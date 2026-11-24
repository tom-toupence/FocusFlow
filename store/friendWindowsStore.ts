"use client";

import { create } from "zustand";

// Lien entre la liste des amis et leur fenêtre dans la rue (non persisté) :
// survoler une ligne fait pulser la fenêtre de cet ami.
interface FriendWindowsState {
  highlight: string | null;
  setHighlight: (userId: string | null) => void;
}

export const useFriendWindowsStore = create<FriendWindowsState>((set) => ({
  highlight: null,
  setHighlight: (highlight) => set({ highlight }),
}));
