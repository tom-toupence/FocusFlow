"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { remainingSeconds, elapsedSeconds, isAbandoned } from "@/lib/timerClock";
import { nextCycleSeconds } from "@/lib/stopPlan";
import { freshCursor, stepVideoSync, MIN_CREDIT_SEC, type VideoSyncEvent, type VideoSyncState, type VideoSyncView } from "@/lib/videoSync";
import type { VideoSchedule } from "@/lib/videoSchedule";
import { activeEvents, breakExtension, eventKey, workFit, type AgendaMeeting, type AgendaNotice } from "@/lib/agendaTimer";
import { useAgendaStore } from "@/store/agendaStore";

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
  // « Dernier train » : heure d'arrêt de la session (epoch ms), null = pas d'heure.
  // Ignorée en Flowtime. Les durées des cycles viennent alors de planUntil.
  stopAt: number | null;
  // Durée réelle (s) du cycle courant, posée à son démarrage : c'est elle qui est
  // créditée (stats, XP, projets), pas settings.workDuration.
  cycleSeconds: number;
  // Plan épuisé : l'heure d'arrêt est atteinte, la session attend (rien ne tourne).
  stopReached: boolean;
  // Vrai une fois l'état persisté relu (skipHydration + TimerHydrator) : tant que
  // c'est faux, le store porte les valeurs par défaut et ne doit pas être ré-écrit.
  hydrated: boolean;
  // « Calé sur la vidéo » : le minuteur est piloté par le temps de la vidéo
  // (mode et secondes viennent de syncVideo, plus de endsAt). Non persisté :
  // au rechargement, la session repart en minuteur normal puis se recale.
  videoSync: VideoSyncState | null;
  // Dernier état calculé (bloc n / total, phase) pour l'affichage.
  videoSyncView: VideoSyncView | null;
  // Persisté : une session calée est en cours sur cette vidéo. Au rechargement
  // (ou au retour sur /session), tick reste inerte jusqu'à la reprise du calage,
  // au lieu de repartir sur des valeurs périmées. Effacé par stopVideoSync.
  // `gap` : la vidéo était dans un trou (intro…), rien n'y est créditable.
  videoSyncActive: { videoId: string; gap?: boolean } | null;

  // Agenda (lot 4) : proposition affichée sous le minuteur (non persistée),
  // réunion pendant laquelle la pause est rallongée (persistée), événements
  // ignorés pour la session ou pour le cycle en cours (« Garder 25 min »).
  agendaNotice: AgendaNotice | null;
  agendaMeeting: AgendaMeeting | null;
  agendaIgnored: string[];
  agendaCycleIgnored: string[];

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
  setStopAt: (stopAt: number | null) => void;
  // « Encore un pomodoro » après l'heure d'arrêt : efface l'heure et lance un cycle normal.
  continueAfterStop: () => void;
  // Fin de session : désactive sans effacer sessionsCompleted/flowMinutesTotal (lus par /summary).
  endSession: () => void;
  /** Active le pilotage par la vidéo (le premier syncVideo pose mode et secondes). */
  /**
   * Active le pilotage par la vidéo (le premier syncVideo pose mode et secondes).
   * Rend les secondes de travail du cycle normal écoulées avant la bascule, à
   * créditer en partiel (0 à la reprise d'une session déjà calée).
   */
  startVideoSync: (videoId: string, schedule: VideoSchedule) => number;
  /** La vidéo est à `t` s : recale le minuteur, rend les transitions à traiter. */
  syncVideo: (t: number, wallMs?: number) => VideoSyncEvent[];
  /** Retour au minuteur normal : `fresh` = nouveau cycle de travail, sinon on continue le décompte en cours. */
  stopVideoSync: (fresh?: boolean) => void;
  /**
   * Sortie de /session (démontage, pagehide) en plein calage : rend les secondes
   * de travail jouées à créditer (une seule fois : elles sont remises à zéro) et
   * garde videoSyncActive pour reprendre le calage au retour.
   */
  suspendVideoSync: () => number;
  /** Agenda : annule le raccourci du cycle en cours (durée pleine). */
  keepFullCycle: () => void;
  /** Agenda : oublie l'événement de la proposition pour la session. */
  ignoreAgendaEvent: () => void;
  /** Agenda : « Attendre » la fin de la réunion (pause jusqu'à sa fin). */
  waitForMeeting: () => void;
  dismissAgendaNotice: () => void;
  /** Agenda relu : ajuste le cycle de travail en cours s'il chevauche un événement. */
  refitAgenda: () => void;
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

