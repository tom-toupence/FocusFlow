"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Préférences de lecture des files YouTube (playlists résolues, mixes radio,
// File FocusFlow) : lecture aléatoire et bouclage. Quand `loop` est désactivé,
// la fin de la file enchaîne sur des titres similaires (mix RD du dernier titre)
// au lieu de reboucler.
interface PlaybackPrefsState {
  shuffle: boolean;
  loop: boolean;
  toggleShuffle: () => void;
  toggleLoop: () => void;
}

export const usePlaybackPrefsStore = create<PlaybackPrefsState>()(
  persist(
    (set) => ({
      shuffle: false,
      loop: true,
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      toggleLoop: () => set((s) => ({ loop: !s.loop })),
    }),
    { name: "focusflow-playback" }
  )
);
