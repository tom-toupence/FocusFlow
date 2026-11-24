// « Emporter la session sur le téléphone » (lot 7) : sérialisation de la session
// côté ordinateur et reconstruction côté téléphone. Les fonctions de ce fichier
// sont PURES (testées dans handoff.test.ts) ; l'hydratation des stores est dans
// handoffApply.ts.
//
// Crédit unique : à l'accusé de réception, l'ordinateur crédite le travail déjà
// fait du cycle (cycleSeconds − secondsLeft, au moment de l'envoi) par le même
// chemin que « Terminer ». Le téléphone reçoit un cycle dont la durée créditable
// est exactement ce qui restait (cycleSeconds = secondsLeft envoyé). La somme
// des deux crédits vaut le cycle, jamais plus. En Flowtime, l'ordinateur banque
// tout le flow et le téléphone repart d'un flow à zéro.

import type { TimerMode, TimerSettings } from "@/store/timerStore";
import type { Todo } from "@/store/sessionStore";
import type { YouTubeSource } from "@/lib/playback/youtube";
import { clip, MAX_TODOS, MAX_TRACKS, MAX_TITLE, type HandoffMedia, type HandoffState, type HandoffTodo } from "./protocol";

/** Ce que l'ordinateur lit de son minuteur au moment de l'envoi. */
export interface TimerSnapshot {
  settings: TimerSettings;
  mode: TimerMode;
  isRunning: boolean;
  endsAt: number | null;
  secondsLeft: number;
  cycleSeconds: number;
  sessionsCompleted: number;
  stopAt: number | null;
  flowBreakTotal: number;
}

/** Ce que l'ordinateur sait du média en cours. */
export interface MediaSnapshot {
  kind: "youtube" | "spotify" | "twitch";
  youtube: YouTubeSource | null;
  spotifyUri: string | null;
  twitch: { channel?: string; vodId?: string } | null;
  /** Piste en cours (id YouTube) et position (s) dans la piste. */
  trackId: string | null;
  position: number | null;
  playing: boolean;
}

const YT_ID = /^[\w-]{11}$/;

/** Restant exact à l'instant `now` (depuis l'échéance quand le minuteur tourne). */
export function secondsLeftAt(t: Pick<TimerSnapshot, "isRunning" | "endsAt" | "secondsLeft">, now: number): number {
  return t.isRunning && t.endsAt != null ? Math.max(0, Math.ceil((t.endsAt - now) / 1000)) : t.secondsLeft;
}

export function mediaForHandoff(m: MediaSnapshot): HandoffMedia {
  if (m.kind === "spotify") return m.spotifyUri ? { kind: "spotify", uri: m.spotifyUri } : { kind: "none" };
  if (m.kind === "twitch") {
    const channel = m.twitch?.channel ?? null;
    const vodId = m.twitch?.vodId ?? null;
    return channel || vodId ? { kind: "twitch", channel: vodId ? null : channel, vodId } : { kind: "none" };
  }
  const y = m.youtube;
  const position = Math.max(0, Math.round((m.position ?? 0) * 10) / 10);
  if (!y) return { kind: "none" };
  if (y.type === "radio") return { kind: "radio" };
  if (y.type === "native") return { kind: "native", listId: y.listId, title: clip(y.title || "Playlist YouTube") };
  if (y.type === "video") {
    return { kind: "video", id: y.id, title: clip(y.title || "Vidéo"), sub: y.subtitle ? clip(y.subtitle) : null, position, playing: m.playing };
  }
  // File maison : la piste en cours d'abord, puis la suite dans l'ordre (bornée).
  const all = y.tracks.filter((t) => YT_ID.test(t.id));
  if (all.length === 0) return { kind: "none" };
  const cur = Math.max(0, all.findIndex((t) => t.id === m.trackId));
  const rotated = [...all.slice(cur), ...all.slice(0, cur)].slice(0, MAX_TRACKS);
  const onTrack = m.trackId != null && rotated[0].id === m.trackId;
  return {
    kind: "queue",
    tracks: rotated.map((t) => ({ id: t.id, title: clip(t.title || "Titre") })),
    index: 0,
    subtitle: y.subtitle ? clip(y.subtitle) : null,
    position: onTrack ? position : 0,
    playing: m.playing,
  };
}

