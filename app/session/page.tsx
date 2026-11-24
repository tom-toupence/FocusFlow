"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTimerStore, TimerMode } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaybackPrefsStore } from "@/store/playbackPrefsStore";
import { useSessionSummaryStore } from "@/store/sessionSummaryStore";
import { cn } from "@/lib/utils";
import TodoList from "@/components/TodoList";
import { useStatsStore } from "@/store/statsStore";
import { useNotesStore } from "@/store/notesStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";
import StickyNote from "@/components/StickyNote";
import SessionMedia, { TwitchGlyph } from "@/components/session/SessionMedia";
import UpNext, { hasUpNext } from "@/components/session/UpNext";
import PipTimer from "@/components/PipTimer";
import BreathingExercise from "@/components/BreathingExercise";
import RueScene, { type RueHandle } from "@/components/RueScene";
import { usePlayback, type PlayerAdapter } from "@/lib/playback/types";
import { useSessionMedia } from "@/lib/playback/useSessionMedia";
import type { ExtendedEvent, SourceKind } from "@/lib/playback/types";
import { useIdleHide } from "@/lib/useIdleHide";
import { usePrefsStore } from "@/store/prefsStore";
import { useDistractionStore } from "@/store/distractionStore";
import { useAchievementsStore } from "@/store/achievementsStore";
import { useGoalStore, getTodayProgress } from "@/store/goalStore";
import { useProjectStore } from "@/store/projectStore";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { toast } from "@/components/Toast";
import { playBreakChime, playWorkChime } from "@/lib/sounds";
import { upsertMyFriendStats } from "@/lib/friends";
import { CHEER_EVENT } from "@/store/chatStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Nom de la source affiché aux amis (YouTube : rien, le titre suffit). */
const SOURCE_NAME: Record<SourceKind, string> = { youtube: "", spotify: "Spotify", twitch: "Twitch" };

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

const breakLabel: Record<TimerMode, string> = {
  work: "",
  "short-break": "Pause courte",
  "long-break": "Longue pause",
};

// ─── Session Page ─────────────────────────────────────────────────────────────

