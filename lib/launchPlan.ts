// « Lancer en une phrase » : du résultat de `parseQuickLaunch` à un plan de
// lancement concret (rythme, tâche, média), sans toucher aux stores. Logique
// pure, testée ; `lib/launch.ts` lit les stores et applique le plan.
import type { QuickContext, QuickLaunch, QuickMedia, QuickTodo } from "./quickLaunch";
import { PRESETS, type TimerPreset, type TimerSettings } from "@/store/timerStore";
import type { Video } from "@/data/videos";
import type { PlayType } from "@/store/playHistoryStore";

// --- Types --------------------------------------------------------------------

/** Comment sélectionner un média dans les stores. */
export type MediaRef =
  | { type: "video"; id: string } // vidéo du catalogue ou de la bibliothèque (Video.id)
  | { type: "youtube"; youtubeId: string; title?: string; channel?: string } // ajoutée en vidéo perso si absente
  | { type: "yt-playlist"; id: string } // SavedPlaylist.id
  | { type: "yt-playlist-url"; listId: string; startVideoId?: string; title?: string } // ajoutée si absente
  | { type: "local"; id: string } // playlist locale
  | { type: "spotify"; uri: string }
  | { type: "twitch-channel"; login: string }
  | { type: "twitch-vod"; id: string }
  | { type: "current-youtube" }; // garde la sélection YouTube, coupe Spotify/Twitch

export interface LaunchMedia extends QuickMedia {
  ref: MediaRef;
  thumbnailUrl?: string;
  youtubeId?: string;
  /** Clé de `playHistoryStore` qui désigne ce média (youtubeId, pl:…, uri…). */
  historyKey?: string;
}

export interface HistoryLite {
  mediaKey: string;
  type: PlayType;
  title: string;
  subtitle: string;
  thumbnailUrl?: string;
}

export interface LaunchEnv {
  timer: TimerSettings;
  sessionActive: boolean;
  /** Plus récente en premier. */
  history: HistoryLite[];
  currentMediaTitle?: string;
  spotify: { connected: boolean; selectedUri: string | null; playlists: { uri: string; name: string; imageUrl?: string }[] };
  twitch: { selectedChannel: string | null; selectedVodId: string | null; followed: string[] };
}

export interface LaunchContext extends QuickContext {
  media: LaunchMedia[];
  env: LaunchEnv;
}

export interface ContextSnapshot {
  todos: QuickTodo[];
  catalogue: Video[];
  custom: Video[];
  playlists: { id: string; playlistId: string; title: string; channelName?: string; thumbnailUrl?: string }[];
  localPlaylists: { id: string; name: string; tracks: { youtubeId: string; title: string; thumbnailUrl?: string }[] }[];
  /** Entrées d'historique, plus récente en premier. */
  history: (HistoryLite & { minutes: number })[];
  env: Omit<LaunchEnv, "history">;
}

// --- Contexte -----------------------------------------------------------------

const SPOTIFY_LOGIN = "Connecte Spotify d'abord (Écouter, Spotify).";

export const ytThumb = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

