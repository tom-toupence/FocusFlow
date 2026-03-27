"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DayStats {
  date: string; // "YYYY-MM-DD" local time
  sessions: number;
  minutesWorked: number;
}

interface StatsState {
  days: Record<string, DayStats>;
  recordSession: (minutesWorked: number) => void;
}

/** Returns today's date string in local time (YYYY-MM-DD). */
export function localToday(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Returns a local date string N days ago. */
function localDateMinus(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      days: {},

      recordSession: (minutesWorked) => {
        const key = localToday();
        const { days } = get();
        const existing = days[key] ?? { date: key, sessions: 0, minutesWorked: 0 };
        set({
          days: {
            ...days,
            [key]: {
              ...existing,
              sessions: existing.sessions + 1,
              minutesWorked: existing.minutesWorked + Math.max(1, minutesWorked),
            },
          },
        });
      },
    }),
    { name: "focusflow-stats" }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export function getTodayStats(days: Record<string, DayStats>): DayStats {
  const key = localToday();
  return days[key] ?? { date: key, sessions: 0, minutesWorked: 0 };
}

export function getWeekStats(days: Record<string, DayStats>): { sessions: number; minutesWorked: number } {
  let sessions = 0;
  let minutesWorked = 0;
  const daysSinceMonday = (new Date().getDay() + 6) % 7;
  for (let i = 0; i <= daysSinceMonday; i++) {
    const d = days[localDateMinus(i)];
    if (d) { sessions += d.sessions; minutesWorked += d.minutesWorked; }
  }
  return { sessions, minutesWorked };
}

export function getStreak(days: Record<string, DayStats>): number {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (days[localDateMinus(i)]?.sessions > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export function getLast119Days(days: Record<string, DayStats>): { date: string; minutes: number }[] {
  return Array.from({ length: 119 }, (_, i) => {
    const key = localDateMinus(118 - i);
    return { date: key, minutes: days[key]?.minutesWorked ?? 0 };
  });
}

export function getTotalStats(days: Record<string, DayStats>): { sessions: number; minutesWorked: number; activeDays: number } {
  const values = Object.values(days);
  return {
    sessions: values.reduce((a, d) => a + d.sessions, 0),
    minutesWorked: values.reduce((a, d) => a + d.minutesWorked, 0),
    activeDays: values.filter((d) => d.sessions > 0).length,
  };
}

export function getBestDay(days: Record<string, DayStats>): DayStats | null {
  const values = Object.values(days).filter((d) => d.minutesWorked > 0);
  if (values.length === 0) return null;
  return values.reduce((best, d) => d.minutesWorked > best.minutesWorked ? d : best);
}

export function getLast7Days(days: Record<string, DayStats>): { date: string; minutes: number; label: string }[] {
  const dayShort = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return Array.from({ length: 7 }, (_, i) => {
    const key = localDateMinus(6 - i);
    const d = new Date(key + "T00:00:00");
    return { date: key, minutes: days[key]?.minutesWorked ?? 0, label: dayShort[d.getDay()] };
  });
}
