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
  g.window = { localStorage: ls };
});

import { useTimerStore, mergeTimerState } from "./timerStore";
import type { VideoSchedule } from "@/lib/videoSchedule";

// « Calé sur la vidéo » : le minuteur piloté par le temps de la vidéo.
const S: VideoSchedule = [
  { start: 0, end: 3000, kind: "work" }, { start: 3000, end: 3600, kind: "break" },
  { start: 3600, end: 6600, kind: "work" }, { start: 6600, end: 7200, kind: "break" },
];
const T0 = new Date("2026-01-01T10:00:00Z").getTime();
const st = () => useTimerStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  st().applyPreset("classic");
  st().resetAll();
  st().start();
});
afterEach(() => vi.useRealTimers());

describe("timerStore piloté par la vidéo", () => {
  it("le mode et les secondes viennent de la vidéo, plus de l'échéance", () => {
    st().startVideoSync("v", S);
    st().syncVideo(1200, T0);
    expect(st()).toMatchObject({ mode: "work", secondsLeft: 1800, cycleSeconds: 1800, endsAt: null, isRunning: true });
    expect(st().videoSyncView).toMatchObject({ block: 1, blocks: 2 });
    // tick ne touche plus à rien
    vi.setSystemTime(T0 + 60_000);
    st().tick();
    expect(st().secondsLeft).toBe(1800);
  });

  it("fin de bloc pris en route : crédit au prorata, pomodoro compté, pause de la vidéo", () => {
    st().startVideoSync("v", S);
    let wall = T0;
    st().syncVideo(1200, wall);
    const events = [];
    for (let t = 1201; t <= 3005; t++) events.push(...st().syncVideo(t, (wall += 1000)));
    expect(events).toEqual([{ type: "work-end", creditSec: 1800 }]);
    expect(st()).toMatchObject({ mode: "short-break", sessionsCompleted: 1, secondsLeft: 595, cycleSeconds: 600 });
  });

  it("pause et reprise : sans échéance tant que c'est calé", () => {
    st().startVideoSync("v", S);
    st().pause();
    expect(st()).toMatchObject({ isRunning: false, endsAt: null });
    st().start();
    expect(st()).toMatchObject({ isRunning: true, endsAt: null });
  });

  it("désactivation : le décompte en cours continue à l'horloge", () => {
    st().startVideoSync("v", S);
    st().syncVideo(2000, T0);
    st().stopVideoSync();
    expect(st()).toMatchObject({ videoSync: null, secondsLeft: 1000, endsAt: T0 + 1000 * 1000 });
    vi.setSystemTime(T0 + 10_000);
    st().tick();
    expect(st().secondsLeft).toBe(990);
  });

  it("rythme épuisé : nouveau cycle normal de travail", () => {
    st().startVideoSync("v", S);
    st().syncVideo(7100, T0);
    st().stopVideoSync(true);
    expect(st()).toMatchObject({ videoSync: null, mode: "work", secondsLeft: 25 * 60 });
  });

  it("incompatible avec Flowtime et l'heure d'arrêt", () => {
    st().applyPreset("flowtime");
    st().startVideoSync("v", S);
    expect(st().videoSync).toBeNull();
  });

  it("trou (intro) : Terminer n'y crédite rien", () => {
    const intro: VideoSchedule = [{ start: 120, end: 3120, kind: "work" }, { start: 3120, end: 3720, kind: "break" }];
    st().startVideoSync("v", intro);
    let wall = T0;
    for (let t = 0; t <= 90; t++) st().syncVideo(t, (wall += 1000));
    // même calcul que handleStop et closeActiveSession
    expect(st().mode).toBe("work");
    expect(st().cycleSeconds - st().secondsLeft).toBe(0);
  });

  it("bascule en cours de cycle normal : rend le travail déjà fait, à créditer", () => {
    vi.setSystemTime(T0 + 10 * 60_000);
    st().tick();
    expect(st().startVideoSync("v", S)).toBe(600);
  });

  it("sortie de /session : crédit une seule fois, puis reprise inerte et sans double crédit", () => {
    st().startVideoSync("v", S);
    let wall = T0;
    for (let t = 1000; t <= 1300; t++) st().syncVideo(t, (wall += 1000));
    expect(st().suspendVideoSync()).toBe(300);
    expect(st().suspendVideoSync()).toBe(0);
    expect(st()).toMatchObject({ videoSync: null, videoSyncActive: { videoId: "v" } });
    expect(st().cycleSeconds - st().secondsLeft).toBe(0);
    // En attente de reprise : l'horloge ne fait pas avancer le minuteur.
    const left = st().secondsLeft;
    vi.setSystemTime(T0 + 5 * 60_000);
    st().tick();
    expect(st().secondsLeft).toBe(left);
    // Reprise du calage sur la même vidéo : rien à créditer.
    expect(st().startVideoSync("v", S)).toBe(0);
  });

  it("rechargement : l'indicateur de calage est persisté et relu", () => {
    st().startVideoSync("v", S);
    const raw = JSON.parse(localStorage.getItem("focusflow-timer")!).state;
    expect(raw.videoSyncActive).toEqual({ videoId: "v", gap: false });
    const merged = mergeTimerState(raw, { ...st(), videoSync: null }, T0);
    expect(merged.videoSyncActive).toEqual({ videoId: "v", gap: false });
    expect(merged.videoSync).toBeNull();
  });

  it("pas de rythme au retour : stopVideoSync efface l'attente et relance le décompte", () => {
    st().startVideoSync("v", S);
    st().syncVideo(2000, T0);
    st().suspendVideoSync();
    st().stopVideoSync();
    expect(st()).toMatchObject({ videoSyncActive: null, secondsLeft: 1000, endsAt: T0 + 1000 * 1000 });
  });

  it("trou puis reprise impossible : jamais de décompte de travail sur l'intro", () => {
    const intro: VideoSchedule = [{ start: 120, end: 3120, kind: "work" }, { start: 3120, end: 3720, kind: "break" }];
    st().startVideoSync("v", intro);
    st().syncVideo(30, T0);
    expect(st().videoSyncActive).toEqual({ videoId: "v", gap: true });
    st().suspendVideoSync();
    st().stopVideoSync();
    expect(st()).toMatchObject({ videoSyncActive: null, mode: "work", secondsLeft: 25 * 60, cycleSeconds: 25 * 60 });
  });
});