/**
 * Tâches de LA SESSION : celles qui ne sont pas terminées, et celles terminées
 * pendant la session (pas les terminées avant son départ).
 */
export function sessionTodos(todos: Todo[], doneAtStart: string[]): Todo[] {
  const before = new Set(doneAtStart);
  return todos.filter((t) => t.status !== "done" || !before.has(t.id));
}

/** Tâches transférées : les non terminées d'abord, bornées. */
export function todosForHandoff(todos: Todo[]): HandoffTodo[] {
  const valid = todos.filter((t) => /^[A-Za-z0-9_-]{1,64}$/.test(t.id) && t.text.trim().length > 0);
  const ordered = [...valid.filter((t) => t.status !== "done"), ...valid.filter((t) => t.status === "done")];
  return ordered.slice(0, MAX_TODOS).map((t) => ({ id: t.id, text: clip(t.text, MAX_TITLE), status: t.status }));
}

export function buildHandoffState(timer: TimerSnapshot, todos: Todo[], media: MediaSnapshot, now: number): HandoffState {
  const flowWork = timer.settings.preset === "flowtime" && timer.mode === "work";
  const left = flowWork ? 0 : secondsLeftAt(timer, now);
  return {
    timer: {
      settings: {
        preset: timer.settings.preset,
        workDuration: Math.round(timer.settings.workDuration),
        shortBreakDuration: Math.round(timer.settings.shortBreakDuration),
        longBreakDuration: Math.round(timer.settings.longBreakDuration),
        sessionsBeforeLongBreak: Math.round(timer.settings.sessionsBeforeLongBreak),
      },
      mode: timer.mode,
      running: timer.isRunning,
      endsAt: timer.isRunning && !flowWork ? timer.endsAt : null,
      secondsLeft: left,
      cycleSeconds: Math.max(left, Math.round(timer.cycleSeconds)),
      sessionsCompleted: timer.sessionsCompleted,
      stopAt: timer.settings.preset === "flowtime" ? null : timer.stopAt,
      flowBreakTotal: Math.round(timer.flowBreakTotal),
    },
    todos: todosForHandoff(todos),
    media: mediaForHandoff(media),
  };
}

/** Taille max du handoff en clair (octets UTF-8) : scellé, il reste sous 160 Ko. */
export const HANDOFF_MAX_BYTES = 110 * 1024;

const byteSize = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;

/**
 * Réduit l'état jusqu'à ce qu'il tienne : d'abord la file (moitié par moitié,
 * la piste en cours reste en tête), puis les tâches.
 */
export function fitHandoff(state: HandoffState, maxBytes = HANDOFF_MAX_BYTES): HandoffState {
  let s = state;
  while (byteSize(s) > maxBytes) {
    const m = s.media;
    if (m.kind === "queue" && m.tracks.length > 1) {
      s = { ...s, media: { ...m, tracks: m.tracks.slice(0, Math.ceil(m.tracks.length / 2)) } };
    } else if (s.todos.length > 0) {
      s = { ...s, todos: s.todos.slice(0, Math.floor(s.todos.length / 2)) };
    } else break;
  }
  return s;
}

/**
 * Part créditée par chacun : l'ordinateur, le travail fait au moment de
 * l'envoi ; le téléphone, ce qui restait (la durée créditable de son cycle).
 * Hors travail (pause) : rien à créditer.
 */
export function splitCredit(mode: TimerMode, cycleSeconds: number, secondsLeftAtSend: number) {
  if (mode !== "work") return { hostSeconds: 0, phoneCycleSeconds: cycleSeconds };
  const left = Math.max(0, Math.min(cycleSeconds, secondsLeftAtSend));
  return { hostSeconds: cycleSeconds - left, phoneCycleSeconds: left };
}