/** État « heure d'arrêt atteinte » : attente, rien ne tourne. Le cycle affiché reste un cycle neuf. */
const STOP_REACHED = (settings: TimerSettings, now: number) => ({
  mode: "work" as TimerMode,
  secondsLeft: settings.workDuration * 60,
  cycleSeconds: settings.workDuration * 60,
  isRunning: false,
  flowSeconds: 0,
  endsAt: null,
  flowStartedAt: null,
  stopReached: true,
  updatedAt: now,
});

const CLEARED = { endsAt: null, flowStartedAt: null } as const;
const NO_SYNC = { videoSync: null, videoSyncView: null, videoSyncActive: null } as const;
/** Calage en cours ou en attente de reprise : l'horloge ne fait pas avancer le minuteur. */
const synced = (s: Pick<TimerState, "videoSync" | "videoSyncActive">) => s.videoSync != null || s.videoSyncActive != null;

const NO_AGENDA = { agendaNotice: null, agendaMeeting: null, agendaIgnored: [] as string[], agendaCycleIgnored: [] as string[] };

/** L'agenda s'applique : ni en Flowtime (pas de durée), ni calé sur la vidéo (rythme du créateur). */
const agendaOn = (s: Pick<TimerState, "settings" | "videoSync" | "videoSyncActive">) =>
  s.settings.preset !== "flowtime" && !synced(s);

/** Événements à respecter maintenant (hors ignorés pour la session et le cycle). */
const agendaEventsFor = (s: Pick<TimerState, "agendaIgnored" | "agendaCycleIgnored">, now: number, extra: string[] = []) =>
  activeEvents(useAgendaStore.getState().events, [...s.agendaIgnored, ...s.agendaCycleIgnored, ...extra], now);

/** Heure d'arrêt applicable (pas en Flowtime). */
const stopAtOf = (s: Pick<TimerState, "stopAt" | "settings">): number | null =>
  s.settings.preset === "flowtime" ? null : s.stopAt;

/** Forme persistée. */
type PersistedTimer = Pick<
  TimerState,
  | "settings" | "mode" | "secondsLeft" | "endsAt" | "isRunning" | "sessionsCompleted"
  | "flowSeconds" | "flowStartedAt" | "flowMinutesTotal" | "flowBreakTotal" | "active" | "updatedAt"
  | "stopAt" | "cycleSeconds" | "stopReached" | "videoSyncActive" | "agendaMeeting"
>;

export const TIMER_PERSIST_VERSION = 2;

