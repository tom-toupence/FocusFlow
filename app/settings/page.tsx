"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useTimerStore, TimerPreset, PRESETS } from "@/store/timerStore";
import { useSessionStore, Todo, TodoPriority } from "@/store/sessionStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useNotesStore } from "@/store/notesStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { getVideoColor } from "@/data/videos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import CoachModal from "@/components/CoachModal";
import { useExpandNavigate } from "@/lib/useExpandNavigate";
import RoutineSaveModal from "@/components/RoutineSaveModal";
import { PlannedTask } from "@/lib/coach";
import { Button } from "@/components/ff/Button";
import { Modal } from "@/components/ff/Modal";
import { IconPlay } from "@/components/ff/icons";

// Chaque format se lit comme un CYCLE : longueur d'eau (travail) puis
// longueur de pause, à la même échelle. Pas d'icône décorative.
const presetConfig = [
  { id: "classic" as TimerPreset, label: "Classique", sub: "25 / 5", desc: "Le Pomodoro original. Bon pour des tâches variées.", work: 25, rest: 5 },
  { id: "deep" as TimerPreset, label: "Deep Work", sub: "50 / 10", desc: "Des blocs longs pour entrer dans un sujet difficile.", work: 50, rest: 10 },
  { id: "flowtime" as TimerPreset, label: "Flowtime", sub: "sans trait", desc: "Tu travailles tant que ça tient. Pause = temps passé ÷ 5.", work: 0, rest: 0 },
  { id: "custom" as TimerPreset, label: "Personnalisé", sub: "tes durées", desc: "Règle chaque durée ci-dessous.", work: -1, rest: -1 },
];

/** Diagramme du cycle : eau (travail) puis filet sodium (pause), échelle 60 min. */
function CycleShape({ work, rest, customWork, customRest }: { work: number; rest: number; customWork: number; customRest: number }) {
  const w = work < 0 ? customWork : work;
  const r = rest < 0 ? customRest : rest;
  if (work === 0) {
    return (
      <span aria-hidden className="flex items-center h-2 w-full">
        <span className="h-2 flex-1 rounded-l-[2px] bg-[linear-gradient(90deg,var(--water)_70%,transparent)]" />
      </span>
    );
  }
  const scale = 70;
  return (
    <span aria-hidden className="flex items-center gap-[3px] h-2 w-full">
      <span className="h-2 rounded-[2px] bg-water" style={{ width: `${Math.min(100, (w / scale) * 100)}%` }} />
      <span className="h-[2px] bg-sodium" style={{ width: `${Math.min(30, (r / scale) * 100)}%` }} />
    </span>
  );
}


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
      <span className="text-sm text-ink-2">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - (label.includes("Sessions") ? 1 : 5)))}
          className="w-7 h-7 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-ink-2 flex items-center justify-center transition-colors text-sm font-medium"
        >
          −
        </button>
        <span className="text-sm font-medium text-foreground tabular-nums w-10 text-center">
          {label.includes("Sessions") ? value : `${value}m`}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + (label.includes("Sessions") ? 1 : 5)))}
          className="w-7 h-7 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-ink-2 flex items-center justify-center transition-colors text-sm font-medium"
        >
          +
        </button>
      </div>
    </div>
  );
}

const PRIORITY_DOT: Record<TodoPriority, string> = {
  urgent: "bg-danger",
  normal: "bg-sodium",
  low:    "bg-foreground/20",
};

