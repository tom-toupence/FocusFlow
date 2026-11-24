import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { scheduleFromWatchData, scheduleFromWatchHtml, chaptersFromInitialData, lengthFrom } from "./ytSchedule";
import { scheduleFromChapters } from "./videoSchedule";

// Fixtures : structure ytInitialData / ytInitialPlayerResponse tronquée, telle
// que la sert la page watch (aucun réseau dans les tests).
const fx = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "__fixtures__", name), "utf8")) as { initialData: unknown; playerResponse: unknown };

/** Page watch minimale : les deux objets affectés dans des <script>, comme chez YouTube. */
const page = (f: { initialData: unknown; playerResponse: unknown }) =>
  `<html><script>var ytInitialPlayerResponse = ${JSON.stringify(f.playerResponse)};var meta = {};</script>` +
  `<script>var ytInitialData = ${JSON.stringify(f.initialData)};</script></html>`;

describe("ytSchedule : chapitres de la page watch", () => {
  it("chapitres de la barre de lecture (chapterRenderer), prioritaires sur la description", () => {
    const r = scheduleFromWatchData(fx("yt-watch-chapters.json").initialData, fx("yt-watch-chapters.json").playerResponse);
    expect(r.source).toBe("chapters");
    expect(r.durationSec).toBe(11040);
    expect(r.chapters.map((c) => c.startSec)).toEqual([0, 120, 3120, 3720, 6720, 7320, 10320, 10920]);
    expect(r.chapters[1].title).toBe("Focus 1");
    const s = scheduleFromChapters(r.chapters, r.durationSec)!;
    expect(s.map((x) => [x.start, x.end, x.kind])).toEqual([
      [120, 3120, "work"], [3120, 3720, "break"], [3720, 6720, "work"],
      [6720, 7320, "break"], [7320, 10320, "work"], [10320, 10920, "break"],
    ]);
  });

  it("panneau des chapitres (macroMarkersListItemRenderer) : startTimeSeconds, sinon timeDescription", () => {
    const f = fx("yt-watch-macro.json");
    const chapters = chaptersFromInitialData(f.initialData);
    expect(chapters.map((c) => [c.startSec, c.title])).toEqual([
      [0, "Pomodoro 1"], [1500, "Short break"], [1800, "Pomodoro 2"], [3300, "Short break"], [3600, "Pomodoro 3"],
    ]);
    expect(lengthFrom(f.playerResponse)).toBe(5400);
  });

  it("sans chapitres structurés : horodatages de la description (attributedDescription)", () => {
    const f = fx("yt-watch-description.json");
    const r = scheduleFromWatchData(f.initialData, f.playerResponse);
    expect(r.source).toBe("description");
    expect(r.chapters.map((c) => c.startSec)).toEqual([0, 3000, 3600, 6600]);
    const s = scheduleFromChapters(r.chapters, r.durationSec)!;
    expect(s.filter((x) => x.kind === "work")).toHaveLength(2);
  });

  it("tracklist d'un mix (shortDescription) : chapitres lus, mais aucun rythme", () => {
    const f = fx("yt-watch-tracklist.json");
    const r = scheduleFromWatchData(f.initialData, f.playerResponse);
    expect(r.chapters).toHaveLength(3);
    expect(scheduleFromChapters(r.chapters, r.durationSec)).toBeNull();
  });

  it("depuis le HTML : extrait ytInitialData et ytInitialPlayerResponse", () => {
    const r = scheduleFromWatchHtml(page(fx("yt-watch-chapters.json")));
    expect(r.durationSec).toBe(11040);
    expect(r.chapters).toHaveLength(8);
  });

  it("page illisible : rien, sans exception", () => {
    expect(scheduleFromWatchHtml("<html>consent</html>")).toEqual({ chapters: [], durationSec: 0, source: "none" });
  });
});
