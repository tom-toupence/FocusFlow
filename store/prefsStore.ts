"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrefsState {
  breathingEnabled: boolean;
  setBreathingEnabled: (v: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      breathingEnabled: true,
      setBreathingEnabled: (v) => set({ breathingEnabled: v }),
    }),
    { name: "focusflow-prefs" }
  )
);
