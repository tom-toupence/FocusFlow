// « Calé sur la vidéo » : rythme travail/pause déduit des chapitres d'une vidéo
// Study With Me. Logique pure ; le temps de la vidéo devient la source du minuteur.

export interface Chapter {
  startSec: number;
  title: string;
}

export type SegmentKind = "work" | "break";

export interface Segment {
  start: number;
  end: number;
  kind: SegmentKind;
  title?: string;
}

export type VideoSchedule = Segment[];

const TS = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}`;
const LEAD = new RegExp(String.raw`^[\s\[(\-•*▶►>]*(${TS})[\s\])\-–—:.|)]*(.*)$`);
const TRAIL = new RegExp(String.raw`^(.*?)[\s\-–—:|(\[]+(${TS})[\s\])]*$`);

function toSeconds(ts: string): number | null {
  const p = ts.split(":").map(Number);
  if (p.some((x) => !Number.isFinite(x))) return null;
  const [h, m, s] = p.length === 3 ? p : [0, p[0], p[1]];
  if (s >= 60 || (p.length === 3 && m >= 60)) return null;
  return h * 3600 + m * 60 + s;
}

/** Chapitres « 0:00 Focus » / « 1:00:00 Pomodoro 2 » d'une description, triés et dédoublonnés. */
export function parseChaptersFromDescription(text: string): Chapter[] {
  const seen = new Set<number>();
  const out: Chapter[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let ts: string | undefined;
    let title: string | undefined;
    const a = line.match(LEAD);
    if (a) [, ts, title] = a;
    else {
      const b = line.match(TRAIL);
      if (b) [, title, ts] = b;
    }
    if (!ts || title === undefined) continue;
    const sec = toSeconds(ts);
    title = title.trim();
    if (sec === null || !title || seen.has(sec)) continue;
    seen.add(sec);
    out.push({ startSec: sec, title });
  }
  return out.sort((x, y) => x.startSec - y.startSec);
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const BREAK_RE = /\b(break|pause|rest|repos|recess|intermission|stretch|coffee|cafe|snack|lunch|dejeuner)\b/;
const WORK_RE = /\b(focus|study|studying|work|working|pomodoro|session|travail|concentration|deep|round|sprint|revision|lecture|reading)\b/;
const SKIP_RE = /\b(intro|introduction|outro|welcome|bienvenue|ending|end|fin|credits|thanks|merci|tracklist)\b/;

type Class = SegmentKind | "skip" | "unknown";

function classify(title: string): Class {
  const t = norm(title);
  if (BREAK_RE.test(t)) return "break";
  if (WORK_RE.test(t)) return "work";
  if (SKIP_RE.test(t)) return "skip";
  return "unknown";
}

/**
 * Segments travail/pause à partir des chapitres. intro/outro : aucun segment
 * (le précédent s'arrête là) ; titre non reconnu : rattaché au segment précédent.
 * null si pas au moins un travail ET une pause.
 */
export function scheduleFromChapters(chapters: Chapter[], durationSec: number): VideoSchedule | null {
  if (!(durationSec > 0)) return null;
  const cs = chapters
    .filter((c) => c.startSec < durationSec)
    .sort((a, b) => a.startSec - b.startSec)
    .map((c) => ({ ...c, cls: classify(c.title) }));
  const segs: Segment[] = [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.cls === "skip" || c.cls === "unknown") continue;
    // fin = prochain chapitre qui n'est pas « inconnu » (les inconnus prolongent ce segment)
    let end = durationSec;
    for (let j = i + 1; j < cs.length; j++) {
      if (cs[j].cls !== "unknown") {
        end = cs[j].startSec;
        break;
      }
    }
    if (end > c.startSec) segs.push({ start: c.startSec, end, kind: c.cls, title: c.title });
  }
  if (!segs.some((s) => s.kind === "work") || !segs.some((s) => s.kind === "break")) return null;
  return segs;
}

export interface SegmentPosition {
  segment: Segment;
  index: number;
  remainingSec: number;
}

/** Segment courant au temps t de la vidéo ; null dans un trou (intro/outro) ou hors vidéo. */
export function segmentAt(schedule: VideoSchedule, currentTimeSec: number): SegmentPosition | null {
  const index = schedule.findIndex((s) => currentTimeSec >= s.start && currentTimeSec < s.end);
  if (index < 0) return null;
  const segment = schedule[index];
  return { segment, index, remainingSec: segment.end - currentTimeSec };
}

/** Début du prochain segment de travail strictement après t ; null s'il n'y en a plus. */
export function nextWorkStart(schedule: VideoSchedule, t: number): number | null {
  let best: number | null = null;
  for (const s of schedule) if (s.kind === "work" && s.start > t && (best === null || s.start < best)) best = s.start;
  return best;
}