/** v0 (settings seul) -> v1 -> v2 (stopAt, cycleSeconds, stopReached) : les champs absents prennent les défauts au merge. */
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
    stopAt: p.stopAt ?? null,
    cycleSeconds: typeof p.cycleSeconds === "number" ? p.cycleSeconds : getDuration(p.mode ?? "work", settings),
    stopReached: p.stopReached ?? false,
    videoSyncActive: p.videoSyncActive ?? null,
    agendaMeeting: p.agendaMeeting ?? null,
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
      stopAt: null,
      cycleSeconds: getDuration("work", settings),
      stopReached: false,
      videoSyncActive: null,
      agendaMeeting: null,
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
      stopAt: null,
      cycleSeconds: defaultSettings.workDuration * 60,
      stopReached: false,
      hydrated: false,
      videoSync: null,
      videoSyncView: null,
      videoSyncActive: null,
      agendaNotice: null,
      agendaMeeting: null,
      agendaIgnored: [],
      agendaCycleIgnored: [],

      applyPreset: (preset) => {
        const values = PRESETS[preset];
        const merged: TimerSettings = { preset, ...values };
        set({ settings: merged, mode: "work", secondsLeft: values.workDuration * 60, cycleSeconds: values.workDuration * 60, isRunning: false, flowSeconds: 0, stopReached: false, ...CLEARED, ...NO_SYNC });
      },

      updateSettings: (newSettings) => {
        const { settings, mode } = get();
        const merged = { ...settings, ...newSettings, preset: "custom" as TimerPreset };
        set({ settings: merged, secondsLeft: getDuration(mode, merged), cycleSeconds: getDuration(mode, merged), isRunning: false, ...CLEARED });
      },

      setMode: (mode) => {
        const { settings } = get();
        set({ mode, secondsLeft: getDuration(mode, settings), cycleSeconds: getDuration(mode, settings), isRunning: false, flowSeconds: 0, stopReached: false, ...CLEARED });
      },

      // Recalcule depuis l'horloge (idempotent : appelable à tout moment, en retard ou non).
      tick: () => {
        const s = get();
        if (!s.isRunning || synced(s)) return; // calé : c'est la vidéo qui fait avancer
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
        if (synced(s)) {
          set({ isRunning: true, endsAt: null, flowStartedAt: null, active: true, updatedAt: now });
          return;
        }
        if (isFlowWork(s)) {
          set({
            isRunning: true,
            flowStartedAt: s.isRunning && s.flowStartedAt != null ? s.flowStartedAt : now - s.flowSeconds * 1000,
            endsAt: null,
            active: true,
            updatedAt: now,
          });
        } else {
          if (s.stopReached) return;
          let secondsLeft = s.secondsLeft;
          let cycleSeconds = s.cycleSeconds;
          const stopAt = stopAtOf(s);
          // Cycle neuf avec heure d'arrêt : sa durée vient du plan, calculé maintenant.
          if (stopAt != null && !s.isRunning && (!s.active || s.secondsLeft === s.cycleSeconds)) {
            const planned = nextCycleSeconds({
              stopAt, now, mode: s.mode, settings: s.settings, sessionsCompleted: s.sessionsCompleted,
            });
            if (planned == null) {
              set({ ...STOP_REACHED(s.settings, now), active: true });
              return;
            }
            secondsLeft = planned;
            cycleSeconds = planned;
          }
          // Agenda : un cycle de travail neuf ne chevauche jamais un événement.
          // Raccourci par défaut (proposition visible, annulable) ; trop court :
          // on ne démarre pas et on demande. Un 2e démarrage = « quand même ».
          let agendaNotice = s.agendaNotice;
          let agendaCycleIgnored = s.agendaCycleIgnored;
          if (s.mode === "work" && agendaOn(s) && !s.isRunning && (!s.active || s.secondsLeft === s.cycleSeconds)) {
            if (agendaNotice?.kind === "tooShort") agendaCycleIgnored = [...agendaCycleIgnored, eventKey(agendaNotice.event)];
            const base = agendaNotice?.kind === "fit" && stopAt == null ? agendaNotice.fullSeconds : secondsLeft;
            const fit = workFit({
              now, baseSeconds: base, settings: s.settings,
              events: agendaEventsFor({ ...s, agendaCycleIgnored }, now),
            });
            if (fit.kind === "tooShort") {
              set({ agendaNotice: fit.notice, secondsLeft: base, cycleSeconds: base, active: true, updatedAt: now });
              return;
            }
            agendaNotice = fit.kind === "fit" ? fit.notice : null;
            secondsLeft = fit.kind === "fit" ? fit.seconds : base;
            cycleSeconds = secondsLeft;
          } else if (agendaNotice?.kind === "resume") {
            agendaNotice = null;
          }
          set({
            agendaNotice,
            agendaCycleIgnored,
            isRunning: true,
            secondsLeft,
            cycleSeconds,
            endsAt: s.isRunning && s.endsAt != null ? s.endsAt : now + secondsLeft * 1000,
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
        if (synced(s)) {
          set({ isRunning: false, ...CLEARED, updatedAt: now });
          return;
        }
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
        set({ secondsLeft: getDuration(mode, settings), cycleSeconds: getDuration(mode, settings), isRunning: false, flowSeconds: 0, ...CLEARED });
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
        let duration = getDuration(nextMode, settings);
        const flowWork = settings.preset === "flowtime" && nextMode === "work";
        const stopAt = stopAtOf(get());
        if (stopAt != null) {
          const planned = nextCycleSeconds({
            stopAt, now, mode: nextMode, settings, sessionsCompleted: newSessionsCompleted,
          });
          if (planned == null) {
            // Plan épuisé : on attend, sans enchaîner (pas d'autoStart).
            set({ ...STOP_REACHED(settings, now), sessionsCompleted: newSessionsCompleted });
            return;
          }
          duration = planned;
        }
        // Agenda : la pause tombe sur une réunion -> rallongée jusqu'à sa fin ;
        // fin de la réunion -> on attend « Reprendre » ; un cycle de travail
        // neuf ne chevauche jamais un événement.
        const cur = get();
        let run = autoStart;
        let agendaNotice: AgendaNotice | null = null;
        let agendaMeeting: AgendaMeeting | null = null;
        if (agendaOn(cur)) {
          const events = agendaEventsFor({ ...cur, agendaCycleIgnored: [] }, now);
          if (nextMode !== "work") {
            const ext = breakExtension({ now, breakSeconds: duration, settings, events, stopAt });
            duration = ext.seconds;
            agendaMeeting = ext.meeting;
          } else {
            const m = cur.agendaMeeting;
            if (m && now >= m.until - 1000) {
              agendaNotice = { kind: "resume", event: m.event };
              run = false;
            }
            const fit = workFit({ now, baseSeconds: duration, settings, events });
            if (fit.kind === "tooShort") {
              agendaNotice = fit.notice;
              run = false;
            } else if (fit.kind === "fit") {
              duration = fit.seconds;
              if (!agendaNotice) agendaNotice = fit.notice;
            }
          }
        }
        set({
          mode: nextMode,
          secondsLeft: duration,
          cycleSeconds: duration,
          stopReached: false,
          isRunning: run,
          sessionsCompleted: newSessionsCompleted,
          flowSeconds: 0,
          endsAt: run && !flowWork ? now + duration * 1000 : null,
          flowStartedAt: run && flowWork ? now : null,
          updatedAt: now,
          agendaNotice,
          agendaMeeting,
          agendaCycleIgnored: [],
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

      endSession: () => {
        set({ active: false, isRunning: false, endsAt: null, flowStartedAt: null, updatedAt: null, stopAt: null, stopReached: false, ...NO_SYNC, ...NO_AGENDA });
      },

      resetAll: () => {
        const { settings } = get();
        set({
          mode: "work",
          secondsLeft: getDuration("work", settings),
          cycleSeconds: getDuration("work", settings),
          isRunning: false,
          sessionsCompleted: 0,
          flowSeconds: 0,
          flowMinutesTotal: 0,
          flowBreakTotal: 0,
          ...CLEARED,
          active: false,
          updatedAt: null,
          stopAt: null,
          stopReached: false,
          ...NO_SYNC,
          ...NO_AGENDA,
        });
      },

      // Une heure déjà passée est ignorée (rien à planifier).
      // Une heure déjà passée, ou trop proche pour un seul pomodoro, équivaut à « pas d'heure ».
      setStopAt: (stopAt) => {
        const { settings } = get();
        const now = Date.now();
        const ok =
          stopAt != null && stopAt > now && settings.preset !== "flowtime" &&
          nextCycleSeconds({ stopAt, now, mode: "work", settings, sessionsCompleted: 0 }) != null;
        set({ stopAt: ok ? stopAt : null, stopReached: false });
      },

      continueAfterStop: () => {
        const { settings } = get();
        const now = Date.now();
        const duration = settings.workDuration * 60;
        set({
          stopAt: null,
          stopReached: false,
          mode: "work",
          secondsLeft: duration,
          cycleSeconds: duration,
          isRunning: true,
          endsAt: now + duration * 1000,
          flowStartedAt: null,
          active: true,
          updatedAt: now,
        });
      },

      startVideoSync: (videoId, schedule) => {
        // Flowtime et heure d'arrêt ont leur propre horloge : incompatibles.
        const s = get();
        if (s.settings.preset === "flowtime" || s.stopAt != null || schedule.length === 0) return 0;
        // Travail du cycle normal déjà fait (bascule en cours de cycle) ; rien à la
        // reprise d'un calage (ses secondes jouées ont été créditées à la sortie).
        const resuming = s.videoSyncActive?.videoId === videoId;
        const left = s.isRunning && s.endsAt != null ? remainingSeconds(s.endsAt, Date.now()) : s.secondsLeft;
        const elapsed = !resuming && s.mode === "work" && !s.stopReached ? Math.max(0, s.cycleSeconds - left) : 0;
        set({
          videoSync: { videoId, schedule, cursor: freshCursor() }, videoSyncView: null, videoSyncActive: { videoId, gap: false },
          ...CLEARED, stopReached: false, agendaNotice: null,
        });
        return elapsed;
      },

      syncVideo: (t, wallMs = Date.now()) => {
        const s = get();
        if (!s.videoSync) return [];
        const r = stepVideoSync(s.videoSync, t, wallMs);
        const completed = r.events.filter((e) => e.type === "work-end" && e.creditSec >= MIN_CREDIT_SEC).length;
        const patch: Partial<TimerState> = {
          videoSync: { ...s.videoSync, cursor: r.cursor },
          videoSyncView: r.view,
          sessionsCompleted: s.sessionsCompleted + completed,
          updatedAt: wallMs,
        };
        const gap = r.view?.phase === "gap";
        if (!!s.videoSyncActive?.gap !== gap) patch.videoSyncActive = { videoId: s.videoSync.videoId, gap };
        if (r.view) {
          patch.mode = r.view.mode;
          patch.secondsLeft = r.view.secondsLeft;
          patch.cycleSeconds = r.view.cycleSeconds;
        }
        set(patch);
        return r.events;
      },

      stopVideoSync: (fresh = false) => {
        const s = get();
        if (!synced(s)) return;
        const now = Date.now();
        // Un trou ne se prolonge jamais en décompte de travail (ce serait du crédit fantôme).
        if (fresh || s.videoSyncView?.phase === "gap" || s.videoSyncActive?.gap) {
          const duration = s.settings.workDuration * 60;
          set({
            ...NO_SYNC, mode: "work", secondsLeft: duration, cycleSeconds: duration,
            endsAt: s.isRunning ? now + duration * 1000 : null, flowStartedAt: null, updatedAt: now,
          });
        } else {
          // Le décompte en cours continue à l'horloge (crédit : cycleSeconds reste « joué + restant »).
          set({ ...NO_SYNC, endsAt: s.isRunning ? now + s.secondsLeft * 1000 : null, flowStartedAt: null, updatedAt: now });
        }
      },

      suspendVideoSync: () => {
        const s = get();
        if (!s.videoSync) return 0;
        const work = s.videoSyncView?.phase === "work";
        const credit = work ? Math.round(s.videoSync.cursor.workedSec) : 0;
        set({
          videoSync: null, videoSyncView: null,
          // Plus rien de « joué » dans le cycle : Terminer ou closeActiveSession ne recréditent pas.
          ...(work ? { cycleSeconds: s.secondsLeft } : {}),
          updatedAt: Date.now(),
        });
        return credit;
      },

      keepFullCycle: () => {
        const s = get();
        const n = s.agendaNotice;
        if (n?.kind !== "fit" || s.mode !== "work") return;
        const now = Date.now();
        const left = s.isRunning && s.endsAt != null ? remainingSeconds(s.endsAt, now) : s.secondsLeft;
        const secondsLeft = Math.max(0, left + n.fullSeconds - s.cycleSeconds);
        set({
          cycleSeconds: n.fullSeconds,
          secondsLeft,
          endsAt: s.isRunning ? now + secondsLeft * 1000 : null,
          agendaNotice: null,
          agendaCycleIgnored: [...s.agendaCycleIgnored, eventKey(n.event)],
          updatedAt: now,
        });
      },

      ignoreAgendaEvent: () => {
        const s = get();
        const n = s.agendaNotice;
        if (!n) return;
        set({ agendaIgnored: [...s.agendaIgnored, eventKey(n.event)] });
        if (n.kind === "fit") get().keepFullCycle();
        else if (n.kind === "tooShort") { set({ agendaNotice: null }); get().start(); }
        else set({ agendaNotice: null });
      },

      waitForMeeting: () => {
        const s = get();
        const n = s.agendaNotice;
        if (n?.kind !== "tooShort") return;
        const now = Date.now();
        const seconds = Math.max(1, Math.ceil((n.until - now) / 1000));
        set({
          mode: "short-break",
          secondsLeft: seconds,
          cycleSeconds: seconds,
          isRunning: true,
          endsAt: now + seconds * 1000,
          flowStartedAt: null,
          flowSeconds: 0,
          stopReached: false,
          active: true,
          agendaNotice: null,
          agendaMeeting: { event: n.event, until: n.until },
          agendaCycleIgnored: [],
          updatedAt: now,
        });
      },

      dismissAgendaNotice: () => set({ agendaNotice: null }),

      refitAgenda: () => {
        const s = get();
        if (!agendaOn(s) || s.mode !== "work" || s.stopReached || !s.isRunning || s.endsAt == null) return;
        const now = Date.now();
        const left = remainingSeconds(s.endsAt, now);
        const elapsed = Math.max(0, s.cycleSeconds - left);
        const events = agendaEventsFor(s, now);
        const full = s.agendaNotice?.kind === "fit" ? s.agendaNotice.fullSeconds : s.cycleSeconds;
        if (elapsed < 60) {
          // Cycle qui vient de démarrer (agenda arrivé juste après) : comme un départ.
          const fit = workFit({ now, baseSeconds: full - elapsed, settings: s.settings, events });
          if (fit.kind === "tooShort") {
            set({ isRunning: false, ...CLEARED, secondsLeft: full, cycleSeconds: full, agendaNotice: { ...fit.notice, fullSeconds: full }, updatedAt: now });
          } else if (fit.kind === "fit" && fit.seconds < left) {
            set({
              secondsLeft: fit.seconds, cycleSeconds: elapsed + fit.seconds, endsAt: now + fit.seconds * 1000,
              agendaNotice: { ...fit.notice, fullSeconds: full }, updatedAt: now,
            });
          }
          return;
        }
        // En plein cycle : on finit avant l'événement (au moins 1 min devant).
        const fit = workFit({ now, baseSeconds: left, settings: s.settings, events, minWorkMin: 1 });
        if (fit.kind === "fit" && fit.seconds < left) {
          set({
            secondsLeft: fit.seconds, cycleSeconds: elapsed + fit.seconds, endsAt: now + fit.seconds * 1000,
            agendaNotice: { ...fit.notice, fullSeconds: full }, updatedAt: now,
          });
        }
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
        stopAt: state.stopAt,
        cycleSeconds: state.cycleSeconds,
        stopReached: state.stopReached,
        videoSyncActive: state.videoSyncActive,
        agendaMeeting: state.agendaMeeting,
      }),
      merge: (persisted, current) => mergeTimerState(persisted, current),
      // Relu au montage par <TimerHydrator /> : le SSR et le 1er rendu client
      // partent tous deux des valeurs par défaut (pas de mismatch d'hydratation).
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useTimerStore.setState({ hydrated: true });
      },
    }
  )
);