/** Patch du minuteur du téléphone. `offsetMs` = horloge téléphone − horloge ordinateur. */
export interface PhoneTimerPatch {
  settings: TimerSettings;
  mode: TimerMode;
  secondsLeft: number;
  cycleSeconds: number;
  isRunning: boolean;
  endsAt: number | null;
  flowSeconds: number;
  flowStartedAt: number | null;
  flowMinutesTotal: number;
  flowBreakTotal: number;
  sessionsCompleted: number;
  stopAt: number | null;
  stopReached: boolean;
  active: boolean;
  updatedAt: number;
}

export function phoneTimerPatch(h: HandoffState, offsetMs: number, now: number): PhoneTimerPatch {
  const t = h.timer;
  const flowWork = t.settings.preset === "flowtime" && t.mode === "work";
  const endsAt = t.endsAt != null ? t.endsAt + offsetMs : null;
  const running = t.running;
  const secondsLeft = flowWork ? t.secondsLeft : running && endsAt != null ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : t.secondsLeft;
  const { phoneCycleSeconds } = splitCredit(t.mode, t.cycleSeconds, t.secondsLeft);
  return {
    settings: { ...t.settings },
    mode: t.mode,
    secondsLeft,
    // Au moins le restant affiché : la barre de progression reste bornée.
    cycleSeconds: flowWork ? t.cycleSeconds : Math.max(secondsLeft, phoneCycleSeconds),
    isRunning: running,
    endsAt: running && !flowWork ? (endsAt ?? now + secondsLeft * 1000) : null,
    flowSeconds: 0,
    flowStartedAt: running && flowWork ? now : null,
    flowMinutesTotal: 0,
    flowBreakTotal: t.flowBreakTotal,
    sessionsCompleted: t.sessionsCompleted,
    stopAt: t.stopAt != null ? t.stopAt + offsetMs : null,
    stopReached: false,
    active: true,
    updatedAt: now,
  };
}

/**
 * La session active de cet appareil EST celle qu'on reçoit (même navigateur :
 * un autre onglet, ou les tests). La clore la créditerait une deuxième fois.
 */
export function isSameSession(
  local: { active: boolean; mode: TimerMode; sessionsCompleted: number; isRunning: boolean; endsAt: number | null; secondsLeft: number; settings: { preset: string } },
  h: HandoffState,
  offsetMs: number,
): boolean {
  if (!local.active) return false;
  const t = h.timer;
  if (local.mode !== t.mode || local.sessionsCompleted !== t.sessionsCompleted || local.settings.preset !== t.settings.preset) return false;
  if (t.running && t.endsAt != null) return local.isRunning && local.endsAt != null && Math.abs(local.endsAt - (t.endsAt + offsetMs)) < 3000;
  return !local.isRunning && local.secondsLeft === t.secondsLeft;
}

/**
 * Fusion des tâches par id : une tâche déjà connue du téléphone ne prend que le
 * statut (son texte, peut-être modifié ailleurs, n'est pas réécrit) ; les
 * autres sont ajoutées.
 */
export function mergeTodos(local: Todo[], incoming: HandoffTodo[], today: string): Todo[] {
  const byId = new Map(incoming.map((t) => [t.id, t]));
  const merged = local.map((t) => {
    const x = byId.get(t.id);
    if (!x) return t;
    byId.delete(t.id);
    if (x.status === t.status) return t;
    return { ...t, status: x.status, completedAt: x.status === "done" ? (t.completedAt ?? today) : undefined };
  });
  for (const x of byId.values()) {
    merged.push({ id: x.id, text: x.text, status: x.status, createdAt: today, completedAt: x.status === "done" ? today : undefined, priority: "normal", pomodoroEstimate: 1, pomodorosUsed: 0 });
  }
  return merged;
}

/** Seconde de reprise au moment du toucher (la piste a continué de jouer depuis la mesure). */
export function resumePosition(position: number, playing: boolean, measuredAt: number, now: number): number {
  return Math.max(0, position + (playing ? Math.max(0, now - measuredAt) / 1000 : 0));
}
