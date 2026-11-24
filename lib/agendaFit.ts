// Moteur commun « Dernier train » et « agenda » : adapte la durée des cycles
// à une heure d'arrêt et/ou à des événements occupés. Logique pure, sans store.
// Toutes les heures sont des epoch en ms ; les durées de réglages sont en minutes.

const MIN = 60_000;

export type AgendaMode = "work" | "short-break" | "long-break";

export interface AgendaSettings {
  work: number;
  short: number;
  long: number;
  sessionsBeforeLongBreak: number;
}

export interface AgendaCycle {
  mode: AgendaMode;
  remainingSec: number;
  sessionsCompleted: number;
}

export interface BusyEvent {
  start: number;
  end: number;
  title?: string;
}

export interface PlanInput {
  now: number;
  settings: AgendaSettings;
  cycle?: AgendaCycle;
  stopAt?: number | null;
  events?: BusyEvent[];
  /** Marge avant un événement, en minutes (défaut 5). */
  marginMin?: number;
  /** Durée minimale d'un pomodoro, en minutes (défaut 10). */
  minWorkMin?: number;
  /** Flowtime : non applicable, les fonctions renvoient null / plan vide. */
  flowtime?: boolean;
}

export interface FitProposal {
  seconds: number;
  reason: "event" | "stop";
  endsAt: number;
  event?: BusyEvent;
}

export interface FitTooShort {
  tooShort: true;
  /** Heure à partir de laquelle un cycle utile est possible. */
  until: number;
  reason: "event" | "stop";
  event?: BusyEvent;
}

export type FitResult = FitProposal | FitTooShort;

export interface PlannedCycle {
  mode: AgendaMode;
  start: number;
  end: number;
  seconds: number;
}

export interface Plan {
  cycles: PlannedCycle[];
  pomodoros: number;
  workSeconds: number;
  endsAt: number;
  stopAt: number;
  input: PlanInput;
}

export interface Goal {
  unit: "pomodoros" | "minutes";
  target: number;
}

const DEFAULT_MARGIN = 5;
const DEFAULT_MIN_WORK = 10;
const STRETCH_MAX = 1.5;

function sortedEvents(events: BusyEvent[] | undefined, from: number): BusyEvent[] {
  return (events ?? [])
    .filter((e) => e.end > e.start && e.end > from)
    .sort((a, b) => a.start - b.start);
}

/** Si t tombe dans la zone bloquée (marge incluse) d'un événement, renvoie la fin chaînée. */
function unblock(events: BusyEvent[], t: number, marginMs: number): { t: number; event?: BusyEvent } {
  let cur = t;
  let first: BusyEvent | undefined;
  let moved = true;
  while (moved) {
    moved = false;
    for (const e of events) {
      if (e.start - marginMs <= cur && cur < e.end) {
        cur = e.end;
        first ??= e;
        moved = true;
      }
    }
  }
  return { t: cur, event: first };
}

/** Premier événement dont la zone bloquée commence strictement après t. */
function nextEvent(events: BusyEvent[], t: number, marginMs: number): BusyEvent | undefined {
  return events.find((e) => e.start - marginMs > t);
}

/**
 * Durée proposée pour le cycle de travail qui démarre maintenant, si un
 * événement ou l'heure d'arrêt tombe avant sa fin naturelle. null si rien
 * ne gêne (ou Flowtime).
 */
export function fitCurrentCycle(input: PlanInput): FitResult | null {
  if (input.flowtime) return null;
  const { now, settings, cycle, stopAt } = input;
  const marginMs = (input.marginMin ?? DEFAULT_MARGIN) * MIN;
  const minWorkMs = (input.minWorkMin ?? DEFAULT_MIN_WORK) * MIN;
  const events = sortedEvents(input.events, now);
  const dur = (cycle && cycle.mode === "work" && cycle.remainingSec > 0 ? cycle.remainingSec : settings.work * 60) * 1000;
  const naturalEnd = now + dur;

  // Déjà dans la zone d'un événement : attendre sa fin (ou l'arrêt).
  const blocked = unblock(events, now, marginMs);
  if (blocked.t > now) {
    if (stopAt != null && stopAt <= blocked.t) return { tooShort: true, until: Math.max(stopAt, now), reason: "stop" };
    return { tooShort: true, until: blocked.t, reason: "event", event: blocked.event };
  }

  let limit = Infinity;
  let reason: "event" | "stop" = "stop";
  let event: BusyEvent | undefined;
  if (stopAt != null && stopAt < naturalEnd) {
    limit = stopAt;
    reason = "stop";
  }
  const ne = nextEvent(events, now, marginMs);
  if (ne && ne.start - marginMs < naturalEnd && ne.start - marginMs < limit) {
    limit = ne.start - marginMs;
    reason = "event";
    event = ne;
  }
  if (limit === Infinity) return null;

  const avail = limit - now;
  if (avail < minWorkMs) {
    if (reason === "stop") return { tooShort: true, until: Math.max(limit, now), reason };
    return { tooShort: true, until: unblock(events, event!.start, marginMs).t, reason, event };
  }
  const seconds = Math.floor(avail / MIN) * 60;
  return { seconds, reason, endsAt: now + seconds * 1000, ...(event ? { event } : {}) };
}

