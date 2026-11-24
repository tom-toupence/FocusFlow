import { describe, it, expect } from "vitest";
import { nextCycleSeconds, nextHalfHours, suggestStopAt, formatHM, parseHM, pomodorosLeft } from "./stopPlan";

const MIN = 60_000;
const classic = { workDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 };
const at = (d: number, h: number, m: number) => new Date(2026, 0, d, h, m, 0, 0).getTime();

describe("nextCycleSeconds", () => {
  const now = at(15, 14, 0);
  it("garde 25 min quand le temps ne manque pas", () => {
    expect(nextCycleSeconds({ stopAt: now + 4 * 60 * MIN, now, mode: "work", settings: classic, sessionsCompleted: 0 })).toBe(25 * 60);
  });
  it("étire le dernier pomodoro pour finir pile", () => {
    expect(nextCycleSeconds({ stopAt: now + 35 * MIN, now, mode: "work", settings: classic, sessionsCompleted: 0 })).toBe(35 * 60);
  });
  it("raccourcit le dernier pomodoro sous la durée normale", () => {
    expect(nextCycleSeconds({ stopAt: now + 18 * MIN, now, mode: "work", settings: classic, sessionsCompleted: 0 })).toBe(18 * 60);
  });
  it("raccourcit la longue pause si cela permet un pomodoro de plus", () => {
    const sec = nextCycleSeconds({ stopAt: now + 55 * MIN, now, mode: "long-break", settings: classic, sessionsCompleted: 4 });
    expect(sec).toBe(14 * 60);
  });
  it("garde la longue pause entière quand rien ne presse", () => {
    expect(nextCycleSeconds({ stopAt: now + 5 * 60 * MIN, now, mode: "long-break", settings: classic, sessionsCompleted: 4 })).toBe(15 * 60);
  });
  it("renvoie null quand le plan est épuisé", () => {
    expect(nextCycleSeconds({ stopAt: now, now, mode: "short-break", settings: classic, sessionsCompleted: 1 })).toBeNull();
    expect(nextCycleSeconds({ stopAt: now + 8 * MIN, now, mode: "work", settings: classic, sessionsCompleted: 0 })).toBeNull();
    // Une pause qui ne mène à aucun pomodoro n'a pas de sens.
    expect(nextCycleSeconds({ stopAt: now + 12 * MIN, now, mode: "short-break", settings: classic, sessionsCompleted: 1 })).toBeNull();
  });
});

describe("pomodorosLeft", () => {
  it("compte le cycle en cours", () => {
    const now = at(15, 14, 0);
    expect(pomodorosLeft({ stopAt: now + 65 * MIN, now, mode: "work", secondsLeft: 25 * 60, sessionsCompleted: 0, settings: classic })).toBe(2);
  });
});

describe("heures", () => {
  it("formate et lit HH:MM", () => {
    const now = at(15, 14, 20);
    expect(formatHM(at(15, 18, 5))).toBe("18:05");
    expect(parseHM("18:30", now)).toBe(at(15, 18, 30));
    expect(parseHM("25:00", now)).toBeNull();
    expect(parseHM("abc", now)).toBeNull();
  });
  it("propose les prochaines demi-heures, au moins 30 min devant", () => {
    expect(nextHalfHours(at(15, 14, 20)).map(formatHM)).toEqual(["15:00", "15:30", "16:00", "16:30"]);
    expect(nextHalfHours(at(15, 14, 0)).map(formatHM)).toEqual(["14:30", "15:00", "15:30", "16:00"]);
  });
  it("s'arrête à minuit", () => {
    expect(nextHalfHours(at(15, 22, 40)).map(formatHM)).toEqual(["23:30"]);
  });
});

describe("suggestStopAt", () => {
  const entry = (d: number, h: number, m: number) => {
    const t = at(d, h, m);
    return { timestamp: t, date: `2026-01-${String(d).padStart(2, "0")}` };
  };
  const now = at(15, 12, 0);
  it("médiane des fins de journée, arrondie à 5 min", () => {
    const e = [entry(14, 18, 2), entry(14, 11, 0), entry(13, 18, 40), entry(12, 17, 58)];
    expect(formatHM(suggestStopAt(e, now)!)).toBe("18:00");
  });
  it("rien sous 3 jours d'historique", () => {
    expect(suggestStopAt([entry(14, 18, 0), entry(13, 18, 0)], now)).toBeNull();
  });
  it("rien si l'heure est déjà passée aujourd'hui", () => {
    const e = [entry(14, 9, 0), entry(13, 9, 0), entry(12, 9, 0)];
    expect(suggestStopAt(e, now)).toBeNull();
  });
  it("ignore aujourd'hui et plus de 7 jours", () => {
    const e = [entry(15, 11, 0), entry(14, 18, 0), entry(13, 18, 0), entry(5, 18, 0)];
    expect(suggestStopAt(e, now)).toBeNull();
  });
});
