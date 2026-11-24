"use client";
// Côté ordinateur (/session) : télécommande et « Emporter la session » (lot 7).
// Monté en une ligne par la page de session, qui lui passe ses propres actions
// (Pause/Reprendre, Distraction, fin de session) : le téléphone déclenche
// exactement les mêmes chemins que les boutons, la touche D et la Media Session.
//
// Sécurité : secret de 128 bits dans le fragment du QR, canal dérivé du secret,
// messages signés (lib/remote/channel.ts). Tout appareil doit être autorisé sur
// l'ordinateur (« Autoriser ? ») avant de commander ou de recevoir la session.
//
// Cycle de vie du canal :
//   . ouverture du panneau sans téléphone connecté : nouveau code, nouveau secret ;
//   . fermer le panneau ne coupe rien ; « Déconnecter » ferme le canal ;
//   . le code expire au bout de 2 h ; quitter /session (ou la page) ferme le canal.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTimerStore } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSessionSummaryStore } from "@/store/sessionSummaryStore";
import { useDistractionStore } from "@/store/distractionStore";
import { skipTrack } from "@/lib/useMediaSession";
import type { PlaybackState, PlayerAdapter } from "@/lib/playback/types";
import type { SessionMedia } from "@/lib/playback/useSessionMedia";
import { transportKind } from "./transport";
import { SecureChannel } from "./channel";
import { buildLink, cryptoReady, newSecret } from "./crypto";
import { buildHandoffState, resumePosition, sessionTodos, type MediaSnapshot } from "./handoff";
import { HostLogic, type Ask, type HandoffBuild, type HostAction } from "./host";
import { readPendingResume, clearPendingResume, type PendingResume } from "./handoffApply";
import {
  clip, CODE_TTL_MS, generateCode, isExpired, isPhoneConnected, newNonce, STATE_INTERVAL_MS,
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
   * (null hors travail ou en Flowtime). Le mode est celui de l'envoi (vérifié).
   */
  onHandedOff: (leftSeconds: number | null) => void;
}

export type RemoteTab = "remote" | "handoff";

export interface RemoteHost {
  /** Un transport existe ici (Supabase configuré, ou dev / lab) et WebCrypto aussi. */
  available: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  tab: RemoteTab;
  setTab: (tab: RemoteTab) => void;
  code: string | null;
  expiresAt: number | null;
  connected: boolean;
  /** Un téléphone attend « Autoriser » (connexion ou reprise de la session). */
  ask: Ask | null;
  authorize: () => void;
  deny: () => void;
  /** La session a été envoyée, en attente de l'accusé du téléphone. */
  handingOff: boolean;
  remoteUrl: string | null;
  handoffUrl: string | null;
  disconnect: () => void;
  /** Téléphone qui vient de reprendre une session : « Toucher pour reprendre ». */
  gate: { visible: boolean; ready: boolean; resume: () => void } | null;
}

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

/** L'état complet de la session, figé au moment d'« Autoriser ». */
function buildForHandoff(o: RemoteHostOptions, now: number): HandoffBuild {
  const st = useTimerStore.getState();
  const state = buildHandoffState(
    {
      settings: st.settings, mode: st.mode, isRunning: st.isRunning && !st.stopReached, endsAt: st.endsAt,
      secondsLeft: st.secondsLeft, cycleSeconds: st.cycleSeconds, sessionsCompleted: st.sessionsCompleted,
      stopAt: st.stopAt, flowBreakTotal: st.flowBreakTotal,
    },
    sessionTodos(useSessionStore.getState().todos, useSessionSummaryStore.getState().todoDoneIdsAtStart),
    mediaSnapshot(o.media, o.adapter, o.pb),
    now,
  );
  const creditable = st.mode === "work" && st.settings.preset !== "flowtime";
  return { state, mode: st.mode, sessionsCompleted: st.sessionsCompleted, leftSeconds: creditable ? state.timer.secondsLeft : null };
}

