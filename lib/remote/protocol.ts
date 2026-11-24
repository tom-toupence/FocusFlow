// Téléphone télécommande et « Emporter la session » (lot 7) : le protocole.
// Logique PURE (aucun accès réseau ni store), testée dans protocol.test.ts.
//
// Le canal est éphémère et nommé par un code aléatoire de 6 caractères : le code
// EST le secret. Chaque message est versionné, validé à la réception (forme
// stricte, types, tailles bornées) ; un message inconnu, malformé, trop vieux
// (> 30 s) ou déjà vu (nonce) est ignoré sans bruit.

import type { TimerMode, TimerPreset } from "@/store/timerStore";

export const REMOTE_VERSION = 1;
/** Sans I, L, O, 0, 1 : rien à confondre en recopiant le code à la main. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
/** Durée de vie d'un code. */
export const CODE_TTL_MS = 2 * 60 * 60 * 1000;
/** Au-delà, un message est ignoré (anti-rejeu, avec le nonce). */
export const MAX_MESSAGE_AGE_MS = 30_000;
/** L'ordinateur diffuse son état à ce rythme (et à chaque changement). */
export const STATE_INTERVAL_MS = 5_000;
/** « Téléphone connecté » : il a parlé dans cette fenêtre. */
export const CONNECTED_WINDOW_MS = 15_000;
/** Le téléphone déclare l'ordinateur introuvable sans état reçu dans ce délai. */
export const HOST_TIMEOUT_MS = 10_000;
/** Un handoff sans accusé dans ce délai est abandonné (l'ordinateur continue). */
export const HANDOFF_ACK_TIMEOUT_MS = 10_000;

/** Décalage d'horloge au-delà duquel on prévient (et plafond de l'estimation). */
export const SKEW_WARN_MS = 30_000;
export const MAX_SKEW_MS = 24 * 3600_000;

export const MAX_TITLE = 200;
export const MAX_TODOS = 50;
export const MAX_TRACKS = 200;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
const NONCE_RE = /^[A-Za-z0-9_-]{8,32}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const YT_ID_RE = /^[\w-]{11}$/;
const YT_LIST_RE = /^[\w-]{2,64}$/;
const SPOTIFY_URI_RE = /^spotify:(playlist|album):[A-Za-z0-9]{22}$/;
/** Nonce d'accusé : envoyé seulement dans le message de handoff (signé). */
const ACK_RE = /^[A-Za-z0-9_-]{16,32}$/;
const TWITCH_CHANNEL_RE = /^\w{1,25}$/;
const TWITCH_VOD_RE = /^\d{1,15}$/;

// ─── Code d'appairage ─────────────────────────────────────────────────────────

/** Octets aléatoires cryptographiques (injectable pour les tests). */
export type RandomBytes = (n: number) => Uint8Array;
export const cryptoBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/**
 * Code de 6 caractères tirés de CODE_ALPHABET (31 symboles, ~8,9e8 codes).
 * Tirage par rejet : sans biais de modulo (on garde les octets < 31 × 8 = 248).
 */
export function generateCode(rand: RandomBytes = cryptoBytes): string {
  const limit = CODE_ALPHABET.length * Math.floor(256 / CODE_ALPHABET.length);
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of rand(16)) {
      if (b < limit) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}

/** Code saisi ou lu dans l'URL : majuscules, sans espaces. null si invalide. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 32) return null;
  const c = raw.trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

/** Nonce de message (12 caractères aléatoires). */
export function newNonce(rand: RandomBytes = cryptoBytes): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return Array.from(rand(12), (b) => abc[b & 63]).join("");
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export type RemoteCommand = "pause" | "resume" | "distraction" | "next";
export type ByeReason = "expired" | "ended" | "disconnected" | "handed-off";
/** denied : refusé sur l'ordinateur ; taken : code déjà servi ; changed : la session a bougé avant l'accusé. */
export type RefuseReason = "denied" | "taken" | "changed";

