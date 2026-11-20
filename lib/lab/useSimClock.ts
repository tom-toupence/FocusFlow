"use client";

// Horloge de session SIMULÉE pour le lab : un pomodoro de 25 min joué en
// 25 s (×60), puis une pause de 5 min en 5 s, en boucle. Expose aussi des
// événements ponctuels (fin de pomodoro, distraction, piste suivante) pour que
// chaque prototype montre les mêmes moments du produit.
import { useCallback, useEffect, useRef, useState } from "react";

export type SimPhase = "idle" | "work" | "break";
export type SimEvent = "start" | "pomodoroEnd" | "breakEnd" | "distraction" | "track";

export interface SimClock {
  phase: SimPhase;
  /** Secondes simulées écoulées dans la phase. */
  elapsed: number;
  /** 0..1 dans la phase. */
  progress: number;
  /** Secondes simulées restantes. */
  remaining: number;
  pomodoros: number;
  start: () => void;
  distraction: () => void;
  track: () => void;
  skip: () => void;
  on: (cb: (e: SimEvent) => void) => () => void;
}

const WORK = 25 * 60;
const BREAK = 5 * 60;

export function useSimClock(speed = 60, autostart = true): SimClock {
  const [phase, setPhase] = useState<SimPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [pomodoros, setPomodoros] = useState(0);
  const subs = useRef(new Set<(e: SimEvent) => void>());
  const emit = useCallback((e: SimEvent) => subs.current.forEach((cb) => cb(e)), []);
  const state = useRef({ phase: "idle" as SimPhase, elapsed: 0 });

  const start = useCallback(() => {
    state.current = { phase: "work", elapsed: 0 };
    setPhase("work"); setElapsed(0);
    emit("start");
  }, [emit]);

  const skip = useCallback(() => {
    const s = state.current;
    if (s.phase === "work") { s.phase = "break"; s.elapsed = 0; setPomodoros((n) => n + 1); emit("pomodoroEnd"); }
    else { s.phase = "work"; s.elapsed = 0; emit("breakEnd"); }
    setPhase(s.phase); setElapsed(0);
  }, [emit]);

  useEffect(() => {
    if (!autostart) return;
    const t = setTimeout(start, 400);
    return () => clearTimeout(t);
  }, [autostart, start]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speed;
      last = now;
      const s = state.current;
      if (s.phase !== "idle") {
        s.elapsed += dt;
        const total = s.phase === "work" ? WORK : BREAK;
        if (s.elapsed >= total) {
          if (s.phase === "work") { s.phase = "break"; setPomodoros((n) => n + 1); emit("pomodoroEnd"); }
          else { s.phase = "work"; emit("breakEnd"); }
          s.elapsed = 0;
          setPhase(s.phase);
        }
        setElapsed(s.elapsed);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed, emit]);

  const total = phase === "break" ? BREAK : WORK;
  return {
    phase,
    elapsed,
    progress: phase === "idle" ? 0 : Math.min(1, elapsed / total),
    remaining: Math.max(0, total - elapsed),
    pomodoros,
    start,
    skip,
    distraction: () => emit("distraction"),
    track: () => emit("track"),
    on: (cb) => { subs.current.add(cb); return () => { subs.current.delete(cb); }; },
  };
}

export function clock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
