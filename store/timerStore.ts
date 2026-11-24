"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { remainingSeconds, elapsedSeconds, isAbandoned } from "@/lib/timerClock";

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

  // Échéances (epoch ms) : le décompte se calcule depuis l'horloge, pas depuis les ticks.
  // endsAt : fin du cycle en cours (null si en pause). flowStartedAt : départ « virtuel »
  // du flowtime (maintenant moins le temps déjà accumulé), null si en pause.
  endsAt: number | null;
  flowStartedAt: number | null;
  // Une session a été démarrée et pas terminée (survit à la navigation et au rechargement).
  active: boolean;
  updatedAt: number | null;

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

const isFlowWork = (s: Pick<TimerState, "mode" | "settings">) =>
  s.settings.preset === "flowtime" && s.mode === "work";

/** Flowtime : secondes accumulées à l'instant `now` (valeur figée si en pause). */
function liveFlowSeconds(s: TimerState, now: number): number {
  return s.isRunning && s.flowStartedAt != null
    ? elapsedSeconds(s.flowStartedAt, now)
    : s.flowSeconds;
}

const CLEARED = { endsAt: null, flowStartedAt: null } as const;

/** Forme persistée. */
type PersistedTimer = Pick<
  TimerState,
  | "settings" | "mode" | "secondsLeft" | "endsAt" | "isRunning" | "sessionsCompleted"
  | "flowSeconds" | "flowStartedAt" | "flowMinutesTotal" | "flowBreakTotal" | "active" | "updatedAt"
>;

export const TIMER_PERSIST_VERSION = 1;

/** v0 (settings seul) -> v1 : les champs de session absents prennent les défauts au merge. */
export function migrateTimerState(persisted: unknown, version: number): Partial<PersistedTimer> {
  const p = (persisted ?? {}) as Partial<PersistedTimer>;
  if (version < 1) return { settings: p.settings };
  return p;
}

