// Agenda -> minuteur : ce que le timerStore applique au démarrage d'un cycle
// de travail (durée raccourcie, ou « pas assez de temps ») et à la fin d'un
// cycle (pause rallongée jusqu'à la fin de la réunion). Logique pure : le store
// fournit l'heure, les réglages et les événements.
//
// Choix assumé : quand une réunion tombe avant la fin du pomodoro, la durée
// est ajustée PAR DÉFAUT et la proposition est affichée sous le minuteur,
// annulable en un clic (« Garder 25 min »). Jamais de décision silencieuse.

import { fitCurrentCycle, type BusyEvent } from "@/lib/agendaFit";
import { toAgendaSettings, type StopSettings } from "@/lib/stopPlan";

export type AgendaNotice =
  /** Cycle raccourci pour finir avant l'événement. */
  | { kind: "fit"; event: BusyEvent; seconds: number; fullSeconds: number; endsAt: number }
  /** Pas assez de temps pour un pomodoro avant l'événement (ou événement en cours). */
  | { kind: "tooShort"; event: BusyEvent; until: number; fullSeconds: number; inProgress: boolean }
  /** La réunion est finie : invitation à reprendre. */
  | { kind: "resume"; event: BusyEvent };

/** Pause rallongée jusqu'à la fin d'une réunion. */
export interface AgendaMeeting {
  event: BusyEvent;
  until: number;
}

/** Clé stable d'un événement (pour l'ignorer le temps d'une session ou d'un cycle). */
export function eventKey(e: BusyEvent): string {
  return `${e.start}|${e.end}|${e.title ?? ""}`;
}

/** Libellé d'un événement : son titre, ou « Réunion ». */
export function eventLabel(e: Pick<BusyEvent, "title">): string {
  const t = e.title?.trim();
  return t ? t : "Réunion";
}

export function activeEvents(events: BusyEvent[], ignored: string[], now: number): BusyEvent[] {
  if (events.length === 0) return events;
  const skip = new Set(ignored);
  return events.filter((e) => e.end > now && !skip.has(eventKey(e)));
}

export type WorkFit =
  | { kind: "none" }
  | { kind: "fit"; seconds: number; notice: Extract<AgendaNotice, { kind: "fit" }> }
  | { kind: "tooShort"; notice: Extract<AgendaNotice, { kind: "tooShort" }> };

/**
 * Cycle de travail qui démarre à `now` pour `baseSeconds` (durée du preset ou
 * du plan « Dernier train ») : raccourci si un événement tombe avant sa fin.
 * L'heure d'arrêt est déjà dans `baseSeconds` : la contrainte la plus proche gagne.
 */
export function workFit(args: {
  now: number;
  baseSeconds: number;
  settings: StopSettings;
  events: BusyEvent[];
  minWorkMin?: number;
}): WorkFit {
  const { now, baseSeconds, events } = args;
  if (events.length === 0 || baseSeconds <= 0) return { kind: "none" };
  const r = fitCurrentCycle({
    now,
    settings: toAgendaSettings(args.settings),
    cycle: { mode: "work", remainingSec: baseSeconds, sessionsCompleted: 0 },
    events,
    minWorkMin: args.minWorkMin,
  });
  if (!r || r.reason !== "event" || !r.event) return { kind: "none" };
  if ("tooShort" in r) {
    return {
      kind: "tooShort",
      notice: { kind: "tooShort", event: r.event, until: r.until, fullSeconds: baseSeconds, inProgress: r.event.start <= now },
    };
  }
  if (r.seconds >= baseSeconds) return { kind: "none" };
  return {
    kind: "fit",
    seconds: r.seconds,
    notice: { kind: "fit", event: r.event, seconds: r.seconds, fullSeconds: baseSeconds, endsAt: r.endsAt },
  };
}

/**
 * Pause qui commence à `now` pour `breakSeconds` : si aucun pomodoro utile ne
 * tient entre sa fin et la prochaine réunion (ou si la réunion est en cours),
 * elle est rallongée jusqu'à la fin de la réunion (sans dépasser l'heure d'arrêt).
 */
export function breakExtension(args: {
  now: number;
  breakSeconds: number;
  settings: StopSettings;
  events: BusyEvent[];
  stopAt?: number | null;
}): { seconds: number; meeting: AgendaMeeting | null } {
  const { now, breakSeconds, events, stopAt } = args;
  const none = { seconds: breakSeconds, meeting: null };
  if (events.length === 0) return none;
  const breakEnd = now + breakSeconds * 1000;
  const r = fitCurrentCycle({ now: breakEnd, settings: toAgendaSettings(args.settings), events });
  if (!r || !("tooShort" in r) || r.reason !== "event" || !r.event) return none;
  const until = stopAt != null ? Math.min(r.until, Math.max(stopAt, breakEnd)) : r.until;
  if (until <= breakEnd) return none;
  return { seconds: Math.ceil((until - now) / 1000), meeting: { event: r.event, until } };
}
