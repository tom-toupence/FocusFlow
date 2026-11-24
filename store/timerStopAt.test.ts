import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// localStorage factice, posé avant la création du store (sinon persist est inactif).
vi.hoisted(() => {
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

import { useTimerStore, mergeTimerState, migrateTimerState, PRESETS } from "./timerStore";
import { useStatsStore, getTodayStats } from "./statsStore";
import { closeActiveSession } from "@/lib/sessionEnd";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();
const min = (n: number) => n * 60_000;
const st = () => useTimerStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  st().applyPreset("classic");
  st().resetAll();
  useStatsStore.setState({ days: {} });
});
afterEach(() => vi.useRealTimers());

describe("heure d'arrêt : durée des cycles", () => {
  it("un cycle neuf garde 25 min tant que le plan le permet", () => {
    st().setStopAt(T0 + min(120));
    st().start();
    expect(st().secondsLeft).toBe(25 * 60);
    expect(st().cycleSeconds).toBe(25 * 60);
    expect(st().endsAt).toBe(T0 + min(25));
  });

  it("étire le dernier pomodoro pour finir pile à l'heure d'arrêt", () => {
    st().setStopAt(T0 + min(65));
    st().start();
    expect(st().cycleSeconds).toBe(25 * 60);
    vi.setSystemTime(T0 + min(25));
    st().nextSession(true);
    expect(st().mode).toBe("short-break");
    expect(st().secondsLeft).toBe(5 * 60);
    vi.setSystemTime(T0 + min(30));
    st().nextSession(true);
    expect(st().mode).toBe("work");
    expect(st().secondsLeft).toBe(35 * 60);
    expect(st().cycleSeconds).toBe(35 * 60);
    expect(st().endsAt).toBe(T0 + min(65));
  });

  it("raccourcit le premier pomodoro quand l'heure est proche", () => {
    st().setStopAt(T0 + min(18));
    st().start();
    expect(st().secondsLeft).toBe(18 * 60);
    expect(st().cycleSeconds).toBe(18 * 60);
  });

  it("nextSession sans autoStart prépare quand même la durée du plan", () => {
    st().setStopAt(T0 + min(65));
    st().start();
    vi.setSystemTime(T0 + min(25));
    st().nextSession(false);
    vi.setSystemTime(T0 + min(30));
    st().nextSession(false);
    expect(st().secondsLeft).toBe(35 * 60);
    expect(st().isRunning).toBe(false);
  });

  it("plan épuisé après le dernier pomodoro : attente, sans enchaîner", () => {
    st().setStopAt(T0 + min(30));
    st().start();
    expect(st().cycleSeconds).toBe(30 * 60);
    vi.setSystemTime(T0 + min(30));
    st().nextSession(true);
    const s = st();
    expect(s.stopReached).toBe(true);
    expect(s.isRunning).toBe(false);
    expect(s.endsAt).toBeNull();
    expect(s.sessionsCompleted).toBe(1);
    st().start(); // sans effet
    expect(st().isRunning).toBe(false);
  });

  it("démarrer quand l'heure est déjà (presque) là : heure d'arrêt atteinte", () => {
    st().setStopAt(T0 + min(6));
    st().start();
    expect(st().stopReached).toBe(true);
    expect(st().isRunning).toBe(false);
  });

  it("encore un pomodoro : efface l'heure et lance un cycle normal", () => {
    st().setStopAt(T0 + min(30));
    st().start();
    vi.setSystemTime(T0 + min(30));
    st().nextSession(true);
    st().continueAfterStop();
    const s = st();
    expect(s.stopAt).toBeNull();
    expect(s.stopReached).toBe(false);
    expect(s.isRunning).toBe(true);
    expect(s.cycleSeconds).toBe(25 * 60);
    expect(s.endsAt).toBe(T0 + min(30) + min(25));
  });

  it("reprise après pause : la durée restante n'est pas replanifiée", () => {
    st().setStopAt(T0 + min(65));
    st().start();
    vi.setSystemTime(T0 + min(10));
    st().pause();
    vi.setSystemTime(T0 + min(20));
    st().start();
    expect(st().secondsLeft).toBe(15 * 60);
    expect(st().cycleSeconds).toBe(25 * 60);
    expect(st().endsAt).toBe(T0 + min(20) + min(15));
  });

  it("Flowtime ignore l'heure d'arrêt", () => {
    st().applyPreset("flowtime");
    st().setStopAt(T0 + min(30));
    st().start();
    vi.setSystemTime(T0 + min(10));
    st().tick();
    expect(st().flowSeconds).toBe(600);
    expect(st().stopReached).toBe(false);
  });

  it("sans heure d'arrêt, comportement inchangé", () => {
    st().start();
    expect(st().secondsLeft).toBe(25 * 60);
    vi.setSystemTime(T0 + min(25));
    st().nextSession(true);
    expect(st().secondsLeft).toBe(5 * 60);
    expect(st().cycleSeconds).toBe(5 * 60);
  });

  it("resetAll et endSession remettent l'heure d'arrêt à null", () => {
    st().setStopAt(T0 + min(60));
    st().resetAll();
    expect(st().stopAt).toBeNull();
    st().setStopAt(T0 + min(60));
    st().endSession();
    expect(st().stopAt).toBeNull();
    expect(st().stopReached).toBe(false);
  });
});

describe("crédit de la durée réelle", () => {
  it("cycleSeconds porte la durée du plan, pas workDuration", () => {
    st().setStopAt(T0 + min(35));
    st().start();
    expect(st().settings.workDuration).toBe(25);
    expect(st().cycleSeconds).toBe(35 * 60);
  });

  it("fermer une session en cours crédite les minutes réellement écoulées du cycle", () => {
    st().setStopAt(T0 + min(35));
    st().start();
    vi.setSystemTime(T0 + min(20));
    closeActiveSession();
    expect(getTodayStats(useStatsStore.getState().days).minutesWorked).toBe(20);
  });
});

describe("persistance de l'heure d'arrêt", () => {
  it("migre un état v1 sans heure d'arrêt", () => {
    const settings = { preset: "classic" as const, ...PRESETS.classic };
    const merged = mergeTimerState(migrateTimerState({ settings, mode: "short-break", secondsLeft: 200 }, 1), st(), T0);
    expect(merged.stopAt).toBeNull();
    expect(merged.stopReached).toBe(false);
    expect(merged.cycleSeconds).toBe(5 * 60);
  });

  it("relit stopAt, cycleSeconds et stopReached", () => {
    const settings = { preset: "classic" as const, ...PRESETS.classic };
    const merged = mergeTimerState(
      { settings, mode: "work", secondsLeft: 1000, endsAt: null, isRunning: false, active: true, updatedAt: T0, stopAt: T0 + min(90), cycleSeconds: 2100, stopReached: false },
      st(),
      T0 + min(1),
    );
    expect(merged.stopAt).toBe(T0 + min(90));
    expect(merged.cycleSeconds).toBe(2100);
  });
});
