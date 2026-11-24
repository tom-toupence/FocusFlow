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
      return r.w >= 16 && inside(withPlate, zone) && !avoid.some((a) => overlaps(withPlate, a));
    })
    .map((w) => w.id)
    .sort((a, b) => a - b);
}

/** Au plus 24 amis dans la façade (plus « Toi ») ; les suivants restent dans la liste. */
export const MAX_STREET_FRIENDS = 24;

/** Boîte englobante de toutes les fenêtres annotées, en px de la photo. */
export function facadeBox(f: Facade): Rect {
  const bs = f.windows.map((w) => quadBox(w.quad));
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x0 * f.width, y: y0 * f.height, w: (x1 - x0) * f.width, h: (y1 - y0) * f.height };
}

/**
 * Zone libre de l'écran de pause, en px du conteneur. `text` = le bloc de
 * texte de la pause (minuteur, respiration, boutons), mesuré dans la page.
 * Bureau et paysage (largeur 768 et plus) : la façade à droite du texte.
 * Téléphone : la façade en haut, au-dessus du texte, sous les boutons du haut.
 */
export function pauseZone(cw: number, ch: number, text: Rect | null, top = 120): Rect {
  if (cw >= 768) {
    const x0 = Math.max(cw * 0.45, text ? text.x + text.w + 32 : cw * 0.5);
    return { x: x0, y: 64, w: Math.max(80, cw - 24 - x0), h: Math.max(80, ch - 64 - 24) };
  }
  const y1 = (text ? text.y : ch * 0.55) - 16;
  return { x: 12, y: top, w: cw - 24, h: Math.max(80, y1 - top) };
}

/** Bouton « Post-it » de la session (fixe, en haut à gauche sur téléphone). */
export const POSTIT_PHONE: Rect = { x: 0, y: 70, w: 118, h: 48 };

/**
 * Zone et cadrage de la pause. Sur téléphone, la façade monte sous la barre
 * du haut si son bloc évite le bouton « Post-it » (bloc étroit, centré),
 * sinon elle commence sous ce bouton.
 */
export function framePause(cw: number, ch: number, text: Rect | null, f: Facade): { zone: Rect; img: Rect } {
  const tops = cw >= 768 ? [120] : [56, 120];
  let best: { zone: Rect; img: Rect; s: number } | null = null;
  for (const top of tops) {
    const zone = pauseZone(cw, ch, text, top);
    const img = frameFacade(cw, ch, zone, f);
    const B = facadeBox(f), s = img.w / f.width;
    const block = { x: img.x + B.x * s, y: img.y + B.y * s, w: B.w * s, h: B.h * s + PLATE_SPACE };
    const hitsPostit = cw < 768 && overlaps(block, POSTIT_PHONE);
    if (!hitsPostit && (!best || s > best.s)) best = { zone, img, s };
  }
  if (best) return { zone: best.zone, img: best.img };
  const zone = pauseZone(cw, ch, text);
  return { zone, img: frameFacade(cw, ch, zone, f) };
}

/** Plein écran (banc d'essai) : tout, sauf la bande du haut (liste repliée, réglages). */
export function fullZone(cw: number, ch: number): Rect {
  return { x: 8, y: 64, w: cw - 16, h: ch - 72 };
}

/**
 * Cadrage de la photo : le bloc des fenêtres annotées tient ENTIER dans la
 * zone libre (plaques comprises), quitte à ce que la photo ne couvre plus tout
 * l'écran (le fond de nuit prend le relais, bords fondus). Quand c'est
 * possible sans sortir le bloc de la zone, la photo couvre le conteneur.
 */
export function frameFacade(cw: number, ch: number, zone: Rect, f: Facade, maxScale = 1): Rect {
  const B = facadeBox(f), m = 8;
  const z = { x: zone.x + m, y: zone.y + m, w: Math.max(1, zone.w - 2 * m), h: Math.max(1, zone.h - 2 * m - PLATE_SPACE) };
  const s = Math.min(z.w / B.w, z.h / B.h, maxScale);
  const w = f.width * s, h = f.height * s;
  const axis = (zs: number, zl: number, bs: number, bl: number, size: number, c: number) => {
    const lo = zs - bs * s, hi = zs + zl - (bs + bl) * s;
    const mid = (lo + hi) / 2;
    if (size < c) return mid;
    const a = Math.max(lo, c - size), b = Math.min(hi, 0);
    return a <= b ? Math.min(b, Math.max(a, mid)) : mid;
  };
  return { x: axis(z.x, z.w, B.x, B.w, w, cw), y: axis(z.y, z.h, B.y, B.h, h, ch), w, h };
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
  const slots = Math.min(MAX_STREET_FRIENDS, pool.length - (me ? 1 : 0));
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
