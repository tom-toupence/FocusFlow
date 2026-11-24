"use client";
// FocusFlow dans le système (lot 1) : pendant la session, le temps restant et le
// titre en cours sortent de la page.
//   . titre d'onglet « 18:42 · Focus », mis à jour chaque seconde ;
//   . Media Session API : écran verrouillé, contrôles média de l'OS, touches
//     média du clavier. Lecture/pause = minuteur ET musique (même action que le
//     bouton Pause de la session) ; suivant/précédent = titre suivant/précédent.
// Tout est calculé depuis l'échéance du minuteur (timerStore.endsAt), donc juste
// même quand l'onglet est caché et que les intervalles sont bridés.
import { useEffect, useRef } from "react";
import { useTimerStore, type TimerMode, type TimerSettings } from "@/store/timerStore";
import { remainingSeconds, elapsedSeconds, formatClock } from "@/lib/timerClock";
import type { PlayerAdapter, PlaybackState, SourceKind } from "@/lib/playback/types";

/**
 * Contournement « audio silencieux » (voir `useSilentAudio`). Mettre à false
 * pour le couper : il ne reste alors que le titre d'onglet et des métadonnées
 * que le navigateur peut ignorer quand le son vient d'un iframe.
 */
export const SILENT_AUDIO_WORKAROUND = true;

/** Rafraîchissement des métadonnées de l'OS (pas chaque seconde : on ménage l'OS). */
const METADATA_REFRESH_MS = 15_000;

const SOURCE_LABEL: Record<SourceKind, string> = { youtube: "YouTube", spotify: "Spotify", twitch: "Twitch" };

interface ClockView {
  mode: TimerMode;
  running: boolean;
  /** Flowtime en cours de travail : chrono croissant, pas de durée fixe. */
  flow: boolean;
  /** Secondes affichées : restantes (cycle) ou écoulées (flow). */
  seconds: number;
  /** Durée totale du cycle (0 en flow). */
  total: number;
}

function cycleTotal(mode: TimerMode, settings: TimerSettings, flowBreakTotal: number): number {
  if (mode === "work") return settings.workDuration * 60;
  if (settings.preset === "flowtime") return flowBreakTotal || settings.shortBreakDuration * 60;
  return (mode === "short-break" ? settings.shortBreakDuration : settings.longBreakDuration) * 60;
}

/** Lecture de l'horloge à l'instant `now`, directement depuis les échéances. */
function readClock(now: number): ClockView {
  const s = useTimerStore.getState();
  const flow = s.settings.preset === "flowtime" && s.mode === "work";
  if (flow) {
    const seconds = s.isRunning && s.flowStartedAt != null ? elapsedSeconds(s.flowStartedAt, now) : s.flowSeconds;
    return { mode: s.mode, running: s.isRunning, flow, seconds, total: 0 };
  }
  const seconds = s.isRunning && s.endsAt != null ? remainingSeconds(s.endsAt, now) : s.secondsLeft;
  return { mode: s.mode, running: s.isRunning, flow, seconds, total: cycleTotal(s.mode, s.settings, s.flowBreakTotal) };
}

/** « 18:42 · Focus », « 04:12 · Pause », « Flow 32:10 », « En pause · 18:42 ». */
export function tabTitle(c: ClockView): string {
  const t = formatClock(c.seconds);
  if (!c.running) return `En pause · ${t}`;
  if (c.flow) return `Flow ${t}`;
  return c.mode === "work" ? `${t} · Focus` : `${t} · Pause`;
}

/** Titre affiché par l'OS : « Focus · 18:42 restantes », « Pause · 04:12 », « Flow · 32:10 ». */
export function mediaTitle(c: ClockView): string {
  const t = formatClock(c.seconds);
  if (c.flow) return c.running ? `Flow · ${t}` : `Flow en pause · ${t}`;
  if (c.mode !== "work") return c.running ? `Pause · ${t}` : `Pause arrêtée · ${t}`;
  return c.running ? `Focus · ${t} restantes` : `Focus en pause · ${t} restantes`;
}

const YT_ID = /^[\w-]{11}$/;

