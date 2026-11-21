// Petit animateur des scènes de ville, basé sur l'HORLOGE (performance.now),
// pas sur le nombre d'images : une transition de 1,4 s dure 1,4 s même à
// 10 images/s (l'animateur générique plafonne le temps par image, ce qui
// étirait les transitions sur les machines lentes et décalait la scène de la
// page). Courbes de Bézier nommées, images clés avec `times`, délai.
export type Bezier = [number, number, number, number];

function bezier([x1, y1, x2, y2]: Bezier) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

interface Track { target: Record<string, number>; key: string; from: number[]; times: number[]; start: number; dur: number; ease: (x: number) => number; done: () => void }

const tracks = new Set<Track>();
let raf = 0;
function tick() {
  const now = performance.now();
  for (const tr of tracks) {
    const p = Math.min(1, Math.max(0, (now - tr.start) / tr.dur));
    if (now < tr.start) continue;
    // Segment d'images clés courant ; la courbe s'applique à chaque segment.
    let i = 0;
    while (i < tr.times.length - 2 && p > tr.times[i + 1]) i++;
    const a = tr.times[i], b = tr.times[i + 1];
    const local = b > a ? tr.ease((p - a) / (b - a)) : 1;
    tr.target[tr.key] = tr.from[i] + (tr.from[i + 1] - tr.from[i]) * local;
    if (p >= 1) { tr.target[tr.key] = tr.from[tr.from.length - 1]; tracks.delete(tr); tr.done(); }
  }
  raf = tracks.size ? requestAnimationFrame(tick) : 0;
}

/**
 * Anime des clés numériques de `target`. `to[k]` : valeur finale, ou liste
 * d'images clés (la première remplace la valeur courante). Une nouvelle
 * animation sur la même clé remplace l'ancienne.
 */
export function tween(
  target: object,
  to: Record<string, number | number[]>,
  o: { duration?: number; delay?: number; times?: number[]; ease?: Bezier } = {},
): Promise<void> {
  const t = target as Record<string, number>;
  const ease = bezier(o.ease ?? [0.45, 0, 0.55, 1]);
  const start = performance.now() + (o.delay ?? 0) * 1000;
  const dur = Math.max(1, (o.duration ?? 0.3) * 1000);
  const ps: Promise<void>[] = [];
  for (const key in to) {
    for (const tr of tracks) if (tr.target === t && tr.key === key) { tracks.delete(tr); tr.done(); }
    const v = to[key];
    const from = Array.isArray(v) ? [...v] : [t[key], v];
    const times = o.times && o.times.length === from.length ? o.times : from.map((_, i) => i / (from.length - 1));
    ps.push(new Promise<void>((done) => tracks.add({ target: t, key, from, times, start, dur, ease, done })));
  }
  if (!raf) raf = requestAnimationFrame(tick);
  return Promise.all(ps).then(() => undefined);
}
