"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimerMode = "work" | "short-break" | "long-break";

export type TimerPreset = "classic" | "deep" | "custom";

export interface TimerSettings {
  preset: TimerPreset;
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export const PRESETS: Record<TimerPreset, Omit<TimerSettings, "preset">> = {
  classic: { workDuration: 25, shortBreakDuration: 5,  longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
  deep:    { workDuration: 50, shortBreakDuration: 10, longBreakDuration: 30, sessionsBeforeLongBreak: 3 },
  custom:  { workDuration: 25, shortBreakDuration: 5,  longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
};

interface TimerState {
  mode: TimerMode;
  secondsLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  settings: TimerSettings;

  applyPreset: (preset: TimerPreset) => void;
  updateSettings: (settings: Partial<TimerSettings>) => void;
  setMode: (mode: TimerMode) => void;
  tick: () => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  nextSession: (autoStart?: boolean) => void;
  resetAll: () => void;
}

const defaultSettings: TimerSettings = {
  preset: "classic",
  ...PRESETS.classic,
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

      applyPreset: (preset) => {
        const values = PRESETS[preset];
        const merged: TimerSettings = { preset, ...values };
        set({ settings: merged, mode: "work", secondsLeft: values.workDuration * 60, isRunning: false });
      },

      updateSettings: (newSettings) => {
        const { settings, mode } = get();
        const merged = { ...settings, ...newSettings, preset: "custom" as TimerPreset };
        set({ settings: merged, secondsLeft: getDuration(mode, merged), isRunning: false });
      },

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

      nextSession: (autoStart = false) => {
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
          isRunning: autoStart,
          sessionsCompleted: newSessionsCompleted,
        });
      },

      resetAll: () => {
        const { settings } = get();
        set({ mode: "work", secondsLeft: getDuration("work", settings), isRunning: false, sessionsCompleted: 0 });
      },
    }),
    {
      name: "focusflow-timer",
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