export default function SessionPage() {
  const router = useRouter();
  const {
    mode, secondsLeft, isRunning, sessionsCompleted, settings,
    flowSeconds, flowBreakTotal,
    tick, start, pause, nextSession, finishFlow, accumulateFlow,
  } = useTimerStore();
  const isFlowtime = settings.preset === "flowtime";
  const { todos } = useSessionStore();
  const { recordSession } = useStatsStore();
  const { startSession } = useSessionSummaryStore();
  const { notes, addNote } = useNotesStore();
  const recordPlay = usePlayHistoryStore((st) => st.record);
  const { breathingEnabled } = usePrefsStore();
  const { sessionCount: distractionCount, markDistraction, resetSession: resetDistractions } = useDistractionStore();

  // Ce qui joue, décrit sans que la page connaisse les sources.
  const media = useSessionMedia();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSecondsRef = useRef(secondsLeft);
  const sessionEndedRef = useRef(false);
  const goalCelebratedRef = useRef(false);
  const isBreakRef = useRef(mode !== "work");
  // La ville (halte + mode Spotify) : événements de ville déclenchés par la session.
  const city = useRef<RueHandle>(null);
  const isRunningRef = useRef(isRunning);
  // Tâches repliées et « À venir » ouvert : l'écran de la landing.
  const [showTodos, setShowTodos] = useState(false);
  const [showUpNext, setShowUpNext] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [showVolume, setShowVolume] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // Mode ultra-zen : chrome masqué manuellement (touche H)
  const [zenHidden, setZenHidden] = useState(false);
  const [distractionFlash, setDistractionFlash] = useState(0);
  // Préférences de lecture (shuffle / boucle), communes à toutes les sources.
  const { shuffle, loop } = usePlaybackPrefsStore();
  // L'adaptateur de la source en cours (interface de lecture unique, phase 8).
  const [adapter, setAdapter] = useState<PlayerAdapter | null>(null);
  const pb = usePlayback(adapter);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  // Téléphone : « À venir » replié au départ (la place est comptée).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (window.matchMedia("(max-width: 767px)").matches) setShowUpNext(false); }, []);
  // Sur téléphone, les deux panneaux occupent la même place : l'un ferme l'autre.
  const small = () => window.matchMedia("(max-width: 767px)").matches;
  const toggleUpNext = () => { const next = !showUpNext; setShowUpNext(next); if (next && small()) setShowTodos(false); };
  const toggleTodos = () => { const next = !showTodos; setShowTodos(next); if (next && small()) setShowUpNext(false); };

  const isBreak = mode !== "work";

  // Keep refs in sync for use inside IFrame API callbacks
  useEffect(() => { isBreakRef.current = isBreak; }, [isBreak]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  // ── Chime sounds on mode transitions ─────────────────────────────────────
  // Fin de pomodoro : bloom doux plein écran de la teinte d'ambiance (une
  // keyframe one-shot re-déclenchée par `key`), en plus du chime existant.
  const [bloomKey, setBloomKey] = useState(0);
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    if (mode !== "work") {
      playBreakChime();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBloomKey((k) => k + 1);
      // La pause sort du mode zen : au retour en focus, le chrome est visible.
      setZenHidden(false);
    } else {
      playWorkChime();
    }
    prevModeRef.current = mode;
  }, [mode]);

  // ── Record session start ─────────────────────────────────────────────────
  // Retour sur une session déjà en cours (navigation ou rechargement) : on ne la
  // réinitialise pas, on la reprend telle quelle (en pause, elle reste en pause).
  const resumedRef = useRef(false);
  useEffect(() => {
    if (useTimerStore.getState().active) {
      resumedRef.current = true;
      return;
    }
    const doneTodoIds = todos.filter((t) => t.status === "done").map((t) => t.id);
    startSession(settings.workDuration, doneTodoIds);
    resetDistractions();
    start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Présence « en focus » pour les amis (online-only, no-op sans compte) ──
  // in_focus=true au montage + heartbeat toutes les 60 s ; cleanup au démontage
  // (couvre Terminer/navigation). Les amis voient le statut via Realtime.
  useEffect(() => {
    const now = Date.now();
    upsertMyFriendStats({ inFocus: true, focusStartedAt: now, focusHeartbeat: now });
    const beat = setInterval(() => upsertMyFriendStats({ focusHeartbeat: Date.now() }), 60_000);
    return () => {
      clearInterval(beat);
      // Sortie de session : plus « en focus » ni d'activité en clair.
      upsertMyFriendStats({ inFocus: false, activity: null });
    };
  }, []);

  // ── Fullscreen ───────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);

  // ── Notifications ────────────────────────────────────────────────────────
  // Firefox n'autorise requestPermission() que depuis un geste utilisateur →
  // on attend le premier clic dans la session.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const ask = () => { Notification.requestPermission(); };
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, []);

  // ── Pilotage commun à toutes les sources ──────────────────────────────────
  // Une seule règle : la musique joue pendant le travail minuteur en marche,
  // s'arrête en pause et pendant la halte (Twitch compris, ce qui manquait).
  useEffect(() => {
    if (!adapter) return;
    if (!isBreak && isRunning) adapter.play(); else adapter.pause();
  }, [adapter, isBreak, isRunning]);
  useEffect(() => { adapter?.setShuffle(shuffle); }, [adapter, shuffle]);
  useEffect(() => { adapter?.setLoop(loop); }, [adapter, loop]);

  // ── Timer tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, tick]);

  // Onglet en arrière-plan : les minuteurs sont bridés, on recalcule au retour.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [tick]);

  // Lu dans des callbacks mémorisés : toujours la description courante.
  const playEntryRef = useRef(media.playEntry);
  useEffect(() => { playEntryRef.current = media.playEntry; });
  const buildPlayEntry = (minutes: number) => playEntryRef.current(minutes);

  // ── Celebrations: achievements unlocked + daily goal reached ──────────────
  const celebrateProgress = () => {
    // Achievements (re-evaluated from fresh stats/history)
    const newly = useAchievementsStore.getState().sync();
    for (const id of newly) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) toast({ title: "Succès débloqué", description: a.title, accent: "amber" });
    }
    // Daily goal (only once per session view)
    if (!goalCelebratedRef.current) {
      const { unit, target } = useGoalStore.getState();
      const progress = getTodayProgress(useStatsStore.getState().days, unit, target);
      if (progress.reached) {
        goalCelebratedRef.current = true;
        playWorkChime();
        toast({ title: "Objectif du jour atteint", description: "Bien joué.", accent: "emerald" });
        // Événement de ville : une vague de lumière part de la tour, une fois la halte installée.
        setTimeout(() => city.current?.goal(), 3200);
      }
    }
  };

  // ── Session end ───────────────────────────────────────────────────────────
  const handleSessionEnd = useCallback((autoStart = true) => {
    if (typeof window !== "undefined" && Notification.permission === "granted") {
      new Notification("FocusFlow", {
        body: mode === "work" ? "Session terminée ! Pause en cours." : "Pause terminée ! C'est reparti.",
        icon: "/favicon.ico",
      });
    }
    if (mode === "work") {
      if (!sessionEndedRef.current) {
        sessionEndedRef.current = true;
        recordSession(settings.workDuration);
        recordPlay(buildPlayEntry(settings.workDuration));
        useProjectStore.getState().logPomodoro(); // advance the active project, if any
        celebrateProgress();
      }
    } else {
      sessionEndedRef.current = false;
    }
    nextSession(autoStart);
  }, [mode, nextSession, recordSession, recordPlay, settings.workDuration]);

  useEffect(() => {
    if (prevSecondsRef.current > 0 && secondsLeft === 0) handleSessionEnd();
    prevSecondsRef.current = secondsLeft;
  }, [secondsLeft, handleSessionEnd]);

  // ── Rattrapage au retour : un cycle a pu finir pendant qu'on était ailleurs ──
  // Traité une seule fois, au montage, et un seul cycle est crédité même si
  // plusieurs se seraient écoulés. On reste ensuite en attente (pas d'enchaînement).
  // Le rendu initial lit un secondsLeft périmé : la transition passe donc par cet
  // effet, qui change le mode dans la même passe (le rendu ne voit jamais 0).
  const catchUpDoneRef = useRef(false);
  useEffect(() => {
    if (catchUpDoneRef.current || !resumedRef.current) return;
    catchUpDoneRef.current = true;
    tick();
    const st = useTimerStore.getState();
    const flowWork = st.settings.preset === "flowtime" && st.mode === "work";
    if (st.isRunning && !flowWork && st.secondsLeft === 0) handleSessionEnd(false);
  }, [tick, handleSessionEnd]);

  // ── Flowtime: end the stretch and start the earned break ────────────────
  const handleFlowBreak = () => {
    const minutes = Math.round(useTimerStore.getState().flowSeconds / 60);
    if (minutes >= 1) {
      recordSession(minutes);
      recordPlay(buildPlayEntry(minutes));
      useProjectStore.getState().logPomodoro();
      celebrateProgress();
    }
    finishFlow();
  };

  // ── Stop → Summary ────────────────────────────────────────────────────────
  const handleStop = () => {
    pause();
    // Record partial work time if we were mid-session
    if (mode === "work") {
      const minutesWorked = isFlowtime
        ? accumulateFlow()
        : Math.round((settings.workDuration * 60 - secondsLeft) / 60);
      if (minutesWorked >= 1) {
        recordSession(minutesWorked);
        recordPlay(buildPlayEntry(minutesWorked));
      }
    }
    // Sync achievements so the summary reflects anything just unlocked.
    useAchievementsStore.getState().sync();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    router.push("/summary");
  };

  // ── Distraction tracking ──────────────────────────────────────────────────
  // Faithful to the original Pomodoro Technique: mark every interruption.
  const handleDistraction = useCallback(() => {
    if (isBreakRef.current) return; // only count during focus
    markDistraction();
    setDistractionFlash((n) => n + 1); // trigger a brief visual feedback
    city.current?.next(); // Spotify : chaque titre a sa rue
  }, [markDistraction]);

  // Keyboard shortcuts (ignored while typing in a field):
  //  • D — mark a distraction   • Space — pause / resume
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        handleDistraction();
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setZenHidden((v) => !v);
      } else if (e.code === "Space") {
        e.preventDefault();
        if (!isBreakRef.current) {
          if (isRunningRef.current) pause(); else start();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDistraction, pause, start]);

  // Auto-masquage du panneau de volume après 2,5 s sans interaction.
  const volumeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armVolumeHide = useCallback(() => {
    if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current);
    volumeHideTimerRef.current = setTimeout(() => setShowVolume(false), 2500);
  }, []);
  useEffect(() => {
    return () => { if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current); };
  }, []);

  const handleVolumeChange = (v: number) => {
    setVolumeState(v);
    armVolumeHide();
    adapter?.setVolume(v);
  };

  // Fin de liste prolongée par des titres proches : toast et ville.
  const handleExtended = ({ added }: ExtendedEvent, kind: SourceKind) => {
    if (added === 0) return;
    toast({
      title: kind === "spotify" ? "Fin de la playlist" : "Fin de la liste",
      description: kind === "spotify"
        ? `${added} titre${added > 1 ? "s" : ""} proche${added > 1 ? "s" : ""} de toute ta playlist ajouté${added > 1 ? "s" : ""} à la suite.`
        : "La lecture continue avec des titres proches de toute ta playlist.",
      accent: "emerald",
    });
    city.current?.next();
  };

  const skipTrack = (dir: "next" | "prev") => { if (dir === "next") adapter?.next(); else adapter?.previous(); };

  // « Now Playing » unifié : la piste que l'adaptateur déclare, quelle que soit la source.
  const nowPlaying: { title: string; sub: string } | null = pb.track
    ? {
        title: pb.track.title,
        sub: [pb.track.subtitle, pb.track.total ? `${(pb.track.index ?? 0) + 1}/${pb.track.total}` : ""].filter(Boolean).join(" · "),
      }
    : null;

  // ── Activité en clair pour les amis (rich presence) ───────────────────────
  // « En focus · <titre écouté> » / « En pause » / « Flowtime · … ». Éphémère,
  // publiée dans friend_stats.activity ; effacée à la sortie de session.
  const activityKind = mode !== "work" ? "En pause" : isFlowtime ? "Flowtime" : "En focus";
  const sourceName = SOURCE_NAME[media.kind];
  const activityMedia = nowPlaying ? [nowPlaying.title, sourceName].filter(Boolean).join(" · ") : sourceName;
  const activityLabel = activityMedia ? `${activityKind} · ${activityMedia}` : activityKind;
  useEffect(() => {
    upsertMyFriendStats({ activity: activityLabel });
  }, [activityLabel]);

  const progress = (() => {
    if (isFlowtime && mode === "work") return 0; // open-ended stretch, no fixed total
    const total =
      mode === "work" ? settings.workDuration * 60
      : mode === "short-break" ? settings.shortBreakDuration * 60
      : settings.longBreakDuration * 60;
    return total > 0 ? 1 - secondsLeft / total : 0;
  })();

  const breakTotal = isFlowtime
    ? flowBreakTotal
    : mode === "long-break"
      ? settings.longBreakDuration * 60
      : settings.shortBreakDuration * 60;

  // Flowtime: break earned so far (elapsed ÷ 5, min 2 min)
  const earnedBreakMin = Math.max(2, Math.round(flowSeconds / 5 / 60));

  const pendingTodos = todos.filter((t) => t.status !== "done");

  // ── Auto-masquage du chrome après 4 s d'inactivité (mode zen) ─────────────
  // Désactivé en pause / break / panneau d'aide ouvert ; la touche H masque
  // manuellement. Ne reste alors que la vidéo + le timer.
  const idleHidden = useIdleHide(4000, isRunning && !isBreak && !showHelp && !showTodos);
  const chromeHidden = !isBreak && (zenHidden || idleHidden);
  const chromeHideCls = cn(
    "transition-[opacity,transform] duration-500",
    chromeHidden && "opacity-0 motion-safe:translate-y-2 pointer-events-none"
  );

  // Encouragement d'un ami : une vague de lumière traverse la rue (visible en
  // pause et en mode Spotify ; sous une vidéo, le toast suffit).
  useEffect(() => {
    const onCheer = () => city.current?.goal();
    window.addEventListener(CHEER_EVENT, onCheer);
    return () => window.removeEventListener(CHEER_EVENT, onCheer);
  }, []);

  // Un clic n'importe où réaffiche le chrome masqué manuellement (H).
  useEffect(() => {
    if (!zenHidden) return;
    const restore = () => setZenHidden(false);
    window.addEventListener("pointerdown", restore);
    return () => window.removeEventListener("pointerdown", restore);
  }, [zenHidden]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Le lecteur, quelle que soit la source (seul endroit qui les distingue). */}
      <SessionMedia
        media={media}
        playing={!isBreak && isRunning}
        isBreak={isBreak}
        volume={volume}
        trackId={pb.track?.id}
        onAdapter={setAdapter}
        onExtended={handleExtended}
        backdrop={
          <RueScene
            ref={city}
            mode="work"
            className="absolute inset-0"
            label="Une rue de nuit sous la pluie, décor de la session quand aucune vidéo ne joue."
          />
        }
      />

      {/* Bloom doux plein écran à la fin d'un pomodoro (opacité gérée par .anim-bloom) */}
      {bloomKey > 0 && (
        <div
          key={`bloom-${bloomKey}`}
          className="absolute inset-0 z-30 pointer-events-none anim-bloom"
          style={{ background: "radial-gradient(ellipse at center, var(--ambient) 0%, transparent 70%)" }}
        />
      )}

      {/* Liseré de progression ambiant le long du bord supérieur de l'écran */}
      {!isBreak && !isFlowtime && (
        <div className="fixed top-0 inset-x-0 h-[2px] z-30 pointer-events-none">
          <div
            className="h-full origin-left"
            style={{
              background: "var(--ambient-2)",
              transform: `scaleX(${progress})`,
              transition: "transform 1s linear",
            }}
          />
        </div>
      )}

      {/* ── La halte (pause) : la ville s'éteint, la vue se brouille ───────── */}
      {isBreak && (
        <div className="absolute inset-0 z-20 bg-[#07090d]">
          <RueScene
            ref={city}
            mode="break"
            interval={[40, 60]}
            className="absolute inset-0"
            label={`La halte : une rue de nuit, il reste ${formatTime(secondsLeft)} de pause.`}
          />
          {/* Voile de lecture : à gauche sur grand écran, en bas sur mobile. */}
          <div aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,#07090d_0%,rgba(7,9,13,0.86)_32%,rgba(7,9,13,0.15)_62%,transparent_80%)] max-md:bg-[linear-gradient(0deg,#07090d_0%,rgba(7,9,13,0.9)_45%,rgba(7,9,13,0.2)_70%,transparent_85%)]" />
          <div className="relative z-10 h-full overflow-y-auto flex items-end md:items-center px-5 sm:px-10 lg:px-16 py-8">
            <div className="flex flex-col gap-6 max-w-md text-white">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-focus">{breakLabel[mode]}</p>
                <h1 className="mt-2 font-semibold tracking-tight text-[clamp(2.75rem,7vw,5rem)] leading-[0.95]">Pause</h1>
                <p className="mt-3 text-[15px] text-white/75">
                  {sessionsCompleted > 0 ? `Pomodoro ${sessionsCompleted} terminé. ` : ""}Lève les yeux de l&apos;écran.
                </p>
              </div>
              <div>
                <p className="font-mono tabular-nums text-[clamp(4.5rem,12vw,7.5rem)] leading-none text-focus" role="timer" aria-label={`Pause : ${formatTime(secondsLeft)}`}>
                  {formatTime(secondsLeft)}
                </p>
                <div className="mt-4 h-[3px] w-full max-w-[18rem] bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-focus origin-left"
                    style={{ transform: `scaleX(${breakTotal > 0 ? secondsLeft / breakTotal : 0})`, transition: "transform 1s linear" }}
                  />
                </div>
              </div>
              {breathingEnabled && <BreathingExercise />}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => nextSession(true)}
                  className="ff-press inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-white/30 hover:border-white/70 text-white/85 hover:text-white text-sm transition-colors"
                >
                  Passer la pause
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path d="M5 4l15 8-15 8V4z" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="19" y1="4" x2="19" y2="20" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  onClick={handleStop}
                  className="ff-press inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-rose-400/40 hover:border-rose-400 text-rose-300 hover:text-rose-200 text-sm transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                  Terminer la session
                </button>
              </div>
              <button
                onClick={() => usePrefsStore.getState().setBreathingEnabled(!breathingEnabled)}
                className="self-start text-[12px] text-white/55 hover:text-white/85 underline-offset-4 hover:underline transition-colors"
              >
                {breathingEnabled ? "Masquer la respiration guidée" : "Afficher la respiration guidée"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky notes — portal to escape overflow:hidden ─────────────── */}
      {mounted && createPortal(
        <>
          {notes.map((note) => <StickyNote key={note.id} note={note} />)}
          <button
            onClick={addNote}
            title="Ajouter un post-it"
            className="fixed top-[4.75rem] left-3 md:top-[5.25rem] md:left-5 z-[100] flex h-9 items-center gap-1.5 px-3 rounded-lg border border-white/15 bg-black/50 backdrop-blur-sm text-white/75 hover:text-white hover:bg-black/70 text-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Post-it
          </button>
        </>,
        document.body
      )}

      {/* ── Work screen overlay ─────────────────────────────────────────────── */}
      {!isBreak && (
        <>
          {/* L'écran annoncé sur la landing (SessionReplica) : en cours en haut
              à gauche, minuteur en haut à droite, « À venir » en bas à droite,
              une rangée de boutons en bas au centre. Garder les deux identiques. */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-start justify-between gap-3 p-3 md:p-5">
            {/* En cours */}
            <div className={cn("min-w-0 max-w-[calc(100%-8.5rem)] md:max-w-[42%] anim-cascade", chromeHideCls)}>
              {nowPlaying && (
                <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-sm">
                  <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full transition-colors", isRunning ? "bg-focus" : "bg-white/30")} />
                  {/* key = piste → le titre glisse à chaque changement */}
                  <div key={pb.track?.id ?? ""} className="min-w-0 anim-track-in">
                    <p className="truncate text-xs text-white">{nowPlaying.title}</p>
                    <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
                      {pb.extending ? "Recherche de titres proches…" : nowPlaying.sub || sourceName}
                    </p>
                    {pb.error && <p role="status" className="mt-0.5 text-[10px] text-rose-300">{pb.error}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Minuteur : chiffres sodium et filet de progression. */}
            <div className="shrink-0 anim-cascade [animation-delay:80ms]">
              <div className="rounded-lg border border-white/10 bg-night/80 px-3 md:px-4 py-1.5 text-center backdrop-blur-sm shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)]">
                <span
                  role="timer"
                  aria-label={`${isFlowtime ? "Flowtime" : "Temps restant"} : ${formatTime(isFlowtime ? flowSeconds : secondsLeft)}`}
                  className="block font-mono tabular-nums text-[26px] md:text-[34px] leading-none text-sodium [text-shadow:0_0_14px_color-mix(in_oklab,var(--sodium)_55%,transparent)]"
                >
                  {formatTime(isFlowtime ? flowSeconds : secondsLeft)}
                </span>
                <div aria-hidden className="mt-1.5 h-[2px] w-full overflow-hidden bg-white/10">
                  {!isFlowtime && <div className="h-full origin-left bg-sodium transition-transform duration-1000 ease-linear" style={{ transform: `scaleX(${progress})` }} />}
                </div>
                <p className="mt-1 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
                  {isFlowtime ? `Flow · pause ${earnedBreakMin} min` : `Pomodoro ${sessionsCompleted + 1}`}
                </p>
              </div>
            </div>
          </div>

          {/* À venir : en bas à droite, visible sans ouvrir de menu. */}
          <UpNext
            adapter={adapter}
            pb={pb}
            open={showUpNext}
            className={cn(
              "absolute z-10 inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-5 md:bottom-20 md:w-[300px]",
              chromeHideCls,
            )}
          />

          {/* Contrôles : une rangée en bas au centre (barre fixe sur mobile). */}
          <div
            className={cn(
              "fixed bottom-0 inset-x-0 z-20 flex items-center gap-1.5 overflow-x-auto px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-black/60 backdrop-blur-md border-t border-white/10",
              "md:absolute md:inset-x-0 md:bottom-5 md:justify-center md:overflow-visible md:bg-transparent md:backdrop-blur-none md:border-0 md:p-0",
              "anim-cascade [animation-delay:160ms]",
              chromeHideCls,
            )}
          >
            {/* Pause / Reprendre : l'action principale (Espace). */}
            <Pill primary onClick={isRunning ? pause : start} title={isRunning ? "Mettre en pause · Espace" : "Reprendre · Espace"}>
              {isRunning ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
              )}
              {isRunning ? "Pause" : "Reprendre"}
            </Pill>

            {/* Flowtime : finir l'élan et prendre la pause méritée. */}
            {isFlowtime && (
              <Pill onClick={handleFlowBreak} title={`Terminer ce flow et prendre ${earnedBreakMin} min de pause`} className="border-focus/45 text-white">
                Pause méritée · {earnedBreakMin} min
              </Pill>
            )}

            {/* Distraction (D) */}
            <Pill onClick={handleDistraction} title="Marquer une distraction · touche D" className="relative hover:text-rose-300">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Distraction</span>
              {distractionCount > 0 && <span className="font-mono tabular-nums text-rose-300">{distractionCount}</span>}
              {distractionFlash > 0 && (
                <span key={distractionFlash} className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold text-rose-300 animate-[distractionPop_0.7s_ease-out_forwards]">+1</span>
              )}
            </Pill>

            {/* Titres : précédent / suivant (files et playlists). */}
            {pb.caps.skip && (
              <>
                <Pill icon onClick={() => skipTrack("prev")} title="Titre précédent" aria-label="Titre précédent">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" /></svg>
                </Pill>
                <Pill onClick={() => skipTrack("next")} title="Titre suivant">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16 6h2v12h-2zM6 6v12l8.5-6z" /></svg>
                  <span className="hidden sm:inline">Suivant</span>
                </Pill>
              </>
            )}

            {/* À venir : bascule le panneau du bas à droite. */}
            {hasUpNext(adapter, pb) && (
              <Pill active={showUpNext} onClick={() => toggleUpNext()} title="À venir" aria-pressed={showUpNext}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M4 6h11M4 12h11M4 18h7M18 15v6M15 18h6" strokeLinecap="round" /></svg>
                <span className="hidden sm:inline">À venir</span>
              </Pill>
            )}

            {/* Tâches */}
            <Pill active={showTodos} onClick={() => toggleTodos()} title="Afficher / masquer les tâches" aria-pressed={showTodos}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" strokeLinecap="round" />
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Tâches</span>
              {pendingTodos.length > 0 && <span className="font-mono tabular-nums text-white/60">{pendingTodos.length}</span>}
            </Pill>

            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/15" />

            {/* Réglages de lecture, en boutons carrés du même style. */}
            {mounted && pb.caps.skip && pb.caps.shuffle && (
              <Pill icon active={shuffle} onClick={() => usePlaybackPrefsStore.getState().toggleShuffle()} title={shuffle ? "Lecture aléatoire activée" : "Activer la lecture aléatoire"} aria-pressed={shuffle}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Pill>
            )}
            {/* Boucle : coupée, la fin de liste continue avec des titres proches. */}
            {mounted && pb.caps.skip && pb.caps.loop && (
              <Pill icon active={loop} onClick={() => usePlaybackPrefsStore.getState().toggleLoop()} title={loop ? "Boucle activée" : "Boucle désactivée : la fin de liste continue avec des titres proches de toute la playlist"} aria-pressed={loop}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path d="M17 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Pill>
            )}

            {/* Volume : le curseur s'ouvre au-dessus de la rangée. */}
            {pb.caps.volume && (
              <div className="relative shrink-0">
                <div
                  onPointerMove={armVolumeHide}
                  className={cn(
                    "absolute bottom-full right-0 mb-2 flex h-28 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/70 backdrop-blur-sm shadow-lg shadow-black/40 transition-[opacity,transform] duration-300",
                    showVolume ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
                  )}
                >
                  <input
                    type="range"
                    min={0} max={1} step={0.05}
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    tabIndex={showVolume ? 0 : -1}
                    aria-label="Volume de la vidéo"
                    className="h-20 cursor-pointer accent-white"
                    style={{ writingMode: "vertical-lr", direction: "rtl" }}
                  />
                </div>
                <Pill icon active={showVolume} onClick={() => setShowVolume((v) => { const next = !v; if (next) armVolumeHide(); return next; })} title="Volume de la vidéo" aria-label="Volume de la vidéo">
                  {volume === 0 ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" /><line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
                    </svg>
                  )}
                </Pill>
              </div>
            )}

            {/* Mini-minuteur toujours au premier plan (Document PiP). */}
            <PipTimer onDistraction={handleDistraction} onFlowBreak={handleFlowBreak} />

            {/* Ouvrir chez la source (Twitch). */}
            {media.external && (
              <a
                href={media.external.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(PILL_BASE, PILL_ICON, PILL_IDLE, "hover:text-[#9146ff]")}
                title={media.external.label}
                aria-label={media.external.label}
              >
                <TwitchGlyph className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Aide & raccourcis */}
            <Pill icon active={showHelp} onClick={() => setShowHelp((v) => !v)} title="Aide & raccourcis" aria-label="Aide & raccourcis">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Pill>

            {/* Terminer la session */}
            <Pill onClick={handleStop} title="Terminer la session" className="hover:text-rose-300 hover:border-rose-400/50">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
              Terminer
            </Pill>
          </div>

          {/* ── Help panel ─────────────────────────────────────────────────── */}
          {showHelp && (
            <div className="absolute top-24 md:top-28 right-3 md:right-5 w-80 max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-y-auto bg-night/90 backdrop-blur-sm rounded-xl border border-white/10 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] z-30">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-xs font-semibold text-white/70 font-mono uppercase tracking-[0.14em]">Comment ça marche</span>
                <button onClick={() => setShowHelp(false)} className="text-white/40 hover:text-white transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="p-4 flex flex-col gap-3.5 text-xs">
                <HelpRow icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>} title="Distraction (touche D)">
                  À chaque fois que tu décroches, clique ou appuie sur <b className="text-white/80">D</b> pour la noter. Rien n&apos;est détecté tout seul : c&apos;est toi qui marques. Moins tu en as, meilleur est ton <b className="text-white/80">Focus Score</b> en fin de session.
                </HelpRow>
                <HelpRow icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 4v16M18 4v16" strokeLinecap="round" strokeLinejoin="round" /></svg>} title="Pause / Reprise (Espace)">
                  Met en pause le timer et la vidéo. Le raccourci <b className="text-white/80">Espace</b> fait pareil.
                </HelpRow>
                <HelpRow icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" /></svg>} title="Mode zen (touche H)">
                  Les contrôles s&apos;effacent après 4 s sans bouger la souris ; il ne reste que la vidéo et le minuteur. <b className="text-white/80">H</b> les masque manuellement (re-appuie ou clique pour les réafficher).
                </HelpRow>
                <HelpRow icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" strokeLinecap="round" /></svg>} title="Timer flottant">
                  Détache le timer dans une mini-fenêtre toujours au premier plan, même par-dessus tes autres applis (Chrome/Edge).
                </HelpRow>
                <HelpRow icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>} title="Respiration guidée">
                  Pendant les pauses, une bulle t&apos;aide à respirer (cycle 4-4-4-4) pour vraiment récupérer.
                </HelpRow>
                <HelpRow icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" /></svg>} title="Tâches & post-its">
                  Coche tes tâches au fil de la session ; ajoute des post-it en bas à gauche pour tes idées.
                </HelpRow>
              </div>
            </div>
          )}

          {/* Tasks panel — mini kanban */}
          {showTodos && (
            <div className={cn(
              // Mobile : pleine largeur au-dessus de la barre de contrôles.
              "absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-[55vh] overflow-y-auto",
              "md:inset-x-auto md:left-5 md:bottom-20 md:w-[30rem] md:max-w-[calc(100vw-22rem)] md:max-h-[60vh] md:overflow-y-auto",
              "bg-night/85 backdrop-blur-sm rounded-xl border border-white/10 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] z-10 p-4",
              chromeHideCls
            )}>
              <TodoList />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Boutons de la rangée du bas (mêmes que l'image de la landing) ────────────

const PILL_BASE = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs transition-colors";
const PILL_ICON = "w-9";
const PILL_IDLE = "border-white/15 bg-black/50 text-white/75 backdrop-blur-sm hover:bg-black/70 hover:text-white";

function Pill({
  primary, active, icon, className, children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; active?: boolean; icon?: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        PILL_BASE,
        icon ? PILL_ICON : "px-3.5",
        primary ? "border-white bg-white font-medium text-black hover:bg-white/90"
          : active ? "border-white/30 bg-white/20 text-white backdrop-blur-sm"
          : PILL_IDLE,
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── Help panel row ───────────────────────────────────────────────────────────

function HelpRow({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="flex-shrink-0 mt-0.5 text-white/45">{icon}</span>
      <div className="min-w-0">
        <p className="text-white/85 font-semibold text-[11px] mb-0.5">{title}</p>
        <p className="text-white/45 leading-relaxed text-[11px]">{children}</p>
      </div>
    </div>
  );
}