/** Miniatures en plusieurs tailles (YouTube : i.ytimg.com, sinon l'artwork fourni). */
function artworkFor(track: PlaybackState["track"], kind: SourceKind): MediaImage[] {
  if (!track) return [];
  if ((track.source ?? kind) === "youtube" && YT_ID.test(track.id)) {
    const base = `https://i.ytimg.com/vi/${track.id}`;
    return [
      { src: `${base}/default.jpg`, sizes: "120x90", type: "image/jpeg" },
      { src: `${base}/mqdefault.jpg`, sizes: "320x180", type: "image/jpeg" },
      { src: `${base}/hqdefault.jpg`, sizes: "480x360", type: "image/jpeg" },
      { src: `${base}/sddefault.jpg`, sizes: "640x480", type: "image/jpeg" },
    ];
  }
  return track.artwork ? [{ src: track.artwork }] : [];
}

// ─── Contournement : un <audio> silencieux pour posséder la session média ─────
//
// Le son vient d'un iframe YouTube d'un autre domaine (ou du SDK Spotify, lui
// aussi dans un iframe). Le navigateur attribue alors la session média à cet
// iframe et ignore les métadonnées et les handlers posés par la page. Le
// contournement standard : la page joue elle-même, en boucle, un média
// silencieux. Elle a alors un lecteur actif et le navigateur lui route la
// session média (Chrome privilégie la frame principale quand elle joue).
//   . le son est fait d'échantillons nuls (vraiment silencieux, iOS ignorant
//     `volume`) ; volume 0.01 et surtout PAS `muted` : un média muet n'obtient
//     pas la session ;
//   . il dure 10 s : Chrome ignore les médias de moins de 5 s pour les
//     contrôles média. Généré en mémoire (WAV 8 kHz 8 bits, ~80 Ko, Blob URL)
//     plutôt qu'écrit en dur : un data URI de quelques centaines d'octets
//     durerait bien moins de 5 s ;
//   . il joue tant que la session est active, minuteur en pause compris : le
//     bouton « Reprendre » de l'écran verrouillé reste ainsi disponible (le
//     bouton affiché suit `playbackState`, posé explicitement) ;
//   . `play()` exige un geste utilisateur : on tente au démarrage (la session
//     est lancée par un clic, l'activation est encore là après la navigation
//     côté client), puis, en cas de refus (rechargement de /session), au
//     prochain clic ou à la prochaine touche.
// Il ne touche jamais à l'adaptateur : la musique (lecture, pause pendant la
// halte) reste pilotée par la page comme avant.

function silentWavUrl(seconds = 10, rate = 8000): string {
  const n = seconds * rate;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, "data"); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128); // PCM 8 bits non signé : 128 = silence
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

function useSilentAudio(shouldPlay: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wantRef = useRef(shouldPlay);
  const tryPlayRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!SILENT_AUDIO_WORKAROUND || typeof Audio === "undefined") return;
    const url = silentWavUrl();
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.01;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");
    audio.dataset.focusflowSilent = "";
    audioRef.current = audio;

    // Refus de lecture (pas encore de geste) : nouvel essai au prochain geste,
    // écouteurs retirés dès que la lecture a réussi.
    const onGesture = () => tryPlay();
    const listenGestures = (on: boolean) => {
      for (const type of ["pointerdown", "keydown"] as const) {
        if (on) window.addEventListener(type, onGesture, true);
        else window.removeEventListener(type, onGesture, true);
      }
    };
    const tryPlay = () => {
      if (!wantRef.current || !audio.paused) return;
      audio.play().then(() => listenGestures(false), () => listenGestures(true));
    };
    tryPlayRef.current = tryPlay;
    // Mis en pause par le système (autre média, coupure audio) alors qu'on le
    // veut encore : relance si l'onglet est visible, sinon au retour sur l'onglet.
    const onPaused = () => { if (wantRef.current && document.visibilityState === "visible") tryPlay(); };
    const onVisible = () => { if (document.visibilityState === "visible") tryPlay(); };
    audio.addEventListener("pause", onPaused);
    document.addEventListener("visibilitychange", onVisible);
    tryPlay();
    return () => {
      wantRef.current = false;
      tryPlayRef.current = () => {};
      listenGestures(false);
      audio.removeEventListener("pause", onPaused);
      document.removeEventListener("visibilitychange", onVisible);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    wantRef.current = shouldPlay;
    if (shouldPlay) tryPlayRef.current();
    else audioRef.current?.pause();
  }, [shouldPlay]);
}

/**
 * Titre suivant / précédent sans réveiller la musique : si le minuteur est en
 * pause ou en halte, le titre change mais le son reste coupé.
 */
export function skipTrack(adapter: PlayerAdapter | null, dir: "next" | "prev") {
  if (!adapter) return;
  if (dir === "next") adapter.next(); else adapter.previous();
  const s = useTimerStore.getState();
  if (!s.isRunning || s.mode !== "work") adapter.pause();
}

