"use client";

import { useState, KeyboardEvent } from "react";
import TodoStatusDropdown from "@/components/TodoStatusDropdown";
import { useRouter } from "next/navigation";
import { useTimerStore, TimerPreset, PRESETS } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useNotesStore } from "@/store/notesStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { getVideoColor } from "@/data/videos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const presetConfig = [
  {
    id: "classic" as TimerPreset,
    label: "Classic",
    sub: "25 min / 5 min",
    desc: "Le format Pomodoro original. Idéal pour des tâches variées.",
    icon: (
      <svg className="w-5 h-5 text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "deep" as TimerPreset,
    label: "Deep Work",
    sub: "50 min / 10 min",
    desc: "Blocs longs pour entrer en concentration profonde.",
    icon: (
      <svg className="w-5 h-5 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "custom" as TimerPreset,
    label: "Personnalisé",
    sub: "À toi de définir",
    desc: "Choisis tes propres durées.",
    icon: (
      <svg className="w-5 h-5 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-foreground/[0.06] last:border-0">
      <span className="text-sm text-foreground/70">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - (label.includes("Sessions") ? 1 : 5)))}
          className="w-7 h-7 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground/70 flex items-center justify-center transition-colors text-sm font-medium"
        >
          −
        </button>
        <span className="text-sm font-medium text-foreground tabular-nums w-10 text-center">
          {label.includes("Sessions") ? value : `${value}m`}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + (label.includes("Sessions") ? 1 : 5)))}
          className="w-7 h-7 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground/70 flex items-center justify-center transition-colors text-sm font-medium"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { settings, applyPreset, updateSettings, resetAll } = useTimerStore();
  const { selectedVideoId, selectedPlaylistId, getAllVideos } = useSessionStore();
  const { playlists } = usePlaylistStore();
  const { selectedPlaylistUri, playlists: spotifyPlaylists } = useSpotifyStore();
  const { selectedChannel, selectedVodId } = useTwitchStore();

  const [preset, setPreset] = useState<TimerPreset>(settings.preset ?? "classic");
  const [work, setWork] = useState(settings.workDuration);
  const [shortBreak, setShortBreak] = useState(settings.shortBreakDuration);
  const [longBreak, setLongBreak] = useState(settings.longBreakDuration);
  const [sessions, setSessions] = useState(settings.sessionsBeforeLongBreak);

  const { todos, addTodo, setTodoStatus, deleteTodo } = useSessionStore();
  const [todoInput, setTodoInput] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);

  const activeTodos = todos.filter((t) => t.status !== "done");
  const inProgressTodos = activeTodos.filter((t) => t.status === "in-progress");

  const allVideos = getAllVideos();
  const video = allVideos.find((v) => v.id === selectedVideoId) ?? allVideos[0];
  const playlist = playlists.find((p) => p.id === selectedPlaylistId) ?? null;
  const isPlaylistMode = !!selectedPlaylistId && !!playlist;
  const spotifyPlaylist = spotifyPlaylists.find((p) => p.uri === selectedPlaylistUri) ?? null;
  const isSpotifyMode = !!selectedPlaylistUri && !!spotifyPlaylist;
  const isTwitchMode = !!selectedChannel || !!selectedVodId;
  const [imgError, setImgError] = useState(false);

  const handleAddTodo = () => {
    const t = todoInput.trim();
    if (!t) return;
    addTodo(t);
    setTodoInput("");
  };

  const handleTodoKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddTodo();
  };

  const handlePresetSelect = (p: TimerPreset) => {
    setPreset(p);
    if (p !== "custom") {
      const vals = PRESETS[p];
      setWork(vals.workDuration);
      setShortBreak(vals.shortBreakDuration);
      setLongBreak(vals.longBreakDuration);
      setSessions(vals.sessionsBeforeLongBreak);
    }
  };

  const applyTimerSettings = () => {
    if (preset !== "custom") {
      applyPreset(preset);
    } else {
      updateSettings({ workDuration: work, shortBreakDuration: shortBreak, longBreakDuration: longBreak, sessionsBeforeLongBreak: sessions });
    }
    resetAll();
  };

  const handleStart = () => {
    applyTimerSettings();
    if (activeTodos.length > 0) {
      setShowResumeModal(true);
      return;
    }
    useSessionStore.getState().clearDone();
    useNotesStore.getState().clearAll();
    router.push("/session");
  };

  type StartMode = "keep" | "reset-inprogress" | "clear-all";

  const startSession = (mode: StartMode) => {
    if (mode === "reset-inprogress") {
      inProgressTodos.forEach((t) => setTodoStatus(t.id, "todo"));
    } else if (mode === "clear-all") {
      activeTodos.forEach((t) => deleteTodo(t.id));
    }
    useSessionStore.getState().clearDone();
    useNotesStore.getState().clearAll();
    setShowResumeModal(false);
    router.push("/session");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Modal : reprendre les tâches en cours ──────────────────────── */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/70 backdrop-blur-sm">
          <div className="bg-background border border-foreground/10 rounded-2xl shadow-2xl shadow-black/20 w-full max-w-sm p-6 flex flex-col gap-5">
            {/* Icon + title */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 8v4l3 3" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="9"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Tâches en cours</h2>
                <p className="text-xs text-foreground/45 mt-0.5 leading-relaxed">
                  Tu as {activeTodos.length} tâche{activeTodos.length > 1 ? "s" : ""} active{activeTodos.length > 1 ? "s" : ""}. Comment veux-tu les gérer ?
                </p>
              </div>
            </div>

            {/* Task list */}
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto -mx-1 px-1">
              {activeTodos.map((t) => (
                <div key={t.id} className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  t.status === "in-progress"
                    ? "bg-amber-500/5 border-amber-500/10"
                    : "bg-foreground/[0.03] border-foreground/[0.06]"
                )}>
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    t.status === "in-progress" ? "bg-amber-400" : "bg-foreground/30"
                  )} />
                  <span className="text-xs text-foreground/70 truncate">{t.text}</span>
                  {t.status === "in-progress" && (
                    <span className="ml-auto text-[10px] text-amber-500/70 flex-shrink-0">En cours</span>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => startSession("keep")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground/10 hover:bg-foreground/15 border border-foreground/10 text-foreground text-sm font-semibold transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 4l15 8-15 8V4z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Continuer avec ces tâches
              </button>
              {inProgressTodos.length > 0 && (
                <button
                  onClick={() => startSession("reset-inprogress")}
                  className="w-full py-2.5 rounded-xl bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/15 text-amber-600 dark:text-amber-400 text-sm font-medium transition-all"
                >
                  Remettre les En cours À faire
                </button>
              )}
              <button
                onClick={() => startSession("clear-all")}
                className="w-full py-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground/60 text-sm font-medium transition-all"
              >
                Démarrer sans tâches
              </button>
              <button
                onClick={() => setShowResumeModal(false)}
                className="w-full py-2 text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-14 flex items-center px-6 border-b border-foreground/[0.06]">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-foreground/40 hover:text-foreground/80 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>
        <span className="text-sm font-semibold text-foreground/80 tracking-tight mx-auto">Configuration</span>
        <div className="w-16" />
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-0 max-w-4xl mx-auto w-full px-6 py-8 gap-8">
        {/* Left: selected content */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-3">
            {isTwitchMode ? "Stream Twitch" : isSpotifyMode ? "Playlist Spotify" : isPlaylistMode ? "Playlist choisie" : "Vidéo choisie"}
          </p>
          <div className="rounded-xl overflow-hidden aspect-video relative">
            {isTwitchMode ? (
              <>
                <div className="w-full h-full bg-gradient-to-br from-[#1a0a3a] to-[#0d0d1a] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#9146ff]/30" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white text-xs font-medium line-clamp-1">
                    {selectedChannel ?? `VOD ${selectedVodId}`}
                  </p>
                  <p className="text-white/40 text-[10px]">
                    {selectedChannel ? "Stream en direct" : "Rediffusion"}
                  </p>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-[#9146ff]/20 text-[#9146ff]">
                    {selectedChannel ? "Live" : "VOD"}
                  </span>
                </div>
              </>
            ) : isSpotifyMode ? (
              <>
                {spotifyPlaylist!.imageUrl && !imgError ? (
                  <img
                    src={spotifyPlaylist!.imageUrl}
                    alt={spotifyPlaylist!.name}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1a3a1a] to-[#111] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#1db954]/30" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white text-xs font-medium line-clamp-1">{spotifyPlaylist!.name}</p>
                  {spotifyPlaylist!.trackCount > 0 && (
                    <p className="text-white/40 text-[10px]">{spotifyPlaylist!.trackCount} titres</p>
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-[#1db954]/20 text-[#1db954]">
                    Spotify
                  </span>
                </div>
              </>
            ) : isPlaylistMode ? (
              <>
                {playlist.thumbnailUrl && !imgError ? (
                  <img
                    src={playlist.thumbnailUrl}
                    alt={playlist.title}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-900/60 to-indigo-900/60 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" strokeLinecap="round" />
                      <path d="M9 12h6M9 16h4" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white text-xs font-medium line-clamp-1">{playlist.title}</p>
                  {playlist.channelName && (
                    <p className="text-white/40 text-[10px]">{playlist.channelName}</p>
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-violet-500/30 text-violet-200">
                    Playlist
                  </span>
                </div>
              </>
            ) : (
              <>
                {!imgError ? (
                  <img
                    src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${getVideoColor(video)} 0%, #0d0d0f 100%)` }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white text-xs font-medium line-clamp-1">{video.title}</p>
                  <p className="text-white/40 text-[10px]">{video.channel}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: settings */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Preset selector */}
          <div>
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-3">Format Pomodoro</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {presetConfig.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  className={cn(
                    "flex flex-col gap-1 p-4 rounded-xl border text-left transition-all duration-200",
                    preset === p.id
                      ? "border-foreground/30 bg-foreground/10"
                      : "border-foreground/[0.08] bg-foreground/[0.02] hover:border-foreground/15 hover:bg-foreground/5"
                  )}
                >
                  <span className="mb-0.5">{p.icon}</span>
                  <span className="text-sm font-semibold text-foreground">{p.label}</span>
                  <span className="text-xs font-medium text-foreground/50">{p.sub}</span>
                  <span className="text-xs text-foreground/30 leading-relaxed">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom settings */}
          <div className={cn("transition-all duration-300", preset !== "custom" && "opacity-40 pointer-events-none")}>
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-3">Durées</p>
            <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] px-4">
              <NumberInput label="Durée de focus" value={work} min={5} max={120} onChange={setWork} />
              <NumberInput label="Pause courte" value={shortBreak} min={1} max={30} onChange={setShortBreak} />
              <NumberInput label="Pause longue" value={longBreak} min={5} max={60} onChange={setLongBreak} />
              <NumberInput label="Sessions avant pause longue" value={sessions} min={2} max={8} onChange={setSessions} />
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-2 text-xs text-foreground/30">
            <span>{work} min focus</span>
            <span>·</span>
            <span>{shortBreak} min pause</span>
            <span>·</span>
            <span>Pause longue après {sessions} sessions</span>
          </div>

          {/* Tasks */}
          <div>
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-3">
              Tâches de la session
              {todos.length > 0 && <span className="ml-2 text-foreground/20 normal-case font-normal">{todos.filter(t => t.status !== "done").length} à faire</span>}
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={handleTodoKey}
                placeholder="Qu'est-ce que tu veux accomplir ?"
                className="flex-1 bg-foreground/5 border-foreground/10 text-foreground placeholder:text-foreground/25 focus-visible:ring-foreground/20 rounded-xl text-sm h-10"
              />
              <button
                onClick={handleAddTodo}
                disabled={!todoInput.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/10 hover:bg-foreground/15 disabled:opacity-20 text-foreground transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {activeTodos.length > 0 && (
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
                {activeTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-foreground/[0.03] group"
                  >
                    <TodoStatusDropdown
                      status={todo.status}
                      onChange={(s) => setTodoStatus(todo.id, s)}
                    />
                    <span className="flex-1 text-xs text-foreground/75">
                      {todo.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 text-foreground/25 hover:text-foreground/60 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start button */}
          <button
            onClick={handleStart}
            className="flex items-center justify-center gap-2 py-3.5 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 transition-all shadow-lg shadow-black/30"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Démarrer la session
          </button>
        </div>
      </main>
    </div>
  );
}
