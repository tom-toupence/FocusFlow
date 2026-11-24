"use client";
// Côté ordinateur (/session) : télécommande et « Emporter la session » (lot 7).
// Monté en une ligne par la page de session, qui lui passe ses propres actions
// (Pause/Reprendre, Distraction, fin de session) : le téléphone déclenche
// exactement les mêmes chemins que les boutons, la touche D et la Media Session.
//
// Cycle de vie du canal :
//   . ouverture du panneau sans téléphone connecté : nouveau code, nouveau canal ;
//   . fermer le panneau ne coupe rien ; « Déconnecter » ferme le canal ;
//   . le code expire au bout de 2 h ; quitter /session ferme le canal.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTimerStore } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { useDistractionStore } from "@/store/distractionStore";
import { skipTrack } from "@/lib/useMediaSession";
import type { PlaybackState, PlayerAdapter } from "@/lib/playback/types";
import type { SessionMedia } from "@/lib/playback/useSessionMedia";
import { openTransport, transportKind, type RemoteTransport } from "./transport";
import { buildHandoffState, resumePosition, type MediaSnapshot } from "./handoff";
import { readPendingResume, clearPendingResume, type PendingResume } from "./handoffApply";
import {
  clip, CODE_TTL_MS, generateCode, HANDOFF_ACK_TIMEOUT_MS, isExpired, isPhoneConnected, makeMessage, ReplayGuard, STATE_INTERVAL_MS,
  type ByeReason, type RemoteMessageBody, type RemoteState,
} from "./protocol";

export interface RemoteHostOptions {
  adapter: PlayerAdapter | null;
  pb: PlaybackState;
  media: SessionMedia;
  /** Reprendre : même action que le bouton « Reprendre ». */
  onPlay: () => void;
  /** Pause : même action que le bouton « Pause ». */
  onPause: () => void;
  /** Distraction : même chemin que la touche D. */
  onDistraction: () => void;
  /**
   * Accusé de réception du téléphone : crédite le partiel et arrête la session
   * (même chemin que « Terminer »). `leftSeconds` = restant au moment de l'envoi
   * (null hors travail ou en Flowtime).
   */
  onHandedOff: (leftSeconds: number | null) => void;
}

export type RemoteTab = "remote" | "handoff";

export interface RemoteHost {
  /** Un transport existe ici (Supabase configuré, ou dev / lab). */
  available: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  tab: RemoteTab;
  setTab: (tab: RemoteTab) => void;
  code: string | null;
  expiresAt: number | null;
  connected: boolean;
  /** Un téléphone a demandé la session, en attente de son accusé. */
  handingOff: boolean;
  remoteUrl: string | null;
  handoffUrl: string | null;
  disconnect: () => void;
  /** Téléphone qui vient de reprendre une session : « Toucher pour reprendre ». */
  gate: { visible: boolean; ready: boolean; resume: () => void } | null;
}

interface Pending { id: string; at: number; mode: string; secondsLeft: number }

/** État diffusé au téléphone. */
function remoteState(pb: PlaybackState, expiresAt: number, now: number): RemoteState {
  const s = useTimerStore.getState();
  const flow = s.settings.preset === "flowtime" && s.mode === "work";
  const running = s.isRunning && !s.stopReached;
  const seconds = flow
    ? (s.isRunning && s.flowStartedAt != null ? Math.max(0, Math.floor((now - s.flowStartedAt) / 1000)) : s.flowSeconds)
    : (s.isRunning && s.endsAt != null ? Math.max(0, Math.ceil((s.endsAt - now) / 1000)) : s.secondsLeft);
  return {
    mode: s.mode,
    running,
    flow,
    // Calé sur la vidéo : pas d'échéance dans le store, on en pose une virtuelle (recalée toutes les 5 s).
    endsAt: running && !flow ? (s.endsAt ?? now + s.secondsLeft * 1000) : null,
    flowStartedAt: running && flow ? (s.flowStartedAt ?? now - s.flowSeconds * 1000) : null,
    seconds: Math.min(seconds, 86_400),
    total: flow ? 0 : Math.min(Math.max(0, Math.round(s.cycleSeconds)), 86_400),
    pomodoro: Math.min(s.sessionsCompleted + 1, 10_000),
    title: pb.track?.title ? clip(pb.track.title) : null,
    sub: pb.track?.subtitle ? clip(pb.track.subtitle) : null,
    caps: { skip: pb.caps.skip },
    distractions: Math.min(useDistractionStore.getState().sessionCount, 100_000),
    expiresAt,
  };
}

