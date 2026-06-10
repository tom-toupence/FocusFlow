"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WrappedState {
  /** Monday (YYYY-MM-DD) of the last weekly recap the user has opened. */
  lastSeenWeekStart: string | null;
  markSeen: (weekStart: string) => void;
}

export const useWrappedStore = create<WrappedState>()(
  persist(
    (set) => ({
      lastSeenWeekStart: null,
      markSeen: (weekStart) => set({ lastSeenWeekStart: weekStart }),
    }),
    { name: "focusflow-wrapped" }
  )
);
