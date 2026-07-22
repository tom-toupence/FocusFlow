"use client";

import { create } from "zustand";

// Navigation simplifiée : 4 destinations de premier niveau au lieu de 7 onglets.
// « Écouter » regroupe les sources média (catalogue / bibliothèque / découvrir /
// Spotify / Twitch) derrière un sous-sélecteur, pour réduire la charge cognitive.
export type NavSection = "accueil" | "ecouter" | "organisation" | "activite";
export type MediaSource = "catalogue" | "library" | "discover" | "spotify" | "twitch";
export type OrgTab = "projets" | "planning" | "sprint" | "routines" | "journal";
export type ActivityTab = "apercu" | "stats" | "wrapped";
/** Nature de l'élément à créer, posé par le bouton global « ＋ Créer ».
    (Pas de "planBlock" : le planning a ses boutons + par jour, on ouvre juste l'onglet.) */
export type CreateKind = "project" | "sprint";

interface NavState {
  section: NavSection;
  /** Section précédente — sert à la direction du slide de transition. */
  prevSection: NavSection;
  mediaSource: MediaSource;
  orgTab: OrgTab;
  activityTab: ActivityTab;
  /** Flag consommé par la vue cible pour ouvrir directement son formulaire de création. */
  pendingCreate: CreateKind | null;
  setSection: (s: NavSection) => void;
  /** Ouvre la section Écouter sur une source précise. */
  openMedia: (src: MediaSource) => void;
  /** Ouvre la section Organisation sur un sous-onglet précis. */
  openOrg: (tab: OrgTab) => void;
  /** Ouvre la section Activité sur un sous-onglet précis. */
  openActivity: (tab: ActivityTab) => void;
  /** Navigue vers la vue de création correspondante et pose le flag `pendingCreate`. */
  requestCreate: (kind: CreateKind) => void;
  /** À appeler par la vue cible : si le flag correspond, le consomme (efface) et retourne true. */
  consumeCreate: (kind: CreateKind) => boolean;
}

// Non persisté : on retombe toujours sur « Accueil » au chargement (prévisible).
export const useNavStore = create<NavState>((set, get) => ({
  section: "accueil",
  prevSection: "accueil",
  mediaSource: "catalogue",
  orgTab: "projets",
  activityTab: "apercu",
  pendingCreate: null,
  setSection: (section) => set((st) => ({ section, prevSection: st.section })),
  openMedia: (mediaSource) => set((st) => ({ section: "ecouter", mediaSource, prevSection: st.section })),
  openOrg: (orgTab) => set((st) => ({ section: "organisation", orgTab, prevSection: st.section })),
  openActivity: (activityTab) => set((st) => ({ section: "activite", activityTab, prevSection: st.section })),
  requestCreate: (kind) => {
    const st = get();
    if (kind === "project") set({ section: "organisation", orgTab: "projets", prevSection: st.section, pendingCreate: kind });
    else if (kind === "sprint") set({ section: "organisation", orgTab: "sprint", prevSection: st.section, pendingCreate: kind });
  },
  consumeCreate: (kind) => {
    const st = get();
    if (st.pendingCreate !== kind) return false;
    set({ pendingCreate: null });
    return true;
  },
}));
