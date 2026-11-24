// « Calé sur la vidéo » : pilotage du minuteur par le temps de la vidéo.
// Logique pure (testée) : à chaque lecture de currentTime, on déduit le mode,
// les secondes restantes et la durée créditable, et on signale les transitions.
//
// Crédit : seules les secondes réellement jouées comptent. Un pas est « joué »
// si la vidéo a avancé d'au plus le temps écoulé à l'horloge (+ tolérance) ;
// sinon c'est un seek (manuel ou « Début du bloc suivant ») : on se recale sans
// rien créditer. Ainsi cycleSeconds = secondes jouées + secondes restantes, et
// le crédit d'un bloc pris en route est au prorata de ce qui a été joué.
import { segmentAt, type VideoSchedule } from "./videoSchedule";

export type SyncMode = "work" | "short-break" | "long-break";
/** Une pause de vidéo d'au moins 15 min compte comme une longue pause. */
export const LONG_BREAK_SEC = 15 * 60;
/** Tolérance (s) entre l'avance de la vidéo et celle de l'horloge. */
const PLAY_TOLERANCE_SEC = 2;
/** Fin de vidéo (bouclée) : on était à moins de 3 s de la fin du rythme. */
const WRAP_MARGIN_SEC = 3;

export interface VideoSyncCursor {
  /** Segment courant (null : trou entre segments, ou pas encore calé). */
  index: number | null;
  /** Secondes de travail réellement jouées dans le segment courant. */
  workedSec: number;
  lastT: number | null;
  lastWallMs: number | null;
}

export interface VideoSyncState {
  videoId: string;
  schedule: VideoSchedule;
  cursor: VideoSyncCursor;
}

export type VideoSyncEvent =
  /** Fin naturelle d'un segment de travail : même chemin qu'une fin de cycle. */
  | { type: "work-end"; creditSec: number }
  /** Segment de travail quitté par un seek : travail réel crédité en partiel. */
  | { type: "work-partial"; creditSec: number }
  /** Rythme épuisé (fin des segments ou fin de la vidéo) : retour au minuteur normal. */
  | { type: "exhausted" };

export interface VideoSyncView {
  phase: "work" | "break" | "gap";
  mode: SyncMode;
  secondsLeft: number;
  /** Durée créditable du cycle affiché (travail : joué + restant). */
  cycleSeconds: number;
  /** Numéro du bloc de travail (1-based) : le bloc en cours, ou le prochain en pause/trou. */
  block: number | null;
  blocks: number;
}

export interface VideoSyncStep {
  cursor: VideoSyncCursor;
  view: VideoSyncView | null;
  events: VideoSyncEvent[];
}

export const freshCursor = (): VideoSyncCursor => ({ index: null, workedSec: 0, lastT: null, lastWallMs: null });

const workCount = (s: VideoSchedule) => s.filter((x) => x.kind === "work").length;
/** Numéro (1-based) du bloc de travail d'index `i` ou du premier qui suit. */
function blockNumber(s: VideoSchedule, i: number): number | null {
  let n = 0;
  for (let k = 0; k < s.length; k++) {
    if (s[k].kind === "work") n++;
    if (k >= i && s[k].kind === "work") return n;
  }
  return null;
}

function view(schedule: VideoSchedule, t: number, workedSec: number): VideoSyncView | null {
  const blocks = workCount(schedule);
  const pos = segmentAt(schedule, t);
  if (pos) {
    const left = Math.max(1, Math.ceil(pos.remainingSec));
    const len = pos.segment.end - pos.segment.start;
    if (pos.segment.kind === "work") {
      return { phase: "work", mode: "work", secondsLeft: left, cycleSeconds: Math.round(workedSec) + left, block: blockNumber(schedule, pos.index), blocks };
    }
    return {
      phase: "break", mode: len >= LONG_BREAK_SEC ? "long-break" : "short-break",
      secondsLeft: left, cycleSeconds: Math.round(len), block: blockNumber(schedule, pos.index), blocks,
    };
  }
  // Trou (intro, chapitre ignoré) : compte jusqu'au prochain segment, sans crédit.
  const nextIdx = schedule.findIndex((s) => s.start > t);
  if (nextIdx < 0) return null;
  const prevEnd = nextIdx > 0 ? schedule[nextIdx - 1].end : 0;
  const left = Math.max(1, Math.ceil(schedule[nextIdx].start - t));
  return { phase: "gap", mode: "work", secondsLeft: left, cycleSeconds: Math.max(left, Math.round(schedule[nextIdx].start - prevEnd)), block: blockNumber(schedule, nextIdx), blocks };
}