// Une carte = une tâche. Le statut est donné par la colonne ; la carte peut
// être déplacée dans les deux sens (← recule, action principale avance).
function KanbanCard({
  todo,
  onStatus,
  onDelete,
}: {
  todo: Todo;
  onStatus: (s: import("@/store/sessionStore").TodoStatus) => void;
  onDelete: () => void;
}) {
  const back =
    todo.status === "in-progress"
      ? { target: "todo" as const, title: "Remettre à faire" }
      : todo.status === "done"
      ? { target: "in-progress" as const, title: "Remettre en cours" }
      : null;

  const advance =
    todo.status === "todo"
      ? { label: "Commencer →", target: "in-progress" as const, cls: "text-sodium-text dark:text-sodium-text bg-sodium/10 hover:bg-sodium/20" }
      : todo.status === "in-progress"
      ? { label: "Terminer →", target: "done" as const, cls: "text-sodium-text dark:text-sodium-text bg-sodium/10 hover:bg-sodium/20" }
      : { label: "↺ À faire", target: "todo" as const, cls: "text-ink-3 bg-foreground/5 hover:bg-foreground/10" };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", todo.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-background border border-foreground/[0.08] shadow-sm hover:border-foreground/20 transition-colors cursor-grab active:cursor-grabbing",
        todo.status === "done" && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", PRIORITY_DOT[todo.priority ?? "normal"])} />
        <span className={cn(
          "flex-1 text-sm text-ink leading-snug min-w-0 break-words",
          todo.status === "done" && "line-through text-ink-3"
        )}>
          {todo.text}
        </span>
        <button
          onClick={onDelete}
          className="sm:opacity-0 sm:group-hover:opacity-100 text-ink-3 sm:text-ink-3 hover:text-danger transition-all flex-shrink-0 mt-0.5 p-1 -m-1"
          title="Supprimer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        {(todo.pomodoroEstimate ?? 0) > 0 && (
          <span className="text-[10px] text-ink-3 tabular-nums flex items-center gap-1" title="Pomodoros">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {(todo.pomodorosUsed ?? 0) > 0 ? `${todo.pomodorosUsed}/` : ""}{todo.pomodoroEstimate}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {back && (
            <button
              onClick={() => onStatus(back.target)}
              title={back.title}
              className="text-[11px] font-medium px-2 py-1 rounded-lg text-ink-3 bg-foreground/5 hover:bg-foreground/10 hover:text-ink-2 transition-all"
            >
              ←
            </button>
          )}
          {todo.status === "todo" && (
            <button
              onClick={() => onStatus("done")}
              title="Marquer terminé directement"
              className="text-[11px] font-medium px-2 py-1 rounded-lg text-sodium-text dark:text-sodium-text bg-sodium/5 hover:bg-sodium/15 transition-all"
            >
              ✓
            </button>
          )}
          <button
            onClick={() => onStatus(advance.target)}
            className={cn("text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all", advance.cls)}
          >
            {advance.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// Colonne du Kanban : panneau teinté + header + liste scrollable.
// Zone de drop : on peut y faire glisser une carte pour changer son statut.
function KanbanColumn({
  title,
  tint,
  status,
  todos,
  empty,
  onStatus,
  onDelete,
}: {
  title: string;
  tint: "neutral" | "amber" | "emerald";
  status: import("@/store/sessionStore").TodoStatus;
  todos: Todo[];
  empty: string;
  onStatus: (id: string, s: import("@/store/sessionStore").TodoStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const styles = {
    neutral: { panel: "bg-foreground/[0.03] border-foreground/[0.07]", dot: "bg-foreground/30", label: "text-ink-3", over: "border-foreground/40 bg-foreground/[0.07]" },
    amber:   { panel: "bg-sodium/[0.05] border-sodium/15",        dot: "bg-sodium",     label: "text-sodium-text dark:text-sodium-text", over: "border-sodium/50 bg-sodium/15" },
    emerald: { panel: "bg-sodium/[0.05] border-sodium/15",    dot: "bg-sodium",   label: "text-sodium-text dark:text-sodium-text", over: "border-sodium/50 bg-sodium/15" },
  }[tint];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onStatus(id, status);
      }}
      className={cn("flex flex-col rounded-2xl border p-3 transition-colors", styles.panel, dragOver && styles.over)}
    >
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", styles.dot)} />
        <span className={cn("text-xs font-semibold uppercase tracking-wider", styles.label)}>{title}</span>
        <span className="ml-auto text-xs text-ink-3 tabular-nums">{todos.length}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-80 min-h-[72px]">
        {todos.length === 0 ? (
          <p className="text-[11px] text-ink-3 text-center py-6 px-2 leading-relaxed">{empty}</p>
        ) : (
          todos.map((todo) => (
            <KanbanCard
              key={todo.id}
              todo={todo}
              onStatus={(s) => onStatus(todo.id, s)}
              onDelete={() => onDelete(todo.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const expandTo = useExpandNavigate();
  const previewRef = useRef<HTMLDivElement>(null);
  const { settings, applyPreset, updateSettings, resetAll } = useTimerStore();
  const { selectedVideoId, selectedPlaylistId, getAllVideos } = useSessionStore();
  const { playlists } = usePlaylistStore();
  const { selectedPlaylistUri, playlists: spotifyPlaylists, shuffle, setShuffle } = useSpotifyStore();
  const { selectedChannel, selectedVodId } = useTwitchStore();

  const [preset, setPreset] = useState<TimerPreset>(settings.preset ?? "classic");
  const [work, setWork] = useState(settings.workDuration);
  const [shortBreak, setShortBreak] = useState(settings.shortBreakDuration);
  const [longBreak, setLongBreak] = useState(settings.longBreakDuration);
  const [sessions, setSessions] = useState(settings.sessionsBeforeLongBreak);

  const { todos, addTodo, setTodoStatus, deleteTodo } = useSessionStore();
  const [todoInput, setTodoInput] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showRoutineSave, setShowRoutineSave] = useState(false);

  const handleCoachAdd = (tasks: PlannedTask[]) => {
    tasks.forEach((t) => addTodo(t.text, { pomodoroEstimate: t.pomodoroEstimate }));
  };

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
    // Transition continue : la vignette « s'étend » vers le plein écran.
    expandTo(previewRef.current, "/session");
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
    expandTo(previewRef.current, "/session");
  };

  return (
    <div className="relative isolate min-h-screen bg-background flex flex-col">

      {/* ── Coach de planification (local, gratuit) ───────────────────── */}
      {showCoach && <CoachModal onClose={() => setShowCoach(false)} onAdd={handleCoachAdd} />}

      {/* ── Enregistrer comme routine ─────────────────────────────────── */}
      {showRoutineSave && <RoutineSaveModal onClose={() => setShowRoutineSave(false)} />}

      {/* ── Modal : reprendre les tâches en cours ──────────────────────── */}
      <Modal
        open={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        title="Des tâches sont encore ouvertes"
        meta={`${activeTodos.length} tâche${activeTodos.length > 1 ? "s" : ""} active${activeTodos.length > 1 ? "s" : ""}`}
        size="sm"
        footer={<Button variant="quiet" onClick={() => setShowResumeModal(false)}>Annuler</Button>}
      >
        <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {activeTodos.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 py-1.5 text-[14px] text-ink-2">
              <span aria-hidden className={cn("h-[2px] w-3 shrink-0", t.status === "in-progress" ? "bg-sodium" : "bg-line-strong")} />
              <span className="truncate">{t.text}</span>
              {t.status === "in-progress" && <span className="ml-auto shrink-0 text-[12px] text-sodium-text">en cours</span>}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="signal" onClick={() => startSession("keep")} className="w-full">
            <IconPlay size={14} />
            Continuer avec ces tâches
          </Button>
          {inProgressTodos.length > 0 && (
            <Button variant="line" onClick={() => startSession("reset-inprogress")} className="w-full">
              Remettre les « en cours » à faire
            </Button>
          )}
          <Button variant="line" onClick={() => startSession("clear-all")} className="w-full">
            Démarrer sans tâches
          </Button>
        </div>
      </Modal>

      {/* Header */}
      <header className="h-14 flex items-center px-4 sm:px-8 border-b border-line">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>
        <span className="font-display text-lg text-ink mx-auto">Avant de lancer</span>
        <div className="w-16" />
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-10 flex flex-col gap-12">
        <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: selected content */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <p className="text-[13px] text-ink-3 mb-3">
            {isTwitchMode ? "Stream Twitch" : isSpotifyMode ? "Playlist Spotify" : isPlaylistMode ? "Playlist choisie" : "Vidéo choisie"}
          </p>
          <div ref={previewRef} className="rounded-[var(--r-media)] overflow-hidden aspect-video relative bg-water-deep">
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#9146ff]/20 text-[#9146ff]">
                    {selectedChannel ? "Live" : "VOD"}
                  </span>
                </div>
              </>
            ) : isSpotifyMode ? (
              <>
                {spotifyPlaylist!.imageUrl && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#1db954]/20 text-[#1db954]">
                    Spotify
                  </span>
                </div>
              </>
            ) : isPlaylistMode ? (
              <>
                {playlist.thumbnailUrl && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={playlist.thumbnailUrl}
                    alt={playlist.title}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-ink/60 to-ink/60 flex items-center justify-center">
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-ink/30 text-ink-2">
                    Playlist
                  </span>
                </div>
              </>
            ) : (
              <>
                {!imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
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
          {isTwitchMode && selectedVodId && (
            <p className="text-[10px] text-sodium-text mt-2 leading-snug">
              Rediffusion abonné uniquement ? Utilise le bouton &quot;Ouvrir sur Twitch&quot; dans la session.
            </p>
          )}

          {/* Spotify shuffle toggle */}
          {isSpotifyMode && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setShuffle(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-medium transition-all",
                  !shuffle
                    ? "border-foreground/25 bg-foreground/10 text-foreground"
                    : "border-foreground/[0.07] bg-transparent text-ink-3 hover:text-ink-2 hover:border-foreground/12"
                )}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Dans l&apos;ordre
              </button>
              <button
                onClick={() => setShuffle(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-medium transition-all",
                  shuffle
                    ? "border-[#1db954]/40 bg-[#1db954]/10 text-[#1db954]"
                    : "border-foreground/[0.07] bg-transparent text-ink-3 hover:text-ink-2 hover:border-foreground/12"
                )}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="16 3 21 3 21 8" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="4" y1="20" x2="21" y2="3" strokeLinecap="round" />
                  <polyline points="21 16 21 21 16 21" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="15" y1="15" x2="21" y2="21" strokeLinecap="round" />
                </svg>
                Aléatoire
              </button>
            </div>
          )}
        </div>

        {/* Right: settings */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Preset selector */}
          <div>
            <h2 className="font-display text-xl text-ink mb-4">Le rythme</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presetConfig.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  aria-pressed={preset === p.id}
                  className={cn(
                    "ff-press flex flex-col gap-2.5 p-4 rounded-[var(--r-surface)] border text-left transition-colors duration-[var(--d-ui)]",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sodium",
                    preset === p.id
                      ? "border-sodium bg-surface"
                      : "border-line hover:border-line-strong"
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-[17px] text-ink">{p.label}</span>
                    <span className="font-mono text-[12px] tabular-nums text-ink-3">{p.sub}</span>
                  </span>
                  <CycleShape work={p.work} rest={p.rest} customWork={work} customRest={shortBreak} />
                  <span className="text-[13px] text-ink-2 leading-relaxed">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom settings */}
          <div className={cn("transition-all duration-300", preset !== "custom" && "opacity-40 pointer-events-none")}>
            <h2 className="font-display text-xl text-ink mb-4">Durées</h2>
            <div className="rounded-[var(--r-surface)] border border-line px-4">
              <NumberInput label="Durée de focus" value={work} min={5} max={120} onChange={setWork} />
              <NumberInput label="Pause courte" value={shortBreak} min={1} max={30} onChange={setShortBreak} />
              <NumberInput label="Pause longue" value={longBreak} min={5} max={60} onChange={setLongBreak} />
              <NumberInput label="Sessions avant pause longue" value={sessions} min={2} max={8} onChange={setSessions} />
            </div>
          </div>

          {/* Summary */}
          {preset === "flowtime" ? (
            <div className="flex items-center gap-2 text-xs text-ink-3">
              <span>Chrono libre, sans limite</span>
              <span>·</span>
              <span>Pause méritée = temps travaillé ÷ 5 (2–25 min)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-ink-3">
              <span>{work} min focus</span>
              <span>·</span>
              <span>{shortBreak} min pause</span>
              <span>·</span>
              <span>Pause longue après {sessions} sessions</span>
            </div>
          )}

        </div>
        </div>

        {/* Tasks — Kanban (pleine largeur) */}
        <div>
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="font-display text-xl text-ink">Tâches de la session</h2>
              <button
                onClick={() => setShowCoach(true)}
                className="ml-auto flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-control)] border border-line-strong/60 hover:border-ink text-ink-2 hover:text-ink text-[13px] transition-colors"
                title="Découper un objectif en tâches (100 % local, gratuit)"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3l1.9 4.8L19 9.6l-4 3.4 1.2 5L12 15.8 7.8 18l1.2-5-4-3.4 5.1-1.8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Coach
              </button>
            </div>
            <p className="text-xs text-ink-3 mb-4 leading-relaxed">
              Prépare ce que tu vas faire pendant cette session : une carte = une tâche.
              Fais-les avancer de <span className="text-ink-2">À faire</span> → <span className="text-sodium-text">En cours</span> → <span className="text-sodium-text">Terminé</span> au fil de la session.
            </p>

            {/* Add task */}
            <div className="flex gap-2 mb-4">
              <Input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={handleTodoKey}
                placeholder="Ajouter une tâche…"
                className="flex-1 bg-foreground/5 border-foreground/10 text-foreground placeholder:text-ink-3 focus-visible:ring-foreground/20 rounded-xl text-sm h-9"
              />
              <button
                onClick={handleAddTodo}
                disabled={!todoInput.trim()}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-foreground/10 hover:bg-foreground/15 disabled:opacity-20 text-foreground transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Kanban columns */}
            {todos.length === 0 ? (
              <p className="text-xs text-ink-3 text-center py-5">Ajoute des tâches avant de démarrer</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KanbanColumn
                  title="À faire"
                  tint="neutral"
                  status="todo"
                  todos={todos.filter((t) => t.status === "todo")}
                  empty="Rien en attente"
                  onStatus={setTodoStatus}
                  onDelete={deleteTodo}
                />
                <KanbanColumn
                  title="En cours"
                  tint="amber"
                  status="in-progress"
                  todos={todos.filter((t) => t.status === "in-progress")}
                  empty="Clique « Commencer » sur une tâche pour la passer ici"
                  onStatus={setTodoStatus}
                  onDelete={deleteTodo}
                />
                <KanbanColumn
                  title="Terminé"
                  tint="emerald"
                  status="done"
                  todos={todos.filter((t) => t.status === "done")}
                  empty="Les tâches finies arrivent ici"
                  onStatus={setTodoStatus}
                  onDelete={deleteTodo}
                />
              </div>
            )}
          </div>

        {/* Start button */}
        <div className="flex flex-col gap-3">
          <Button variant="signal" size="lg" onClick={handleStart} className="w-full h-14 text-base">
            <IconPlay size={16} />
            Démarrer la session
          </Button>
          <button
            onClick={() => setShowRoutineSave(true)}
            className="flex items-center justify-center gap-2 text-xs text-ink-3 hover:text-ink-2 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Enregistrer cette config comme routine
          </button>
        </div>
      </main>
    </div>
  );
}
