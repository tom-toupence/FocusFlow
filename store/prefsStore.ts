"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrefsState {
  breathingEnabled: boolean;
  setBreathingEnabled: (v: boolean) => void;
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  /** Scènes d'eau WebGL (landing, pauses, Spotify, résumé). false = image fixe. */
  waterEffects: boolean;
  setWaterEffects: (v: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      breathingEnabled: true,
      setBreathingEnabled: (v) => set({ breathingEnabled: v }),
      onboarded: false,
      setOnboarded: (v) => set({ onboarded: v }),
      waterEffects: true,
      setWaterEffects: (v) => set({ waterEffects: v }),
    }),
    { name: "focusflow-prefs" }
  )
);