/** Ce que le téléphone affiche, diffusé par l'ordinateur. */
export interface RemoteState {
  mode: TimerMode;
  running: boolean;
  /** Flowtime en cours de travail : chrono croissant (flowStartedAt). */
  flow: boolean;
  /** Fin du cycle (horloge de l'ordinateur), null en pause ou en flow. */
  endsAt: number | null;
  /** Départ virtuel du flow (horloge de l'ordinateur), null hors flow en marche. */
  flowStartedAt: number | null;
  /** Secondes affichées quand rien ne tourne (restantes, ou écoulées en flow). */
  seconds: number;
  /** Durée du cycle (0 en flow) : pour la barre de progression. */
  total: number;
  /** Numéro du pomodoro en cours (1 au départ). */
  pomodoro: number;
  title: string | null;
  sub: string | null;
  caps: { skip: boolean };
  distractions: number;
  /** Fin de validité du code (horloge de l'ordinateur). */
  expiresAt: number;
}

export interface HandoffTodo { id: string; text: string; status: "todo" | "in-progress" | "done" }

export type HandoffMedia =
  /** Rien de résolu côté ordinateur : le téléphone garde le catalogue. */
  | { kind: "none" }
  | { kind: "video"; id: string; title: string; sub: string | null; position: number; playing: boolean }
  /** File maison (File FocusFlow, playlist ou mix résolus) : ids, titres, piste en cours. */
  | { kind: "queue"; tracks: { id: string; title: string }[]; index: number; subtitle: string | null; position: number; playing: boolean }
  | { kind: "native"; listId: string; title: string }
  | { kind: "radio" }
  | { kind: "spotify"; uri: string }
  | { kind: "twitch"; channel: string | null; vodId: string | null };

/** État complet transféré au téléphone (Emporter la session). */
export interface HandoffState {
  timer: {
    settings: { preset: TimerPreset; workDuration: number; shortBreakDuration: number; longBreakDuration: number; sessionsBeforeLongBreak: number };
    mode: TimerMode;
    running: boolean;
    /** Fin du cycle, horloge de l'ordinateur (null en pause ou en flow). */
    endsAt: number | null;
    /** Restant au moment de l'envoi : c'est la part du cycle que le téléphone créditera. */
    secondsLeft: number;
    cycleSeconds: number;
    sessionsCompleted: number;
    stopAt: number | null;
    flowBreakTotal: number;
  };
  todos: HandoffTodo[];
  media: HandoffMedia;
}

interface Envelope { v: 1; n: string; t: number }
/**
 * `id` : identifiant d'appareil (télécommande, gardé dans le stockage du
 * téléphone) ou de demande (handoff, un par page).
 */
export type RemoteMessage =
  /** `pub` : clé publique ECDSA de l'appareil (id = son empreinte) ; `ch` : défi pour caler l'horloge. */
  | (Envelope & { type: "hello"; role: "remote" | "handoff"; id: string; pub: string; ch: string })
  /** L'ordinateur a vu la demande : en attente d'« Autoriser » sur l'ordinateur. */
  | (Envelope & { type: "wait"; id: string; ch: string })
  /** Cet appareil est appairé : ses commandes seront appliquées. */
  | (Envelope & { type: "paired"; id: string; ch: string })
  | (Envelope & { type: "state"; s: RemoteState })
  /** `sig` : signature ECDSA de l'appareil (deviceSigningInput). */
  | (Envelope & { type: "cmd"; id: string; cmd: RemoteCommand; sig: string })
  | (Envelope & { type: "handoff"; id: string; ack: string; state: HandoffState })
  | (Envelope & { type: "ack"; id: string; ack: string; sig: string })
  | (Envelope & { type: "refused"; id: string; reason: RefuseReason; ch: string })
  | (Envelope & { type: "bye"; reason: ByeReason });

type Body<T> = T extends Envelope ? Omit<T, keyof Envelope> : never;
export type RemoteMessageBody = Body<RemoteMessage>;

/** Enveloppe un corps de message (version, nonce, horodatage). */
export function makeMessage<B extends RemoteMessageBody>(body: B, now = Date.now(), rand: RandomBytes = cryptoBytes): B & Envelope {
  return { v: REMOTE_VERSION, n: newNonce(rand), t: now, ...body } as B & Envelope;
}