const emptyPlan = (stopAt: number, input: PlanInput): Plan => ({
  cycles: [],
  pomodoros: 0,
  workSeconds: 0,
  endsAt: input.now,
  stopAt,
  input,
});

/**
 * Cycles restants jusqu'à l'heure d'arrêt, en évitant les événements. Le
 * dernier cycle de travail d'un segment libre est étiré (+50 % max) ou
 * raccourci (>= minimum) pour finir pile ; la longue pause est raccourcie
 * (>= pause courte) si cela permet un pomodoro de plus.
 */
export function planUntil(stopAt: number, input: PlanInput): Plan {
  const { now, settings, cycle } = input;
  if (input.flowtime || stopAt <= now) return emptyPlan(stopAt, input);
  const marginMs = (input.marginMin ?? DEFAULT_MARGIN) * MIN;
  const minWorkMs = (input.minWorkMin ?? DEFAULT_MIN_WORK) * MIN;
  const events = sortedEvents(input.events, now);
  const W = settings.work * MIN;
  const S = settings.short * MIN;
  const L = settings.long * MIN;
  const N = Math.max(1, settings.sessionsBeforeLongBreak);

  const cycles: PlannedCycle[] = [];
  const push = (mode: AgendaMode, start: number, end: number) =>
    cycles.push({ mode, start, end, seconds: Math.round((end - start) / 1000) });

  let t = now;
  let done = cycle?.sessionsCompleted ?? 0;
  let firstWork = true;

  // Pause en cours : on la termine d'abord.
  if (cycle && cycle.mode !== "work") {
    const end = Math.min(t + Math.max(0, cycle.remainingSec) * 1000, stopAt);
    if (end > t) push(cycle.mode, t, end);
    t = end;
    firstWork = false;
  }

  for (let guard = 0; guard < 200 && t < stopAt - minWorkMs; guard++) {
    const free = unblock(events, t, marginMs);
    if (free.t > t) {
      t = free.t;
      continue;
    }
    const ne = nextEvent(events, t, marginMs);
    const eventCap = ne ? ne.start - marginMs : Infinity;
    const cap = Math.min(stopAt, eventCap);
    const avail = cap - t;
    if (avail < minWorkMs) {
      if (cap === stopAt || !ne) break;
      t = unblock(events, ne.start, marginMs).t;
      firstWork = false;
      continue;
    }

    const partial = firstWork && cycle?.mode === "work" && cycle.remainingSec > 0;
    const dur = partial ? cycle!.remainingSec * 1000 : W;
    firstWork = false;

    let workLen: number;
    let breakLen = 0;
    if (avail <= dur) {
      workLen = Math.floor(avail / 1000) * 1000; // raccourci pour finir pile
    } else {
      const brk = (done + 1) % N === 0 ? L : S;
      const restAfter = cap - (t + dur);
      if (restAfter - brk >= minWorkMs) {
        workLen = dur;
        breakLen = brk;
      } else if (brk === L && restAfter - S >= minWorkMs) {
        workLen = dur;
        breakLen = Math.min(L, Math.max(S, restAfter - W)); // longue pause raccourcie
      } else {
        workLen = Math.min(avail, Math.max(dur, W * STRETCH_MAX)); // dernier cycle étiré
        workLen = Math.floor(workLen / 1000) * 1000;
      }
    }
    push("work", t, t + workLen);
    t += workLen;
    done++;
    if (breakLen > 0) {
      push((done % N === 0 ? "long-break" : "short-break") as AgendaMode, t, t + breakLen);
      t += breakLen;
    }
  }

  const work = cycles.filter((c) => c.mode === "work");
  return {
    cycles,
    pomodoros: work.length,
    workSeconds: work.reduce((s, c) => s + c.seconds, 0),
    endsAt: cycles.length ? cycles[cycles.length - 1].end : now,
    stopAt,
    input,
  };
}

function reaches(plan: Plan, doneToday: number, goal: Goal): boolean {
  const have = goal.unit === "pomodoros" ? plan.pomodoros : plan.workSeconds / 60;
  return doneToday + have >= goal.target;
}

/**
 * L'objectif du jour tient-il dans le plan ? Sinon, heure d'arrêt la plus
 * proche (pas de 5 min, jusqu'à +12 h) qui permettrait de l'atteindre.
 */
export function goalReachable(
  planned: Plan,
  doneToday: number,
  goal: Goal,
): { reachable: boolean; stopAtNeeded?: number } {
  if (reaches(planned, doneToday, goal)) return { reachable: true };
  if (planned.input.flowtime) return { reachable: false };
  for (let ext = 5; ext <= 12 * 60; ext += 5) {
    const p = planUntil(planned.stopAt + ext * MIN, planned.input);
    if (reaches(p, doneToday, goal)) return { reachable: false, stopAtNeeded: planned.stopAt + ext * MIN };
  }
  return { reachable: false };
}
