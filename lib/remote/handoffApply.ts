"use client";
// Côté téléphone : hydrate les stores à partir de l'état reçu de l'ordinateur
// (« Emporter la session », lot 7), puis /session reprend la session telle
// quelle (session active : pas de départ neuf). La seconde de la piste est
// gardée pour l'écran « Toucher pour reprendre » (l'autoplay est bloqué sur iOS).
import { useTimerStore } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { useQueueStore } from "@/store/queueStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { useSessionSummaryStore } from "@/store/sessionSummaryStore";
import { useDistractionStore } from "@/store/distractionStore";
import { localToday } from "@/store/statsStore";
import { defaultVideos } from "@/data/videos";
import { closeActiveSession } from "@/lib/sessionEnd";
import { isSameSession, mergeTodos, phoneTimerPatch } from "./handoff";
import type { HandoffMedia, HandoffState } from "./protocol";

const RESUME_KEY = "focusflow-handoff-resume";
/** Session reprise sans compte : /session et /summary passent l'AuthGate dans cet onglet. */
export const GUEST_KEY = "focusflow-handoff-guest";

export interface PendingResume {
  /** Piste à caler (id YouTube), null : rien à caler (radio, Spotify, Twitch). */
  trackId: string | null;
  position: number;
  playing: boolean;
  /** Instant de la mesure, horloge du téléphone. */
  measuredAt: number;
}

export function readPendingResume(): PendingResume | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingResume;
    // Une reprise de plus de 10 min n'a plus de sens (onglet rouvert plus tard).
    if (typeof p?.measuredAt !== "number" || Date.now() - p.measuredAt > 10 * 60_000) return null;
    return p;
  } catch { return null; }
}

export function clearPendingResume() {
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* stockage bloqué */ }
}

export function isHandoffGuest(): boolean {
  try { return sessionStorage.getItem(GUEST_KEY) === "1"; } catch { return false; }
}

/**
 * Sélectionne le média reçu sur ce téléphone. Rend un message à afficher quand
 * la reprise n'est que partielle (Spotify, VOD, playlist non résolue).
 */
function applyMedia(m: HandoffMedia): string | null {
  const session = useSessionStore.getState();
  const spotify = useSpotifyStore.getState();
  const twitch = useTwitchStore.getState();
  const toCatalogue = () => { session.selectVideo(defaultVideos[0].id); };
  // Spotify et Twitch passent avant YouTube dans useSessionMedia : on les coupe.
  if (m.kind !== "spotify") spotify.selectPlaylist(null);
  if (m.kind !== "twitch") twitch.selectChannel(null);

  switch (m.kind) {
    case "video": {
      const cat = defaultVideos.find((v) => v.youtubeId === m.id);
      if (cat) { session.selectVideo(cat.id); return null; }
      // Vidéo hors catalogue : jouée comme une file d'un titre (la File d'attente est remplacée).
      useQueueStore.setState({ items: [{ id: crypto.randomUUID(), youtubeId: m.id, title: m.title }] });
      session.selectQueue();
      return null;
    }
    case "queue":
      useQueueStore.setState({ items: m.tracks.map((t) => ({ id: crypto.randomUUID(), youtubeId: t.id, title: t.title })) });
      session.selectQueue();
      return null;
    case "radio":
      session.selectRadio();
      return null;
    case "spotify":
      if (spotify.accessToken) {
        spotify.selectPlaylist(m.uri);
        return "Spotify reprend ta playlist ici. Il faut le même compte Premium sur ce téléphone.";
      }
      toCatalogue();
      return "Spotify n'est pas connecté sur ce téléphone. La session continue avec une vidéo du catalogue.";
    case "twitch":
      if (m.vodId) { twitch.selectVod(m.vodId); return "La VOD Twitch reprend au début."; }
      twitch.selectChannel(m.channel);
      return null;
    case "native":
      toCatalogue();
      return "Cette playlist YouTube n'a pas pu suivre. La session continue avec une vidéo du catalogue.";
    case "none":
      return null;
  }
}

/**
 * Hydrate le téléphone. `offsetMs` = horloge du téléphone − horloge de
 * l'ordinateur (estimé à la réception). Rend le message de reprise partielle.
 */
export function applyHandoff(h: HandoffState, offsetMs: number, sentAtHost: number): string | null {
  const now = Date.now();
  const timer = useTimerStore.getState();
  // Une session en cours ici est close et créditée d'abord, sauf si c'est la
  // même (même navigateur) : elle serait comptée deux fois.
  if (!isSameSession(timer, h, offsetMs)) closeActiveSession();

  const patch = phoneTimerPatch(h, offsetMs, now);
  useTimerStore.setState({
    ...patch,
    videoSync: null, videoSyncView: null, videoSyncActive: null,
    agendaNotice: null, agendaMeeting: null, agendaIgnored: [], agendaCycleIgnored: [],
  });

  const session = useSessionStore.getState();
  useSessionStore.setState({ todos: mergeTodos(session.todos, h.todos, localToday()) });
  const doneIds = useSessionStore.getState().todos.filter((t) => t.status === "done").map((t) => t.id);
  useSessionSummaryStore.getState().startSession(h.timer.settings.workDuration, doneIds);
  useDistractionStore.getState().resetSession();

  const notice = applyMedia(h.media);
  const m = h.media;
  const resume: PendingResume = m.kind === "video"
    ? { trackId: m.id, position: m.position, playing: m.playing, measuredAt: sentAtHost + offsetMs }
    : m.kind === "queue"
      ? { trackId: m.tracks[m.index].id, position: m.position, playing: m.playing, measuredAt: sentAtHost + offsetMs }
      : { trackId: null, position: 0, playing: false, measuredAt: now };
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify(resume));
    sessionStorage.setItem(GUEST_KEY, "1");
  } catch { /* stockage bloqué : pas d'écran de reprise, la session joue quand même */ }
  return notice;
}
