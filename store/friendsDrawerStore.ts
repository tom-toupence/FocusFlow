"use client";

import { create } from "zustand";

// Ouverture du tiroir « Amis » (drawer latéral droit façon launcher de jeu).
// Partagé pour que le bouton flottant, le menu « Créer » et le lien ?add=<code>
// puissent tous l'ouvrir. Non persisté (toujours fermé au chargement).
interface FriendsDrawerState {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

export const useFriendsDrawer = create<FriendsDrawerState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