// ─── Validation ───────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
/** Exactement ces clés (pas une de plus, pas une de moins hors optionnelles). */
function hasKeys(o: Obj, required: string[], optional: string[] = []): boolean {
  const keys = Object.keys(o);
  if (!required.every((k) => k in o)) return false;
  return keys.every((k) => required.includes(k) || optional.includes(k));
}
const isNum = (x: unknown, min = -Infinity, max = Infinity): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
const isInt = (x: unknown, min: number, max: number): x is number => isNum(x, min, max) && Number.isInteger(x);
const isStr = (x: unknown, max: number, min = 0): x is string => typeof x === "string" && x.length >= min && x.length <= max;
const isBool = (x: unknown): x is boolean => typeof x === "boolean";
const isTime = (x: unknown): x is number => isNum(x, 0, 1e14);
const isTimeOrNull = (x: unknown) => x === null || isTime(x);
const isStrOrNull = (x: unknown, max: number) => x === null || isStr(x, max);

const MODES = new Set<TimerMode>(["work", "short-break", "long-break"]);
const PRESETS = new Set<TimerPreset>(["classic", "deep", "custom", "flowtime"]);
const COMMANDS = new Set<RemoteCommand>(["pause", "resume", "distraction", "next"]);
const BYES = new Set<ByeReason>(["expired", "ended", "disconnected", "handed-off"]);
const REFUSALS = new Set<RefuseReason>(["denied", "taken", "changed"]);
const STATUSES = new Set(["todo", "in-progress", "done"]);
const DAY = 24 * 3600;

export function validRemoteState(s: unknown): s is RemoteState {
  if (!isObj(s)) return false;
  if (!hasKeys(s, ["mode", "running", "flow", "endsAt", "flowStartedAt", "seconds", "total", "pomodoro", "title", "sub", "caps", "distractions", "expiresAt"])) return false;
  return MODES.has(s.mode as TimerMode) && isBool(s.running) && isBool(s.flow)
    && isTimeOrNull(s.endsAt) && isTimeOrNull(s.flowStartedAt)
    && isInt(s.seconds, 0, DAY) && isInt(s.total, 0, DAY) && isInt(s.pomodoro, 1, 10_000)
    && isStrOrNull(s.title, MAX_TITLE) && isStrOrNull(s.sub, MAX_TITLE)
    && isObj(s.caps) && hasKeys(s.caps, ["skip"]) && isBool(s.caps.skip)
    && isInt(s.distractions, 0, 100_000) && isTime(s.expiresAt);
}

function validTrack(t: unknown): boolean {
  return isObj(t) && hasKeys(t, ["id", "title"]) && isStr(t.id, 11) && YT_ID_RE.test(t.id as string) && isStr(t.title, MAX_TITLE);
}

export function validHandoffMedia(m: unknown): m is HandoffMedia {
  if (!isObj(m) || typeof m.kind !== "string") return false;
  switch (m.kind) {
    case "none":
    case "radio":
      return hasKeys(m, ["kind"]);
    case "video":
      return hasKeys(m, ["kind", "id", "title", "sub", "position", "playing"])
        && isStr(m.id, 11) && YT_ID_RE.test(m.id as string) && isStr(m.title, MAX_TITLE)
        && isStrOrNull(m.sub, MAX_TITLE) && isNum(m.position, 0, DAY) && isBool(m.playing);
    case "queue":
      return hasKeys(m, ["kind", "tracks", "index", "subtitle", "position", "playing"])
        && Array.isArray(m.tracks) && m.tracks.length >= 1 && m.tracks.length <= MAX_TRACKS && m.tracks.every(validTrack)
        && isInt(m.index, 0, m.tracks.length - 1) && isStrOrNull(m.subtitle, MAX_TITLE)
        && isNum(m.position, 0, DAY) && isBool(m.playing);
    case "native":
      return hasKeys(m, ["kind", "listId", "title"]) && isStr(m.listId, 64) && YT_LIST_RE.test(m.listId as string) && isStr(m.title, MAX_TITLE);
    case "spotify":
      return hasKeys(m, ["kind", "uri"]) && isStr(m.uri, 100) && SPOTIFY_URI_RE.test(m.uri as string);
    case "twitch":
      return hasKeys(m, ["kind", "channel", "vodId"])
        && (m.channel === null || (isStr(m.channel, 25) && TWITCH_CHANNEL_RE.test(m.channel as string)))
        && (m.vodId === null || (isStr(m.vodId, 15) && TWITCH_VOD_RE.test(m.vodId as string)))
        && (m.channel !== null || m.vodId !== null);
    default:
      return false;
  }
}

