"use client";

import { create } from "zustand";

interface SessionSummaryState {
  startedAt: number | null;
  focusMinutesPerSession: number;
  todoDoneIdsAtStart: string[];

  startSession: (workDuration: number, doneTodoIds: string[]) => void;
  clearSession: () => void;
}

export const useSessionSummaryStore = create<SessionSummaryState>()((set) => ({
  startedAt: null,
  focusMinutesPerSession: 25,
  todoDoneIdsAtStart: [],

  startSession: (workDuration, doneTodoIds) =>
    set({ startedAt: Date.now(), focusMinutesPerSession: workDuration, todoDoneIdsAtStart: doneTodoIds }),

  clearSession: () =>
    set({ startedAt: null, todoDoneIdsAtStart: [] }),
}));
