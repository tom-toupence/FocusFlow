// Horloge du minuteur : calculs purs sur des échéances (epoch ms), sans état.
// Le décompte ne dépend plus de la cadence des setInterval (bridés en arrière-plan).

/** Au-delà, une session laissée en plan est considérée comme abandonnée. */
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000;

/** Secondes restantes avant l'échéance (arrondi au-dessus, jamais négatif). */
export function remainingSeconds(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Secondes écoulées depuis un départ (réel ou « virtuel » : now - déjà accumulé). */
export function elapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export interface PersistedClock {
  active: boolean;
  isRunning: boolean;
  endsAt: number | null;
  flowStartedAt: number | null;
  updatedAt: number | null;
}

/**
 * Une session active est abandonnée si son échéance est dépassée de plus de 12 h,
 * ou si elle n'a pas bougé (pause, flowtime en cours) depuis plus de 12 h.
 */
export function isAbandoned(s: PersistedClock, now: number): boolean {
  if (!s.active) return false;
  if (s.isRunning && s.endsAt != null) return now - s.endsAt > STALE_SESSION_MS;
  if (s.updatedAt == null) return false;
  return now - s.updatedAt > STALE_SESSION_MS;
}

/** Mise en forme mm:ss (ou h:mm:ss) du temps restant. */
export function formatClock(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