export function useRemoteHost(opts: RemoteHostOptions): RemoteHost {
  const latest = useRef(opts);
  useEffect(() => { latest.current = opts; });

  const [available, setAvailable] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setAvailable(transportKind() != null && cryptoReady()), []);

  const [open, setOpenState] = useState(false);
  const [tab, setTab] = useState<RemoteTab>("remote");
  const [code, setCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const [now, setNow] = useState(0);
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(window.location.origin), []);

  const channelRef = useRef<SecureChannel | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const logicRef = useRef(new HostLogic());
  const expiresRef = useRef<number>(0);
  const lastSeenRef = useRef<number | null>(null);
  /** Ouverture en cours (dérivation des clés asynchrone) : une seule à la fois. */
  const generationRef = useRef(0);

  const send = useCallback((body: RemoteMessageBody) => channelRef.current?.send(body) ?? Promise.resolve(false), []);

  const sendState = useCallback(() => {
    // Rien ne part tant qu'aucun appareil n'est autorisé.
    if (!channelRef.current || logicRef.current.paired.size === 0) return;
    void send({ type: "state", s: remoteState(latest.current.pb, expiresRef.current, Date.now()) });
  }, [send]);

  const resetUi = useCallback(() => {
    setCode(null);
    setSecret(null);
    setExpiresAt(null);
    setLastSeen(null);
    setAsk(null);
    setHandingOff(false);
  }, []);

  const closeChannel = useCallback((reason: ByeReason) => {
    generationRef.current++;
    const ch = channelRef.current;
    if (!ch) return;
    channelRef.current = null;
    unsubRef.current?.();
    unsubRef.current = null;
    lastSeenRef.current = null;
    // Le « bye » part avant la fermeture, deux fois (un message perdu ne bloque personne).
    void ch.send({ type: "bye", reason }).then(() => new Promise((r) => setTimeout(r, 600)))
      .then(() => ch.send({ type: "bye", reason })).finally(() => ch.close());
  }, []);

  const run = useCallback((actions: HostAction[]) => {
    for (const a of actions) {
      switch (a.type) {
        case "send": void send(a.body); break;
        case "state": setTimeout(sendState, 50); break;
        case "ask": setAsk(a.ask); break;
        case "seen": {
          const t = Date.now();
          lastSeenRef.current = t;
          setLastSeen(t);
          setNow(t);
          break;
        }
        case "command": {
          const { pb, adapter } = latest.current;
          if (a.cmd === "pause") latest.current.onPause();
          else if (a.cmd === "resume") latest.current.onPlay();
          else if (a.cmd === "distraction") latest.current.onDistraction();
          else if (a.cmd === "next" && pb.caps.skip) skipTrack(adapter, "next");
          break;
        }
        case "pending": setHandingOff(a.pending != null); break;
        case "handedOff":
          closeChannel("handed-off");
          resetUi();
          setOpenState(false);
          latest.current.onHandedOff(a.pending.leftSeconds);
          break;
      }
    }
  }, [closeChannel, resetUi, send, sendState]);

  const startChannel = useCallback(async () => {
    closeChannel("disconnected");
    const gen = generationRef.current;
    const c = generateCode();
    const k = newSecret();
    const ch = await SecureChannel.open(c, k, "host");
    if (!ch || gen !== generationRef.current) { ch?.close(); return; }
    channelRef.current = ch;
    logicRef.current = new HostLogic();
    expiresRef.current = Date.now() + CODE_TTL_MS;
    unsubRef.current = ch.onMessage((m) => {
      if (channelRef.current !== ch || isExpired(expiresRef.current, Date.now())) return;
      run(logicRef.current.receive(m, Date.now(), () => {
        const s = useTimerStore.getState();
        return { mode: s.mode, sessionsCompleted: s.sessionsCompleted };
      }));
    });
    setCode(c);
    setSecret(k);
    setExpiresAt(expiresRef.current);
    setLastSeen(null);
    setAsk(null);
    setHandingOff(false);
  }, [closeChannel, run]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) return;
    setNow(Date.now());
    // Code et secret régénérés à chaque ouverture, sauf si un téléphone est là, attend ou reprend la session.
    const l = logicRef.current;
    const live = channelRef.current && (isPhoneConnected(lastSeenRef.current, Date.now()) || l.pending || l.ask);
    if (!live) void startChannel();
  }, [startChannel]);

  const authorize = useCallback(() => {
    run(logicRef.current.authorize(Date.now(), () => buildForHandoff(latest.current, Date.now()), newNonce() + newNonce().slice(0, 8)));
  }, [run]);
  const deny = useCallback(() => run(logicRef.current.deny()), [run]);

  const disconnect = useCallback(() => {
    closeChannel("disconnected");
    resetUi();
  }, [closeChannel, resetUi]);

  // Battement : état toutes les 5 s, expiration du code, accusé qui n'arrive pas.
  useEffect(() => {
    if (!code) return;
    const beat = () => {
      const t = Date.now();
      setNow(t);
      if (isExpired(expiresRef.current, t)) {
        closeChannel("expired");
        resetUi();
        return;
      }
      run(logicRef.current.tick(t));
      sendState();
    };
    beat();
    const id = setInterval(beat, STATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [code, closeChannel, resetUi, run, sendState]);

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

  // Sortie de /session ou fermeture de la page : le téléphone est prévenu, le canal fermé.
  useEffect(() => {
    const onHide = () => closeChannel("ended");
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); closeChannel("ended"); };
  }, [closeChannel]);

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
    ask,
    authorize,
    deny,
    handingOff,
    remoteUrl: code && secret && origin ? buildLink(origin, "/remote", code, secret) : null,
    handoffUrl: code && secret && origin ? buildLink(origin, "/handoff", code, secret) : null,
    disconnect,
    gate: pendingResume ? { visible: true, ready: opts.adapter != null && opts.pb.ready, resume } : null,
  };
}
