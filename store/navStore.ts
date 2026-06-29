"use client";

import { create } from "zustand";

// Navigation simplifiée : 4 destinations de premier niveau au lieu de 7 onglets.
// « Écouter » regroupe les 4 sources média (catalogue / bibliothèque / Spotify / Twitch)
// derrière un sous-sélecteur, pour réduire la charge cognitive.
export type NavSection = "accueil" | "ecouter" | "organisation" | "activite";
export type MediaSource = "catalogue" | "library" | "spotify" | "twitch";

interface NavState {
  section: NavSection;
  mediaSource: MediaSource;
  setSection: (s: NavSection) => void;
  /** Ouvre la section Écouter sur une source précise. */
  openMedia: (src: MediaSource) => void;
}

// Non persisté : on retombe toujours sur « Accueil » au chargement (prévisible).
export const useNavStore = create<NavState>((set) => ({
  section: "accueil",
  mediaSource: "catalogue",
  setSection: (section) => set({ section }),
  openMedia: (mediaSource) => set({ section: "ecouter", mediaSource }),
}));
