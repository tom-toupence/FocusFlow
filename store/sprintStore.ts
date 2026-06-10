"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VideoMood } from "@/data/videos";
import type { FocusBlock } from "@/store/planStore";
import { localToday } from "@/store/statsStore";

export interface Sprint {
  id: string;
  objective: string;
  deadline: string;      // YYYY-MM-DD
  createdAt: string;     // YYYY-MM-DD
  dailyMinutes: number;
  startMin: number;      // preferred start (minutes from midnight)
  mood: VideoMood;       // chosen by the coach for the "Go" button
  blockIds: string[];    // plan blocks owned by this sprint
  taskIds: string[];     // kanban tasks created by this sprint
}

interface SprintState {
  sprint: Sprint | null;
  setSprint: (s: Sprint) => void;
  clearSprint: () => void;
}

export const useSprintStore = create<SprintState>()(
  persist(
    (set) => ({
      sprint: null,
      setSprint: (sprint) => set({ sprint }),
      clearSprint: () => set({ sprint: null }),
    }),
    { name: "focusflow-sprint" }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export interface SprintStatus {
  daysLeft: number;        // until deadline (0 = today)
  blocksTotal: number;
  blocksDone: number;
  missed: number;          // past blocks not done
  todayBlock: FocusBlock | null;
  overdue: boolean;
}

export function getSprintStatus(sprint: Sprint, blocks: FocusBlock[]): SprintStatus {
  const ids = new Set(sprint.blockIds);
  const mine = blocks.filter((b) => ids.has(b.id));
  const today = localToday();
  const msPerDay = 86_400_000;
  const daysLeft = Math.ceil(
    (new Date(sprint.deadline + "T23:59:59").getTime() - Date.now()) / msPerDay
  );
  return {
    daysLeft: Math.max(0, daysLeft),
    blocksTotal: mine.length,
    blocksDone: mine.filter((b) => b.done).length,
    missed: mine.filter((b) => !b.done && b.date < today).length,
    todayBlock: mine.find((b) => b.date === today && !b.done) ?? null,
    overdue: today > sprint.deadline,
  };
}
