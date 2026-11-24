import { describe, expect, it } from "vitest";
import { nextWorkStart, parseChaptersFromDescription, scheduleFromChapters, segmentAt } from "./videoSchedule";

const SWM_50_10 = `Study with me in Tokyo, 3 hours, 50/10 pomodoro, rain sounds

Chapters:
0:00 Intro
0:30 Focus 1
50:30 Break
1:00:30 Focus 2
1:50:30 Break
2:00:30 Focus 3
2:50:30 Outro

Follow me on Instagram: https://instagram.com/x
Music: 10:00 is not a chapter here`;

const SWM_25_5 = `⏱ 25/5 Pomodoro
00:00 Pomodoro 1
25:00 Pause
30:00 Pomodoro 2
55:00 Pause
1:00:00 Pomodoro 3
1:25:00 Repos
1:30:00 Pomodoro 4
1:55:00 Pause longue
2:10:00 Fin`;

describe("parseChaptersFromDescription", () => {
  it("lignes début de ligne, H:MM:SS, tri", () => {
    const c = parseChaptersFromDescription(SWM_50_10);
    expect(c.map((x) => x.startSec)).toEqual([0, 30, 3030, 3630, 6630, 7230, 10230]);
    expect(c[0]).toEqual({ startSec: 0, title: "Intro" });
    expect(c[3]).toEqual({ startSec: 3630, title: "Focus 2" });
  });

  it("formats variés", () => {
    const c = parseChaptersFromDescription("[0:00] - Focus\n- 25:00 : Break\n(50:00) Focus\nBreak - 1:15:00\nrien ici\n");
    expect(c).toEqual([
      { startSec: 0, title: "Focus" },
      { startSec: 1500, title: "Break" },
      { startSec: 3000, title: "Focus" },
      { startSec: 4500, title: "Break" },
    ]);
  });

  it("rejette les horodatages invalides et les doublons", () => {
    expect(parseChaptersFromDescription("0:99 Mauvais\n0:00 A\n0:00 B")).toEqual([{ startSec: 0, title: "A" }]);
    expect(parseChaptersFromDescription("")).toEqual([]);
  });
});

describe("scheduleFromChapters", () => {
  it("50/10 : intro ignorée (trou), outro coupe la fin", () => {
    const chapters = parseChaptersFromDescription(SWM_50_10).filter((c) => c.startSec <= 10230);
    const s = scheduleFromChapters(chapters, 3 * 3600)!;
    expect(s.map((x) => x.kind)).toEqual(["work", "break", "work", "break", "work"]);
    expect(s[0]).toMatchObject({ start: 30, end: 3030 });
    expect(s[4].end).toBe(10230);
    expect(segmentAt(s, 10)).toBeNull(); // intro
    expect(segmentAt(s, 10300)).toBeNull(); // outro
  });

  it("25/5 avec « Pause longue » et « Fin »", () => {
    const s = scheduleFromChapters(parseChaptersFromDescription(SWM_25_5), 2 * 3600 + 15 * 60)!;
    expect(s).toHaveLength(8);
    expect(s.filter((x) => x.kind === "work")).toHaveLength(4);
    expect(s[0]).toMatchObject({ start: 0, end: 1500, kind: "work" });
    expect(s[7]).toMatchObject({ start: 6900, end: 7800, kind: "break" });
  });

  it("titre inconnu rattaché au segment précédent", () => {
    const s = scheduleFromChapters(
      [
        { startSec: 0, title: "Focus" },
        { startSec: 600, title: "Tokyo rain" },
        { startSec: 1500, title: "Break" },
      ],
      1800,
    )!;
    expect(s[0]).toMatchObject({ kind: "work", start: 0, end: 1500 });
  });

  it("null sans travail ET pause", () => {
    expect(scheduleFromChapters([{ startSec: 0, title: "Focus" }], 1000)).toBeNull();
    expect(scheduleFromChapters([{ startSec: 0, title: "Break" }], 1000)).toBeNull();
    expect(
      scheduleFromChapters([{ startSec: 0, title: "Chill" }, { startSec: 60, title: "Jazz" }], 1000),
    ).toBeNull();
    expect(scheduleFromChapters([], 1000)).toBeNull();
    expect(scheduleFromChapters([{ startSec: 0, title: "Focus" }, { startSec: 5, title: "Break" }], 0)).toBeNull();
  });
});

describe("segmentAt / nextWorkStart", () => {
  const s = scheduleFromChapters(parseChaptersFromDescription(SWM_25_5), 2 * 3600 + 15 * 60)!;

  it("segment courant et secondes restantes", () => {
    expect(segmentAt(s, 0)).toMatchObject({ index: 0, remainingSec: 1500 });
    expect(segmentAt(s, 1499)).toMatchObject({ index: 0, remainingSec: 1 });
    const b = segmentAt(s, 1500)!;
    expect(b.segment.kind).toBe("break");
    expect(b.remainingSec).toBe(300);
    expect(segmentAt(s, 7800)).toBeNull();
    expect(segmentAt(s, -5)).toBeNull();
  });

  it("prochain début de travail", () => {
    expect(nextWorkStart(s, 100)).toBe(1800);
    expect(nextWorkStart(s, 1600)).toBe(1800);
    expect(nextWorkStart(s, 1800)).toBe(3600);
    expect(nextWorkStart(s, 5500)).toBeNull();
  });
});
