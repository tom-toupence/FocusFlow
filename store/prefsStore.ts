"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrefsState {
  breathingEnabled: boolean;
  setBreathingEnabled: (v: boolean) => void;
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  /** Scène 3D de la ruelle (landing, pauses, Spotify, résumé). false = image fixe. */
  sceneEffects: boolean;
  setSceneEffects: (v: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      breathingEnabled: true,
      setBreathingEnabled: (v) => set({ breathingEnabled: v }),
      onboarded: false,
      setOnboarded: (v) => set({ onboarded: v }),
      sceneEffects: true,
      setSceneEffects: (v) => set({ sceneEffects: v }),
    }),
    { name: "focusflow-prefs" }
  )
);
