"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
// easeOutBack : léger overshoot élastique (pour l'anneau d'objectif).
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Anime une valeur numérique vers `target` (count-up rAF, ease-out).
 * Reduced-motion : renvoie directement la valeur finale.
 * À utiliser après le pattern `mounted` (les valeurs viennent de stores persistés).
 */
export function useCountUp(target: number, duration = 800, overshoot = false): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    if (reduced) {
      currentRef.current = target;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      return;
    }
    const from = currentRef.current;
    if (from === target) return;
    const ease = overshoot ? easeOutBack : easeOutCubic;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = from + (target - from) * ease(t);
      currentRef.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
      else currentRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, overshoot, reduced]);

  return value;
}