/** Construit le contexte d'analyse : tâches et médias avec des clés stables `kind:id`. */
export function buildContextFrom(s: ContextSnapshot): LaunchContext {
  const plays = new Map<string, number>();
  for (const e of s.history) plays.set(e.mediaKey, (plays.get(e.mediaKey) ?? 0) + 1);
  const covered = new Set<string>();
  const media: LaunchMedia[] = [];

  const catalogueIds = new Set(s.catalogue.map((v) => v.youtubeId));
  const pushVideo = (v: Video, kind: "catalogue" | "custom") => {
    covered.add(v.youtubeId);
    media.push({
      key: `${kind === "catalogue" ? "cat" : "vid"}:${v.id}`,
      title: v.title,
      subtitle: v.channel,
      kind,
      plays: plays.get(v.youtubeId),
      ref: { type: "video", id: v.id },
      thumbnailUrl: ytThumb(v.youtubeId),
      youtubeId: v.youtubeId,
      historyKey: v.youtubeId,
    });
  };
  s.catalogue.forEach((v) => pushVideo(v, "catalogue"));
  s.custom.filter((v) => !catalogueIds.has(v.youtubeId)).forEach((v) => pushVideo(v, "custom"));

  for (const p of s.playlists) {
    const hk = `pl:${p.playlistId}`;
    covered.add(hk);
    media.push({
      key: `pl:${p.id}`,
      title: p.title,
      subtitle: p.channelName ?? "Playlist YouTube",
      kind: "playlist",
      plays: plays.get(hk),
      ref: { type: "yt-playlist", id: p.id },
      thumbnailUrl: p.thumbnailUrl,
      historyKey: hk,
    });
  }

  for (const p of s.localPlaylists) {
    if (!p.tracks.length) continue;
    media.push({
      key: `loc:${p.id}`,
      title: p.name,
      subtitle: `${p.tracks.length} titre${p.tracks.length > 1 ? "s" : ""}`,
      kind: "local-playlist",
      ref: { type: "local", id: p.id },
      thumbnailUrl: p.tracks[0].thumbnailUrl ?? ytThumb(p.tracks[0].youtubeId),
    });
  }

  // Ce qui n'existe plus que dans l'historique (Spotify, Twitch, vidéo retirée…).
  const seen = new Set<string>();
  for (const e of s.history) {
    if (covered.has(e.mediaKey) || seen.has(e.mediaKey) || e.mediaKey === "queue") continue;
    const ref = historyRef(e);
    if (!ref) continue;
    seen.add(e.mediaKey);
    media.push({
      key: `his:${e.mediaKey}`,
      title: e.title,
      subtitle: e.subtitle,
      kind: "history",
      plays: plays.get(e.mediaKey),
      ref,
      thumbnailUrl: e.thumbnailUrl ?? (ref.type === "youtube" ? ytThumb(ref.youtubeId) : undefined),
      youtubeId: ref.type === "youtube" ? ref.youtubeId : undefined,
      historyKey: e.mediaKey,
    });
  }

  return {
    todos: s.todos,
    media,
    env: { ...s.env, history: s.history.map(({ mediaKey, type, title, subtitle, thumbnailUrl }) => ({ mediaKey, type, title, subtitle, thumbnailUrl })) },
  };
}

function historyRef(e: HistoryLite): MediaRef | null {
  switch (e.type) {
    case "youtube":
      return /^[a-zA-Z0-9_-]{11}$/.test(e.mediaKey) ? { type: "youtube", youtubeId: e.mediaKey, title: e.title, channel: e.subtitle } : null;
    case "playlist":
      return e.mediaKey.startsWith("pl:") ? { type: "yt-playlist-url", listId: e.mediaKey.slice(3), title: e.title } : null;
    case "spotify":
      return e.mediaKey.startsWith("spotify:") ? { type: "spotify", uri: e.mediaKey } : null;
    case "twitch-live":
      return e.mediaKey.startsWith("live:") ? { type: "twitch-channel", login: e.mediaKey.slice(5) } : null;
    case "twitch-vod":
      return e.mediaKey.startsWith("vod:") ? { type: "twitch-vod", id: e.mediaKey.slice(4) } : null;
  }
}

/** « trouvé dans ton historique (12 écoutes) », etc. */
export function provenanceOf(m: QuickMedia): string {
  if (m.plays && m.plays > 0) return `trouvé dans ton historique (${m.plays} écoute${m.plays > 1 ? "s" : ""})`;
  switch (m.kind) {
    case "catalogue": return "dans le catalogue";
    case "custom": return "dans ta bibliothèque";
    case "playlist": return "playlist YouTube de ta bibliothèque";
    case "local-playlist": return "playlist locale";
    case "history": return "dans ton historique";
  }
}

// --- Rythme -------------------------------------------------------------------

export const PRESET_LABEL: Record<TimerPreset, string> = { classic: "Classic", deep: "Deep", flowtime: "Flowtime", custom: "Perso" };

export interface TimerPlan {
  /** true : on garde le réglage courant tel quel. */
  keep: boolean;
  preset: TimerPreset;
  /** Pour `custom` uniquement. */
  settings?: Omit<TimerSettings, "preset">;
  label: string;
}

const breaksOf = (cur: TimerSettings): Omit<TimerSettings, "preset"> =>
  cur.preset === "custom"
    ? { workDuration: cur.workDuration, shortBreakDuration: cur.shortBreakDuration, longBreakDuration: cur.longBreakDuration, sessionsBeforeLongBreak: cur.sessionsBeforeLongBreak }
    : PRESETS[cur.preset === "flowtime" ? "classic" : cur.preset];

