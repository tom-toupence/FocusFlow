// « Calé sur la vidéo » : chapitres et durée d'une vidéo, lus dans la page watch
// de YouTube (ytInitialData + ytInitialPlayerResponse). Logique pure, testée sur
// des fixtures (tests sans réseau). Robuste aux changements de markup : tout
// échec rend une liste vide ou une durée nulle.
import { extractYtInitialData, extractYtPlayerResponse, ytText } from "./ytParse";
import { parseChaptersFromDescription, type Chapter } from "./videoSchedule";

export interface WatchSchedule {
  chapters: Chapter[];
  /** Durée de la vidéo (s), 0 si inconnue. */
  durationSec: number;
  /** D'où viennent les chapitres. */
  source: "chapters" | "description" | "none";
}

/** Tous les objets portés par `key`, dans l'ordre de rencontre. */
function findAll(node: unknown, key: string, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node !== "object") return acc;
  if (Array.isArray(node)) {
    for (const n of node) findAll(n, key, acc);
    return acc;
  }
  const obj = node as Record<string, unknown>;
  const hit = obj[key];
  if (hit && typeof hit === "object" && !Array.isArray(hit)) acc.push(hit as Record<string, unknown>);
  for (const k of Object.keys(obj)) findAll(obj[k], key, acc);
  return acc;
}

function tsToSeconds(ts: string): number | null {
  const m = ts.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Au-delà, ce n'est plus un rythme de travail (et la réponse reste petite). */
export const MAX_CHAPTERS = 200;
const MAX_TITLE = 120;

function dedupe(chapters: Chapter[]): Chapter[] {
  const seen = new Set<number>();
  return chapters
    .filter((c) => c.title && Number.isFinite(c.startSec) && c.startSec >= 0 && !seen.has(c.startSec) && (seen.add(c.startSec), true))
    .sort((a, b) => a.startSec - b.startSec)
    .slice(0, MAX_CHAPTERS)
    .map((c) => ({ startSec: c.startSec, title: c.title.slice(0, MAX_TITLE) }));
}

/** Chapitres structurés : barre de lecture (chapterRenderer), sinon panneau (macroMarkersListItemRenderer). */
export function chaptersFromInitialData(data: unknown): Chapter[] {
  const bar = findAll(data, "chapterRenderer")
    .map((c) => ({ startSec: Math.floor(Number(c.timeRangeStartMillis) / 1000), title: ytText(c.title).trim() }));
  const fromBar = dedupe(bar);
  if (fromBar.length >= 2) return fromBar;
  const panel = findAll(data, "macroMarkersListItemRenderer").map((m) => {
    const tap = (m.onTap as { watchEndpoint?: { startTimeSeconds?: unknown } } | undefined)?.watchEndpoint?.startTimeSeconds;
    const start = typeof tap === "number" ? tap : tsToSeconds(ytText(m.timeDescription));
    return { startSec: start ?? NaN, title: ytText(m.title).trim() };
  });
  const fromPanel = dedupe(panel);
  return fromPanel.length >= 2 ? fromPanel : [];
}

/** Description : attributedDescription (récent), description.runs (ancien), sinon shortDescription. */
export function descriptionFrom(data: unknown, player: unknown): string {
  for (const info of findAll(data, "videoSecondaryInfoRenderer")) {
    const attributed = (info.attributedDescription as { content?: unknown } | undefined)?.content;
    if (typeof attributed === "string" && attributed.trim()) return attributed;
    const old = ytText(info.description);
    if (old.trim()) return old;
  }
  const details = (player as { videoDetails?: { shortDescription?: unknown } } | null)?.videoDetails;
  return typeof details?.shortDescription === "string" ? details.shortDescription : "";
}

/** lengthSeconds (chaîne) de videoDetails, sinon du microformat. */
export function lengthFrom(player: unknown): number {
  const p = player as {
    videoDetails?: { lengthSeconds?: unknown };
    microformat?: { playerMicroformatRenderer?: { lengthSeconds?: unknown } };
  } | null;
  for (const v of [p?.videoDetails?.lengthSeconds, p?.microformat?.playerMicroformatRenderer?.lengthSeconds]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 0;
}

/** Chapitres + durée à partir des deux objets déjà extraits. */
export function scheduleFromWatchData(data: unknown, player: unknown): WatchSchedule {
  const durationSec = lengthFrom(player);
  const structured = chaptersFromInitialData(data);
  if (structured.length) return { chapters: structured, durationSec, source: "chapters" };
  const described = dedupe(parseChaptersFromDescription(descriptionFrom(data, player)));
  if (described.length >= 2) return { chapters: described, durationSec, source: "description" };
  return { chapters: [], durationSec, source: "none" };
}

/** Chapitres + durée depuis le HTML de la page watch. */
export function scheduleFromWatchHtml(html: string): WatchSchedule {
  return scheduleFromWatchData(extractYtInitialData(html), extractYtPlayerResponse(html));
}