/** Fin du rythme : après le dernier segment. */
export const scheduleEnd = (s: VideoSchedule) => (s.length ? s[s.length - 1].end : 0);

/**
 * Un pas de pilotage : la vidéo est à `t` (s) à l'instant `wallMs`.
 * Rend le nouveau curseur, ce que le minuteur doit afficher (null = épuisé)
 * et les transitions à traiter.
 */
export function stepVideoSync(state: VideoSyncState, t: number, wallMs: number): VideoSyncStep {
  const { schedule, cursor } = state;
  const events: VideoSyncEvent[] = [];
  const end = scheduleEnd(schedule);
  const prev = cursor.index != null ? schedule[cursor.index] : null;
  const hasPrev = cursor.lastT != null && cursor.lastWallMs != null;
  const dV = hasPrev ? t - cursor.lastT! : 0;
  const dWall = hasPrev ? Math.max(0, (wallMs - cursor.lastWallMs!) / 1000) : 0;
  const played = hasPrev && dV > 0 && dV <= dWall + PLAY_TOLERANCE_SEC;
  // Vidéo bouclée par le lecteur : on était au bout du rythme et elle repart du début.
  const wrapped = hasPrev && dV < 0 && cursor.lastT! >= end - WRAP_MARGIN_SEC && dWall <= PLAY_TOLERANCE_SEC + 1;

  let worked = cursor.workedSec;
  if (prev?.kind === "work" && (played || wrapped)) {
    // Part du pas jouée DANS le segment précédent (jusqu'à sa fin au plus).
    worked += Math.max(0, Math.min(wrapped ? prev.end : t, prev.end) - cursor.lastT!);
  }

  if (wrapped || t >= end) {
    if (prev?.kind === "work" && (played || wrapped)) events.push({ type: "work-end", creditSec: Math.round(worked) });
    else if (prev?.kind === "work") events.push({ type: "work-partial", creditSec: Math.round(worked) });
    // Une seule fois : les pas suivants, toujours au-delà de la fin, ne redisent rien.
    if (wrapped || cursor.lastT == null || cursor.lastT < end) events.push({ type: "exhausted" });
    return { cursor: { index: null, workedSec: 0, lastT: t, lastWallMs: wallMs }, view: null, events };
  }

  const pos = segmentAt(schedule, t);
  const index = pos ? pos.index : null;
  if (index !== cursor.index) {
    if (prev?.kind === "work") {
      // Sortie naturelle (le pas joué franchit la fin) ou par un seek.
      const natural = played && cursor.lastT! < prev.end && t >= prev.end;
      events.push({ type: natural ? "work-end" : "work-partial", creditSec: Math.round(worked) });
    }
    // Nouveau segment de travail atteint en jouant : ce qui en a été joué compte.
    worked = pos && pos.segment.kind === "work" && played && cursor.lastT! < pos.segment.start
      ? t - pos.segment.start
      : 0;
  }

  return {
    cursor: { index, workedSec: worked, lastT: t, lastWallMs: wallMs },
    view: view(schedule, t, worked),
    events,
  };
}

/** Arrivée en plein bloc : faut-il proposer le choix, et lequel mettre en avant ? */
export function arrivalChoice(schedule: VideoSchedule, t: number): { remainingRatio: number; preferNext: boolean } | null {
  const pos = segmentAt(schedule, t);
  if (!pos || pos.segment.kind !== "work") return null;
  const len = pos.segment.end - pos.segment.start;
  // Moins de 30 s de bloc écoulées : c'est le début, rien à demander.
  if (t - pos.segment.start < 30) return null;
  const remainingRatio = pos.remainingSec / len;
  return { remainingRatio, preferNext: remainingRatio <= 0.5 };
}