/**
 * Durée et preset demandés → réglage du minuteur. Une durée libre donne un
 * réglage personnalisé avec les pauses du preset demandé, sinon du preset courant.
 */
export function timerPlan(r: Pick<QuickLaunch, "minutes" | "preset">, cur: TimerSettings): TimerPlan {
  const { minutes, preset } = r;
  if (preset === "flowtime") return { keep: false, preset: "flowtime", label: "Flowtime" };
  if (preset === "classic" || preset === "deep") {
    if (minutes === undefined || minutes === PRESETS[preset].workDuration) {
      return { keep: false, preset, label: `${PRESETS[preset].workDuration} min, ${PRESET_LABEL[preset]}` };
    }
    return { keep: false, preset: "custom", settings: { ...PRESETS[preset], workDuration: minutes }, label: `${minutes} min, pauses ${PRESET_LABEL[preset]}` };
  }
  if (minutes !== undefined) {
    if (preset !== "custom" && (cur.preset === "classic" || cur.preset === "deep") && minutes === cur.workDuration) {
      return { keep: true, preset: cur.preset, label: `${minutes} min, ${PRESET_LABEL[cur.preset]}` };
    }
    return { keep: false, preset: "custom", settings: { ...breaksOf(cur), workDuration: minutes }, label: `${minutes} min` };
  }
  return {
    keep: true,
    preset: cur.preset,
    label: cur.preset === "flowtime" ? "Flowtime" : cur.preset === "custom" ? `${cur.workDuration} min` : `${cur.workDuration} min, ${PRESET_LABEL[cur.preset]}`,
  };
}

// --- Média ----------------------------------------------------------------------

export interface MediaPlan {
  /** null : la sélection actuelle est gardée. */
  ref: MediaRef | null;
  key?: string;
  title: string;
  subtitle?: string;
  provenance: string;
  thumbnailUrl?: string;
}

