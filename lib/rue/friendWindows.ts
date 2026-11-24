// Les fenêtres allumées : chaque ami a SA fenêtre dans la rue de nuit.
// Logique pure (testée) : lecture des fenêtres d'une scène dans la texture
// ids (canal G = numéro de fenêtre, voir scripts/rue/04_masks.py), choix
// déterministe d'une fenêtre par ami, état allumée / vive / éteinte.
//
// Limite : 16 amis au plus dans la rue (MAX_FRIEND_WINDOWS), car le shader
// reçoit leurs fenêtres dans un tableau d'uniforms de taille fixe. Au-delà,
// les allumés passent d'abord ; la liste, elle, montre tous les amis.
import { isActivelyFocusing, isOnline, type FriendStats } from "@/lib/friends";

/** Une fenêtre de la scène, lue dans ids.webp. */
export interface RueWindow {
  /** Numéro de fenêtre (canal G de ids.webp, 1..255). */
  id: number;
  /** Surface en pixels de la photo. */
  area: number;
  /** Centre, en coordonnées de texture (0..1, y vers le bas). */
  cx: number;
  cy: number;
  /** Part de ciel (canal B de ids.webp, 0..1) : une « fenêtre » dans le ciel est un nuage éclairé. */
  sky?: number;
  /** Disparité au centre (0 = loin, 1 = proche), remplie par le moteur. */
  depth?: number;
}

export type FriendWindowState = "on" | "focus" | "off";

/** Ce que le moteur reçoit : une fenêtre, son état, un grésillement éventuel. */
export interface FriendWindow {
  windowId: number;
  state: FriendWindowState;
  /** Début du grésillement (ms, horloge Date.now()). */
  flickerAt?: number;
}

/** Au plus 16 amis dans la rue (uniforms du shader). */
export const MAX_FRIEND_WINDOWS = 16;
/** Une fenêtre plus petite que ça ne se voit pas à l'écran. */
export const MIN_WINDOW_AREA = 80;
/** Durée du grésillement quand un ami passe de focus à pause (ms). */
export const FLICKER_MS = 1200;

/**
 * Parcourt les pixels RGBA de ids.webp et rassemble les fenêtres (canal G).
 * Une seule passe, faite une fois par scène. `areaScale` ramène la surface
 * en pixels de la photo quand on lit une version réduite.
 */
export function scanWindowIds(data: ArrayLike<number>, width: number, height: number, areaScale = 1): RueWindow[] {
  const area = new Float64Array(256), sx = new Float64Array(256), sy = new Float64Array(256), sk = new Float64Array(256);
  for (let y = 0, i = 1; y < height; y++) {
    for (let x = 0; x < width; x++, i += 4) {
      const g = data[i];
      if (g === 0) continue;
      area[g]++; sx[g] += x; sy[g] += y; sk[g] += data[i + 1];
    }
  }
  const out: RueWindow[] = [];
  for (let g = 1; g < 256; g++) {
    if (!area[g]) continue;
    out.push({ id: g, area: area[g] * areaScale, cx: (sx[g] / area[g] + 0.5) / width, cy: (sy[g] / area[g] + 0.5) / height, sky: sk[g] / area[g] / 255 });
  }
  return out;
}

/** FNV-1a 32 bits : stable d'un navigateur à l'autre. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Ami -> fenêtre, pour une scène. Toujours la même fenêtre pour le même ami
 * dans la même scène : position = hash(scène, ami) parmi les fenêtres assez
 * grandes, triées par numéro. Deux amis sur la même fenêtre : le second
 * (dans l'ordre des identifiants) prend la suivante libre.
 */
export function assignFriendWindows(friendIds: string[], windows: RueWindow[], sceneKey: string): Map<string, number> {
  const out = new Map<string, number>();
  if (!friendIds.length || !windows.length) return out;
  const need = Math.min(friendIds.length, MAX_FRIEND_WINDOWS);
  // De préférence : assez grandes, et dans la partie de la photo qui reste
  // à l'écran quel que soit le cadrage (les bords sont souvent rognés).
  const big = windows.filter((w) => w.area >= MIN_WINDOW_AREA && (w.sky ?? 0) < 0.08);
  const central = big.filter((w) => w.cx >= 0.1 && w.cx <= 0.9 && w.cy >= 0.22 && w.cy <= 0.8);
  const pool = (central.length >= need ? central : big.length >= need ? big : windows)
    .map((w) => w.id)
    .sort((a, b) => a - b);
  return pickSlots([...new Set(friendIds)].sort().slice(0, MAX_FRIEND_WINDOWS), pool, sceneKey, out);
}

/**
 * Attribution déterministe : chaque identifiant (dans l'ordre donné) prend la
 * case hash(clé, id) du `pool` (trié), ou la suivante libre. `taken` permet
 * de réserver des cases d'avance.
 */
export function pickSlots(ids: string[], pool: number[], key: string, out = new Map<string, number>(), taken = new Set<number>(out.values())): Map<string, number> {
  for (const id of ids) {
    if (taken.size >= pool.length) break;
    let k = hashString(`${key}:${id}`) % pool.length;
    while (taken.has(pool[k])) k = (k + 1) % pool.length;
    taken.add(pool[k]);
    out.set(id, pool[k]);
  }
  return out;
}

/** Allumée (en ligne), vive (en focus) ou éteinte (hors ligne). */
export function friendWindowState(stats: FriendStats | null, now: number = Date.now()): FriendWindowState {
  if (isActivelyFocusing(stats, now)) return "focus";
  if (isOnline(stats, now)) return "on";
  return "off";
}

const RANK: Record<FriendWindowState, number> = { focus: 0, on: 1, off: 2 };

/** Ordre de la liste : en focus, en ligne, hors ligne ; puis par nom. */
export function sortByWindowState<T extends { displayName: string; stats: FriendStats | null }>(friends: T[], now: number = Date.now()): T[] {
  return [...friends].sort((a, b) =>
    RANK[friendWindowState(a.stats, now)] - RANK[friendWindowState(b.stats, now)] || a.displayName.localeCompare(b.displayName, "fr"));
}

/** Les amis retenus pour la rue (16 au plus, les allumés d'abord). */
export function friendsForStreet<T extends { userId: string; displayName: string; stats: FriendStats | null }>(friends: T[], now: number = Date.now()): T[] {
  return sortByWindowState(friends, now).slice(0, MAX_FRIEND_WINDOWS);
}

/** Le prénom affiché (premier mot du nom). */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

/** Ce qu'il fait, en clair : l'activité publiée, sinon son état. */
export function friendActivityLine(stats: FriendStats | null, now: number = Date.now()): string {
  const st = friendWindowState(stats, now);
  if (st === "off") return "Hors ligne";
  const a = stats?.activity?.trim();
  if (a) return a;
  return st === "focus" ? "En focus" : "En ligne";
}
