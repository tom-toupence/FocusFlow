"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TwitchState {
  selectedChannel: string | null;
  selectChannel: (channel: string | null) => void;
}

export const useTwitchStore = create<TwitchState>()(
  persist(
    (set) => ({
      selectedChannel: null,
      selectChannel: (channel) => set({ selectedChannel: channel }),
    }),
    { name: "focusflow-twitch" }
  )
);
