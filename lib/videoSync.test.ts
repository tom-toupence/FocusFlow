import { describe, it, expect } from "vitest";
import { stepVideoSync, freshCursor, arrivalChoice, type VideoSyncState } from "./videoSync";
import { scheduleFromChapters, type VideoSchedule } from "./videoSchedule";

// Rythme 50/10 × 3 (vidéo de 3 h).
const S: VideoSchedule = scheduleFromChapters(
  [
    { startSec: 0, title: "Focus 1" }, { startSec: 3000, title: "Break" },
    { startSec: 3600, title: "Focus 2" }, { startSec: 6600, title: "Break" },
    { startSec: 7200, title: "Focus 3" }, { startSec: 10200, title: "Break" },
  ],
  10800,
)!;

/** Pilote la vidéo pas à pas : `play(dt)` = lecture réelle, `seek(t)` = saut. */
function pilot(startT: number, schedule = S) {
  let state: VideoSyncState = { videoId: "v", schedule, cursor: freshCursor() };
  let t = startT;
  let wall = 1_000_000;
  const events: ReturnType<typeof stepVideoSync>["events"] = [];
  const apply = () => {
    const r = stepVideoSync(state, t, wall);
    state = { ...state, cursor: r.cursor };
    events.push(...r.events);
    return r;
  };
  let last = apply();
  return {
    get view() { return last.view; },
    events,
    /** Lecture normale, par pas d'une seconde. */
    play(sec: number) { for (let i = 0; i < sec; i++) { t += 1; wall += 1000; last = apply(); } return last; },
    seek(to: number) { t = to; wall += 1000; last = apply(); return last; },
    /** Onglet en arrière-plan : un seul pas long (minuteurs bridés), mais joué. */
    playThrottled(sec: number) { t += sec; wall += sec * 1000; last = apply(); return last; },
    /** Vidéo en pause : le temps passe, la vidéo non. */
    idle(sec: number) { wall += sec * 1000; last = apply(); return last; },
  };
}

describe("videoSync : segment courant", () => {
  it("début de vidéo : bloc 1 / 3, 50 min de travail", () => {
    const p = pilot(0);
    expect(p.view).toMatchObject({ phase: "work", mode: "work", secondsLeft: 3000, block: 1, blocks: 3 });
  });

  it("en pause : pause courte, la durée est celle de la vidéo", () => {
    const p = pilot(3200);
    expect(p.view).toMatchObject({ phase: "break", mode: "short-break", secondsLeft: 400, cycleSeconds: 600, block: 2 });
  });

  it("arrivée en plein bloc : le reste du bloc, crédit au prorata (0 joué au départ)", () => {
    const p = pilot(1200);
    expect(p.view).toMatchObject({ secondsLeft: 1800, cycleSeconds: 1800 });
    p.play(60);
    expect(p.view).toMatchObject({ secondsLeft: 1740, cycleSeconds: 1800 });
  });
});

describe("videoSync : transitions", () => {
  it("fin naturelle d'un bloc : work-end avec les secondes réellement jouées, puis pause", () => {
    const p = pilot(1200);
    p.play(1805);
    expect(p.events).toEqual([{ type: "work-end", creditSec: 1800 }]);
    expect(p.view).toMatchObject({ phase: "break", secondsLeft: 595 });
  });

  it("fin de pause : retour au travail, bloc 2, rien à créditer", () => {
    const p = pilot(3590);
    p.play(15);
    expect(p.events).toEqual([]);
    expect(p.view).toMatchObject({ phase: "work", block: 2, secondsLeft: 2995, cycleSeconds: 3000 });
  });

  it("onglet en arrière-plan : un pas long reste de la lecture (crédit complet)", () => {
    const p = pilot(0);
    p.playThrottled(2990);
    p.playThrottled(20);
    expect(p.events).toEqual([{ type: "work-end", creditSec: 3000 }]);
  });

  it("vidéo en pause : aucun crédit, le minuteur reste figé", () => {
    const p = pilot(100);
    p.idle(600);
    expect(p.view).toMatchObject({ secondsLeft: 2900, cycleSeconds: 2900 });
  });

  it("rythme épuisé : dernière pause finie, exhausted", () => {
    const p = pilot(10790);
    p.play(11);
    expect(p.events).toEqual([{ type: "exhausted" }]);
    expect(p.view).toBeNull();
  });

  it("vidéo bouclée par le lecteur au bout d'un bloc de travail final : crédit puis exhausted", () => {
    const sched: VideoSchedule = [{ start: 0, end: 600, kind: "break" }, { start: 600, end: 3600, kind: "work" }];
    const p = pilot(3590, sched);
    p.play(9);
    p.seek(0.5); // le lecteur repart au début (loop), une seconde après
    expect(p.events).toEqual([{ type: "work-end", creditSec: 10 }, { type: "exhausted" }]);
  });
});

describe("videoSync : seek manuel", () => {
  it("saut en avant dans le bloc : le minuteur se recale, pas de travail fantôme", () => {
    const p = pilot(0);
    p.play(120);
    p.seek(2000);
    expect(p.view).toMatchObject({ secondsLeft: 1000, cycleSeconds: 1120 });
    p.play(1001);
    expect(p.events).toEqual([{ type: "work-end", creditSec: 1120 }]);
  });

  it("saut vers le bloc suivant : partiel crédité (réel), pas de fin de bloc", () => {
    const p = pilot(1200);
    p.play(300);
    p.seek(3600);
    expect(p.events).toEqual([{ type: "work-partial", creditSec: 300 }]);
    expect(p.view).toMatchObject({ phase: "work", block: 2, cycleSeconds: 3000 });
  });

  it("retour en arrière depuis la pause : on revient au travail sans crédit", () => {
    const p = pilot(3100);
    p.seek(2900);
    expect(p.events).toEqual([]);
    expect(p.view).toMatchObject({ phase: "work", block: 1, secondsLeft: 100, cycleSeconds: 100 });
  });
});

describe("videoSync : arrivée en plein bloc", () => {
  it("plus de 50 % du bloc : prendre en route", () => {
    expect(arrivalChoice(S, 1200)).toMatchObject({ preferNext: false });
  });
  it("moins de 50 % : début du bloc suivant mis en avant", () => {
    expect(arrivalChoice(S, 2500)).toMatchObject({ preferNext: true });
  });
  it("début de bloc ou pause : rien à demander", () => {
    expect(arrivalChoice(S, 10)).toBeNull();
    expect(arrivalChoice(S, 3200)).toBeNull();
  });
});
