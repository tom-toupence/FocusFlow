// Gamification engine — XP, levels, focus garden and weekly challenges.
// Everything is DERIVED from existing data (stats + achievements) so it can be
// recomputed at any time without separate event bookkeeping.

import { DayStats, getTotalStats, getStreak } from "@/store/statsStore";

// ── XP & levels ────────────────────────────────────────────────────────────────

const XP_PER_SESSION = 12;
const XP_PER_MINUTE = 0.5;
const XP_PER_ACHIEVEMENT = 50;
const XP_PER_STREAK_DAY = 5;

export function totalXp(days: Record<string, DayStats>, unlockedAchievements: number): number {
  const total = getTotalStats(days);
  const streak = getStreak(days);
  return Math.floor(
    total.sessions * XP_PER_SESSION +
    total.minutesWorked * XP_PER_MINUTE +
    unlockedAchievements * XP_PER_ACHIEVEMENT +
    streak * XP_PER_STREAK_DAY
  );
}

/** Cumulative XP required to reach a given level (level 1 = 0). */
function xpToReach(level: number): number {
  // Each level L costs 100*(L-1) XP → cumulative is 100 * (L-1)*L / 2.
  return 50 * (level - 1) * level;
}

export interface LevelInfo {
  level: number;
  xp: number;
  xpInLevel: number;
  xpForNext: number;
  progress: number; // 0..1
  title: string;
}

const LEVEL_TITLES = [
  "Graine",        // 1-2
  "Pousse",        // 3-4
  "Apprenti",      // 5-6
  "Concentré",     // 7-9
  "Focalisé",      // 10-13
  "Discipliné",    // 14-18
  "Maître du flow",// 19-24
  "Légende",       // 25+
];

function titleForLevel(level: number): string {
  if (level >= 25) return LEVEL_TITLES[7];
  if (level >= 19) return LEVEL_TITLES[6];
  if (level >= 14) return LEVEL_TITLES[5];
  if (level >= 10) return LEVEL_TITLES[4];
  if (level >= 7) return LEVEL_TITLES[3];
  if (level >= 5) return LEVEL_TITLES[2];
  if (level >= 3) return LEVEL_TITLES[1];
  return LEVEL_TITLES[0];
}

export function getLevelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xpToReach(level + 1) <= xp) level++;
  const base = xpToReach(level);
  const next = xpToReach(level + 1);
  const xpInLevel = xp - base;
  const xpForNext = next - base;
  return {
    level,
    xp,
    xpInLevel,
    xpForNext,
    progress: xpForNext > 0 ? xpInLevel / xpForNext : 0,
    title: titleForLevel(level),
  };
}

// ── Week helpers ─────────────────────────────────────────────────────────────

function localDateMinus(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/** Stats for the current week (Mon→today), incl. active-day count. */
export function getWeekDetail(days: Record<string, DayStats>): {
  sessions: number;
  minutes: number;
  activeDays: number;
} {
  let sessions = 0, minutes = 0, activeDays = 0;
  const daysSinceMonday = (new Date().getDay() + 6) % 7;
  for (let i = 0; i <= daysSinceMonday; i++) {
    const d = days[localDateMinus(i)];
    if (d) {
      sessions += d.sessions;
      minutes += d.minutesWorked;
      if (d.sessions > 0) activeDays++;
    }
  }
  return { sessions, minutes, activeDays };
}

// ── Weekly challenges ─────────────────────────────────────────────────────────

export interface Challenge {
  id: string;
  emoji: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
}

export function getWeeklyChallenges(days: Record<string, DayStats>): Challenge[] {
  const week = getWeekDetail(days);
  const make = (id: string, emoji: string, label: string, current: number, target: number): Challenge => ({
    id, emoji, label, current: Math.min(current, target), target, done: current >= target,
  });
  return [
    make("week-days", "📅", "Jours actifs cette semaine", week.activeDays, 5),
    make("week-pomodoros", "🍅", "Pomodoros cette semaine", week.sessions, 25),
    make("week-minutes", "⏱️", "Minutes de focus cette semaine", week.minutes, 300),
  ];
}

// ── Focus garden ──────────────────────────────────────────────────────────────

export type Plant = { stage: 0 | 1 | 2 | 3 }; // bud → sprout → bloom → tree

/**
 * Builds the garden for the current week: one plant per active day, its growth
 * stage based on that day's focus minutes. Padded to 7 slots (empty plots).
 */
export function getGarden(days: Record<string, DayStats>): (Plant | null)[] {
  const garden: (Plant | null)[] = [];
  const daysSinceMonday = (new Date().getDay() + 6) % 7;
  for (let i = daysSinceMonday; i >= 0; i--) {
    const d = days[localDateMinus(i)];
    const minutes = d?.minutesWorked ?? 0;
    if (minutes <= 0) { garden.push(null); continue; }
    const stage: Plant["stage"] = minutes >= 120 ? 3 : minutes >= 60 ? 2 : minutes >= 25 ? 1 : 0;
    garden.push({ stage });
  }
  while (garden.length < 7) garden.push(null);
  return garden;
}
