// Weekly "Wrapped" recap — aggregates a week of focus data from the existing
// stores (stats, play history, achievements, journal, distractions).
// Pure functions: callers pass store snapshots, nothing is fetched.

import { weekDates } from "@/store/planStore";
import type { DayStats } from "@/store/statsStore";
import { getTopPlays, type PlayEntry } from "@/store/playHistoryStore";
import type { JournalEntry } from "@/store/journalStore";
import { ACHIEVEMENTS, type Achievement } from "@/lib/achievements";

export interface WrappedData {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string;   // YYYY-MM-DD (Sunday)
  minutes: number;
  sessions: number;
  activeDays: number;
  prevMinutes: number;
  /** % change vs previous week, or null when previous week is empty. */
  deltaPct: number | null;
  bestDay: { date: string; label: string; minutes: number } | null;
  peakHour: number | null;
  topPlay: { title: string; subtitle: string; thumbnailUrl?: string; totalMinutes: number } | null;
  badges: Achievement[];
  avgMood: number | null;
  distractions: number;
}

const DAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function sumWeek(days: Record<string, DayStats>, dates: string[]) {
  let minutes = 0, sessions = 0, activeDays = 0;
  for (const d of dates) {
    const s = days[d];
    if (!s) continue;
    minutes += s.minutesWorked;
    sessions += s.sessions;
    if (s.sessions > 0) activeDays++;
  }
  return { minutes, sessions, activeDays };
}

/**
 * Computes the recap for the week at `weekOffset` (-1 = last completed week, 0 = current).
 */
export function computeWrapped(
  weekOffset: number,
  days: Record<string, DayStats>,
  history: PlayEntry[],
  unlocked: Record<string, string>,
  journal: JournalEntry[],
  distractionsByDate: Record<string, number>
): WrappedData {
  const dates = weekDates(weekOffset);
  const prevDates = weekDates(weekOffset - 1);
  const inWeek = new Set(dates);

  const cur = sumWeek(days, dates);
  const prev = sumWeek(days, prevDates);
  const deltaPct = prev.minutes > 0 ? Math.round(((cur.minutes - prev.minutes) / prev.minutes) * 100) : null;

  // Best day
  let bestDay: WrappedData["bestDay"] = null;
  for (const d of dates) {
    const s = days[d];
    if (s && s.minutesWorked > 0 && (!bestDay || s.minutesWorked > bestDay.minutes)) {
      bestDay = { date: d, label: DAY_LABELS[new Date(d + "T00:00:00").getDay()], minutes: s.minutesWorked };
    }
  }

  // Plays within the week
  const weekPlays = history.filter((e) => inWeek.has(e.date));
  const byHour = Array(24).fill(0) as number[];
  for (const e of weekPlays) byHour[new Date(e.timestamp).getHours()] += e.minutes;
  const maxHour = Math.max(...byHour);
  const peakHour = maxHour > 0 ? byHour.indexOf(maxHour) : null;
  const top = getTopPlays(weekPlays, 1)[0];
  const topPlay = top
    ? { title: top.title, subtitle: top.subtitle, thumbnailUrl: top.thumbnailUrl, totalMinutes: top.totalMinutes }
    : null;

  // Badges unlocked during the week
  const badges = ACHIEVEMENTS.filter((a) => unlocked[a.id] && inWeek.has(unlocked[a.id]));

  // Average mood
  const moods = journal.filter((e) => inWeek.has(e.date)).map((e) => e.mood);
  const avgMood = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;

  // Distractions
  let distractions = 0;
  for (const d of dates) distractions += distractionsByDate[d] ?? 0;

  return {
    weekStart: dates[0],
    weekEnd: dates[6],
    minutes: cur.minutes,
    sessions: cur.sessions,
    activeDays: cur.activeDays,
    prevMinutes: prev.minutes,
    deltaPct,
    bestDay,
    peakHour,
    topPlay,
    badges,
    avgMood,
    distractions,
  };
}

export function formatWrappedMinutes(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

/** "9–15 juin" style label for the week. */
export function wrappedWeekLabel(data: WrappedData): string {
  const start = new Date(data.weekStart + "T00:00:00");
  const end = new Date(data.weekEnd + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const startLabel = start.getMonth() === end.getMonth()
    ? String(start.getDate())
    : start.toLocaleDateString("fr", opts);
  return `${startLabel} – ${end.toLocaleDateString("fr", opts)}`;
}
