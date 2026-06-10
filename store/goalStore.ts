"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DayStats, getTodayStats } from "@/store/statsStore";

export type GoalUnit = "minutes" | "pomodoros";

interface GoalState {
  unit: GoalUnit;
  target: number;

  setUnit: (unit: GoalUnit) => void;
  setTarget: (target: number) => void;
}

/** Sensible defaults per unit when toggling. */
export const DEFAULT_TARGET: Record<GoalUnit, number> = {
  minutes: 120,
  pomodoros: 8,
};

export const useGoalStore = create<GoalState>()(
  persist(
    (set) => ({
      unit: "minutes",
      target: DEFAULT_TARGET.minutes,

      setUnit: (unit) => set((s) => ({ unit, target: s.unit === unit ? s.target : DEFAULT_TARGET[unit] })),
      setTarget: (target) => set({ target: Math.max(1, Math.round(target)) }),
    }),
    { name: "focusflow-goal" }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export interface GoalProgress {
  value: number;
  target: number;
  ratio: number; // 0..1 (capped)
  reached: boolean;
  unit: GoalUnit;
}

export function getTodayProgress(
  days: Record<string, DayStats>,
  unit: GoalUnit,
  target: number
): GoalProgress {
  const today = getTodayStats(days);
  const value = unit === "minutes" ? today.minutesWorked : today.sessions;
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  return { value, target, ratio, reached: value >= target && target > 0, unit };
}

export function goalUnitLabel(unit: GoalUnit, value: number): string {
  if (unit === "minutes") return `${value} min`;
  return `${value} pomodoro${value !== 1 ? "s" : ""}`;
}