export function validHandoffState(h: unknown): h is HandoffState {
  if (!isObj(h) || !hasKeys(h, ["timer", "todos", "media"])) return false;
  const t = h.timer;
  if (!isObj(t) || !hasKeys(t, ["settings", "mode", "running", "endsAt", "secondsLeft", "cycleSeconds", "sessionsCompleted", "stopAt", "flowBreakTotal"])) return false;
  const st = t.settings;
  if (!isObj(st) || !hasKeys(st, ["preset", "workDuration", "shortBreakDuration", "longBreakDuration", "sessionsBeforeLongBreak"])) return false;
  const settingsOk = PRESETS.has(st.preset as TimerPreset)
    && isInt(st.workDuration, 1, 240) && isInt(st.shortBreakDuration, 1, 120)
    && isInt(st.longBreakDuration, 1, 240) && isInt(st.sessionsBeforeLongBreak, 1, 12);
  const timerOk = settingsOk && MODES.has(t.mode as TimerMode) && isBool(t.running)
    && isTimeOrNull(t.endsAt) && isInt(t.secondsLeft, 0, DAY) && isInt(t.cycleSeconds, 0, DAY)
    && isInt(t.sessionsCompleted, 0, 10_000) && isTimeOrNull(t.stopAt) && isInt(t.flowBreakTotal, 0, DAY);
  if (!timerOk) return false;
  if (!Array.isArray(h.todos) || h.todos.length > MAX_TODOS) return false;
  const todosOk = h.todos.every((x) => isObj(x) && hasKeys(x, ["id", "text", "status"])
    && isStr(x.id, 64) && ID_RE.test(x.id as string) && isStr(x.text, MAX_TITLE, 1) && STATUSES.has(x.status as string));
  return todosOk && validHandoffMedia(h.media);
}

const validId = (x: unknown) => isStr(x, 64) && ID_RE.test(x as string);
const validAck = (x: unknown) => isStr(x, 32) && ACK_RE.test(x as string);
const validPub = (x: unknown) => isStr(x, 140) && /^[A-Za-z0-9_-]{100,140}$/.test(x as string);
const validSig = (x: unknown) => isStr(x, 86) && /^[A-Za-z0-9_-]{86}$/.test(x as string);
const validCh = (x: unknown) => isStr(x, 32) && NONCE_RE.test(x as string);

/** Forme stricte d'un message ; null pour tout ce qui n'est pas un message v1 connu et valide. */
export function parseMessage(raw: unknown): RemoteMessage | null {
  if (!isObj(raw)) return null;
  if (raw.v !== REMOTE_VERSION || !isStr(raw.n, 32) || !NONCE_RE.test(raw.n as string) || !isTime(raw.t)) return null;
  const env = ["v", "n", "t", "type"];
  switch (raw.type) {
    case "hello":
      return hasKeys(raw, [...env, "role", "id", "pub", "ch"]) && (raw.role === "remote" || raw.role === "handoff")
        && validId(raw.id) && validPub(raw.pub) && validCh(raw.ch) ? (raw as unknown as RemoteMessage) : null;
    case "wait":
    case "paired":
      return hasKeys(raw, [...env, "id", "ch"]) && validId(raw.id) && validCh(raw.ch) ? (raw as unknown as RemoteMessage) : null;
    case "state":
      return hasKeys(raw, [...env, "s"]) && validRemoteState(raw.s) ? (raw as unknown as RemoteMessage) : null;
    case "cmd":
      return hasKeys(raw, [...env, "id", "cmd", "sig"]) && validId(raw.id) && COMMANDS.has(raw.cmd as RemoteCommand) && validSig(raw.sig) ? (raw as unknown as RemoteMessage) : null;
    case "handoff":
      return hasKeys(raw, [...env, "id", "ack", "state"]) && validId(raw.id) && validAck(raw.ack)
        && validHandoffState(raw.state) ? (raw as unknown as RemoteMessage) : null;
    case "ack":
      return hasKeys(raw, [...env, "id", "ack", "sig"]) && validId(raw.id) && validAck(raw.ack) && validSig(raw.sig) ? (raw as unknown as RemoteMessage) : null;
    case "refused":
      return hasKeys(raw, [...env, "id", "reason", "ch"]) && validId(raw.id) && REFUSALS.has(raw.reason as RefuseReason) && validCh(raw.ch) ? (raw as unknown as RemoteMessage) : null;
    case "bye":
      return hasKeys(raw, [...env, "reason"]) && BYES.has(raw.reason as ByeReason) ? (raw as unknown as RemoteMessage) : null;
    default:
      return null; // type inconnu (version future) : ignoré
  }
}

