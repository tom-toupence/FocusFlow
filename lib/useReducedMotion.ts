"use client";

import { useEffect, useState } from "react";

/**
 * True si l'utilisateur préfère les animations réduites.
 * Pour les animations pilotées en JS (count-up, expand, FLIP…) : sauter à
 * l'état final quand ce hook renvoie true. Les animations CSS passent, elles,
 * par les classes .anim-* (neutralisées dans globals.css) ou motion-safe:.
 */
export function useReducedMotion(): boolean {
  // Initialisé à false (et non via matchMedia synchrone) : le SSR rend "false",
  // un init client différent casserait l'hydratation (ex. TimerDigits rend un
  // arbre différent selon cette valeur). Coût : 1 frame avant la bascule.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
