// Analyse locale de la phrase de ⌘K « Lancer en une phrase ». Logique pure.
import { extractYouTubeId } from "@/data/videos";

export interface QuickTodo {
  id: string;
  text: string;
  status: string;
}

export type QuickMediaKind = "catalogue" | "custom" | "playlist" | "local-playlist" | "history";

export interface QuickMedia {
  key: string;
  title: string;
  subtitle?: string;
  kind: QuickMediaKind;
  plays?: number;
}

export interface QuickContext {
  todos: QuickTodo[];
  media: QuickMedia[];
}

export type QuickPreset = "classic" | "deep" | "flowtime" | "custom";

export interface QuickLaunch {
  minutes?: number;
  preset?: QuickPreset;
  todoId?: string;
  todoAlternatives?: string[];
  mediaKey?: string;
  mediaAlternatives?: string[];
  url?: string;
  /** Source citée (« spotify »), indice pour le choix du média. */
  source?: "youtube" | "spotify" | "twitch";
  /** YouTube : identifiant extrait de l'URL. */
  youtubeId?: string;
  intent?: "launch" | "resume-session" | "relaunch-last";
  /** 0 à 1 ; sous 0.6, l'UI doit faire confirmer. */
  confidence: number;
}

export const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[œ]/g, "oe")
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP = new Set(
  (
    "le la les un une des de du d l a au aux et en sur pour avec mon ma mes ton ta mes je veux j'veux " +
    "lance lancer lancement demarre demarrer commence commencer start go session sessions musique music " +
    "the and for with my to of on in at a un peu fais fait mets mettre met s il moi me"
  ).split(" "),
);

const URL_RE = /(?:https?:\/\/|www\.)\S+|(?:youtu\.be|youtube\.com|open\.spotify\.com|twitch\.tv)\/\S+|spotify:[a-z]+:[A-Za-z0-9]+/i;

function sourceOfUrl(u: string): QuickLaunch["source"] | undefined {
  if (/youtu\.?be/i.test(u)) return "youtube";
  if (/spotify/i.test(u)) return "spotify";
  if (/twitch\.tv/i.test(u)) return "twitch";
  return undefined;
}

// --- Correspondance floue ----------------------------------------------------

function lev1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}

const stem = (w: string) => (w.length > 3 ? w.replace(/(s|x)$/, "") : w);

/** Poids de la correspondance d'un mot de la requête avec un mot du candidat. */
function tokenWeight(q: string, c: string): number {
  if (q === c) return 1;
  const qs = stem(q);
  const cs = stem(c);
  if (qs === cs) return 0.95;
  if (q.length >= 3 && c.startsWith(q)) return 0.7;
  if (qs.length >= 5 && lev1(qs, cs)) return 0.6;
  return 0;
}

interface Scored<T> {
  item: T;
  match: number;
  score: number;
  used: Set<number>;
}

function scoreCandidate<T>(item: T, text: string, qTokens: string[], free: Set<number>, bonus: number): Scored<T> | null {
  const cTokens = normalize(text).split(" ").filter(Boolean);
  if (!cTokens.length) return null;
  const used = new Set<number>();
  let match = 0;
  for (const qi of free) {
    let best = 0;
    for (const c of cTokens) best = Math.max(best, tokenWeight(qTokens[qi], c));
    if (best > 0) {
      match += best;
      used.add(qi);
    }
  }
  if (match < 0.6) return null;
  const coverage = Math.min(1, used.size / cTokens.length);
  return { item, match, score: match + 0.2 * coverage + bonus, used };
}

/** Meilleur candidat ; ambigu si un second est trop proche (alors pas de choix silencieux). */
function rank<T>(list: Scored<T>[]): { top?: Scored<T>; ambiguous: boolean; alts: Scored<T>[] } {
  const s = list.sort((a, b) => b.score - a.score);
  if (!s.length) return { ambiguous: false, alts: [] };
  const ambiguous = s.length > 1 && s[1].score > s[0].score - 0.15;
  const alts = ambiguous ? s.filter((x) => x.score > s[0].score - 0.5).slice(0, 4) : [];
  return { top: s[0], ambiguous, alts };
}

// --- Analyse -----------------------------------------------------------------