// ─── Anti-rejeu ───────────────────────────────────────────────────────────────

/**
 * Garde de réception (après vérification de la signature) : forme valide, âge
 * ≤ 30 s dans les deux sens, nonce jamais vu. Les nonces sont oubliés après
 * 2 × 30 s (un message plus vieux est de toute façon refusé par l'âge).
 *
 * `offset` = horloge locale − horloge de l'ordinateur. L'ordinateur est la
 * référence (0) ; le téléphone l'estime sur la première réponse qui renvoie SON
 * défi (`ch` du hello, dans wait/paired/refused : `calibrate`), puis date ses
 * propres messages à l'heure de l'ordinateur. Un vieux message rejoué ne peut
 * donc pas fausser le calage.
 */
export class ReplayGuard {
  private seen = new Map<string, number>();
  offset: number | null;
  constructor(private maxAge = MAX_MESSAGE_AGE_MS, offset: number | null = 0) { this.offset = offset; }

  /** Pose le décalage sur une réponse à notre défi (au plus 24 h, au-delà on n'y croit pas). */
  calibrate(raw: unknown, challenge: string, now = Date.now()) {
    if (this.offset != null) return;
    const m = parseMessage(raw);
    if (!m || (m.type !== "wait" && m.type !== "paired" && m.type !== "refused") || m.ch !== challenge) return;
    if (Math.abs(now - m.t) <= MAX_SKEW_MS) this.offset = now - m.t;
  }

  accept(raw: unknown, now = Date.now()): RemoteMessage | null {
    const m = parseMessage(raw);
    if (!m || this.offset == null) return null;
    if (Math.abs(now - this.offset - m.t) > this.maxAge) return null;
    if (this.seen.has(m.n)) return null;
    this.seen.set(m.n, now);
    if (this.seen.size > 500) this.prune(now);
    return m;
  }

  private prune(now: number) {
    for (const [n, at] of this.seen) if (now - at > 2 * this.maxAge) this.seen.delete(n);
    // Inondation : on garde les 500 plus récents.
    while (this.seen.size > 500) this.seen.delete(this.seen.keys().next().value as string);
  }
}

// ─── Petites règles partagées ─────────────────────────────────────────────────

export const isPhoneConnected = (lastSeen: number | null, now: number) =>
  lastSeen != null && now - lastSeen <= CONNECTED_WINDOW_MS;

export const isExpired = (expiresAt: number, now: number) => now >= expiresAt;

/** Tronque un texte libre à la taille admise par le protocole. */
export const clip = (s: string, max = MAX_TITLE) => (s.length > max ? s.slice(0, max) : s);

/** Secondes affichées par le téléphone, depuis l'état et le décalage d'horloge (téléphone − ordinateur). */
export function displaySeconds(s: RemoteState, offsetMs: number, now: number): number {
  const hostNow = now - offsetMs;
  if (s.running && s.flow && s.flowStartedAt != null) return Math.max(0, Math.floor((hostNow - s.flowStartedAt) / 1000));
  if (s.running && s.endsAt != null) return Math.max(0, Math.ceil((s.endsAt - hostNow) / 1000));
  return s.seconds;
}
