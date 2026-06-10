"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { evaluateAchievements } from "@/lib/achievements";
import { useStatsStore, localToday } from "@/store/statsStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";

interface AchievementsState {
  unlocked: Record<string, string>; // id → date unlocked (YYYY-MM-DD)
  /** Re-evaluates achievements; returns ids unlocked for the first time. */
  sync: () => string[];
}

export const useAchievementsStore = create<AchievementsState>()(
  persist(
    (set, get) => ({
      unlocked: {},

      sync: () => {
        const days = useStatsStore.getState().days;
        const history = usePlayHistoryStore.getState().entries;
        const currently = evaluateAchievements(days, history);

        const { unlocked } = get();
        const newlyUnlocked: string[] = [];
        const next = { ...unlocked };
        for (const id of currently) {
          if (!next[id]) {
            next[id] = localToday();
            newlyUnlocked.push(id);
          }
        }
        if (newlyUnlocked.length > 0) set({ unlocked: next });
        return newlyUnlocked;
      },
    }),
    { name: "focusflow-achievements" }
  )
);
