import { create } from "zustand";

export type AmbientPhase = "work" | "break" | null;

interface AmbientState {
  /** Couleur d'ambiance courante (hex), dérivée du média sélectionné. */
  hex: string;
  /** Phase de session (teinte le rendu via data-ambient-phase) — null hors session. */
  phase: AmbientPhase;
  setAmbient: (hex: string, phase: AmbientPhase) => void;
}

/**
 * Volontairement NON persisté : la teinte est recalculée à chaque chargement
 * par AmbientProvider → aucun risque de mismatch d'hydratation.
 */
export const useAmbientStore = create<AmbientState>((set) => ({
  hex: "#4a4a55",
  phase: null,
  setAmbient: (hex, phase) => set({ hex, phase }),
}));
