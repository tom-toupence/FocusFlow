"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimerMode = "work" | "short-break" | "long-break";

interface TimerSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

interface TimerState {
  mode: TimerMode;
  secondsLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  settings: TimerSettings;

  setMode: (mode: TimerMode) => void;
  tick: () => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  nextSession: () => void;
  updateSettings: (settings: Partial<TimerSettings>) => void;
}

const defaultSettings: TimerSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
};

function getDuration(mode: TimerMode, settings: TimerSettings): number {
  if (mode === "work") return settings.workDuration * 60;
  if (mode === "short-break") return settings.shortBreakDuration * 60;
  return settings.longBreakDuration * 60;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      mode: "work",
      secondsLeft: defaultSettings.workDuration * 60,
      isRunning: false,
      sessionsCompleted: 0,
      settings: defaultSettings,

      setMode: (mode) => {
        const { settings } = get();
        set({ mode, secondsLeft: getDuration(mode, settings), isRunning: false });
      },

      tick: () => {
        const { secondsLeft } = get();
        if (secondsLeft > 0) {
          set({ secondsLeft: secondsLeft - 1 });
        } else {
          set({ isRunning: false });
        }
      },

      start: () => set({ isRunning: true }),
      pause: () => set({ isRunning: false }),

      reset: () => {
        const { mode, settings } = get();
        set({ secondsLeft: getDuration(mode, settings), isRunning: false });
      },

      nextSession: () => {
        const { mode, sessionsCompleted, settings } = get();
        let nextMode: TimerMode;
        let newSessionsCompleted = sessionsCompleted;

        if (mode === "work") {
          newSessionsCompleted = sessionsCompleted + 1;
          nextMode =
            newSessionsCompleted % settings.sessionsBeforeLongBreak === 0
              ? "long-break"
              : "short-break";
        } else {
          nextMode = "work";
        }

        set({
          mode: nextMode,
          secondsLeft: getDuration(nextMode, settings),
          isRunning: false,
          sessionsCompleted: newSessionsCompleted,
        });
      },

      updateSettings: (newSettings) => {
        const { settings, mode } = get();
        const merged = { ...settings, ...newSettings };
        set({
          settings: merged,
          secondsLeft: getDuration(mode, merged),
          isRunning: false,
        });
      },
    }),
    {
      name: "focusflow-timer",
      partialize: (state) => ({
        settings: state.settings,
        sessionsCompleted: state.sessionsCompleted,
      }),
    }
  )
);
