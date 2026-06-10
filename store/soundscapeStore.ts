"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SoundscapeId } from "@/lib/soundscapes";

interface SoundscapeState {
  layers: Partial<Record<SoundscapeId, number>>; // volume 0–1 per layer
  masterVolume: number;
  pauseOnBreak: boolean; // mute ambiances during breaks

  setLayer: (id: SoundscapeId, volume: number) => void;
  setMasterVolume: (v: number) => void;
  setPauseOnBreak: (v: boolean) => void;
  reset: () => void;
  anyActive: () => boolean;
}

export const useSoundscapeStore = create<SoundscapeState>()(
  persist(
    (set, get) => ({
      layers: {},
      masterVolume: 0.7,
      pauseOnBreak: false,

      setLayer: (id, volume) =>
        set((s) => ({ layers: { ...s.layers, [id]: Math.max(0, Math.min(1, volume)) } })),

      setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(1, v)) }),

      setPauseOnBreak: (v) => set({ pauseOnBreak: v }),

      reset: () => set({ layers: {} }),

      anyActive: () => Object.values(get().layers).some((v) => (v ?? 0) > 0.01),
    }),
    { name: "focusflow-soundscape" }
  )
);