// ─── Le hook ──────────────────────────────────────────────────────────────────

export interface MediaSessionOptions {
  adapter: PlayerAdapter | null;
  pb: PlaybackState;
  /** Reprendre : même action que le bouton « Reprendre » de la session. */
  onPlay: () => void;
  /** Mettre en pause : même action que le bouton « Pause » de la session. */
  onPause: () => void;
}

export function useMediaSession({ adapter, pb, onPlay, onPause }: MediaSessionOptions) {
  const isRunning = useTimerStore((s) => s.isRunning);
  const mode = useTimerStore((s) => s.mode);
  const endsAt = useTimerStore((s) => s.endsAt);
  const flowStartedAt = useTimerStore((s) => s.flowStartedAt);
  const hydrated = useTimerStore((s) => s.hydrated);
  const active = useTimerStore((s) => s.active);

  useSilentAudio(hydrated && active);

  // Derniers callbacks et état de lecture, lus par les handlers (posés une fois).
  const latest = useRef({ adapter, pb, onPlay, onPause });
  useEffect(() => { latest.current = { adapter, pb, onPlay, onPause }; });

  // ── Titre d'onglet : restauré au démontage ─────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    const original = document.title;
    return () => { document.title = original; };
  }, [hydrated]);
  // À chaque changement d'état (pause, cycle suivant), puis chaque seconde tant
  // que le minuteur tourne (à l'arrêt, le titre ne bouge pas).
  useEffect(() => {
    if (!hydrated) return;
    const update = () => { document.title = tabTitle(readClock(Date.now())); };
    update();
    if (!isRunning) return;
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [hydrated, isRunning, mode, endsAt, flowStartedAt]);

  // ── Handlers : posés une fois le minuteur relu, nettoyés au démontage ───────
  const canSkip = pb.caps.skip;
  useEffect(() => {
    if (!hydrated || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch { /* action inconnue de ce navigateur */ }
    };
    set("play", () => latest.current.onPlay());
    set("pause", () => latest.current.onPause());
    set("stop", null);
    set("seekbackward", null);
    set("seekforward", null);
    set("seekto", null);
    // Minuteur en pause ou halte : le titre change, la musique reste coupée.
    set("nexttrack", canSkip ? () => skipTrack(latest.current.adapter, "next") : null);
    set("previoustrack", canSkip ? () => skipTrack(latest.current.adapter, "prev") : null);
    return () => {
      for (const a of ["play", "pause", "stop", "seekbackward", "seekforward", "seekto", "nexttrack", "previoustrack"] as MediaSessionAction[]) set(a, null);
    };
  }, [hydrated, canSkip]);

  // ── Métadonnées, état et position : toutes les 15 s, et à chaque changement ─
  const trackId = pb.track?.id ?? "";
  const trackTitle = pb.track?.title ?? "";
  useEffect(() => {
    if (!hydrated || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const push = () => {
      const c = readClock(Date.now());
      const { pb: cur } = latest.current;
      const source = SOURCE_LABEL[cur.track?.source ?? cur.kind];
      const artist = cur.track ? [cur.track.title, source].filter(Boolean).join(" · ") : source;
      try {
        ms.metadata = new MediaMetadata({
          title: mediaTitle(c),
          artist,
          album: "FocusFlow",
          artwork: artworkFor(cur.track, cur.kind),
        });
      } catch { /* MediaMetadata absent ou artwork refusée */ }
      try { ms.playbackState = c.running ? "playing" : "paused"; } catch { /* ignoré */ }
      // La barre de progression montre le pomodoro, pas la piste.
      try {
        if (!c.flow && c.total > 0 && "setPositionState" in ms) {
          const position = Math.min(c.total, Math.max(0, c.total - c.seconds));
          ms.setPositionState({ duration: c.total, position, playbackRate: 1 });
        } else if ("setPositionState" in ms) {
          ms.setPositionState();
        }
      } catch { /* position incohérente ou non gérée */ }
    };
    push();
    // À l'arrêt, rien ne bouge : l'effet ne repasse qu'au prochain changement.
    if (!isRunning) return;
    const id = setInterval(push, METADATA_REFRESH_MS);
    return () => clearInterval(id);
  }, [hydrated, isRunning, mode, endsAt, flowStartedAt, trackId, trackTitle, pb.kind]);

  // Démontage : plus de métadonnées FocusFlow dans l'OS.
  useEffect(() => () => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.setPositionState?.();
    } catch { /* ignoré */ }
  }, []);
}
