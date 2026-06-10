"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { localToday } from "@/store/statsStore";

interface DistractionState {
  byDate: Record<string, number>; // YYYY-MM-DD → total distractions (persisted)
  sessionCount: number;           // current session only (not persisted)

  markDistraction: () => void;
  resetSession: () => void;
}

export const useDistractionStore = create<DistractionState>()(
  persist(
    (set, get) => ({
      byDate: {},
      sessionCount: 0,

      markDistraction: () => {
        const key = localToday();
        const { byDate, sessionCount } = get();
        set({
          byDate: { ...byDate, [key]: (byDate[key] ?? 0) + 1 },
          sessionCount: sessionCount + 1,
        });
      },

      resetSession: () => set({ sessionCount: 0 }),
    }),
    {
      name: "focusflow-distractions",
      partialize: (state) => ({ byDate: state.byDate }), // sessionCount stays ephemeral
    }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

/**
 * Focus score 0–100: ratio of completed pomodoros to (pomodoros + distractions).
 * With no pomodoros yet, returns 100 if also no distractions, else degrades.
 */
export function getFocusScore(pomodoros: number, distractions: number): number {
  if (pomodoros === 0 && distractions === 0) return 100;
  const denom = pomodoros + distractions;
  if (denom === 0) return 100;
  return Math.round((pomodoros / denom) * 100);
}

export function getTodayDistractions(byDate: Record<string, number>): number {
  return byDate[localToday()] ?? 0;
}
