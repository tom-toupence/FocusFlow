"use client";

import { useEffect, useState } from "react";

/**
 * True après `timeout` ms sans interaction (pointer/clavier) — pour effacer
 * le chrome de la session et ne laisser que la vidéo + le timer.
 * `enabled: false` force le retour à l'état visible (pause, break, panneau ouvert…).
 */
export function useIdleHide(timeout = 4000, enabled = true): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdle(false);
      return;
    }
    let timer: number;
    const reset = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), timeout);
    };
    reset();
    const events = ["pointermove", "pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeout, enabled]);

  return idle;
}
