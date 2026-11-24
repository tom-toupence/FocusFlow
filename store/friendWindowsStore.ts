"use client";

import { create } from "zustand";

// Lien entre la liste des amis et leur fenêtre (non persisté) : survoler une
// ligne fait pulser la fenêtre de cet ami ; « Ta rue » y signale les amis dont
// la fenêtre est masquée par le texte ou la liste (« hors cadre »).
interface FriendWindowsState {
  highlight: string | null;
  setHighlight: (userId: string | null) => void;
  offFrame: string[];
  setOffFrame: (userIds: string[]) => void;
}

export const useFriendWindowsStore = create<FriendWindowsState>((set, get) => ({
  highlight: null,
  setHighlight: (highlight) => set({ highlight }),
  offFrame: [],
  setOffFrame: (offFrame) => {
    const cur = get().offFrame;
    if (cur.length === offFrame.length && cur.every((id, i) => id === offFrame[i])) return;
    set({ offFrame });
  },
}));