function mediaSnapshot(media: SessionMedia, adapter: PlayerAdapter | null, pb: PlaybackState): MediaSnapshot {
  return {
    kind: media.kind,
    youtube: media.youtube,
    spotifyUri: media.spotify?.playlistUri ?? null,
    twitch: media.twitch ? { channel: media.twitch.channel, vodId: media.twitch.vodId } : null,
    trackId: pb.track?.id ?? null,
    position: adapter?.getCurrentTime?.() ?? null,
    playing: pb.playing,
  };
}

export function useRemoteHost(opts: RemoteHostOptions): RemoteHost {
  const latest = useRef(opts);
  useEffect(() => { latest.current = opts; });

  const [available, setAvailable] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setAvailable(transportKind() != null), []);

  const [open, setOpenState] = useState(false);
  const [tab, setTab] = useState<RemoteTab>("remote");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const [now, setNow] = useState(0);
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(window.location.origin), []);

  const transportRef = useRef<RemoteTransport | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const expiresRef = useRef<number>(0);
  const guardRef = useRef(new ReplayGuard());
  const pendingRef = useRef<Pending | null>(null);
  const handedOffRef = useRef(false);
  const lastSeenRef = useRef<number | null>(null);

  const send = useCallback((body: RemoteMessageBody) => transportRef.current?.send(makeMessage(body)) ?? Promise.resolve(), []);

  const sendState = useCallback(() => {
    if (!transportRef.current) return;
    void send({ type: "state", s: remoteState(latest.current.pb, expiresRef.current, Date.now()) });
  }, [send]);

  const closeChannel = useCallback((reason: ByeReason) => {
    const t = transportRef.current;
    if (!t) return;
    transportRef.current = null;
    unsubRef.current?.();
    unsubRef.current = null;
    pendingRef.current = null;
    lastSeenRef.current = null;
    // Le « bye » part avant la fermeture (Supabase : envoi asynchrone).
    void t.send(makeMessage({ type: "bye", reason })).finally(() => t.close());
  }, []);

  const finishHandoff = useCallback((p: Pending) => {
    handedOffRef.current = true;
    closeChannel("handed-off");
    setCode(null);
    setHandingOff(false);
    setOpenState(false);
    latest.current.onHandedOff(p.mode === "work" && useTimerStore.getState().settings.preset !== "flowtime" ? p.secondsLeft : null);
  }, [closeChannel]);

  const onHandoffHello = useCallback((id: string) => {
    const nowMs = Date.now();
    const p = pendingRef.current;
    // Un seul téléphone par code : un autre est refusé tant que le premier n'a pas abandonné.
    if (handedOffRef.current || (p && p.id !== id && nowMs - p.at < HANDOFF_ACK_TIMEOUT_MS)) {
      void send({ type: "refused", id });
      return;
    }
    const { adapter, pb, media } = latest.current;
    const st = useTimerStore.getState();
    const state = buildHandoffState(
      {
        settings: st.settings, mode: st.mode, isRunning: st.isRunning && !st.stopReached, endsAt: st.endsAt,
        secondsLeft: st.secondsLeft, cycleSeconds: st.cycleSeconds, sessionsCompleted: st.sessionsCompleted,
        stopAt: st.stopAt, flowBreakTotal: st.flowBreakTotal,
      },
      useSessionStore.getState().todos,
      mediaSnapshot(media, adapter, pb),
      nowMs,
    );
    pendingRef.current = { id, at: nowMs, mode: st.mode, secondsLeft: state.timer.secondsLeft };
    setHandingOff(true);
    void send({ type: "handoff", id, state });
  }, [send]);

  const onMessage = useCallback((raw: unknown) => {
    const m = guardRef.current.accept(raw);
    if (!m || !transportRef.current) return;
    const nowMs = Date.now();
    if (isExpired(expiresRef.current, nowMs)) return;
    const { pb, adapter } = latest.current;
    switch (m.type) {
      case "hello":
        lastSeenRef.current = nowMs;
        setLastSeen(nowMs);
        setNow(nowMs);
        if (m.role === "handoff") onHandoffHello(m.id);
        else sendState();
        return;
      case "cmd":
        lastSeenRef.current = nowMs;
        setLastSeen(nowMs);
        setNow(nowMs);
        if (m.cmd === "pause") latest.current.onPause();
        else if (m.cmd === "resume") latest.current.onPlay();
        else if (m.cmd === "distraction") latest.current.onDistraction();
        else if (m.cmd === "next" && pb.caps.skip) skipTrack(adapter, "next");
        // L'état suit dans l'effet de diffusion ; on le pousse aussi tout de suite.
        setTimeout(sendState, 50);
        return;
      case "ack": {
        const p = pendingRef.current;
        if (p && p.id === m.id && !handedOffRef.current) finishHandoff(p);
        return;
      }
      default:
        return; // state/handoff/refused/bye viennent d'un ordinateur : pas pour nous
    }
  }, [finishHandoff, onHandoffHello, sendState]);

  const startChannel = useCallback(() => {
    closeChannel("disconnected");
    const c = generateCode();
    const t = openTransport(c);
    if (!t) return;
    transportRef.current = t;
    guardRef.current = new ReplayGuard();
    handedOffRef.current = false;
    expiresRef.current = Date.now() + CODE_TTL_MS;
    unsubRef.current = t.onMessage(onMessage);
    setCode(c);
    setExpiresAt(expiresRef.current);
    setLastSeen(null);
    setHandingOff(false);
  }, [closeChannel, onMessage]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) return;
    setNow(Date.now());
    // Code régénéré à chaque ouverture, sauf si un téléphone est là (ou reprend la session).
    const live = transportRef.current && (isPhoneConnected(lastSeenRef.current, Date.now()) || pendingRef.current);
    if (!live) startChannel();
  }, [startChannel]);

  const disconnect = useCallback(() => {
    closeChannel("disconnected");
    setCode(null);
    setExpiresAt(null);
    setLastSeen(null);
    setHandingOff(false);
  }, [closeChannel]);

  // Battement : état toutes les 5 s, expiration du code, accusé qui n'arrive pas.
  useEffect(() => {
    if (!code) return;
    const beat = () => {
      const nowMs = Date.now();
      setNow(nowMs);
      if (isExpired(expiresRef.current, nowMs)) {
        closeChannel("expired");
        setCode(null);
        setExpiresAt(null);
        setLastSeen(null);
        return;
      }
      const p = pendingRef.current;
      if (p && nowMs - p.at > HANDOFF_ACK_TIMEOUT_MS) {
        // Pas d'accusé : l'ordinateur continue, comme si de rien n'était.
        pendingRef.current = null;
        setHandingOff(false);
      }
      sendState();
    };
    beat();
    const id = setInterval(beat, STATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [code, closeChannel, sendState]);

  // Diffusion à chaque changement visible sur le téléphone.
  const mode = useTimerStore((s) => s.mode);
  const isRunning = useTimerStore((s) => s.isRunning);
  const endsAt = useTimerStore((s) => s.endsAt);
  const flowStartedAt = useTimerStore((s) => s.flowStartedAt);
  const sessionsCompleted = useTimerStore((s) => s.sessionsCompleted);
  const stopReached = useTimerStore((s) => s.stopReached);
  const frozen = useTimerStore((s) => (s.isRunning ? null : s.secondsLeft));
  const distractions = useDistractionStore((s) => s.sessionCount);
  const title = opts.pb.track?.title ?? null;
  const canSkip = opts.pb.caps.skip;
  useEffect(() => {
    if (code) sendState();
  }, [code, sendState, mode, isRunning, endsAt, flowStartedAt, sessionsCompleted, stopReached, frozen, distractions, title, canSkip]);

  // Sortie de /session : le téléphone est prévenu, le canal fermé.
  useEffect(() => () => closeChannel("ended"), [closeChannel]);

  // ── Téléphone qui reprend une session : « Toucher pour reprendre » ─────────
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPendingResume(readPendingResume()), []);
  const resume = useCallback(() => {
    const p = pendingResume;
    clearPendingResume();
    setPendingResume(null);
    if (!p) return;
    const { adapter, pb } = latest.current;
    if (!adapter) return;
    // La seconde est recalculée au moment du toucher.
    if (p.trackId && pb.track?.id === p.trackId && pb.caps.seek) adapter.seek(resumePosition(p.position, p.playing, p.measuredAt, Date.now()));
    const st = useTimerStore.getState();
    if (st.isRunning && st.mode === "work") adapter.play();
  }, [pendingResume]);

  const connected = code != null && isPhoneConnected(lastSeen, now);

  return {
    available,
    open,
    setOpen,
    tab,
    setTab,
    code,
    expiresAt,
    connected,
    handingOff,
    remoteUrl: code && origin ? `${origin}/remote/${code}` : null,
    handoffUrl: code && origin ? `${origin}/handoff/${code}` : null,
    disconnect,
    gate: pendingResume ? { visible: true, ready: opts.adapter != null && opts.pb.ready, resume } : null,
  };
}
