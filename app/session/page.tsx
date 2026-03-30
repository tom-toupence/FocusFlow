"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTimerStore, TimerMode } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useSessionSummaryStore } from "@/store/sessionSummaryStore";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useStatsStore } from "@/store/statsStore";
import { useNotesStore } from "@/store/notesStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";
import StickyNote from "@/components/StickyNote";
import SpotifyPlayer from "@/components/SpotifyPlayer";
import TwitchPlayer from "@/components/TwitchPlayer";
import TodoStatusDropdown from "@/components/TodoStatusDropdown";
import { playBreakChime, playWorkChime } from "@/lib/sounds";

// ─── YouTube IFrame API types ─────────────────────────────────────────────────

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
  setPlaybackQuality: (q: string) => void;
  setVolume: (v: number) => void;
}

declare global {
  interface Window {
    YT: { Player: new (id: string, cfg: object) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

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
    tick, start, pause, nextSession,
  } = useTimerStore();
  const { selectedVideoId, selectedPlaylistId, todos, addTodo, setTodoStatus, getAllVideos } = useSessionStore();
  const { playlists } = usePlaylistStore();
  const { recordSession } = useStatsStore();
  const { startSession } = useSessionSummaryStore();
  const { notes, addNote } = useNotesStore();
  const { selectedPlaylistUri, accessToken, playlists: spotifyPlaylists } = useSpotifyStore();
  const { selectedChannel, selectedVodId, accessToken: twitchToken } = useTwitchStore();
  const { record: recordPlay } = usePlayHistoryStore();

  const allVideos = getAllVideos();
  const video = allVideos.find((v) => v.id === selectedVideoId) ?? allVideos[0];
  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) ?? null;
  const isPlaylistMode = !!selectedPlaylistId && !!selectedPlaylist;
  const isSpotifyMode = !!selectedPlaylistUri && !!accessToken;
  const isTwitchMode = !!selectedChannel || !!selectedVodId;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSecondsRef = useRef(secondsLeft);
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);
  const isBreakRef = useRef(mode !== "work");
  const isRunningRef = useRef(isRunning);
  const [todoInput, setTodoInput] = useState("");
  const [showTodos, setShowTodos] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [showVolume, setShowVolume] = useState(false);
  const volumeRef = useRef(0.8);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isBreak = mode !== "work";
  const isLong = mode === "long-break";

  // Keep refs in sync for use inside IFrame API callbacks
  useEffect(() => { isBreakRef.current = isBreak; }, [isBreak]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  // ── Chime sounds on mode transitions ─────────────────────────────────────
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    if (mode !== "work") {
      playBreakChime();
    } else {
      playWorkChime();
    }
    prevModeRef.current = mode;
  }, [mode]);

  // ── Record session start ─────────────────────────────────────────────────
  useEffect(() => {
    const doneTodoIds = todos.filter((t) => t.status === "done").map((t) => t.id);
    startSession(settings.workDuration, doneTodoIds);
    start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fullscreen ───────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);

  // ── Notifications ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── YouTube IFrame API ────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const initPlayer = useCallback(() => {
    if (!window.YT?.Player || playerRef.current) return;

    const onReady = (e: { target: YTPlayer }) => {
      playerReadyRef.current = true;
      e.target.setPlaybackQuality("hd1080");
      e.target.setVolume(Math.round(volumeRef.current * 100));
      if (!isBreakRef.current && isRunningRef.current) {
        e.target.playVideo();
      } else {
        e.target.pauseVideo();
      }
    };

    if (isPlaylistMode && selectedPlaylist) {
      // Mode playlist : YouTube enchaîne les vidéos automatiquement
      playerRef.current = new window.YT.Player("yt-player", {
        playerVars: {
          autoplay: 1,
          mute: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          listType: "playlist",
          list: selectedPlaylist.playlistId,
          loop: 1,
        },
        events: { onReady },
      });
    } else {
      // Mode vidéo unique : loop sur la même vidéo
      playerRef.current = new window.YT.Player("yt-player", {
        videoId: video.youtubeId,
        playerVars: {
          autoplay: 1,
          mute: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          showinfo: 0,
          loop: 1,
          playlist: video.youtubeId,
          suggestedQuality: "hd1080",
        },
        events: { onReady },
      });
    }
  }, [video?.youtubeId, isPlaylistMode, selectedPlaylist?.playlistId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isSpotifyMode || isTwitchMode) return;

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        initPlayer();
      };
      // Fallback poll in case callback was already fired before we set it
      pollInterval = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(pollInterval!);
          pollInterval = null;
          initPlayer();
        }
      }, 100);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      playerRef.current?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
    };
  }, [initPlayer, isSpotifyMode, isTwitchMode]);

  // ── Control video playback ────────────────────────────────────────────────
  useEffect(() => {
    if (isSpotifyMode || isTwitchMode) return;
    if (!playerReadyRef.current || !playerRef.current) return;
    if (!isBreak && isRunning) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isBreak, isRunning, isSpotifyMode, isTwitchMode]);

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
    if (isPlaylistMode && selectedPlaylist) {
      return { type: "playlist" as const, title: selectedPlaylist.title, subtitle: selectedPlaylist.channelName ?? "YouTube Playlist", thumbnailUrl: selectedPlaylist.thumbnailUrl, mediaKey: `pl:${selectedPlaylist.playlistId}`, date, timestamp: Date.now(), minutes };
    }
    return { type: "youtube" as const, title: video.title, subtitle: video.channel, thumbnailUrl: `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`, mediaKey: video.youtubeId, date, timestamp: Date.now(), minutes };
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
      recordSession(settings.workDuration);
      recordPlay(buildPlayEntry(settings.workDuration));
    }
    nextSession(true);
  }, [mode, nextSession, recordSession, settings.workDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevSecondsRef.current > 0 && secondsLeft === 0) handleSessionEnd();
    prevSecondsRef.current = secondsLeft;
  }, [secondsLeft, handleSessionEnd]);

  // ── Stop → Summary ────────────────────────────────────────────────────────
  const handleStop = () => {
    pause();
    // Record partial work time if we were mid-session
    if (mode === "work") {
      const secondsWorked = settings.workDuration * 60 - secondsLeft;
      const minutesWorked = Math.round(secondsWorked / 60);
      if (minutesWorked >= 1) {
        recordSession(minutesWorked);
        recordPlay(buildPlayEntry(minutesWorked));
      }
    }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    router.push("/summary");
  };

  // ── Todo ──────────────────────────────────────────────────────────────────
  const handleAddTodo = () => {
    const t = todoInput.trim();
    if (!t) return;
    addTodo(t);
    setTodoInput("");
  };

  const handleVolumeChange = (v: number) => {
    setVolumeState(v);
    volumeRef.current = v;
    if (!isSpotifyMode && !isTwitchMode && playerRef.current && playerReadyRef.current) {
      playerRef.current.setVolume(Math.round(v * 100));
    }
  };

  const progress = (() => {
    const total =
      mode === "work" ? settings.workDuration * 60
      : mode === "short-break" ? settings.shortBreakDuration * 60
      : settings.longBreakDuration * 60;
    return total > 0 ? 1 - secondsLeft / total : 0;
  })();

  const breakTotal =
    mode === "long-break"
      ? settings.longBreakDuration * 60
      : settings.shortBreakDuration * 60;

  const pendingTodos = todos.filter((t) => t.status !== "done");
  const doneTodos = todos.filter((t) => t.status === "done");

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Audio/video source — YouTube, Spotify, or Twitch */}
      {isSpotifyMode ? (
        <SpotifyPlayer
          shouldPlay={!isBreak && isRunning}
          playlistUri={selectedPlaylistUri!}
        />
      ) : isTwitchMode ? (
        <TwitchPlayer
          channel={selectedChannel ?? undefined}
          vodId={selectedVodId ?? undefined}
          token={twitchToken ?? undefined}
          volume={volume}
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

      {/* Twitch sub-only fallback banner */}
      {isTwitchMode && !isBreak && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <a
            href={
              selectedVodId
                ? `https://www.twitch.tv/videos/${selectedVodId}`
                : `https://www.twitch.tv/${selectedChannel}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/70 backdrop-blur-md border border-[#9146ff]/30 text-white/70 hover:text-white hover:border-[#9146ff]/60 text-xs font-medium transition-all"
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

      {/* ── Break overlay ──────────────────────────────────────────────────── */}
      {isBreak && (
        <div className="absolute inset-0 z-20 bg-[#0a0a0c]/95 flex flex-col items-center justify-center gap-8">
          <div
            className={cn(
              "absolute inset-0 opacity-20 pointer-events-none",
              isLong
                ? "bg-[radial-gradient(ellipse_at_center,_#1a3a5f_0%,_transparent_70%)]"
                : "bg-[radial-gradient(ellipse_at_center,_#1a3b2a_0%,_transparent_70%)]"
            )}
          />
          {/* Label */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div className={cn("text-xs font-semibold uppercase tracking-[0.2em]", isLong ? "text-sky-400" : "text-emerald-400")}>
              {breakLabel[mode]}
            </div>
            <h1 className="text-5xl font-thin text-white/90 tracking-tight">Repose-toi</h1>
            <p className="text-white/30 text-sm mt-1">
              Session {sessionsCompleted} terminée — bien joué.
            </p>
          </div>
          {/* Countdown */}
          <div className={cn("text-8xl font-extralight tabular-nums tracking-tighter z-10", isLong ? "text-sky-300" : "text-emerald-300")}>
            {formatTime(secondsLeft)}
          </div>
          {/* Progress bar */}
          <div className="w-48 h-0.5 bg-white/10 rounded-full z-10 overflow-hidden">
            <div
              className={cn("h-full rounded-full", isLong ? "bg-sky-400" : "bg-emerald-400")}
              style={{ width: `${breakTotal > 0 ? (secondsLeft / breakTotal) * 100 : 0}%`, transition: "width 1s linear" }}
            />
          </div>
          {/* Buttons */}
          <div className="flex items-center gap-4 z-10">
            <button
              onClick={() => nextSession(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white text-xs font-medium transition-all"
            >
              Passer la pause
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 4l15 8-15 8V4z" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="19" y1="4" x2="19" y2="20" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400/70 hover:text-red-400 text-xs font-medium transition-all"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
              Terminer la session
            </button>
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
            className="fixed bottom-6 left-6 z-[100] flex items-center gap-2 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-sm border border-white/25 text-white/75 hover:text-white hover:bg-black/80 text-xs font-medium transition-all"
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
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4 z-10">
            {/* Terminer */}
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm border border-white/20 text-white/75 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 text-xs font-medium transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
              Terminer
            </button>

            {/* Timer — centered */}
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
              <div className="w-36 h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/50 rounded-full"
                  style={{ width: `${progress * 100}%`, transition: "width 1s linear" }}
                />
              </div>
              <span className="text-3xl font-light text-white tabular-nums tracking-tight drop-shadow-lg">
                {formatTime(secondsLeft)}
              </span>
              <span className="text-white/30 text-[10px] uppercase tracking-widest">
                Focus · {sessionsCompleted} session{sessionsCompleted !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {isTwitchMode && (
                <a
                  href={
                    selectedVodId
                      ? `https://www.twitch.tv/videos/${selectedVodId}`
                      : `https://www.twitch.tv/${selectedChannel}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-sm border border-white/20 text-white/60 hover:text-[#9146ff] hover:border-[#9146ff]/40 text-xs font-medium transition-all"
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                  Twitch
                </a>
              )}

              {/* Volume (YouTube & Twitch only — Spotify has its own) */}
              {!isSpotifyMode && (
                <div className="relative flex items-center">
                  {showVolume && (
                    <input
                      type="range"
                      min={0} max={1} step={0.05}
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="absolute right-full mr-2 w-20 h-1 accent-white cursor-pointer"
                    />
                  )}
                  <button
                    onClick={() => setShowVolume((v) => !v)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm border border-white/20 text-white/75 hover:text-white transition-all"
                    title="Volume"
                  >
                    {volume === 0 ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
                        <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                </div>
              )}

              {/* Pause / Resume — prominent */}
              <button
                onClick={isRunning ? pause : start}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white text-sm font-semibold transition-all hover:bg-white/30 shadow-lg shadow-black/30"
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

              {/* Tâches */}
              <button
                onClick={() => setShowTodos((v) => !v)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/30 text-white text-xs font-semibold transition-all hover:bg-white/25"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" strokeLinecap="round" />
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {pendingTodos.length > 0 ? `${pendingTodos.length} tâche${pendingTodos.length > 1 ? "s" : ""}` : "Tâches"}
              </button>
            </div>
          </div>

          {/* Tasks panel */}
          {showTodos && (
            <div className="absolute bottom-6 right-6 w-72 bg-black/85 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl shadow-black/80 overflow-hidden z-10">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">Tâches</span>
                {todos.length > 0 && (
                  <span className="text-[11px] text-white/40">{doneTodos.length}/{todos.length} faites</span>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {todos.length === 0 && (
                  <p className="text-white/30 text-xs text-center py-6">Aucune tâche pour cette session</p>
                )}
                {pendingTodos.map((todo) => (
                  <div key={todo.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors">
                    <TodoStatusDropdown
                      status={todo.status}
                      onChange={(s) => setTodoStatus(todo.id, s)}
                      dark
                    />
                    <span className="flex-1 text-sm text-white min-w-0 truncate">{todo.text}</span>
                  </div>
                ))}
                {doneTodos.length > 0 && (
                  <>
                    {pendingTodos.length > 0 && <div className="h-px bg-white/[0.08] mx-4 my-1" />}
                    {doneTodos.map((todo) => (
                      <div key={todo.id} className="flex items-center gap-3 px-4 py-2.5">
                        <TodoStatusDropdown
                          status={todo.status}
                          onChange={(s) => setTodoStatus(todo.id, s)}
                          dark
                        />
                        <span className="flex-1 text-sm text-white/30 line-through min-w-0 truncate">{todo.text}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="border-t border-white/10 px-3 py-2.5 flex gap-2">
                <Input
                  value={todoInput}
                  onChange={(e) => setTodoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                  placeholder="Nouvelle tâche..."
                  className="flex-1 h-8 bg-white/8 border-white/15 text-white placeholder:text-white/30 text-sm rounded-lg focus-visible:ring-white/20"
                />
                <button
                  onClick={handleAddTodo}
                  disabled={!todoInput.trim()}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-20 text-white transition-colors flex-shrink-0"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
