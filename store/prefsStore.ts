"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrefsState {
  breathingEnabled: boolean;
  setBreathingEnabled: (v: boolean) => void;
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  /** Rue de nuit en fond de l'app (thème sombre). */
  streetBackdrop: boolean;
  setStreetBackdrop: (v: boolean) => void;
  /**
   * Adresse iCal privée de l'agenda (lot « agenda »). Un secret : elle reste
   * dans ce navigateur, jamais synchronisée (stateSync ne lit pas ce store),
   * retirée des sauvegardes exportées et effacée au changement de compte.
   */
  icalUrl: string | null;
  setIcalUrl: (v: string | null) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      breathingEnabled: true,
      setBreathingEnabled: (v) => set({ breathingEnabled: v }),
      onboarded: false,
      setOnboarded: (v) => set({ onboarded: v }),
      streetBackdrop: true,
      setStreetBackdrop: (v) => set({ streetBackdrop: v }),
      icalUrl: null,
      setIcalUrl: (v) => set({ icalUrl: v }),
    }),
    { name: "focusflow-prefs" }
  )
);
