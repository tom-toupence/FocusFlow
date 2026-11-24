// « Dernier train » : durée du prochain cycle quand une heure d'arrêt est fixée,
// suggestion d'heure d'arrêt et libellés. Logique pure (le store orchestre).

import { planUntil, type AgendaMode, type AgendaSettings, type Plan } from "@/lib/agendaFit";

const MIN = 60_000;

export interface StopSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export function toAgendaSettings(s: StopSettings): AgendaSettings {
  return {
    work: s.workDuration,
    short: s.shortBreakDuration,
    long: s.longBreakDuration,
    sessionsBeforeLongBreak: s.sessionsBeforeLongBreak,
  };
}

/**
 * Durée (s) du cycle `mode` qui démarre à `now`, d'après le plan jusqu'à `stopAt`.
 * null si le plan est épuisé : plus aucun pomodoro possible après ce cycle.
 * `sessionsCompleted` compte les pomodoros déjà terminés (pause incluse : déjà incrémenté).
 */
export function nextCycleSeconds(args: {
  stopAt: number;
  now: number;
  mode: AgendaMode;
  settings: StopSettings;
  sessionsCompleted: number;
}): number | null {
  const { stopAt, now, mode, sessionsCompleted } = args;
  const settings = toAgendaSettings(args.settings);
  const planFor = (remainingSec: number): Plan =>
    planUntil(stopAt, { now, settings, cycle: { mode, remainingSec, sessionsCompleted } });

  if (mode === "work") {
    const first = planFor(0).cycles[0];
    return first && first.mode === "work" && first.seconds > 0 ? first.seconds : null;
  }

  const full = (mode === "long-break" ? settings.long : settings.short) * 60;
  if (mode === "short-break") {
    const p = planFor(full);
    return p.pomodoros > 0 && p.cycles[0] ? p.cycles[0].seconds : null;
  }
  // Longue pause : la plus longue possible qui garde le maximum de pomodoros.
  const floor = Math.min(settings.short * 60, full);
  const best = planFor(floor).pomodoros;
  if (best === 0) return null;
  for (let rem = full; rem >= floor; rem -= 60) {
    const p = planFor(rem);
    if (p.pomodoros >= best && p.cycles[0]) return p.cycles[0].seconds;
  }
  return planFor(floor).cycles[0]?.seconds ?? null;
}

/** Plan affiché dans /settings (départ à `now`, cycle neuf). */
export function planFromScratch(stopAt: number, now: number, settings: StopSettings): Plan {
  return planUntil(stopAt, { now, settings: toAgendaSettings(settings) });
}

/** Pomodoros restants (cycle en cours compris) pendant la session. */
export function pomodorosLeft(args: {
  stopAt: number;
  now: number;
  mode: AgendaMode;
  secondsLeft: number;
  sessionsCompleted: number;
  settings: StopSettings;
}): number {
  const { stopAt, now, mode, secondsLeft, sessionsCompleted } = args;
  return planUntil(stopAt, {
    now,
    settings: toAgendaSettings(args.settings),
    cycle: { mode, remainingSec: secondsLeft, sessionsCompleted },
  }).pomodoros;
}

// ── Heures ───────────────────────────────────────────────────────────────────

/** « 18:30 » pour un epoch ms (heure locale). */
export function formatHM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** « 18:30 » (aujourd'hui, relatif à `now`) -> epoch ms, null si invalide. */
export function parseHM(value: string, now: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  const d = new Date(now);
  d.setHours(h, mi, 0, 0);
  return d.getTime();
}

/** Les prochaines demi-heures plausibles (au moins 30 min devant, avant minuit). */
export function nextHalfHours(now: number, count = 4): number[] {
  const d = new Date(Math.ceil((now + 30 * MIN) / MIN) * MIN);
  d.setMinutes(d.getMinutes() + ((30 - (d.getMinutes() % 30)) % 30));
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const out: number[] = [];
  for (let t = d.getTime(); out.length < count && t < midnight.getTime(); t += 30 * MIN) out.push(t);
  return out;
}

export interface StopHistoryEntry {
  timestamp: number;
  date: string; // YYYY-MM-DD local
}

function localDate(ms: number): string {
  const d = new Date(ms);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/**
 * Heure de fin médiane des sessions des 7 derniers jours (hors aujourd'hui),
 * arrondie à 5 min, ou null s'il y a moins de 3 jours d'historique. Renvoyée
 * pour aujourd'hui, et seulement si elle est encore devant.
 */
export function suggestStopAt(entries: StopHistoryEntry[], now: number): number | null {
  const today = localDate(now);
  const since = now - 7 * 24 * 60 * MIN;
  const lastOfDay = new Map<string, number>();
  for (const e of entries) {
    if (e.date === today || e.timestamp < since || e.timestamp > now) continue;
    const d = new Date(e.timestamp);
    const minutes = d.getHours() * 60 + d.getMinutes();
    lastOfDay.set(e.date, Math.max(lastOfDay.get(e.date) ?? 0, minutes));
  }
  if (lastOfDay.size < 3) return null;
  const sorted = [...lastOfDay.values()].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const rounded = Math.round(median / 5) * 5;
  const d = new Date(now);
  d.setHours(Math.floor(rounded / 60), rounded % 60, 0, 0);
  return d.getTime() > now + 15 * MIN ? d.getTime() : null;
}
