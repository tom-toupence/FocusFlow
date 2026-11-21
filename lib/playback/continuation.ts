// Lecture continue : quand une playlist se termine pendant une session active
// et que la boucle est coupée, on la prolonge avec des titres cohérents avec
// TOUTE la playlist, pas seulement le dernier morceau (consigne de la mission).
//
// Principe : un échantillon représentatif de graines prises sur toute la
// playlist (début, milieu, fin, et la piste qui vient de se terminer), puis des
// recommandations par graine, fusionnées en alternance et dédupliquées contre
// tout ce qui est déjà dans la file. Les mêmes règles servent partout : session
// YouTube, session Spotify, et les suggestions de Découvrir et des playlists.
//
// Les fonctions de sélection sont PURES et testées
// (lib/playback/continuation.test.ts) ; les appels réseau sont injectés.

/**
 * Choisit `k` graines réparties sur la playlist (quantiles), en garantissant
 * la piste qui vient de finir. Ordre de sortie : la dernière d'abord (le
 * contexte immédiat), puis les autres du début vers la fin.
 */
export function pickSeeds(playlist: readonly string[], last: string | null, k = 3): string[] {
  const ids = [...new Set(playlist.filter(Boolean))];
  if (ids.length === 0) return last ? [last] : [];
  const n = Math.max(1, Math.min(k, ids.length));
  const picks: string[] = [];
  if (last && ids.includes(last)) picks.push(last);
  for (let q = 0; picks.length < n && q < n * 3; q++) {
    // Quantiles : 0, 1/(n-1), …, 1 (avec n graines) ; on saute les doublons.
    const t = n === 1 ? 0 : (q % n) / (n - 1);
    const id = ids[Math.min(ids.length - 1, Math.round(t * (ids.length - 1)))];
    if (!picks.includes(id)) picks.push(id);
    else if (q >= n) {
      // Collision (petite playlist) : on prend la première piste libre.
      const free = ids.find((x) => !picks.includes(x));
      if (free) picks.push(free);
    }
  }
  return picks.slice(0, n);
}

/** Fusionne des listes par alternance (round-robin), sans doublons ni exclus. */
export function interleave<T extends { id: string }>(lists: T[][], exclude: ReadonlySet<string>, limit: number): T[] {
  const seen = new Set(exclude);
  const queues = lists.map((l) => [...l]);
  const out: T[] = [];
  for (let i = 0; out.length < limit && queues.some((q) => q.length > 0); i++) {
    const item = queues[i % queues.length].shift();
    if (item && !seen.has(item.id)) { seen.add(item.id); out.push(item); }
  }
  return out;
}

export interface ContinuationTrack { id: string; title: string; subtitle?: string }

export type ContinuationResult =
  | { kind: "extend"; tracks: ContinuationTrack[] }
  /** Rien de neuf (réseau, doublons) : l'appelant reboucle plutôt que de s'arrêter. */
  | { kind: "loop" };

/**
 * Calcule la prolongation. `recommend(seed)` renvoie des titres proches d'une
 * graine (YouTube : mix radio ; Spotify : titres phares des artistes). Les
 * échecs d'une graine n'empêchent pas les autres.
 */
export async function continuePlaylist(
  playlist: readonly string[],
  last: string | null,
  recommend: (seed: string) => Promise<ContinuationTrack[]>,
  opts: { seeds?: number; limit?: number; exclude?: ReadonlySet<string> } = {},
): Promise<ContinuationResult> {
  const seeds = pickSeeds(playlist, last, opts.seeds ?? 3);
  if (seeds.length === 0) return { kind: "loop" };
  const lists = await Promise.all(seeds.map((s) => recommend(s).catch(() => [] as ContinuationTrack[])));
  const exclude = new Set([...(opts.exclude ?? []), ...playlist]);
  const tracks = interleave(lists, exclude, opts.limit ?? 15);
  return tracks.length > 0 ? { kind: "extend", tracks } : { kind: "loop" };
}
