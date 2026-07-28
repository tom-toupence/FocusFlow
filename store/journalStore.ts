"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { localToday } from "@/store/statsStore";

export interface JournalEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  timestamp: number;
  mood: number;       // 1–5
  wentWell: string;
  blockers: string;
  pomodoros?: number; // pomodoros completed that session
}

interface JournalState {
  entries: JournalEntry[];
  addEntry: (e: Omit<JournalEntry, "id" | "date" | "timestamp">) => void;
  removeEntry: (id: string) => void;
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (e) =>
        set((s) => ({
          entries: [
            { ...e, id: crypto.randomUUID(), date: localToday(), timestamp: Date.now() },
            ...s.entries,
          ].slice(0, 500),
        })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((x) => x.id !== id) })),
    }),
    { name: "focusflow-journal" }
  )
);

// Échelle d'humeur 1→5 avec une couleur (du rouge au vert) plutôt qu'un emoji.
export const MOODS = [
  { value: 1, label: "Difficile", color: "#f87171" },
  { value: 2, label: "Moyen", color: "#fb923c" },
  { value: 3, label: "Correct", color: "#facc15" },
  { value: 4, label: "Bien", color: "#a3e635" },
  { value: 5, label: "Excellent", color: "#34d399" },
];

/** Average mood per day for the last N days that have entries. */
export function moodByDate(entries: JournalEntry[]): Record<string, number> {
  const sum: Record<string, { total: number; n: number }> = {};
  for (const e of entries) {
    if (!sum[e.date]) sum[e.date] = { total: 0, n: 0 };
    sum[e.date].total += e.mood;
    sum[e.date].n += 1;
  }
  const out: Record<string, number> = {};
  for (const [d, v] of Object.entries(sum)) out[d] = v.total / v.n;
  return out;
}
