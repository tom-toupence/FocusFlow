"use client";

import { create } from "zustand";

// Navigation simplifiée : 4 destinations de premier niveau au lieu de 7 onglets.
// « Écouter » regroupe les 4 sources média (catalogue / bibliothèque / Spotify / Twitch)
// derrière un sous-sélecteur, pour réduire la charge cognitive.
export type NavSection = "accueil" | "ecouter" | "organisation" | "activite";
export type MediaSource = "catalogue" | "library" | "spotify" | "twitch";

interface NavState {
  section: NavSection;
  /** Section précédente — sert à la direction du slide de transition. */
  prevSection: NavSection;
  mediaSource: MediaSource;
  setSection: (s: NavSection) => void;
  /** Ouvre la section Écouter sur une source précise. */
  openMedia: (src: MediaSource) => void;
}

// Non persisté : on retombe toujours sur « Accueil » au chargement (prévisible).
export const useNavStore = create<NavState>((set) => ({
  section: "accueil",
  prevSection: "accueil",
  mediaSource: "catalogue",
  setSection: (section) => set((st) => ({ section, prevSection: st.section })),
  openMedia: (mediaSource) => set((st) => ({ section: "ecouter", mediaSource, prevSection: st.section })),
}));
