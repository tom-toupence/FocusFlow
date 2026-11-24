import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// localStorage factice, posé avant la création du store (sinon persist est inactif).
const memory = vi.hoisted(() => {
  const data = new Map<string, string>();
  const ls = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g.localStorage = ls;
  g.window = { localStorage: ls }; // zustand lit window.localStorage
  return data;
});

import {
  useTimerStore,
  PRESETS,
  migrateTimerState,
  mergeTimerState,
} from "./timerStore";
import { STALE_SESSION_MS, formatClock } from "@/lib/timerClock";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();
const min = (n: number) => n * 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  const s = useTimerStore.getState();
  s.applyPreset("classic");
  s.resetAll();
});
afterEach(() => vi.useRealTimers());

describe("minuteur sur échéance", () => {
  it("start pose une échéance et active la session", () => {
    useTimerStore.getState().start();
    const s = useTimerStore.getState();
    expect(s.isRunning).toBe(true);
    expect(s.active).toBe(true);
    expect(s.endsAt).toBe(T0 + min(25));
  });

  it("décompte correct après 10 min sans aucun tick", () => {
    useTimerStore.getState().start();
    vi.setSystemTime(T0 + min(10));
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().secondsLeft).toBe(15 * 60);
  });

  it("ne descend pas sous 0 quand l'échéance est dépassée", () => {
    useTimerStore.getState().start();
    vi.setSystemTime(T0 + min(40));
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().secondsLeft).toBe(0);
  });

  it("pause fige le restant, reprise repart de là", () => {
    const st = useTimerStore.getState();
    st.start();
    vi.setSystemTime(T0 + min(5));
    st.pause();
    expect(useTimerStore.getState().secondsLeft).toBe(20 * 60);
    expect(useTimerStore.getState().endsAt).toBeNull();
    vi.setSystemTime(T0 + min(60)); // longue pause : rien ne bouge
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().secondsLeft).toBe(20 * 60);
    st.start();
    expect(useTimerStore.getState().endsAt).toBe(T0 + min(60) + min(20));
  });

  it("start est idempotent quand déjà en marche", () => {
    const st = useTimerStore.getState();
    st.start();
    vi.setSystemTime(T0 + min(1));
    st.start();
    expect(useTimerStore.getState().endsAt).toBe(T0 + min(25));
  });

  it("nextSession(true) démarre le cycle suivant depuis maintenant", () => {
    vi.setSystemTime(T0 + min(25));
    useTimerStore.getState().nextSession(true);
    const s = useTimerStore.getState();
    expect(s.mode).toBe("short-break");
    expect(s.endsAt).toBe(T0 + min(25) + min(5));
    useTimerStore.getState().nextSession(false);
    expect(useTimerStore.getState().endsAt).toBeNull();
    expect(useTimerStore.getState().isRunning).toBe(false);
  });

  it("resetAll efface l'échéance et désactive la session", () => {
    useTimerStore.getState().start();
    useTimerStore.getState().resetAll();
    const s = useTimerStore.getState();
    expect(s.active).toBe(false);
    expect(s.endsAt).toBeNull();
    expect(s.isRunning).toBe(false);
    expect(s.secondsLeft).toBe(25 * 60);
  });
});

describe("flowtime", () => {
  beforeEach(() => useTimerStore.getState().applyPreset("flowtime"));

  it("accumule depuis l'horloge, sans tick intermédiaire", () => {
    useTimerStore.getState().start();
    vi.setSystemTime(T0 + min(10));
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().flowSeconds).toBe(600);
  });

  it("pause puis reprise conserve le temps accumulé", () => {
    const st = useTimerStore.getState();
    st.start();
    vi.setSystemTime(T0 + min(10));
    st.pause();
    expect(useTimerStore.getState().flowSeconds).toBe(600);
    vi.setSystemTime(T0 + min(30));
    st.start();
    vi.setSystemTime(T0 + min(35));
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().flowSeconds).toBe(900);
  });

  it("finishFlow crédite le temps réel et lance la pause méritée", () => {
    useTimerStore.getState().start();
    vi.setSystemTime(T0 + min(50));
    useTimerStore.getState().finishFlow();
    const s = useTimerStore.getState();
    expect(s.flowMinutesTotal).toBe(50);
    expect(s.mode).toBe("short-break");
    expect(s.secondsLeft).toBe(10 * 60);
    expect(s.endsAt).toBe(T0 + min(50) + min(10));
  });

  it("accumulateFlow renvoie les minutes réelles", () => {
    useTimerStore.getState().start();
    vi.setSystemTime(T0 + min(20));
    expect(useTimerStore.getState().accumulateFlow()).toBe(20);
    expect(useTimerStore.getState().flowSeconds).toBe(0);
  });
});

