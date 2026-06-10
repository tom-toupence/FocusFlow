"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimerMode = "work" | "short-break" | "long-break";

export type TimerPreset = "classic" | "deep" | "custom" | "flowtime";

export interface TimerSettings {
  preset: TimerPreset;
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export const PRESETS: Record<TimerPreset, Omit<TimerSettings, "preset">> = {
  classic:  { workDuration: 25, shortBreakDuration: 5,  longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
  deep:     { workDuration: 50, shortBreakDuration: 10, longBreakDuration: 30, sessionsBeforeLongBreak: 3 },
  custom:   { workDuration: 25, shortBreakDuration: 5,  longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
  // Flowtime: work duration is open-ended; break = elapsed ÷ 5 (durations below are fallbacks)
  flowtime: { workDuration: 25, shortBreakDuration: 5,  longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
};

/** Earned break (seconds) for a flowtime stretch: elapsed ÷ 5, clamped 2–25 min. */
export function flowBreakSeconds(flowSeconds: number): number {
  return Math.min(25 * 60, Math.max(2 * 60, Math.round(flowSeconds / 5)));
}

interface TimerState {
  mode: TimerMode;
  secondsLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  settings: TimerSettings;

  // Flowtime: elapsed seconds of the current open-ended work stretch,
  // total focus minutes banked this session, and the length of the current earned break.
  flowSeconds: number;
  flowMinutesTotal: number;
  flowBreakTotal: number;

  applyPreset: (preset: TimerPreset) => void;
  updateSettings: (settings: Partial<TimerSettings>) => void;
  setMode: (mode: TimerMode) => void;
  tick: () => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  nextSession: (autoStart?: boolean) => void;
  finishFlow: () => void;
  accumulateFlow: () => number;
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

      flowSeconds: 0,
      flowMinutesTotal: 0,
      flowBreakTotal: 0,

      applyPreset: (preset) => {
        const values = PRESETS[preset];
        const merged: TimerSettings = { preset, ...values };
        set({ settings: merged, mode: "work", secondsLeft: values.workDuration * 60, isRunning: false, flowSeconds: 0 });
      },

      updateSettings: (newSettings) => {
        const { settings, mode } = get();
        const merged = { ...settings, ...newSettings, preset: "custom" as TimerPreset };
        set({ settings: merged, secondsLeft: getDuration(mode, merged), isRunning: false });
      },

      setMode: (mode) => {
        const { settings } = get();
        set({ mode, secondsLeft: getDuration(mode, settings), isRunning: false, flowSeconds: 0 });
      },

      tick: () => {
        const { secondsLeft, mode, settings, flowSeconds } = get();
        if (settings.preset === "flowtime" && mode === "work") {
          set({ flowSeconds: flowSeconds + 1 });
          return;
        }
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
        set({ secondsLeft: getDuration(mode, settings), isRunning: false, flowSeconds: 0 });
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
          flowSeconds: 0,
        });
      },

      // Flowtime: end the current stretch — bank the minutes and start the earned break.
      finishFlow: () => {
        const { settings, sessionsCompleted, flowSeconds, flowMinutesTotal } = get();
        if (settings.preset !== "flowtime") return;
        const breakSec = flowBreakSeconds(flowSeconds);
        set({
          mode: "short-break",
          secondsLeft: breakSec,
          flowBreakTotal: breakSec,
          isRunning: true,
          sessionsCompleted: sessionsCompleted + 1,
          flowMinutesTotal: flowMinutesTotal + Math.round(flowSeconds / 60),
          flowSeconds: 0,
        });
      },

      // Flowtime: bank the current stretch without starting a break (used when leaving
      // the session mid-flow). Returns the minutes banked.
      accumulateFlow: () => {
        const { flowSeconds, flowMinutesTotal } = get();
        const minutes = Math.round(flowSeconds / 60);
        set({ flowMinutesTotal: flowMinutesTotal + minutes, flowSeconds: 0 });
        return minutes;
      },

      resetAll: () => {
        const { settings } = get();
        set({
          mode: "work",
          secondsLeft: getDuration("work", settings),
          isRunning: false,
          sessionsCompleted: 0,
          flowSeconds: 0,
          flowMinutesTotal: 0,
          flowBreakTotal: 0,
        });
      },
    }),
    {
      name: "focusflow-timer",
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
