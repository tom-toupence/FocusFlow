"use client";

import { create } from "zustand";

interface SessionSummaryState {
  startedAt: number | null;
  focusMinutesPerSession: number;
  todoDoneIdsAtStart: string[];
  // Minutes réellement créditées (durées de cycle effectives, plan « Dernier train » compris).
  focusMinutes: number;
  cycleMinutes: number[];

  addFocusMinutes: (minutes: number, completedCycle?: boolean) => void;
  startSession: (workDuration: number, doneTodoIds: string[]) => void;
  clearSession: () => void;
}

export const useSessionSummaryStore = create<SessionSummaryState>()((set) => ({
  startedAt: null,
  focusMinutesPerSession: 25,
  todoDoneIdsAtStart: [],
  focusMinutes: 0,
  cycleMinutes: [],

  addFocusMinutes: (minutes, completedCycle = true) =>
    set((s) => ({
      focusMinutes: s.focusMinutes + minutes,
      cycleMinutes: completedCycle ? [...s.cycleMinutes, minutes] : s.cycleMinutes,
    })),

  startSession: (workDuration, doneTodoIds) =>
    set({ startedAt: Date.now(), focusMinutesPerSession: workDuration, todoDoneIdsAtStart: doneTodoIds, focusMinutes: 0, cycleMinutes: [] }),

  clearSession: () =>
    set({ startedAt: null, todoDoneIdsAtStart: [], focusMinutes: 0, cycleMinutes: [] }),
}));
