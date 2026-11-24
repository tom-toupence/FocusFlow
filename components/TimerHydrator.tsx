"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/store/timerStore";

/**
 * Relit le minuteur persisté après le montage (persist en skipHydration).
 * À monter AVANT les pages dans le layout : ses effets passent en premier.
 * Les consommateurs qui lisent des réglages au montage attendent `hydrated`.
 */
export default function TimerHydrator() {
  useEffect(() => {
    void useTimerStore.persist.rehydrate();
  }, []);
  return null;
}
