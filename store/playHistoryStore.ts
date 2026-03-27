"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlayType = "youtube" | "playlist" | "spotify" | "twitch-live" | "twitch-vod";

export interface PlayEntry {
  id: string;
  type: PlayType;
  title: string;
  subtitle: string;
  thumbnailUrl?: string;
  mediaKey: string; // for grouping in top plays (youtubeId, playlistId, spotifyUri, channelLogin…)
  timestamp: number;
  date: string; // YYYY-MM-DD
  minutes: number;
}

interface PlayHistoryState {
  entries: PlayEntry[];
  record: (entry: Omit<PlayEntry, "id">) => void;
  clear: () => void;
}

export const usePlayHistoryStore = create<PlayHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      record: (entry) => {
        if (entry.minutes < 1) return; // ignore very short plays
        const newEntry: PlayEntry = { ...entry, id: crypto.randomUUID() };
        const { entries } = get();
        // Keep last 200 entries
        set({ entries: [newEntry, ...entries].slice(0, 200) });
      },

      clear: () => set({ entries: [] }),
    }),
    { name: "focusflow-play-history" }
  )
);

// ── Selectors ──────────────────────────────────────────────────────────────────

/** Top N media by total minutes listened */
export function getTopPlays(entries: PlayEntry[], n = 6): { mediaKey: string; title: string; subtitle: string; thumbnailUrl?: string; type: PlayType; totalMinutes: number; playCount: number }[] {
  const map = new Map<string, { title: string; subtitle: string; thumbnailUrl?: string; type: PlayType; totalMinutes: number; playCount: number }>();
  for (const e of entries) {
    const existing = map.get(e.mediaKey);
    if (existing) {
      existing.totalMinutes += e.minutes;
      existing.playCount += 1;
    } else {
      map.set(e.mediaKey, {
        title: e.title,
        subtitle: e.subtitle,
        thumbnailUrl: e.thumbnailUrl,
        type: e.type,
        totalMinutes: e.minutes,
        playCount: 1,
      });
    }
  }
  return Array.from(map.entries())
    .map(([mediaKey, v]) => ({ mediaKey, ...v }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, n);
}
