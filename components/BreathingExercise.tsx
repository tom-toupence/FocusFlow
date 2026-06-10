"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

// Box breathing: 4s inhale · 4s hold · 4s exhale · 4s hold.
const PHASES = [
  { key: "inhale",  label: "Inspire",  seconds: 4, scale: 1 },
  { key: "hold1",   label: "Retiens",  seconds: 4, scale: 1 },
  { key: "exhale",  label: "Expire",   seconds: 4, scale: 0.55 },
  { key: "hold2",   label: "Retiens",  seconds: 4, scale: 0.55 },
] as const;

/**
 * Animated guided-breathing bubble shown during breaks. Pure CSS/JS, no assets.
 * `accent` matches the break overlay color (emerald for short, sky for long).
 */
export default function BreathingExercise({ accent = "emerald" }: { accent?: "emerald" | "sky" }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState<number>(PHASES[0].seconds);
  const phaseRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c > 1) return c - 1;
        const next = (phaseRef.current + 1) % PHASES.length;
        phaseRef.current = next;
        setPhaseIndex(next);
        return PHASES[next].seconds;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const phase = PHASES[phaseIndex];
  const ring = accent === "sky" ? "ring-sky-400/40" : "ring-emerald-400/40";
  const glow = accent === "sky"
    ? "bg-[radial-gradient(circle,_rgba(56,189,248,0.35)_0%,_rgba(56,189,248,0.05)_70%)]"
    : "bg-[radial-gradient(circle,_rgba(52,211,153,0.35)_0%,_rgba(52,211,153,0.05)_70%)]";
  const text = accent === "sky" ? "text-sky-300" : "text-emerald-300";

  return (
    <div className="flex flex-col items-center gap-5 z-10">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div
          className={cn("absolute inset-0 rounded-full ring-1", ring, glow)}
          style={{
            transform: `scale(${phase.scale})`,
            transition: `transform ${phase.seconds}s cubic-bezier(0.4, 0, 0.2, 1)`,
          }}
        />
        <div className="relative flex flex-col items-center">
          <span className={cn("text-sm font-semibold uppercase tracking-[0.2em]", text)}>{phase.label}</span>
          <span className="text-3xl font-extralight text-white/80 tabular-nums mt-1">{countdown}</span>
        </div>
      </div>
      <p className="text-white/30 text-xs">Respiration guidée · 4-4-4-4</p>
    </div>
  );
}
