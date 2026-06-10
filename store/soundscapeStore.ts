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
    {
      name: "focusflow-soundscape",
      // Les couches ne sont PAS persistées : chaque session démarre avec 0 ambiance active.
      // Seules les préférences (volume global, couper en pause) sont mémorisées.
      partialize: (state) => ({ masterVolume: state.masterVolume, pauseOnBreak: state.pauseOnBreak }),
      version: 1,
      // Purge les couches éventuellement déjà sauvegardées par une ancienne version.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { masterVolume?: number; pauseOnBreak?: boolean };
        return {
          masterVolume: p.masterVolume ?? 0.7,
          pauseOnBreak: p.pauseOnBreak ?? false,
        };
      },
    }
  )
);