describe("persistance", () => {
  const base = () => useTimerStore.getState();

  it("migre l'ancien état (settings seul) sans perdre les réglages", () => {
    const settings = { preset: "deep" as const, ...PRESETS.deep };
    const migrated = migrateTimerState({ settings }, 0);
    expect(migrated).toEqual({ settings });
    const merged = mergeTimerState(migrated, base(), T0);
    expect(merged.settings.preset).toBe("deep");
    expect(merged.active).toBe(false);
    expect(merged.endsAt).toBeNull();
    expect(merged.mode).toBe("work");
  });

  it("rattrape l'horloge d'une session en marche au rechargement", () => {
    const persisted = {
      settings: base().settings, mode: "work", secondsLeft: 1500, endsAt: T0 + min(25),
      isRunning: true, active: true, updatedAt: T0,
    };
    const merged = mergeTimerState(persisted, base(), T0 + min(10));
    expect(merged.active).toBe(true);
    expect(merged.secondsLeft).toBe(15 * 60);
  });

  it("garde une session en pause telle quelle", () => {
    const persisted = {
      settings: base().settings, mode: "work", secondsLeft: 700, endsAt: null,
      isRunning: false, active: true, updatedAt: T0,
    };
    const merged = mergeTimerState(persisted, base(), T0 + min(60));
    expect(merged.active).toBe(true);
    expect(merged.secondsLeft).toBe(700);
  });

  it("abandonne une session dont l'échéance date de plus de 12 h", () => {
    const persisted = {
      settings: base().settings, mode: "short-break", secondsLeft: 300, endsAt: T0 + min(5),
      isRunning: true, active: true, sessionsCompleted: 3, updatedAt: T0,
    };
    const merged = mergeTimerState(persisted, base(), T0 + min(5) + STALE_SESSION_MS + 1000);
    expect(merged.active).toBe(false);
    expect(merged.isRunning).toBe(false);
    expect(merged.mode).toBe("work");
    expect(merged.sessionsCompleted).toBe(0);
  });

  it("abandonne une pause vieille de plus de 12 h", () => {
    const persisted = {
      settings: base().settings, mode: "work", secondsLeft: 700, endsAt: null,
      isRunning: false, active: true, updatedAt: T0,
    };
    const merged = mergeTimerState(persisted, base(), T0 + STALE_SESSION_MS + 1000);
    expect(merged.active).toBe(false);
  });
});

describe("formatClock", () => {
  it("formate mm:ss et h:mm:ss", () => {
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("endSession", () => {
  it("désactive la session mais garde les compteurs pour le résumé", () => {
    const st = useTimerStore.getState();
    st.start();
    vi.setSystemTime(T0 + min(25));
    useTimerStore.getState().nextSession(true);
    useTimerStore.getState().endSession();
    const s = useTimerStore.getState();
    expect(s.active).toBe(false);
    expect(s.isRunning).toBe(false);
    expect(s.endsAt).toBeNull();
    expect(s.flowStartedAt).toBeNull();
    expect(s.updatedAt).toBeNull();
    expect(s.sessionsCompleted).toBe(1);
  });

  it("garde flowMinutesTotal en flowtime", () => {
    useTimerStore.getState().applyPreset("flowtime");
    useTimerStore.getState().start();
    vi.setSystemTime(T0 + min(30));
    useTimerStore.getState().pause();
    useTimerStore.getState().accumulateFlow();
    useTimerStore.getState().endSession();
    expect(useTimerStore.getState().flowMinutesTotal).toBe(30);
    expect(useTimerStore.getState().active).toBe(false);
  });
});

describe("réhydratation", () => {
  it("relit une session en cours, rattrape l'horloge et passe hydrated à true", async () => {
    const settings = { preset: "classic", ...PRESETS.classic };
    useTimerStore.setState({ hydrated: false }); // avant : setState réécrit le stockage
    memory.set("focusflow-timer", JSON.stringify({
      version: 1,
      state: { settings, mode: "work", secondsLeft: 1500, endsAt: T0 + min(25), isRunning: true, active: true, sessionsCompleted: 2, updatedAt: T0 },
    }));
    vi.setSystemTime(T0 + min(10));
    await useTimerStore.persist.rehydrate();
    const s = useTimerStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.active).toBe(true);
    expect(s.secondsLeft).toBe(15 * 60);
    expect(s.sessionsCompleted).toBe(2);
  });

  it("relit un ancien état (settings seul, version 0)", async () => {
    const settings = { preset: "deep", ...PRESETS.deep };
    useTimerStore.setState({ hydrated: false });
    memory.set("focusflow-timer", JSON.stringify({ version: 0, state: { settings } }));
    await useTimerStore.persist.rehydrate();
    const s = useTimerStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.settings.preset).toBe("deep");
    expect(s.active).toBe(false);
  });
});
