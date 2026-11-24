import { describe, expect, it } from "vitest";
import {
  fitCurrentCycle,
  goalReachable,
  planUntil,
  type AgendaSettings,
  type FitProposal,
  type FitTooShort,
} from "./agendaFit";

const MIN = 60_000;
const at = (h: number, m = 0) => Date.UTC(2026, 5, 10, h, m);
const classic: AgendaSettings = { work: 25, short: 5, long: 15, sessionsBeforeLongBreak: 4 };

describe("fitCurrentCycle", () => {
  it("renvoie null quand rien ne gêne", () => {
    expect(fitCurrentCycle({ now: at(14, 0), settings: classic })).toBeNull();
    expect(
      fitCurrentCycle({ now: at(14, 0), settings: classic, events: [{ start: at(16), end: at(17) }] }),
    ).toBeNull();
  });

  it("raccourcit avant un événement (marge 5 min)", () => {
    const r = fitCurrentCycle({
      now: at(14, 36),
      settings: classic,
      events: [{ start: at(15), end: at(16), title: "Réunion" }],
    }) as FitProposal;
    expect(r.reason).toBe("event");
    expect(r.seconds).toBe(19 * 60);
    expect(r.endsAt).toBe(at(14, 55));
    expect(r.event?.title).toBe("Réunion");
  });

  it("marge configurable", () => {
    const r = fitCurrentCycle({
      now: at(14, 36),
      settings: classic,
      marginMin: 0,
      events: [{ start: at(15), end: at(16) }],
    }) as FitProposal;
    expect(r.seconds).toBe(24 * 60);
  });

  it("heure d'arrêt dans 7 min : trop court", () => {
    const r = fitCurrentCycle({ now: at(18, 23), settings: classic, stopAt: at(18, 30) }) as FitTooShort;
    expect(r.tooShort).toBe(true);
    expect(r.reason).toBe("stop");
    expect(r.until).toBe(at(18, 30));
  });

  it("heure d'arrêt dans 12 min : petit pomodoro de 12 min (>= 10)", () => {
    const r = fitCurrentCycle({ now: at(18, 18), settings: classic, stopAt: at(18, 30) }) as FitProposal;
    expect(r).toMatchObject({ seconds: 12 * 60, reason: "stop" });
  });

  it("heure d'arrêt avec 20 min : propose 20 min", () => {
    const r = fitCurrentCycle({ now: at(18, 10), settings: classic, stopAt: at(18, 30) }) as FitProposal;
    expect(r).toMatchObject({ seconds: 20 * 60, reason: "stop", endsAt: at(18, 30) });
  });

  it("moins de 10 min avant l'événement : attendre la fin", () => {
    const r = fitCurrentCycle({
      now: at(14, 50),
      settings: classic,
      events: [{ start: at(15), end: at(16) }],
    }) as FitTooShort;
    expect(r.tooShort).toBe(true);
    expect(r.until).toBe(at(16));
    expect(r.reason).toBe("event");
  });

  it("dans un événement : attendre, avec chaînage", () => {
    const r = fitCurrentCycle({
      now: at(15, 10),
      settings: classic,
      events: [
        { start: at(15), end: at(16) },
        { start: at(16), end: at(16, 30) },
      ],
    }) as FitTooShort;
    expect(r.until).toBe(at(16, 30));
  });

  it("retient la contrainte la plus proche (événement avant l'arrêt)", () => {
    const r = fitCurrentCycle({
      now: at(14, 30),
      settings: classic,
      stopAt: at(14, 55),
      events: [{ start: at(14, 50), end: at(15) }],
    }) as FitProposal;
    expect(r.reason).toBe("event");
    expect(r.seconds).toBe(15 * 60);
  });

  it("Flowtime : non applicable", () => {
    expect(
      fitCurrentCycle({ now: at(14), settings: classic, stopAt: at(14, 5), flowtime: true }),
    ).toBeNull();
  });

  it("utilise le temps restant d'un cycle de travail en cours", () => {
    const r = fitCurrentCycle({
      now: at(14, 0),
      settings: classic,
      cycle: { mode: "work", remainingSec: 600, sessionsCompleted: 0 },
      stopAt: at(14, 30),
    });
    expect(r).toBeNull();
  });
});

