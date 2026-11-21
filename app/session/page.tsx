"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTimerStore, TimerMode } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaylistStore, isRadioMix, fetchMixVideos, fetchPlaylistVideos } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaybackPrefsStore } from "@/store/playbackPrefsStore";
import { useSessionSummaryStore } from "@/store/sessionSummaryStore";
import { cn } from "@/lib/utils";
import TodoList from "@/components/TodoList";
import { useStatsStore } from "@/store/statsStore";
import { useNotesStore } from "@/store/notesStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";
import StickyNote from "@/components/StickyNote";
import SpotifyPlayer from "@/components/SpotifyPlayer";
import TwitchPlayer from "@/components/TwitchPlayer";
import PipTimer from "@/components/PipTimer";
import BreathingExercise from "@/components/BreathingExercise";
import SessionCity from "@/components/SessionCity";
import { usePlayback, type PlayerAdapter } from "@/lib/playback/types";
import { YouTubeAdapter, type YouTubeSource } from "@/lib/playback/youtube";
import type { CityHandle } from "@/components/CityScene";
import Equalizer from "@/components/Equalizer";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const { selectedVideoId, selectedPlaylistId, playQueue, todos, getAllVideos } = useSessionStore();
  const { playlists } = usePlaylistStore();
  const { items: queueItems } = useQueueStore();
  const { recordSession } = useStatsStore();
  const { startSession } = useSessionSummaryStore();
  const { notes, addNote } = useNotesStore();
  const { selectedPlaylistUri, accessToken, playlists: spotifyPlaylists } = useSpotifyStore();
  const { selectedChannel, selectedVodId, accessToken: twitchToken } = useTwitchStore();
  const { record: recordPlay } = usePlayHistoryStore();
  const { breathingEnabled } = usePrefsStore();
  const { sessionCount: distractionCount, markDistraction, resetSession: resetDistractions } = useDistractionStore();

  const allVideos = getAllVideos();
  const video = allVideos.find((v) => v.id === selectedVideoId) ?? allVideos[0];
  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) ?? null;
  const isQueueMode = playQueue && queueItems.length > 0;
  const isPlaylistMode = !isQueueMode && !!selectedPlaylistId && !!selectedPlaylist;
  const isMix = isPlaylistMode && !!selectedPlaylist && isRadioMix(selectedPlaylist.playlistId);
  const isSpotifyMode = !!selectedPlaylistUri && !!accessToken;
  const isTwitchMode = !!selectedChannel || !!selectedVodId;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSecondsRef = useRef(secondsLeft);
  const sessionEndedRef = useRef(false);
  const goalCelebratedRef = useRef(false);
  const isBreakRef = useRef(mode !== "work");
  // La ville (halte + mode Spotify) : événements de ville déclenchés par la session.
  const city = useRef<CityHandle>(null);
  const isRunningRef = useRef(isRunning);
  const [showTodos, setShowTodos] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [showVolume, setShowVolume] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // Mode ultra-zen : chrome masqué manuellement (touche H)
  const [zenHidden, setZenHidden] = useState(false);
  const [distractionFlash, setDistractionFlash] = useState(0);
  // Mix radio YouTube résolu en pistes { id, title } (null = résolution en cours).
  const [mixTracks, setMixTracks] = useState<{ id: string; title: string }[] | null>(null);
  // Vraie playlist PL… résolue en pistes { id, title } (null = résolution en
  // cours ; [] = échec → repli lecteur natif YouTube).
  const [playlistTracks, setPlaylistTracks] = useState<{ id: string; title: string }[] | null>(null);
  // Préférences de lecture (shuffle / boucle), communes à toutes les sources.
  const { shuffle, loop } = usePlaybackPrefsStore();
  // L'adaptateur de la source en cours (interface de lecture unique, phase 8).
  const [adapter, setAdapter] = useState<PlayerAdapter | null>(null);
  const pb = usePlayback(adapter);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isBreak = mode !== "work";

  // Keep refs in sync for use inside IFrame API callbacks
  useEffect(() => { isBreakRef.current = isBreak; }, [isBreak]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  // ── Résolution des mixes radio YouTube (RD…) ──────────────────────────────
  // Les radios ne sont pas embarquables : on les résout en liste de videoIds via
  // /api/youtube/mix, puis on les joue comme une file contrôlable (skip + loop).
  // Repli sur la vidéo de départ en boucle si la résolution échoue.
  useEffect(() => {
    if (!isMix || !selectedPlaylist) return;
    let cancelled = false;
    (async () => {
      const { ids, titles } = await fetchMixVideos(selectedPlaylist.playlistId, selectedPlaylist.startVideoId);
      if (cancelled) return;
      if (ids.length > 0) {
        setMixTracks(ids.map((id) => ({ id, title: titles[id] ?? "Titre" })));
      } else {
        const sv = selectedPlaylist.startVideoId;
        setMixTracks(sv ? [{ id: sv, title: selectedPlaylist.title }] : []);
        toast({
          title: "Mix YouTube indisponible",
          description: "Lecture de la vidéo de départ en boucle.",
          accent: "amber",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [isMix, selectedPlaylist?.playlistId, selectedPlaylist?.startVideoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Résolution des vraies playlists (PL/OL/UU/FL/…) ───────────────────────
  // On récupère la liste ordonnée { id, title } côté serveur pour jouer via la
  // file maison (shuffle, titre exact, recos de fin). [] = échec → repli natif.
  useEffect(() => {
    if (!isPlaylistMode || isMix || !selectedPlaylist) return;
    let cancelled = false;
    (async () => {
      const videos = await fetchPlaylistVideos(selectedPlaylist.playlistId, selectedPlaylist.startVideoId);
      if (cancelled) return;
      // Titres ajoutés par l'utilisateur (« + Playlist » dans Découvrir/modal),
      // joués à la suite de la playlist (dédupliqués).
      const extras = (selectedPlaylist.extraVideos ?? []).filter(
        (e) => !videos.some((v) => v.id === e.id)
      );
      const all = videos.length > 0 ? [...videos, ...extras] : extras;
      setPlaylistTracks(all);
    })();
    return () => { cancelled = true; };
  }, [isPlaylistMode, isMix, selectedPlaylist?.playlistId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  useEffect(() => {
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

  // ── Source YouTube → adaptateur ───────────────────────────────────────────
  // La source est décrite une fois (vidéo, file maison, repli natif) ; tout le
  // pilotage passe ensuite par l'adaptateur (lib/playback/youtube.ts).
  const ytSource: YouTubeSource | null = (() => {
    if (isSpotifyMode || isTwitchMode) return null;
    if (isQueueMode) {
      return { type: "queue", subtitle: "File FocusFlow", tracks: queueItems.map((i) => ({ id: i.youtubeId, title: i.title })) };
    }
    if (isPlaylistMode && selectedPlaylist) {
      if (isMix) {
        if (mixTracks === null) return null; // résolution en cours
        return mixTracks.length ? { type: "queue", subtitle: selectedPlaylist.title || "Mix radio", tracks: mixTracks } : null;
      }
      if (playlistTracks === null) return null;
      return playlistTracks.length
        ? { type: "queue", subtitle: selectedPlaylist.title, tracks: playlistTracks }
        : { type: "native", listId: selectedPlaylist.playlistId, title: selectedPlaylist.title };
    }
    return video ? { type: "video", id: video.youtubeId, title: video.title, subtitle: video.channel } : null;
  })();
  const ytKey = ytSource ? JSON.stringify(ytSource.type === "queue" ? ytSource.tracks.map((t) => t.id) : ytSource) : "";
  const ytSourceRef = useRef(ytSource);
  // Mis à jour AVANT l'effet de création (les effets s'exécutent dans l'ordre).
  useEffect(() => { ytSourceRef.current = ytSource; });

  useEffect(() => {
    const src = ytSourceRef.current;
    if (!src) return;
    const { shuffle: sh, loop: lp } = usePlaybackPrefsStore.getState();
    const a = new YouTubeAdapter("yt-player", src, {
      volume: volume,
      shuffle: sh,
      loop: lp,
      playing: !isBreakRef.current && isRunningRef.current,
      onExtended: ({ added }) => {
        if (added === 0) return;
        toast({ title: "Fin de la liste", description: "La lecture continue avec des titres proches de toute ta playlist.", accent: "emerald" });
        city.current?.extend();
      },
    });
    setAdapter(a);
    return () => { a.destroy(); setAdapter((cur) => (cur === a ? null : cur)); };
  }, [ytKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Build play history entry ──────────────────────────────────────────────
  const buildPlayEntry = (minutes: number) => {
    const today = new Date();
    const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
    if (isSpotifyMode) {
      const pl = spotifyPlaylists.find((p) => p.uri === selectedPlaylistUri);
      return { type: "spotify" as const, title: pl?.name ?? "Playlist Spotify", subtitle: `${pl?.trackCount ?? 0} titres`, thumbnailUrl: pl?.imageUrl, mediaKey: selectedPlaylistUri ?? "spotify", date, timestamp: Date.now(), minutes };
    }
    if (isTwitchMode) {
      if (selectedVodId) return { type: "twitch-vod" as const, title: `VOD ${selectedVodId}`, subtitle: "Twitch VOD", mediaKey: `vod:${selectedVodId}`, date, timestamp: Date.now(), minutes };
      return { type: "twitch-live" as const, title: selectedChannel ?? "Twitch", subtitle: "Live Twitch", mediaKey: `live:${selectedChannel}`, date, timestamp: Date.now(), minutes };
    }
    if (isQueueMode) {
      return { type: "playlist" as const, title: "File FocusFlow", subtitle: `${queueItems.length} titre${queueItems.length > 1 ? "s" : ""}`, thumbnailUrl: queueItems[0]?.thumbnailUrl, mediaKey: "queue", date, timestamp: Date.now(), minutes };
    }
    if (isPlaylistMode && selectedPlaylist) {
      return { type: "playlist" as const, title: selectedPlaylist.title, subtitle: selectedPlaylist.channelName ?? "YouTube Playlist", thumbnailUrl: selectedPlaylist.thumbnailUrl, mediaKey: `pl:${selectedPlaylist.playlistId}`, date, timestamp: Date.now(), minutes };
    }
    return { type: "youtube" as const, title: video.title, subtitle: video.channel, thumbnailUrl: `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`, mediaKey: video.youtubeId, date, timestamp: Date.now(), minutes };
  };

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
        toast({ title: "Objectif du jour atteint", description: "Une vague de lumière traverse la ville.", accent: "emerald" });
        // Événement de ville : une vague de lumière part de la tour, une fois la halte installée.
        setTimeout(() => city.current?.goal(), 3200);
      }
    }
  };

  // ── Session end ───────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleSessionEnd = useCallback(() => {
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
    nextSession(true);
  }, [mode, nextSession, recordSession, settings.workDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevSecondsRef.current > 0 && secondsLeft === 0) handleSessionEnd();
    prevSecondsRef.current = secondsLeft;
  }, [secondsLeft, handleSessionEnd]);

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
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleDistraction = useCallback(() => {
    if (isBreakRef.current) return; // only count during focus
    markDistraction();
    setDistractionFlash((n) => n + 1); // trigger a brief visual feedback
    city.current?.flicker(); // Spotify : un quartier grésille
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
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
  const activityMedia = nowPlaying ? `${nowPlaying.title}${isSpotifyMode ? " · Spotify" : isTwitchMode ? " · Twitch" : ""}` : isSpotifyMode ? "Spotify" : isTwitchMode ? "Twitch" : "";
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

  // Un clic n'importe où réaffiche le chrome masqué manuellement (H).
  useEffect(() => {
    if (!zenHidden) return;
    const restore = () => setZenHidden(false);
    window.addEventListener("pointerdown", restore);
    return () => window.removeEventListener("pointerdown", restore);
  }, [zenHidden]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Audio/video source — YouTube, Spotify, or Twitch */}
      {isSpotifyMode ? (
        <>
          {/* Aucune vidéo avec Spotify : la ville sert de décor, le panneau
              à LED décompte les minutes. Démontée pendant la halte (qui a la
              sienne) pour ne jamais faire tourner deux scènes. */}
          {!isBreak && (
            <SessionCity
              ref={city}
              phase="work"
              board={isFlowtime ? "FLOW" : `${Math.max(1, Math.ceil(secondsLeft / 60))} MIN`}
              className="absolute inset-0"
              label="La ville la nuit derrière une vitre mouillée, décor de la session Spotify."
            />
          )}
          <SpotifyPlayer
            shouldPlay={!isBreak && isRunning}
            playlistUri={selectedPlaylistUri!}
            backdrop={false}
            controls={false}
            initialLoop={loop}
            onAdapter={setAdapter}
            onExtended={({ added }) => {
              toast({ title: "Fin de la playlist", description: `${added} titre${added > 1 ? "s" : ""} proche${added > 1 ? "s" : ""} de toute ta playlist ajouté${added > 1 ? "s" : ""} à la suite.`, accent: "emerald" });
              city.current?.extend();
            }}
          />
        </>
      ) : isTwitchMode ? (
        <TwitchPlayer
          channel={selectedChannel ?? undefined}
          vodId={selectedVodId ?? undefined}
          token={twitchToken ?? undefined}
          volume={volume}
          onAdapter={setAdapter}
        />
      ) : (
        <div
          id="yt-player"
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Vignette (work only, not on Twitch to keep natural brightness) */}
      {!isBreak && !isTwitchMode && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.45)_100%)]" />
      )}

      {/* Halo d'ambiance discret autour du lecteur (teinte du média) ; le
          changement de `key` sur skip/fin de titre déclenche une pulsation unique */}
      {!isBreak && !isTwitchMode && (
        <div
          key={`halo-${pb.track?.id ?? ""}`}
          className="absolute inset-0 pointer-events-none anim-halo-pulse"
          style={{
            boxShadow: "inset 0 0 160px 20px color-mix(in oklab, var(--ambient) 55%, transparent)",
            opacity: 0.35,
          }}
        />
      )}

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

      {/* Twitch sub-only fallback banner */}
      {isTwitchMode && !isBreak && (
        <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-10 px-3 max-w-full">
          <a
            href={
              selectedVodId
                ? `https://www.twitch.tv/videos/${selectedVodId}`
                : `https://www.twitch.tv/${selectedChannel}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-[6px] bg-black/70 backdrop-blur-md border border-[#9146ff]/30 text-white/70 hover:text-white hover:border-[#9146ff]/60 text-xs font-medium transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#9146ff]" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            Contenu réservé aux abonnés ? Ouvrir sur Twitch
            <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      )}

      {/* ── La halte (pause) : la ville s'éteint, la vue se brouille ───────── */}
      {isBreak && (
        <div className="absolute inset-0 z-20 bg-[#0b1016]">
          <SessionCity
            ref={city}
            phase="break"
            board={`${Math.max(1, Math.ceil(secondsLeft / 60))} MIN`}
            className="absolute inset-0"
            label={`La halte : la ville s'est éteinte au loin, il reste ${formatTime(secondsLeft)} de pause.`}
          />
          {/* Voile de lecture : à gauche sur grand écran, en bas sur mobile. */}
          <div aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,#0b1016_0%,rgba(11,16,22,0.86)_32%,rgba(11,16,22,0.15)_62%,transparent_80%)] max-md:bg-[linear-gradient(0deg,#0b1016_0%,rgba(11,16,22,0.9)_45%,rgba(11,16,22,0.2)_70%,transparent_85%)]" />
          <div className="relative z-10 h-full overflow-y-auto flex items-end md:items-center px-5 sm:px-10 lg:px-16 py-8">
            <div className="flex flex-col gap-6 max-w-md text-[#e9f2ff]">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#53e0a1]">{breakLabel[mode]}</p>
                <h1 className="mt-2 font-display font-extrabold uppercase text-[clamp(3rem,8vw,5.5rem)] leading-[0.88]">La halte</h1>
                <p className="mt-3 text-[15px] text-[#e9f2ff]/75">
                  {sessionsCompleted > 0 ? `Pomodoro ${sessionsCompleted} terminé. ` : ""}La ville s&apos;éteint au loin. Lève les yeux de l&apos;écran.
                </p>
              </div>
              <div>
                <p className="font-led text-[clamp(4.5rem,12vw,7.5rem)] leading-none text-[#53e0a1]" role="timer" aria-label={`Pause : ${formatTime(secondsLeft)}`}>
                  {formatTime(secondsLeft)}
                </p>
                <div className="mt-4 h-[3px] w-full max-w-[18rem] bg-[#e9f2ff]/10 rounded-[1px] overflow-hidden">
                  <div
                    className="h-full bg-[#53e0a1] origin-left"
                    style={{ transform: `scaleX(${breakTotal > 0 ? secondsLeft / breakTotal : 0})`, transition: "transform 1s linear" }}
                  />
                </div>
              </div>
              {breathingEnabled && <BreathingExercise />}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => nextSession(true)}
                  className="ff-press inline-flex items-center gap-2 h-10 px-4 rounded-[4px] border border-[#e9f2ff]/30 hover:border-[#e9f2ff]/70 text-[#e9f2ff]/85 hover:text-[#e9f2ff] text-sm transition-colors"
                >
                  Passer la pause
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path d="M5 4l15 8-15 8V4z" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="19" y1="4" x2="19" y2="20" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  onClick={handleStop}
                  className="ff-press inline-flex items-center gap-2 h-10 px-4 rounded-[4px] border border-[#ff6b5c]/40 hover:border-[#ff6b5c] text-[#ff8a7d] hover:text-[#ffb0a6] text-sm transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                  Terminer la session
                </button>
              </div>
              <button
                onClick={() => usePrefsStore.getState().setBreathingEnabled(!breathingEnabled)}
                className="self-start text-[12px] text-[#e9f2ff]/55 hover:text-[#e9f2ff]/85 underline-offset-4 hover:underline transition-colors"
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
            className="fixed bottom-20 md:bottom-6 left-3 md:left-6 z-[100] flex items-center gap-2 px-3 py-2 rounded-[6px] bg-black/70 backdrop-blur-sm border border-white/25 text-white/75 hover:text-white hover:bg-black/80 text-xs font-medium transition-all"
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
          {/* Top bar — sur mobile le timer n'est plus centré en absolu (il
              passerait sous les autres blocs) : il devient le 2e élément flex,
              aligné à droite, et les contrôles migrent en barre basse. */}
          <div className="absolute top-0 left-0 right-0 flex items-start justify-between gap-2 px-3 md:px-5 py-3 md:py-4 z-10">
            {/* Terminer + Now Playing */}
            <div className={cn("flex flex-col items-start gap-2 max-w-[calc(100%-9rem)] md:max-w-[42%] anim-cascade", chromeHideCls)}>
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 rounded-[6px] bg-black/60 backdrop-blur-sm border border-white/20 text-white/75 hover:text-[#ff8a7d] hover:border-[#ff6b5c]/50 hover:bg-[#ff6b5c]/10 text-xs font-medium transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
                Terminer
              </button>
              {nowPlaying && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-black/50 backdrop-blur-sm border border-white/10 max-w-full">
                  <Equalizer
                    playing={isRunning}
                    mood={!isQueueMode && !isPlaylistMode && !isSpotifyMode && !isTwitchMode ? video.mood : undefined}
                  />
                  {/* key = index de piste → le titre glisse à chaque changement */}
                  <div key={pb.track?.id ?? ""} className="min-w-0 anim-track-in">
                    <p className="text-white/85 text-xs font-medium truncate">{nowPlaying.title}</p>
                    <p className="text-white/60 text-[10px] truncate">{pb.extending ? "Recherche de titres proches de ta playlist…" : nowPlaying.sub}</p>
                    {pb.error && <p role="status" className="text-[#ff8a7d] text-[10px] mt-0.5">{pb.error}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Minuteur : un panneau d'affichage de quai (plaque sombre, chiffres
                à points Doto en sodium), centré sur desktop, à droite sur mobile.
                Lisible sur n'importe quelle vidéo grâce à la plaque. */}
            <div className="flex-shrink-0 md:absolute md:left-1/2 md:-translate-x-1/2 anim-cascade [animation-delay:80ms]">
              <div className="flex flex-col items-center gap-1 rounded-[4px] bg-[#05070a]/80 backdrop-blur-sm border border-white/10 px-3 md:px-4 pt-1.5 pb-1.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)]">
                <span
                  role="timer"
                  aria-label={`${isFlowtime ? "Flowtime" : "Temps restant"} : ${formatTime(isFlowtime ? flowSeconds : secondsLeft)}`}
                  className="font-led text-[26px] md:text-[34px] leading-none text-[#ff9a3c] [text-shadow:0_0_12px_rgba(255,154,60,0.45)]"
                >
                  {formatTime(isFlowtime ? flowSeconds : secondsLeft)}
                </span>
                {/* Jauge : une rangée de 25 points qui s'allument, comme le panneau. */}
                {!isFlowtime && (
                  <span aria-hidden className="flex gap-[3px]">
                    {Array.from({ length: 25 }, (_, i) => (
                      <span key={i} className={cn("w-[3px] h-[3px] rounded-[1px]", i < Math.round(progress * 25) ? "bg-[#ff9a3c]" : "bg-white/15")} />
                    ))}
                  </span>
                )}
                <span className="text-white/60 text-[10px] font-mono uppercase tracking-[0.14em] whitespace-nowrap">
                  {isFlowtime
                    ? `Flow · pause méritée ${earnedBreakMin} min`
                    : `Pomodoro ${sessionsCompleted + 1}`}
                </span>
              </div>
            </div>

            {/* Contrôles — à droite de la top bar sur desktop, barre fixe en bas
                du viewport sur mobile (atteignable au pouce, safe-area iOS). */}
            <div
              className={cn(
                "fixed bottom-0 inset-x-0 z-20 flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-md border-t border-white/10 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
                "md:static md:z-auto md:bg-transparent md:backdrop-blur-none md:border-0 md:p-0 md:pb-0",
                "anim-cascade [animation-delay:160ms]",
                chromeHideCls
              )}
            >
              {/* Utility cluster — icônes uniformes ; scroll horizontal sur mobile
                  pour que Pause/Tâches restent toujours accessibles. */}
              <div className="flex-1 min-w-0 overflow-x-auto md:flex-none md:overflow-visible flex items-center gap-1 p-1 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/15">
                {/* Playlist skip controls (YouTube playlists, mixes & file FocusFlow) */}
                {pb.caps.skip && (
                  <>
                    <button
                      onClick={() => skipTrack("prev")}
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[6px] text-white/75 hover:text-white hover:bg-white/10 transition-all"
                      title="Titre précédent"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => skipTrack("next")}
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[6px] text-white/75 hover:text-white hover:bg-white/10 transition-all"
                      title="Titre suivant"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 6h2v12h-2zM6 6v12l8.5-6z" />
                      </svg>
                    </button>
                    {/* Lecture aléatoire (file maison uniquement ; `mounted`
                        évite le flash avant réhydratation du store persisté) */}
                    {mounted && pb.caps.shuffle && (
                      <button
                        onClick={() => usePlaybackPrefsStore.getState().toggleShuffle()}
                        className={cn(
                          "w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[6px] transition-all",
                          shuffle ? "bg-white/20 text-white" : "text-white/75 hover:text-white hover:bg-white/10"
                        )}
                        title={shuffle ? "Lecture aléatoire activée" : "Activer la lecture aléatoire"}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                    {/* Boucle : off = fin de liste → titres similaires. Masqué en
                        repli lecteur natif (setLoop(true) câblé, non pilotable). */}
                    {mounted && pb.caps.loop && (
                    <button
                      onClick={() => usePlaybackPrefsStore.getState().toggleLoop()}
                      className={cn(
                        "w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[6px] transition-all",
                        loop ? "bg-white/20 text-white" : "text-white/75 hover:text-white hover:bg-white/10"
                      )}
                      title={loop ? "Boucle activée" : "Boucle désactivée : la fin de liste continue avec des titres proches de toute la playlist"}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M17 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    )}
                  </>
                )}
                {/* Distraction marker (shortcut: D) */}
                <button
                  onClick={handleDistraction}
                  className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[6px] text-white/75 hover:text-[#ff8a7d] hover:bg-[#ff6b5c]/10 transition-all"
                  title="Marquer une distraction · touche D"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {distractionCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ff6b5c] text-[#1c0604] text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {distractionCount}
                    </span>
                  )}
                  {/* Flash feedback: a floating +1 on each mark */}
                  {distractionFlash > 0 && (
                    <span
                      key={distractionFlash}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none text-[#ff8a7d] text-xs font-bold animate-[distractionPop_0.7s_ease-out_forwards]"
                    >
                      +1
                    </span>
                  )}
                </button>

                {/* Floating always-on-top mini timer (Document PiP) */}
                <PipTimer onDistraction={handleDistraction} onFlowBreak={handleFlowBreak} />

                {/* Volume : toutes les sources qui le déclarent (Spotify compris). */}
                {pb.caps.volume && (
                  <div className="relative flex items-center flex-shrink-0">
                    {/* Panneau vertical — toujours monté pour une vraie transition
                        CSS, auto-masqué après 2,5 s. S'ouvre VERS LE HAUT sur
                        mobile (la barre de contrôles est en bas de l'écran). */}
                    <div
                      onPointerMove={armVolumeHide}
                      className={cn(
                        "absolute bottom-full mb-2 md:bottom-auto md:top-full md:mb-0 md:mt-2 right-0 w-9 h-28 flex items-center justify-center rounded-[6px] bg-black/70 backdrop-blur-sm border border-white/15 shadow-lg shadow-black/40 transition-[opacity,transform] duration-300",
                        showVolume
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-1 md:-translate-y-1 pointer-events-none"
                      )}
                    >
                      <input
                        type="range"
                        min={0} max={1} step={0.05}
                        value={volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        tabIndex={showVolume ? 0 : -1}
                        aria-label="Volume de la vidéo"
                        className="h-20 accent-white cursor-pointer"
                        style={{ writingMode: "vertical-lr", direction: "rtl" }}
                      />
                    </div>
                    <button
                      onClick={() => setShowVolume((v) => { const next = !v; if (next) armVolumeHide(); return next; })}
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[6px] text-white/75 hover:text-white hover:bg-white/10 transition-all"
                      title="Volume de la vidéo"
                    >
                      {volume === 0 ? (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                          <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
                          <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}

                {/* Twitch shortcut */}
                {isTwitchMode && (
                  <a
                    href={selectedVodId ? `https://www.twitch.tv/videos/${selectedVodId}` : `https://www.twitch.tv/${selectedChannel}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[6px] text-white/75 hover:text-[#9146ff] hover:bg-[#9146ff]/10 transition-all"
                    title="Ouvrir sur Twitch"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                    </svg>
                  </a>
                )}

                {/* Help / info */}
                <button
                  onClick={() => setShowHelp((v) => !v)}
                  className={cn(
                    "w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[6px] transition-all",
                    showHelp ? "bg-white/20 text-white" : "text-white/75 hover:text-white hover:bg-white/10"
                  )}
                  title="Aide & raccourcis"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Flowtime: end the stretch and take the earned break */}
              {isFlowtime && (
                <button
                  onClick={handleFlowBreak}
                  className="flex-shrink-0 flex items-center gap-2 px-3 md:px-4 py-2 rounded-[4px] bg-[#53e0a1]/15 backdrop-blur-md border border-[#53e0a1]/45 text-[#bff5dc] text-xs font-semibold transition-all hover:bg-[#53e0a1]/25 shadow-lg shadow-black/30"
                  title={`Terminer ce flow et prendre ${earnedBreakMin} min de pause`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="6" y1="1" x2="6" y2="4" strokeLinecap="round" /><line x1="10" y1="1" x2="10" y2="4" strokeLinecap="round" /><line x1="14" y1="1" x2="14" y2="4" strokeLinecap="round" />
                  </svg>
                  <span className="hidden sm:inline">Pause méritée ({earnedBreakMin} min)</span>
                  <span className="sm:hidden">{earnedBreakMin} min</span>
                </button>
              )}

              {/* Pause / Resume — primary (shortcut: Espace) */}
              <button
                onClick={isRunning ? pause : start}
                className="flex-shrink-0 flex items-center gap-2 px-4 md:px-5 py-2.5 md:py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white text-sm font-semibold transition-all hover:bg-white/30 shadow-lg shadow-black/30"
                title={isRunning ? "Mettre en pause · Espace" : "Reprendre · Espace"}
              >
                {isRunning ? (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Reprendre
                  </>
                )}
              </button>

              {/* Tâches — primary */}
              <button
                onClick={() => setShowTodos((v) => !v)}
                className="flex-shrink-0 relative flex items-center gap-1.5 px-3 md:px-4 py-2.5 md:py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 text-white text-xs font-semibold transition-all hover:bg-white/25"
                title="Afficher / masquer les tâches"
              >
                <svg className="w-4 h-4 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" strokeLinecap="round" />
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* Libellé complet sur desktop ; sur mobile un simple compteur
                    (la place est réservée à Pause, l'action primaire). */}
                <span className="hidden md:inline">
                  {pendingTodos.length > 0 ? `${pendingTodos.length} tâche${pendingTodos.length > 1 ? "s" : ""}` : "Tâches"}
                </span>
                {pendingTodos.length > 0 && (
                  <span className="md:hidden tabular-nums">{pendingTodos.length}</span>
                )}
              </button>
            </div>
          </div>

          {/* ── Help panel ─────────────────────────────────────────────────── */}
          {showHelp && (
            <div className="absolute top-20 right-3 md:right-5 w-80 max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-y-auto bg-black/85 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl shadow-black/80 z-30">
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
                  À chaque fois que tu décroches, clique ou appuie sur <b className="text-white/80">D</b> pour la noter. Rien n&apos;est détecté tout seul — c&apos;est toi qui marques. Moins tu en as, meilleur est ton <b className="text-white/80">Focus Score</b> en fin de session.
                </HelpRow>
                <HelpRow icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 4v16M18 4v16" strokeLinecap="round" strokeLinejoin="round" /></svg>} title="Pause / Reprise (Espace)">
                  Met en pause le timer et la vidéo. Le raccourci <b className="text-white/80">Espace</b> fait pareil.
                </HelpRow>
                <HelpRow icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" /></svg>} title="Mode zen (touche H)">
                  Les contrôles s&apos;effacent après 4 s sans bouger la souris — il ne reste que la vidéo et le timer. <b className="text-white/80">H</b> les masque manuellement (re-appuie ou clique pour les réafficher).
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
              "absolute inset-x-3 bottom-[4.5rem] max-h-[55vh] overflow-y-auto",
              "md:inset-x-auto md:right-6 md:bottom-6 md:w-[32rem] md:max-w-[calc(100vw-3rem)] md:max-h-none md:overflow-visible",
              "bg-black/85 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl shadow-black/80 z-10 p-4",
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
