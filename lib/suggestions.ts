// Suggestions intelligentes (locales, non intrusives) : déduites de l'historique
// de lecture. Aucune IA, aucun appel réseau — pur dérivé des données existantes.

import { PlayEntry } from "@/store/playHistoryStore";

export interface MediaSuggestion {
  youtubeId: string;
  title: string;
  count: number;
  peakHour: number | null; // heure la plus fréquente pour CE média
}

/**
 * Trouve la vidéo YouTube la plus relancée dans l'historique et l'heure à
 * laquelle elle est le plus souvent lancée. Renvoie null s'il n'y a pas de
 * signal exploitable (moins de 3 lectures de la même vidéo).
 */
export function topRepeatedVideo(entries: PlayEntry[]): MediaSuggestion | null {
  const byKey = new Map<string, { title: string; count: number; hours: number[] }>();
  for (const e of entries) {
    if (e.type !== "youtube") continue;
    const cur = byKey.get(e.mediaKey) ?? { title: e.title, count: 0, hours: [] };
    cur.count++;
    cur.hours.push(new Date(e.timestamp).getHours());
    cur.title = e.title;
    byKey.set(e.mediaKey, cur);
  }
  let best: { youtubeId: string; title: string; count: number; hours: number[] } | null = null;
  for (const [youtubeId, v] of byKey) {
    if (!best || v.count > best.count) best = { youtubeId, ...v };
  }
  if (!best || best.count < 3) return null;

  // Heure dominante pour ce média.
  const hourCounts = new Array(24).fill(0) as number[];
  for (const h of best.hours) hourCounts[h]++;
  const maxCount = Math.max(...hourCounts);
  const peakHour = maxCount > 0 ? hourCounts.indexOf(maxCount) : null;

  return { youtubeId: best.youtubeId, title: best.title, count: best.count, peakHour };
}