/** Fusionne l'état persisté avec l'état courant : rattrape l'horloge, abandonne les vieilles sessions. */
export function mergeTimerState(
  persisted: unknown,
  current: TimerState,
  now: number = Date.now(),
): TimerState {
  const p = (persisted ?? {}) as Partial<PersistedTimer>;
  const settings = p.settings ?? current.settings;
  const merged: TimerState = {
    ...current,
    settings,
    mode: p.mode ?? "work",
    secondsLeft: typeof p.secondsLeft === "number" ? p.secondsLeft : getDuration(p.mode ?? "work", settings),
    endsAt: p.endsAt ?? null,
    isRunning: p.isRunning ?? false,
    sessionsCompleted: p.sessionsCompleted ?? 0,
    flowSeconds: p.flowSeconds ?? 0,
    flowStartedAt: p.flowStartedAt ?? null,
    flowMinutesTotal: p.flowMinutesTotal ?? 0,
    flowBreakTotal: p.flowBreakTotal ?? 0,
    active: p.active ?? false,
    updatedAt: p.updatedAt ?? null,
  };

  if (isAbandoned(merged, now)) {
    return {
      ...merged,
      mode: "work",
      secondsLeft: getDuration("work", settings),
      isRunning: false,
      sessionsCompleted: 0,
      flowSeconds: 0,
      flowMinutesTotal: 0,
      flowBreakTotal: 0,
      ...CLEARED,
      active: false,
      updatedAt: null,
    };
  }

  // Rattrapage : le temps a continué de couler pendant que l'app était fermée.
  if (merged.isRunning) {
    if (isFlowWork(merged) && merged.flowStartedAt != null) {
      merged.flowSeconds = elapsedSeconds(merged.flowStartedAt, now);
    } else if (merged.endsAt != null) {
      merged.secondsLeft = remainingSeconds(merged.endsAt, now);
    }
  }
  return merged;
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

      endsAt: null,
      flowStartedAt: null,
      active: false,
      updatedAt: null,

      applyPreset: (preset) => {
        const values = PRESETS[preset];
        const merged: TimerSettings = { preset, ...values };
        set({ settings: merged, mode: "work", secondsLeft: values.workDuration * 60, isRunning: false, flowSeconds: 0, ...CLEARED });
      },

      updateSettings: (newSettings) => {
        const { settings, mode } = get();
        const merged = { ...settings, ...newSettings, preset: "custom" as TimerPreset };
        set({ settings: merged, secondsLeft: getDuration(mode, merged), isRunning: false, ...CLEARED });
      },

      setMode: (mode) => {
        const { settings } = get();
        set({ mode, secondsLeft: getDuration(mode, settings), isRunning: false, flowSeconds: 0, ...CLEARED });
      },

      // Recalcule depuis l'horloge (idempotent : appelable à tout moment, en retard ou non).
      tick: () => {
        const s = get();
        if (!s.isRunning) return;
        const now = Date.now();
        if (isFlowWork(s)) {
          const flow = liveFlowSeconds(s, now);
          if (flow !== s.flowSeconds) set({ flowSeconds: flow });
          return;
        }
        if (s.endsAt == null) {
          // Etat sans échéance (ne devrait pas arriver) : on en pose une.
          set({ endsAt: now + s.secondsLeft * 1000 });
          return;
        }
        const left = remainingSeconds(s.endsAt, now);
        if (left !== s.secondsLeft) set({ secondsLeft: left });
      },

      start: () => {
        const s = get();
        const now = Date.now();
        if (isFlowWork(s)) {
          set({
            isRunning: true,
            flowStartedAt: s.isRunning && s.flowStartedAt != null ? s.flowStartedAt : now - s.flowSeconds * 1000,
            endsAt: null,
            active: true,
            updatedAt: now,
          });
        } else {
          set({
            isRunning: true,
            endsAt: s.isRunning && s.endsAt != null ? s.endsAt : now + s.secondsLeft * 1000,
            flowStartedAt: null,
            active: true,
            updatedAt: now,
          });
        }
      },

      pause: () => {
        const s = get();
        const now = Date.now();
        if (!s.isRunning) return;
        if (isFlowWork(s)) {
          set({ isRunning: false, flowSeconds: liveFlowSeconds(s, now), ...CLEARED, updatedAt: now });
        } else {
          set({
            isRunning: false,
            secondsLeft: s.endsAt != null ? remainingSeconds(s.endsAt, now) : s.secondsLeft,
            ...CLEARED,
            updatedAt: now,
          });
        }
      },

      reset: () => {
        const { mode, settings } = get();
        set({ secondsLeft: getDuration(mode, settings), isRunning: false, flowSeconds: 0, ...CLEARED });
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

        const now = Date.now();
        const duration = getDuration(nextMode, settings);
        const flowWork = settings.preset === "flowtime" && nextMode === "work";
        set({
          mode: nextMode,
          secondsLeft: duration,
          isRunning: autoStart,
          sessionsCompleted: newSessionsCompleted,
          flowSeconds: 0,
          endsAt: autoStart && !flowWork ? now + duration * 1000 : null,
          flowStartedAt: autoStart && flowWork ? now : null,
          updatedAt: now,
        });
      },

      // Flowtime: end the current stretch — bank the minutes and start the earned break.
      finishFlow: () => {
        const s = get();
        if (s.settings.preset !== "flowtime") return;
        const now = Date.now();
        const flowSeconds = liveFlowSeconds(s, now);
        const breakSec = flowBreakSeconds(flowSeconds);
        set({
          mode: "short-break",
          secondsLeft: breakSec,
          flowBreakTotal: breakSec,
          isRunning: true,
          sessionsCompleted: s.sessionsCompleted + 1,
          flowMinutesTotal: s.flowMinutesTotal + Math.round(flowSeconds / 60),
          flowSeconds: 0,
          endsAt: now + breakSec * 1000,
          flowStartedAt: null,
          updatedAt: now,
        });
      },

      // Flowtime: bank the current stretch without starting a break (used when leaving
      // the session mid-flow). Returns the minutes banked.
      accumulateFlow: () => {
        const s = get();
        const now = Date.now();
        const minutes = Math.round(liveFlowSeconds(s, now) / 60);
        set({
          flowMinutesTotal: s.flowMinutesTotal + minutes,
          flowSeconds: 0,
          flowStartedAt: s.isRunning && isFlowWork(s) ? now : null,
        });
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
          ...CLEARED,
          active: false,
          updatedAt: null,
        });
      },
    }),
    {
      name: "focusflow-timer",
      version: TIMER_PERSIST_VERSION,
      migrate: (persisted, version) => migrateTimerState(persisted, version) as TimerState,
      partialize: (state): PersistedTimer => ({
        settings: state.settings,
        mode: state.mode,
        secondsLeft: state.secondsLeft,
        endsAt: state.endsAt,
        isRunning: state.isRunning,
        sessionsCompleted: state.sessionsCompleted,
        flowSeconds: state.flowSeconds,
        flowStartedAt: state.flowStartedAt,
        flowMinutesTotal: state.flowMinutesTotal,
        flowBreakTotal: state.flowBreakTotal,
        active: state.active,
        updatedAt: state.updatedAt,
      }),
      merge: (persisted, current) => mergeTimerState(persisted, current),
    }
  )
);
