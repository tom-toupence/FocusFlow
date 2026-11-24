// « Radio commune » : programme déterministe calculé depuis l'heure, sans serveur.
// Tout le monde obtient la même piste au même instant (à l'horloge près).

export interface RadioTrack {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  durationSec: number;
}

/** Époque fixe du programme (cycle 0). */
export const RADIO_EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
export const RADIO_SEED = 0x464f4355; // « FOCU »
export const DEFAULT_MAX_SEGMENT_SEC = 45 * 60;
const MIN_TRACK_SEC = 30;

export interface RadioOptions {
  epoch?: number;
  maxSegmentSec?: number;
  seed?: number;
}

export interface RadioSlot {
  track: RadioTrack;
  /** Position globale dans le programme (cycle * taille + rang) ; entrée de skipUnavailable. */
  index: number;
  /** Numéro de cycle (un cycle = toutes les pistes une fois, remélangées à chaque cycle). */
  cycle: number;
  /** Seconde de la vidéo à laquelle chercher (début d'extrait + temps écoulé). */
  offsetSec: number;
  /** Début de l'extrait diffusé dans la vidéo (0 sauf pistes longues). */
  segmentStartSec: number;
  /** Durée diffusée (plafonnée par maxSegmentSec). */
  segmentSec: number;
  startsAt: number;
  endsAt: number;
}

export interface Radio {
  readonly size: number;
  /** Durée d'un cycle complet, en secondes. */
  readonly cycleSec: number;
  nowPlaying(now: number): RadioSlot | null;
  /** Les n pistes suivantes (la piste en cours est exclue). */
  upcoming(now: number, n: number): RadioSlot[];
  slotAt(index: number): RadioSlot | null;
  /** Piste suivante dont l'id n'est pas dans `unavailable`, à partir de l'index donné. */
  skipUnavailable(index: number, unavailable?: ReadonlySet<string>): RadioSlot | null;
}

/** PRNG déterministe (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface CycleLayout {
  order: RadioTrack[];
  /** Début de chaque piste dans le cycle, en secondes (longueur n + 1). */
  starts: number[];
  segStart: number[];
  segLen: number[];
}

export function createRadio(tracksIn: RadioTrack[], opts: RadioOptions = {}): Radio {
  const epoch = opts.epoch ?? RADIO_EPOCH;
  const maxSeg = Math.max(60, opts.maxSegmentSec ?? DEFAULT_MAX_SEGMENT_SEC);
  const seed = opts.seed ?? RADIO_SEED;
  // Tri par id : l'ordre du tableau d'entrée n'influence pas le programme.
  const tracks = tracksIn
    .filter((t) => Number.isFinite(t.durationSec) && t.durationSec >= MIN_TRACK_SEC)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = tracks.length;
  const segDurOf = (t: RadioTrack) => Math.floor(Math.min(t.durationSec, maxSeg));
  const cycleSec = tracks.reduce((s, t) => s + segDurOf(t), 0);

  const cache = new Map<number, CycleLayout>();
  const rawOrder = (cycle: number): RadioTrack[] => {
    const rnd = mulberry32((seed ^ Math.imul(cycle | 0, 0x9e3779b1)) >>> 0);
    const a = tracks.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const layout = (cycle: number): CycleLayout => {
    const hit = cache.get(cycle);
    if (hit) return hit;
    const order = rawOrder(cycle);
    // Évite de rejouer la dernière piste du cycle précédent en tête de celui-ci.
    if (n > 2) {
      const prevLast = rawOrder(cycle - 1)[n - 1];
      if (order[0].id === prevLast.id) [order[0], order[1]] = [order[1], order[0]];
    }
    const starts: number[] = [0];
    const segStart: number[] = [];
    const segLen: number[] = [];
    for (const t of order) {
      const len = segDurOf(t);
      // Début d'extrait déterministe (multiple de 60 s) pour les pistes plus longues que le plafond.
      const room = t.durationSec - len;
      const off = room >= 60 ? Math.floor((hashStr(t.id + ":" + cycle) % Math.floor(room)) / 60) * 60 : 0;
      segStart.push(off);
      segLen.push(len);
      starts.push(starts[starts.length - 1] + len);
    }
    const l = { order, starts, segStart, segLen };
    cache.set(cycle, l);
    if (cache.size > 6) cache.delete(cache.keys().next().value as number);
    return l;
  };

  const slot = (cycle: number, rank: number, elapsedSec = 0): RadioSlot => {
    const l = layout(cycle);
    const startsAt = epoch + (cycle * cycleSec + l.starts[rank]) * 1000;
    return {
      track: l.order[rank],
      index: cycle * n + rank,
      cycle,
      offsetSec: l.segStart[rank] + Math.floor(elapsedSec),
      segmentStartSec: l.segStart[rank],
      segmentSec: l.segLen[rank],
      startsAt,
      endsAt: startsAt + l.segLen[rank] * 1000,
    };
  };

  const slotAt = (index: number): RadioSlot | null => {
    if (!n || cycleSec <= 0) return null;
    const cycle = Math.floor(index / n);
    return slot(cycle, index - cycle * n);
  };

  const nowPlaying = (now: number): RadioSlot | null => {
    if (!n || cycleSec <= 0) return null;
    const elapsed = (now - epoch) / 1000;
    const cycle = Math.floor(elapsed / cycleSec);
    const pos = elapsed - cycle * cycleSec;
    const { starts } = layout(cycle);
    let rank = 0;
    while (rank < n - 1 && starts[rank + 1] <= pos) rank++;
    return slot(cycle, rank, pos - starts[rank]);
  };

  return {
    size: n,
    cycleSec,
    nowPlaying,
    slotAt,
    upcoming(now, count) {
      const cur = nowPlaying(now);
      if (!cur) return [];
      const out: RadioSlot[] = [];
      for (let i = 1; i <= count; i++) {
        const s = slotAt(cur.index + i);
        if (s) out.push(s);
      }
      return out;
    },
    skipUnavailable(index, unavailable = new Set<string>()) {
      for (let i = 1; i <= n; i++) {
        const s = slotAt(index + i);
        if (s && !unavailable.has(s.track.id) && !unavailable.has(s.track.youtubeId)) return s;
      }
      return null;
    },
  };
}

/** Raccourcis sans état (recrée le programme à chaque appel : préférer createRadio en boucle). */
export const nowPlaying = (tracks: RadioTrack[], now: number, opts?: RadioOptions) =>
  createRadio(tracks, opts).nowPlaying(now);
export const upcoming = (tracks: RadioTrack[], now: number, n: number, opts?: RadioOptions) =>
  createRadio(tracks, opts).upcoming(now, n);
