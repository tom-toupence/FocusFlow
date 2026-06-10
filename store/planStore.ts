"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCurrentUserId } from "@/lib/authState";
import { upsertPlanBlock, deletePlanBlock } from "@/lib/db";

export interface FocusBlock {
  id: string;
  date: string;       // YYYY-MM-DD
  startMin: number;   // minutes from midnight (0–1439)
  durationMin: number;
  label: string;
  done: boolean;
}

interface PlanState {
  blocks: FocusBlock[];
  /** Adds a block and returns its generated id. */
  addBlock: (b: Omit<FocusBlock, "id" | "done">) => string;
  updateBlock: (id: string, fields: Partial<Omit<FocusBlock, "id">>) => void;
  removeBlock: (id: string) => void;
  toggleDone: (id: string) => void;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      blocks: [],
      addBlock: (b) => {
        const block: FocusBlock = { ...b, id: crypto.randomUUID(), done: false };
        set((s) => ({ blocks: [...s.blocks, block] }));
        const userId = getCurrentUserId();
        if (userId) upsertPlanBlock(userId, block);
        return block.id;
      },
      updateBlock: (id, fields) => {
        set((s) => ({ blocks: s.blocks.map((x) => (x.id === id ? { ...x, ...fields } : x)) }));
        const userId = getCurrentUserId();
        const block = get().blocks.find((x) => x.id === id);
        if (userId && block) upsertPlanBlock(userId, block);
      },
      removeBlock: (id) => {
        set((s) => ({ blocks: s.blocks.filter((x) => x.id !== id) }));
        const userId = getCurrentUserId();
        if (userId) deletePlanBlock(userId, id);
      },
      toggleDone: (id) => {
        set((s) => ({ blocks: s.blocks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));
        const userId = getCurrentUserId();
        const block = get().blocks.find((x) => x.id === id);
        if (userId && block) upsertPlanBlock(userId, block);
      },
    }),
    { name: "focusflow-plan" }
  )
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Local date string for the Monday-based week containing `ref`, offset by `weekOffset` weeks. */
export function weekDates(weekOffset = 0): string[] {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  });
}

export function blocksForDate(blocks: FocusBlock[], date: string): FocusBlock[] {
  return blocks.filter((b) => b.date === date).sort((a, b) => a.startMin - b.startMin);
}

export function plannedMinutes(blocks: FocusBlock[], date: string): number {
  return blocksForDate(blocks, date).reduce((s, b) => s + b.durationMin, 0);
}

export function formatMinOfDay(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