/** Lien Spotify/Twitch/YouTube → média, ou message si non pris en charge. */
export function mediaFromUrl(r: QuickLaunch, ctx: LaunchContext): MediaPlan | { error: string } {
  const url = r.url ?? "";
  if (r.source === "youtube") {
    if (r.youtubeId) {
      const known = ctx.media.find((m) => m.youtubeId === r.youtubeId && m.ref.type === "video");
      if (known) return { ref: known.ref, key: known.key, title: known.title, subtitle: known.subtitle, provenance: "lien collé, déjà dans ta bibliothèque", thumbnailUrl: known.thumbnailUrl };
      return { ref: { type: "youtube", youtubeId: r.youtubeId }, title: "Vidéo YouTube", provenance: "lien collé, ajoutée à ta bibliothèque", thumbnailUrl: ytThumb(r.youtubeId) };
    }
    const list = url.match(/[?&]list=([A-Za-z0-9_-]+)/)?.[1];
    if (list) {
      const known = ctx.media.find((m) => m.historyKey === `pl:${list}` && m.ref.type === "yt-playlist");
      if (known) return { ref: known.ref, key: known.key, title: known.title, subtitle: known.subtitle, provenance: "lien collé, déjà dans ta bibliothèque", thumbnailUrl: known.thumbnailUrl };
      return { ref: { type: "yt-playlist-url", listId: list }, title: "Playlist YouTube", provenance: "lien collé, ajoutée à ta bibliothèque" };
    }
    return { error: "Ce lien YouTube ne contient ni vidéo ni playlist." };
  }
  if (r.source === "spotify") {
    const m = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/) ?? url.match(/^spotify:([a-z]+):([A-Za-z0-9]+)/);
    if (!m) return { error: "Lien Spotify non reconnu." };
    if (m[1] !== "playlist" && m[1] !== "album") return { error: "Spotify : colle un lien de playlist ou d'album." };
    if (!ctx.env.spotify.connected) return { error: SPOTIFY_LOGIN };
    const uri = `spotify:${m[1]}:${m[2]}`;
    const pl = ctx.env.spotify.playlists.find((p) => p.uri === uri);
    return { ref: { type: "spotify", uri }, title: pl?.name ?? (m[1] === "album" ? "Album Spotify" : "Playlist Spotify"), subtitle: "Spotify", provenance: "lien collé", thumbnailUrl: pl?.imageUrl };
  }
  if (r.source === "twitch") {
    const vod = url.match(/twitch\.tv\/videos\/(\d+)/)?.[1];
    if (vod) return { ref: { type: "twitch-vod", id: vod }, title: `VOD ${vod}`, subtitle: "Twitch", provenance: "lien collé" };
    const login = url.match(/twitch\.tv\/([A-Za-z0-9_]{2,25})(?:[/?#]|$)/)?.[1];
    if (login && !["videos", "directory", "search", "settings"].includes(login.toLowerCase())) {
      return { ref: { type: "twitch-channel", login: login.toLowerCase() }, title: login, subtitle: "Live Twitch", provenance: "lien collé" };
    }
    return { error: "Lien Twitch non reconnu." };
  }
  return { error: "Lien non pris en charge." };
}

/**
 * Média connu → plan. Un média qui n'existe plus que dans l'historique doit
 * repasser par la bibliothèque (la session ne lit que ce qui y est) : on le dit.
 */
function mediaPlanOf(m: LaunchMedia, provenance = provenanceOf(m)): MediaPlan {
  const readded = m.ref.type === "youtube" || m.ref.type === "yt-playlist-url";
  return {
    ref: m.ref,
    key: m.key,
    title: m.title,
    subtitle: m.subtitle,
    provenance: readded ? `${provenance}, sera ajoutée à ta bibliothèque` : provenance,
    thumbnailUrl: m.thumbnailUrl,
  };
}

/** Source citée seule (« deep spotify ») : la sélection courante, sinon la dernière écoutée. */
function mediaFromSource(source: NonNullable<QuickLaunch["source"]>, ctx: LaunchContext): MediaPlan | { error: string } {
  const { env } = ctx;
  if (source === "spotify") {
    if (!env.spotify.connected) return { error: SPOTIFY_LOGIN };
    const uri = env.spotify.selectedUri ?? env.history.find((h) => h.type === "spotify")?.mediaKey ?? env.spotify.playlists[0]?.uri;
    if (!uri) return { error: "Aucune playlist Spotify trouvée." };
    const pl = env.spotify.playlists.find((p) => p.uri === uri);
    const his = env.history.find((h) => h.mediaKey === uri);
    return { ref: { type: "spotify", uri }, title: pl?.name ?? his?.title ?? "Playlist Spotify", subtitle: "Spotify", provenance: env.spotify.selectedUri === uri ? "ta sélection Spotify" : his ? "ta dernière écoute Spotify" : "tes playlists Spotify", thumbnailUrl: pl?.imageUrl ?? his?.thumbnailUrl };
  }
  if (source === "twitch") {
    if (env.twitch.selectedVodId) return { ref: { type: "twitch-vod", id: env.twitch.selectedVodId }, title: `VOD ${env.twitch.selectedVodId}`, subtitle: "Twitch", provenance: "ta sélection Twitch" };
    if (env.twitch.selectedChannel) return { ref: { type: "twitch-channel", login: env.twitch.selectedChannel }, title: env.twitch.selectedChannel, subtitle: "Live Twitch", provenance: "ta sélection Twitch" };
    const his = env.history.find((h) => h.type === "twitch-live" || h.type === "twitch-vod");
    const ref = his && historyRef(his);
    if (his && ref) return { ref, title: his.title, subtitle: his.subtitle, provenance: "ta dernière écoute Twitch", thumbnailUrl: his.thumbnailUrl };
    const login = env.twitch.followed[0];
    if (login) return { ref: { type: "twitch-channel", login }, title: login, subtitle: "Live Twitch", provenance: "chaîne suivie" };
    return { error: "Aucune chaîne Twitch : colle un lien twitch.tv." };
  }
  return { ref: { type: "current-youtube" }, title: "Sélection YouTube actuelle", provenance: "YouTube" };
}

// --- Plan complet ---------------------------------------------------------------

export interface LaunchPlan {
  intent?: QuickLaunch["intent"];
  timer: TimerPlan;
  /** La durée ou le preset viennent de la phrase. */
  timerExplicit: boolean;
  todo: QuickTodo | null;
  /** Non vide : plusieurs tâches correspondent, à faire choisir. */
  todoChoices: QuickTodo[];
  /** null : choix en attente ou erreur. */
  media: MediaPlan | null;
  /** Non vide : plusieurs médias correspondent, à faire choisir. */
  mediaChoices: LaunchMedia[];
  error?: string;
  /** Rien d'ambigu, aucune erreur : la session peut partir. */
  launchable: boolean;
}

export function resolveLaunch(r: QuickLaunch, ctx: LaunchContext): LaunchPlan {
  const timer = timerPlan(r, ctx.env.timer);
  const timerExplicit = r.minutes !== undefined || !!r.preset;
  const todoChoices = (r.todoAlternatives ?? []).map((id) => ctx.todos.find((t) => t.id === id)).filter(Boolean) as QuickTodo[];
  const todo = r.todoId ? ctx.todos.find((t) => t.id === r.todoId) ?? null : null;
  const mediaChoices = (r.mediaAlternatives ?? []).map((k) => ctx.media.find((m) => m.key === k)).filter(Boolean) as LaunchMedia[];
  const base = { intent: r.intent, timer, timerExplicit, todo, todoChoices, mediaChoices };

  if (r.intent === "resume-session") {
    const error = ctx.env.sessionActive ? undefined : "Aucune session en cours.";
    return { ...base, media: null, error, launchable: !error };
  }

  let media: MediaPlan | null = null;
  let error: string | undefined;
  if (r.url) {
    const m = mediaFromUrl(r, ctx);
    if ("error" in m) error = m.error;
    else media = m;
  } else if (mediaChoices.length) {
    media = null;
  } else if (r.mediaKey) {
    const m = ctx.media.find((x) => x.key === r.mediaKey);
    if (m) media = mediaPlanOf(m);
  } else if (r.intent === "relaunch-last") {
    const last = ctx.env.history.map((h) => ctx.media.find((m) => m.historyKey === h.mediaKey)).find(Boolean);
    if (last) media = mediaPlanOf(last, "ta dernière session");
    else error = "Pas encore d'historique de lecture.";
  } else if (r.source) {
    const m = mediaFromSource(r.source, ctx);
    if ("error" in m) error = m.error;
    else media = m;
  }
  // Sans connexion, la session retomberait sur une vidéo sans rapport.
  if (media?.ref?.type === "spotify" && !ctx.env.spotify.connected) {
    media = null;
    error = SPOTIFY_LOGIN;
  }
  if (!media && !error && !mediaChoices.length) {
    media = { ref: null, title: ctx.env.currentMediaTitle ?? "Sélection actuelle", provenance: "sélection actuelle" };
  }

  const launchable = !!r.intent && !error && !todoChoices.length && !mediaChoices.length;
  return { ...base, media, error, launchable };
}

// --- Corrections de l'utilisateur (palette) --------------------------------------

/** Corrections faites sur les pastilles (undefined : rien de touché). */
export interface Overrides {
  duration?: { minutes?: number; preset?: QuickLaunch["preset"] } | "current";
  todo?: string | null;
  media?: string | null;
}

export function applyOverrides(r: QuickLaunch, o: Overrides): QuickLaunch {
  const e: QuickLaunch = { ...r };
  const touched = o.duration !== undefined || o.todo !== undefined || o.media !== undefined;
  if (o.duration === "current") { e.minutes = undefined; e.preset = undefined; }
  else if (o.duration) { e.minutes = o.duration.minutes; e.preset = o.duration.preset; }
  if (o.todo !== undefined) { e.todoId = o.todo ?? undefined; e.todoAlternatives = undefined; }
  if (o.media !== undefined) {
    e.mediaKey = o.media ?? undefined;
    e.mediaAlternatives = undefined;
    e.url = undefined;
    e.youtubeId = undefined;
    e.source = undefined;
    if (e.intent === "relaunch-last") e.intent = "launch";
  }
  if (touched && (!e.intent || e.intent === "resume-session")) e.intent = "launch";
  return e;
}

/**
 * Entrée peut lancer : analyse assez sûre, ou choix explicite du média (et de
 * la tâche si elle était ambiguë). Changer seulement la durée ne confirme pas
 * un média trouvé à l'aveugle.
 */
export function isConfirmed(parsed: QuickLaunch, o: Overrides): boolean {
  if (parsed.confidence >= 0.6) return true;
  const todoOk = !parsed.todoAlternatives?.length || o.todo !== undefined;
  return o.media !== undefined && todoOk;
}