describe("planUntil", () => {
  const input = { now: at(14, 20), settings: classic };

  it("14:20 -> 18:30 classique : cycles contigus, finit pile", () => {
    const plan = planUntil(at(18, 30), input);
    expect(plan.pomodoros).toBeGreaterThanOrEqual(7);
    expect(plan.pomodoros).toBeLessThanOrEqual(9);
    expect(plan.cycles[0].start).toBe(at(14, 20));
    for (let i = 1; i < plan.cycles.length; i++) expect(plan.cycles[i].start).toBe(plan.cycles[i - 1].end);
    expect(plan.endsAt).toBe(at(18, 30));
    const last = plan.cycles[plan.cycles.length - 1];
    expect(last.mode).toBe("work");
    expect(last.seconds).toBeGreaterThanOrEqual(10 * 60);
    expect(last.seconds).toBeLessThanOrEqual(25 * 60 * 1.5);
  });

  it("longue pause après le 4e pomodoro", () => {
    const plan = planUntil(at(18, 30), input);
    const breaks = plan.cycles.filter((c) => c.mode !== "work");
    expect(breaks[3].mode).toBe("long-break");
    expect(breaks[0].mode).toBe("short-break");
  });

  it("aucun cycle de travail sous 10 min", () => {
    const plan = planUntil(at(18, 30), input);
    for (const c of plan.cycles.filter((c) => c.mode === "work")) expect(c.seconds).toBeGreaterThanOrEqual(600);
  });

  it("événement 15:00-16:00 : aucun cycle de travail ne le chevauche", () => {
    const ev = { start: at(15), end: at(16) };
    const plan = planUntil(at(18, 30), { ...input, events: [ev] });
    for (const c of plan.cycles.filter((c) => c.mode === "work")) {
      expect(c.end <= ev.start - 5 * MIN || c.start >= ev.end).toBe(true);
    }
    // un cycle repart juste après l'événement
    const after = plan.cycles.find((c) => c.start >= ev.end);
    expect(after?.start).toBe(at(16));
    expect(plan.cycles[0].end).toBeLessThanOrEqual(at(14, 55));
  });

  it("stop dans 7 min : plan vide", () => {
    const plan = planUntil(at(14, 27), input);
    expect(plan.cycles).toHaveLength(0);
    expect(plan.pomodoros).toBe(0);
  });

  it("stop dans 30 min : un pomodoro étiré", () => {
    const plan = planUntil(at(14, 50), input);
    expect(plan.pomodoros).toBe(1);
    expect(plan.cycles[0].seconds).toBe(30 * 60);
  });

  it("stop dans 20 min : pomodoro raccourci", () => {
    const plan = planUntil(at(14, 40), input);
    expect(plan.cycles).toHaveLength(1);
    expect(plan.cycles[0].seconds).toBe(20 * 60);
  });

  it("la longue pause est raccourcie pour permettre un pomodoro de plus", () => {
    // 4 pomodoros + 3 pauses = 115 min ; il reste 22 min : longue pause pleine
    // (15) ne laisserait que 7 min, raccourcie à 5 min elle laisse 17 min.
    const s: AgendaSettings = { work: 25, short: 5, long: 15, sessionsBeforeLongBreak: 4 };
    const start = at(9);
    const stop = start + 137 * MIN;
    const plan = planUntil(stop, { now: start, settings: s });
    expect(plan.pomodoros).toBe(5);
    const lb = plan.cycles.find((c) => c.mode === "long-break")!;
    expect(lb.seconds).toBeGreaterThanOrEqual(5 * 60);
    expect(lb.seconds).toBeLessThan(15 * 60);
    expect(plan.endsAt).toBe(stop);
  });

  it("reprend le cycle en cours (pause puis travail)", () => {
    const plan = planUntil(at(16), {
      now: at(14),
      settings: classic,
      cycle: { mode: "short-break", remainingSec: 120, sessionsCompleted: 1 },
    });
    expect(plan.cycles[0]).toMatchObject({ mode: "short-break", seconds: 120 });
    expect(plan.cycles[1].mode).toBe("work");
  });

  it("travail en cours avec temps restant", () => {
    const plan = planUntil(at(15), {
      now: at(14),
      settings: classic,
      cycle: { mode: "work", remainingSec: 600, sessionsCompleted: 0 },
    });
    expect(plan.cycles[0]).toMatchObject({ mode: "work", seconds: 600 });
  });

  it("Flowtime : plan vide", () => {
    expect(planUntil(at(18), { ...input, flowtime: true }).cycles).toEqual([]);
  });

  it("heure d'arrêt passée : plan vide", () => {
    expect(planUntil(at(14), input).cycles).toEqual([]);
  });

  it("preset deep 50/10 : plausible", () => {
    const plan = planUntil(at(18, 30), {
      now: at(14, 20),
      settings: { work: 50, short: 10, long: 30, sessionsBeforeLongBreak: 3 },
    });
    expect(plan.pomodoros).toBeGreaterThanOrEqual(3);
    expect(plan.pomodoros).toBeLessThanOrEqual(5);
    expect(plan.endsAt).toBeLessThanOrEqual(at(18, 30));
  });
});

describe("goalReachable", () => {
  const input = { now: at(14, 20), settings: classic };

  it("atteignable", () => {
    const plan = planUntil(at(18, 30), input);
    expect(goalReachable(plan, 2, { unit: "pomodoros", target: 8 })).toEqual({ reachable: true });
  });

  it("inatteignable : donne l'heure d'arrêt nécessaire", () => {
    const plan = planUntil(at(18, 30), input);
    const r = goalReachable(plan, 2, { unit: "pomodoros", target: 12 });
    expect(r.reachable).toBe(false);
    expect(r.stopAtNeeded).toBeGreaterThan(at(18, 30));
    const check = planUntil(r.stopAtNeeded!, input);
    expect(check.pomodoros + 2).toBeGreaterThanOrEqual(12);
  });

  it("objectif en minutes", () => {
    const plan = planUntil(at(16, 20), input);
    expect(goalReachable(plan, 0, { unit: "minutes", target: 60 }).reachable).toBe(true);
    expect(goalReachable(plan, 0, { unit: "minutes", target: 600 }).reachable).toBe(false);
  });
});
