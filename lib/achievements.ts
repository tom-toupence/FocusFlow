// Achievement definitions and evaluation.
// All badges are derived from existing data (stats + play history) so they can be
// recomputed at any time without extra tracking.

import { DayStats, getStreak, getTotalStats } from "@/store/statsStore";
import { PlayEntry } from "@/store/playHistoryStore";

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-focus",  emoji: "🌱", title: "Premier pas",      description: "Compléter ta première session de focus." },
  { id: "streak-7",     emoji: "🔥", title: "Une semaine",      description: "Maintenir une série de 7 jours." },
  { id: "streak-30",    emoji: "🏔️", title: "Inarrêtable",      description: "Maintenir une série de 30 jours." },
  { id: "pomodoros-100",emoji: "💯", title: "Centurion",        description: "Compléter 100 pomodoros au total." },
  { id: "minutes-1000", emoji: "⏳", title: "Mille minutes",    description: "Cumuler 1000 minutes de focus." },
  { id: "marathon",     emoji: "🏃", title: "Marathon",         description: "Compléter 8 pomodoros en une seule journée." },
  { id: "night-owl",    emoji: "🦉", title: "Oiseau de nuit",   description: "Travailler après 22h." },
  { id: "early-bird",   emoji: "🐦", title: "Lève-tôt",         description: "Travailler avant 7h du matin." },
  { id: "explorer",     emoji: "🧭", title: "Explorateur",      description: "Utiliser 3 sources de média différentes." },
];

/**
 * Returns the set of unlocked achievement ids given current stats & history.
 */
export function evaluateAchievements(
  days: Record<string, DayStats>,
  history: PlayEntry[]
): Set<string> {
  const unlocked = new Set<string>();
  const total = getTotalStats(days);
  const streak = getStreak(days);
  const maxPomodorosInADay = Object.values(days).reduce((m, d) => Math.max(m, d.sessions), 0);

  if (total.sessions >= 1) unlocked.add("first-focus");
  if (streak >= 7) unlocked.add("streak-7");
  if (streak >= 30) unlocked.add("streak-30");
  if (total.sessions >= 100) unlocked.add("pomodoros-100");
  if (total.minutesWorked >= 1000) unlocked.add("minutes-1000");
  if (maxPomodorosInADay >= 8) unlocked.add("marathon");

  for (const entry of history) {
    const hour = new Date(entry.timestamp).getHours();
    if (hour >= 22 || hour < 4) unlocked.add("night-owl");
    if (hour >= 4 && hour < 7) unlocked.add("early-bird");
  }

  const mediaTypes = new Set(history.map((e) => e.type));
  if (mediaTypes.size >= 3) unlocked.add("explorer");

  return unlocked;
}