export function parseQuickLaunch(input: string, ctx: QuickContext): QuickLaunch {
  const out: QuickLaunch = { confidence: 0 };
  let text = input;
  let penalty = 0;

  // URL
  const um = text.match(URL_RE);
  if (um) {
    const raw = um[0].replace(/[),.;]+$/, "");
    const src = sourceOfUrl(raw);
    if (src) {
      out.url = /^(https?:|spotify:)/i.test(raw) ? raw : `https://${raw}`;
      out.source = src;
      if (src === "youtube") {
        const id = extractYouTubeId(raw);
        if (id) out.youtubeId = id;
      }
      text = text.replace(um[0], " ");
    }
  }

  let n = " " + normalize(text) + " ";
  const eat = (re: RegExp): RegExpMatchArray | null => {
    const m = n.match(re);
    if (m) n = n.replace(m[0], " ");
    return m;
  };

  // Intentions
  if (eat(/ (?:comme hier|comme la derniere fois|comme avant|comme d habitude|meme chose|relancer|relance|relancer la derniere) /)) {
    out.intent = "relaunch-last";
  } else if (eat(/ (?:retour|reprendre|reprends|reprise|reviens|revenir) /)) {
    out.intent = "resume-session";
    n = n.replace(/ session /g, " ");
  }

  // Durée : 1h30, 2 h, 50 min, 25 ; puis nombre isolé
  let minutes: number | undefined;
  let m = eat(/ (\d{1,2}) ?(?:h|heures?|hrs?) ?(?:(\d{1,2}) ?(?:min|minutes?|mn)? )?/);
  if (m) minutes = +m[1] * 60 + +(m[2] ?? 0);
  if (minutes === undefined) {
    m = eat(/ (\d{1,3}) ?(?:min|minutes?|mn|m) /);
    if (m) minutes = +m[1];
  }
  if (minutes === undefined) {
    m = n.match(/ (\d{1,3}) /);
    if (m && +m[1] >= 5 && +m[1] <= 240) {
      minutes = +m[1];
      n = n.replace(m[0], " ");
    }
  }
  if (minutes !== undefined && minutes >= 1 && minutes <= 720) out.minutes = minutes;

  // Preset et source
  if (eat(/ (?:flowtime|flow|flow time) /)) out.preset = "flowtime";
  else if (eat(/ (?:deep work|deep|profond|travail profond) /)) out.preset = "deep";
  else if (eat(/ (?:classique|classic|pomodoro|standard) /)) out.preset = "classic";
  else if (eat(/ (?:custom|perso|personnalise|personnalisee) /)) out.preset = "custom";
  const sm = eat(/ (spotify|twitch|youtube) /);
  if (sm && !out.source) out.source = sm[1] as QuickLaunch["source"];

  // Mots restants pour tâche et média
  const qTokens = n.split(" ").filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  const free = new Set(qTokens.map((_, i) => i));

  const todos = ctx.todos.filter((t) => t.status !== "done");
  const urlGiven = !!out.url;
  const bonusOf = (p?: number) => Math.min(0.3, 0.1 * Math.log2(1 + (p ?? 0)));

  const todoPass = () => {
    const sc = todos.map((t) => scoreCandidate(t, t.text, qTokens, free, 0)).filter(Boolean) as Scored<QuickTodo>[];
    return rank(sc);
  };
  const mediaPass = () => {
    if (urlGiven) return rank<QuickMedia>([]);
    const sc = ctx.media
      .map((md) => scoreCandidate(md, `${md.title} ${md.subtitle ?? ""}`, qTokens, free, bonusOf(md.plays)))
      .filter(Boolean) as Scored<QuickMedia>[];
    return rank(sc);
  };

  // Le candidat le mieux apparié consomme ses mots en premier.
  let t = free.size ? todoPass() : { ambiguous: false, alts: [] as Scored<QuickTodo>[], top: undefined };
  let md = free.size ? mediaPass() : { ambiguous: false, alts: [] as Scored<QuickMedia>[], top: undefined };
  const mediaFirst = (md.top?.match ?? 0) >= (t.top?.match ?? 0);
  if (mediaFirst) {
    if (md.top && !md.ambiguous) md.top.used.forEach((i) => free.delete(i));
    t = free.size ? todoPass() : { ambiguous: false, alts: [], top: undefined };
  } else {
    if (t.top && !t.ambiguous) t.top.used.forEach((i) => free.delete(i));
    md = free.size ? mediaPass() : { ambiguous: false, alts: [], top: undefined };
  }
  if (md.top && !md.ambiguous) md.top.used.forEach((i) => free.delete(i));
  if (t.top && !t.ambiguous) t.top.used.forEach((i) => free.delete(i));

  if (t.top) {
    if (t.ambiguous) {
      out.todoAlternatives = t.alts.map((a) => a.item.id);
      penalty += 0.4;
    } else out.todoId = t.top.item.id;
  }
  if (md.top) {
    if (md.ambiguous) {
      out.mediaAlternatives = md.alts.map((a) => a.item.key);
      penalty += 0.4;
    } else out.mediaKey = md.top.item.key;
  }
  penalty += Math.min(0.3, free.size * 0.15); // mots non compris

  const actionable =
    out.minutes !== undefined || out.preset || out.todoId || out.todoAlternatives || out.mediaKey ||
    out.mediaAlternatives || out.url || out.source;
  if (!out.intent && actionable) out.intent = "launch";

  if (!out.intent) {
    out.confidence = 0;
    return out;
  }
  const base = out.url || (out.intent !== "launch" && !actionable) ? 0.95 : 0.9;
  out.confidence = Math.max(0.05, Math.round((base - penalty) * 100) / 100);
  return out;
}
