"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/useReducedMotion";

// Box breathing: 4s inhale · 4s hold · 4s exhale · 4s hold.
const PHASES = [
  { key: "inhale",  label: "Inspire",  seconds: 4, scale: 1 },
  { key: "hold1",   label: "Retiens",  seconds: 4, scale: 1 },
  { key: "exhale",  label: "Expire",   seconds: 4, scale: 0.12 },
  { key: "hold2",   label: "Retiens",  seconds: 4, scale: 0.12 },
] as const;

/**
 * Respiration guidée pendant la halte : un TUBE NÉON vert supérette qui
 * s'allume en s'allongeant à l'inspiration, tient, se rétracte à
 * l'expiration, tient. Pas de bulle : un geste de la ville.
 * Reduced motion : le tube ne bouge pas, seuls le mot et le décompte changent.
 */
export default function BreathingExercise({ className }: { className?: string }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState<number>(PHASES[0].seconds);
  const phaseRef = useRef(0);
  const reduce = useReducedMotion();

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
  const scale = reduce ? 1 : phase.scale;

  return (
    <div className={cn("flex flex-col gap-3 w-full max-w-[18rem]", className)}>
      <div className="flex items-baseline justify-between">
        <span className="font-display font-bold uppercase text-2xl tracking-[0.02em] text-[#53e0a1]" aria-live="polite">{phase.label}</span>
        <span className="font-led text-2xl text-[#e9f2ff]/80" aria-hidden>{countdown}</span>
      </div>
      <div className="relative h-[6px] rounded-[1px] bg-[#e9f2ff]/10">
        <div
          className="absolute inset-y-0 left-0 w-full rounded-[1px] bg-[#53e0a1] origin-left"
          style={{
            transform: `scaleX(${scale})`,
            boxShadow: "0 0 14px rgba(83,224,161,0.6)",
            transition: reduce ? undefined : `transform ${phase.seconds}s cubic-bezier(0.45, 0, 0.55, 1)`,
          }}
        />
      </div>
      <p className="text-[#e9f2ff]/60 text-xs">Respiration guidée, quatre temps de quatre secondes</p>
    </div>
  );
}
