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
    // Sans stockage (navigation privée, stockage bloqué), persist sort avant
    // onRehydrateStorage : on marque quand même le store comme relu, sinon
    // /session et /settings attendraient indéfiniment.
    const markHydrated = () => {
      if (!useTimerStore.getState().hydrated) useTimerStore.setState({ hydrated: true });
    };
    try {
      void Promise.resolve(useTimerStore.persist.rehydrate()).finally(markHydrated);
    } catch {
      markHydrated();
    }
  }, []);
  return null;
}
