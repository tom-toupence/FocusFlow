// « Ta rue » : un écran de pause où tes amis SONT les fenêtres d'une vraie
// façade (photo, fenêtres annotées à la main dans public/rues-amis/<id>/).
// Logique pure, testée : cadrage de la photo, fenêtres visibles, attribution
// déterministe (la tienne d'abord, puis une par ami), lumière de chaque ami.
import { pickSlots } from "@/lib/rue/friendWindows";

export type Quad = [[number, number], [number, number], [number, number], [number, number]];

export interface FacadeWindow {
  id: number;
  /** Quatre coins, en coordonnées normalisées de la photo (0..1). */
  quad: Quad;
}

export interface Facade {
  id: string;
  width: number;
  height: number;
  /** Point gardé à l'écran quand la photo est rognée en largeur (0..1). */
  focusX: number;
  credit: string;
  href: string;
  windows: FacadeWindow[];
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Boîte englobante d'une fenêtre (coordonnées normalisées). */
export function quadBox(q: Quad): Rect {
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Photo en « cover » dans le conteneur : taille et position de l'image, en px. */
export function coverLayout(cw: number, ch: number, iw: number, ih: number, focusX = 0.5): Rect {
  const s = Math.max(cw / iw, ch / ih);
  const w = iw * s, h = ih * s;
  return { x: (cw - w) * Math.min(1, Math.max(0, focusX)), y: (ch - h) / 2, w, h };
}

/** Une fenêtre en px du conteneur. */
export function windowRect(win: FacadeWindow, img: Rect): Rect {
  const b = quadBox(win.quad);
  return { x: img.x + b.x * img.w, y: img.y + b.y * img.h, w: b.w * img.w, h: b.h * img.h };
}

const inside = (r: Rect, z: Rect) => r.x >= z.x && r.y >= z.y && r.x + r.w <= z.x + z.w && r.y + r.h <= z.y + z.h;
const overlaps = (r: Rect, z: Rect) => r.x < z.x + z.w && r.x + r.w > z.x && r.y < z.y + z.h && r.y + r.h > z.y;

/** Place réservée à la plaque nominative, sous la fenêtre (px). */
export const PLATE_SPACE = 18;

/**
 * Fenêtres utilisables : entièrement dans `zone` (plaque comprise), hors des
 * zones `avoid` (textes, liste). Triées par numéro.
 */
export function usableWindows(windows: FacadeWindow[], img: Rect, zone: Rect, avoid: Rect[] = []): number[] {
  return windows
    .filter((w) => {
      const r = windowRect(w, img);
      const withPlate = { ...r, h: r.h + PLATE_SPACE };
      return r.w >= 24 && inside(withPlate, zone) && !avoid.some((a) => overlaps(withPlate, a));
    })
    .map((w) => w.id)
    .sort((a, b) => a - b);
}

/** Zones de l'écran de pause : le texte est à gauche (bureau) ou en bas (téléphone). */
export function pauseZones(cw: number, ch: number, listOpen: boolean): { zone: Rect; avoid: Rect[] } {
  if (cw >= 768) {
    const zone = { x: cw * 0.5, y: 16, w: cw * 0.5 - 16, h: ch - 32 };
    const list = { x: cw - 20 - 240 - 12, y: 0, w: 272, h: listOpen ? Math.min(ch * 0.4 + 70, ch) : 64 };
    return { zone, avoid: [list] };
  }
  return { zone: { x: 8, y: 12, w: cw - 16, h: ch * 0.5 - 12 }, avoid: [{ x: cw - 260, y: 0, w: 260, h: 60 }] };
}

/** Plein écran (banc d'essai) : toute la photo, sauf la liste en haut à droite. */
export function fullZones(cw: number, ch: number, listOpen: boolean): { zone: Rect; avoid: Rect[] } {
  return { zone: { x: 8, y: 8, w: cw - 16, h: ch - 16 }, avoid: [{ x: cw - 290, y: 0, w: 290, h: listOpen ? Math.min(ch * 0.4 + 70, ch) : 64 }] };
}

/**
 * Attribution sur TOUTES les fenêtres de la façade (triées par numéro), jamais
 * sur celles qui se voient : le même ami garde la même fenêtre quelle que
 * soit la taille de l'écran (celles qui tombent sous le texte ou la liste
 * sont masquées à l'affichage, l'ami est alors « hors cadre »).
 * Ta fenêtre d'abord (clé « toi »), puis une par ami, dans l'ordre de leurs
 * identifiants. S'il y a plus d'amis que de fenêtres, les allumés passent
 * d'abord (rang 0 = en focus, 1 = en ligne, 2 = hors ligne).
 */
export function assignStreet(
  meId: string | null,
  friends: { id: string; rank: number }[],
  windowIds: number[],
  key: string,
): { me: number | null; friends: Map<string, number> } {
  const pool = [...new Set(windowIds)].sort((a, b) => a - b);
  const out = new Map<string, number>();
  let me: number | null = null;
  if (meId && pool.length) me = pickSlots([`toi:${meId}`], pool, key).values().next().value ?? null;
  const slots = pool.length - (me ? 1 : 0);
  const uniq = [...new Map(friends.map((f) => [f.id, f])).values()];
  const chosen = uniq.length <= slots ? uniq : [...uniq].sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1)).slice(0, slots);
  pickSlots(chosen.map((f) => f.id).sort(), pool, key, out, new Set(me ? [me] : []));
  return { me, friends: out };
}

export type Light = "tungstene" | "neon" | "lampe";
export type Blind = "rideau" | "store" | "nu";

const LIGHTS: Light[] = ["tungstene", "lampe", "neon"];
const BLINDS: Blind[] = ["rideau", "store", "nu"];

/** La lumière de chez lui : tungstène, lampe ou néon froid (stable par ami). */
export function lightOf(userId: string): Light {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return LIGHTS[h % LIGHTS.length];
}

/** Rideau, store ou rien (stable par ami, indépendant de la lumière). */
export function blindOf(userId: string): Blind {
  let h = 7;
  for (let i = 0; i < userId.length; i++) h = (h * 131 + userId.charCodeAt(i) * 17) >>> 0;
  return BLINDS[(h >>> 3) % BLINDS.length];
}
