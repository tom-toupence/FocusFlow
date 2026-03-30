"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { VideoMood, moodLabels, moodColors, extractYouTubeId, getVideoColor, Video, defaultVideos } from "@/data/videos";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaylistStore, SavedPlaylist, extractPlaylistId, extractFirstVideoId, fetchPlaylistMeta } from "@/store/playlistStore";
import { useSpotifyStore, SpotifyPlaylist } from "@/store/spotifyStore";
import { useTwitchStore, extractTwitchVodId, TwitchChannel } from "@/store/twitchStore";
import { loginWithTwitch, getFollowedChannels, getLiveFollowedStreams, searchChannels, refreshTwitchToken } from "@/lib/twitch";
import { loginWithSpotify, fetchMyPlaylists, refreshAccessToken, getSpotifyProfile } from "@/lib/spotify";
import { cn } from "@/lib/utils";
import StatsSection from "@/components/StatsSection";
import ThemeToggle from "@/components/ThemeToggle";
import ProfilePanel from "@/components/ProfilePanel";
import { useProfileStore, resolvedProfile } from "@/store/profileStore";

const allMoods: VideoMood[] = ["lofi", "jazz", "ambience", "nature", "synthwave", "classical"];

function VideoCard({
  video,
  selected,
  isCustom,
  onStart,
  onRemove,
}: {
  video: Video;
  selected: boolean;
  isCustom: boolean;
  onStart: () => void;
  onRemove?: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-200",
        selected ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-foreground/30"
      )}
      onClick={onStart}
    >
      {/* Thumbnail */}
      {!imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${getVideoColor(video)} 0%, #0d0d0f 100%)` }}
        />
      )}

      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
          <svg className="w-4 h-4 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-white text-xs font-semibold tracking-wide">Démarrer</span>
      </div>

      {/* Info (hidden on hover) */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 transition-opacity duration-200 group-hover:opacity-0">
        <p className="text-white text-xs font-medium leading-tight line-clamp-1">{video.title}</p>
        <p className="text-white/50 text-[10px] mt-0.5">{video.channel}</p>
      </div>

      {/* Mood badge */}
      <div className="absolute top-2 right-2">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm", moodColors[video.mood])}>
          {moodLabels[video.mood]}
        </span>
      </div>

      {/* Selected dot */}
      {selected && <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-white shadow" />}

      {/* Remove custom video */}
      {isCustom && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/60 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
          title="Supprimer"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function AddVideoModal({ onClose, onAdd }: { onClose: () => void; onAdd: (video: Video) => void }) {
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState<VideoMood>("lofi");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const handleUrlChange = (val: string) => {
    setInput(val);
    setError("");
    const id = extractYouTubeId(val.trim());
    setPreview(id);
  };

  const handleAdd = () => {
    const youtubeId = extractYouTubeId(input.trim());
    if (!youtubeId) {
      setError("URL YouTube invalide");
      return;
    }
    if (!title.trim()) {
      setError("Donne un titre à cette vidéo");
      return;
    }
    onAdd({
      id: `custom-${Date.now()}`,
      title: title.trim(),
      channel: "Ma vidéo",
      youtubeId,
      mood,
      color: "#1a1a2e",
      custom: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-foreground/10 rounded-2xl shadow-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Ajouter une vidéo</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foregroundtransition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-xl overflow-hidden aspect-video bg-foreground/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${preview}/mqdefault.jpg`}
              alt="Aperçu"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
            />
          </div>
        )}

        {/* URL input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-foreground/40">URL YouTube</label>
          <input
            value={input}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/25 transition-colors"
          />
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-foreground/40">Titre</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nom de la vidéo..."
            className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/25 transition-colors"
          />
        </div>

        {/* Mood */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-foreground/40">Catégorie</label>
          <div className="flex gap-1.5 flex-wrap">
            {allMoods.map((m) => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                  mood === m ? "bg-foreground/15 text-foreground": "text-foreground/40 bg-foreground/5 hover:text-foreground/70"
                )}
              >
                {moodLabels[m]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          onClick={handleAdd}
          className="py-2.5 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 transition-all"
        >
          Ajouter au catalogue
        </button>
      </div>
    </div>
  );
}

function AddPlaylistModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: Omit<SavedPlaylist, "id">) => void }) {
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [firstVideoId, setFirstVideoId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const handleUrlChange = (val: string) => {
    setInput(val);
    setError("");
    const pid = extractPlaylistId(val.trim());
    const vid = extractFirstVideoId(val.trim());
    setPlaylistId(pid);
    setFirstVideoId(vid);
    setThumbnailUrl(null);
    setTitle("");
    setChannelName("");
  };

  const handleFetchMeta = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const meta = await fetchPlaylistMeta(input.trim());
    setLoading(false);
    if (meta.title) setTitle(meta.title);
    if (meta.channelName) setChannelName(meta.channelName);
    if (meta.thumbnailUrl) setThumbnailUrl(meta.thumbnailUrl);
  };

  const handleAdd = () => {
    if (!playlistId) {
      setError("URL de playlist YouTube invalide (paramètre list= manquant)");
      return;
    }
    if (!title.trim()) {
      setError("Donne un titre à cette playlist");
      return;
    }
    onAdd({
      playlistId,
      title: title.trim(),
      channelName: channelName || undefined,
      thumbnailUrl: (thumbnailUrl ?? (firstVideoId ? `https://img.youtube.com/vi/${firstVideoId}/mqdefault.jpg` : undefined)) || undefined,
    });
    onClose();
  };

  const previewSrc = thumbnailUrl ?? (firstVideoId ? `https://img.youtube.com/vi/${firstVideoId}/mqdefault.jpg` : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-foreground/10 rounded-2xl shadow-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Ajouter une playlist</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Preview */}
        {previewSrc && (
          <div className="rounded-xl overflow-hidden aspect-video bg-foreground/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Aperçu"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
            />
          </div>
        )}

        {/* URL input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-foreground/40">URL YouTube (playlist)</label>
          <input
            value={input}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/playlist?list=PL..."
            className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/25 transition-colors"
          />
        </div>

        {/* Fetch meta button */}
        <button
          onClick={handleFetchMeta}
          disabled={!input.trim() || loading}
          className="flex items-center justify-center gap-1.5 py-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-xs font-medium text-foreground/60 hover:text-foreground disabled:opacity-30 transition-all"
        >
          {loading ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          )}
          {loading ? "Récupération..." : "Récupérer les infos"}
        </button>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-foreground/40">Titre</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nom de la playlist..."
            className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/25 transition-colors"
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          onClick={handleAdd}
          className="py-2.5 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 transition-all"
        >
          Ajouter au catalogue
        </button>
      </div>
    </div>
  );
}

function PlaylistCard({
  playlist,
  selected,
  onStart,
  onRemove,
}: {
  playlist: SavedPlaylist;
  selected: boolean;
  onStart: () => void;
  onRemove: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-200",
        selected ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-foreground/30"
      )}
      onClick={onStart}
    >
      {/* Thumbnail */}
      {playlist.thumbnailUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={playlist.thumbnailUrl}
          alt={playlist.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full transition-transform duration-300 group-hover:scale-105 bg-gradient-to-br from-violet-900/60 to-indigo-900/60 flex items-center justify-center">
          <svg className="w-10 h-10 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" strokeLinecap="round" />
            <path d="M9 12h6M9 16h4" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
          <svg className="w-4 h-4 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-white text-xs font-semibold tracking-wide">Démarrer</span>
      </div>

      {/* Info (hidden on hover) */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 transition-opacity duration-200 group-hover:opacity-0">
        <p className="text-white text-xs font-medium leading-tight line-clamp-1">{playlist.title}</p>
        {playlist.channelName && (
          <p className="text-white/50 text-[10px] mt-0.5">{playlist.channelName}</p>
        )}
      </div>

      {/* Playlist badge */}
      <div className="absolute top-2 right-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-violet-500/30 text-violet-200">
          Playlist
        </span>
      </div>

      {/* Selected dot */}
      {selected && <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-white shadow" />}

      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/60 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
        title="Supprimer"
      >
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function CompletedTodosBacklog() {
  const { todos, deleteTodo } = useSessionStore();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const done = todos.filter((t) => t.status === "done");
  if (done.length === 0) return null;

  // Group by completedAt date
  const groups: Record<string, typeof done> = {};
  for (const t of done) {
    const key = t.completedAt ?? "—";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  return (
    <section className="pt-8 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground/30 uppercase tracking-widest">Tâches accomplies</h2>
        <button
          onClick={() => done.forEach((t) => deleteTodo(t.id))}
          className="text-xs text-foreground/20 hover:text-foreground/50 transition-colors"
        >
          Tout effacer
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => (
          <div key={date}>
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-2">{date}</p>
            <div className="flex flex-col gap-1">
              {items.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/[0.02] group">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-1.5 h-1.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="flex-1 text-xs text-foreground/35 line-through">{t.text}</span>
                  <button
                    onClick={() => deleteTodo(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-foreground/20 hover:text-foreground/50 transition-all"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Spotify playlist card ────────────────────────────────────────────────────

function SpotifyPlaylistCard({
  playlist,
  selected,
  onStart,
}: {
  playlist: SpotifyPlaylist;
  selected: boolean;
  onStart: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-200",
        selected ? "ring-2 ring-[#1db954]" : "hover:ring-1 hover:ring-[#1db954]/50"
      )}
      onClick={onStart}
    >
      {playlist.imageUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={playlist.imageUrl}
          alt={playlist.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#1a3a1a] to-[#111] flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#1db954]/30" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-full bg-[#1db954] flex items-center justify-center shadow-lg">
          <svg className="w-4 h-4 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-white text-xs font-semibold tracking-wide">Démarrer</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2.5 transition-opacity duration-200 group-hover:opacity-0">
        <p className="text-white text-xs font-medium leading-tight line-clamp-1">{playlist.name}</p>
        {playlist.trackCount > 0 && (
          <p className="text-white/50 text-[10px] mt-0.5">{playlist.trackCount} titres</p>
        )}
      </div>
      <div className="absolute top-2 right-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-[#1db954]/20 text-[#1db954]">
          Spotify
        </span>
      </div>
      {selected && <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#1db954] shadow" />}
    </div>
  );
}

// ─── Twitch channel card ──────────────────────────────────────────────────────

function TwitchChannelCard({
  channel,
  selected,
  onStart,
}: {
  channel: TwitchChannel;
  selected: boolean;
  onStart: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-200",
        selected ? "ring-2 ring-[#9146ff]" : "hover:ring-1 hover:ring-[#9146ff]/50"
      )}
      onClick={onStart}
    >
      {channel.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={channel.thumbnailUrl}
          alt={channel.displayName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#1a0a3a] to-[#0d0d1a] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#9146ff]/30" fill="currentColor">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
          </svg>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-full bg-[#9146ff] flex items-center justify-center shadow-lg">
          <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-white text-xs font-semibold tracking-wide">Démarrer</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2.5 transition-opacity duration-200 group-hover:opacity-0">
        <p className="text-white text-xs font-medium leading-tight truncate">{channel.displayName}</p>
        {channel.gameName && <p className="text-white/50 text-[10px] mt-0.5 truncate">{channel.gameName}</p>}
        {channel.isLive && channel.viewerCount !== undefined && (
          <p className="text-white/40 text-[10px]">{channel.viewerCount.toLocaleString()} spectateurs</p>
        )}
      </div>
      <div className="absolute top-2 right-2">
        {channel.isLive ? (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-red-500/20 text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Live
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-[#9146ff]/20 text-[#9146ff]">
            Twitch
          </span>
        )}
      </div>
      {selected && <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#9146ff] shadow" />}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const { selectedVideoId, selectedPlaylistId, customVideos, addCustomVideo, removeCustomVideo } = useSessionStore();
  const { playlists, addPlaylist, removePlaylist } = usePlaylistStore();
  const {
    accessToken, refreshToken, expiresAt,
    playlists: spotifyPlaylists, selectedPlaylistUri, isPremium,
    updateToken, clearAuth, setPlaylists, selectPlaylist, setProfile: setSpotifyProfile,
  } = useSpotifyStore();

  const {
    accessToken: twitchToken, refreshToken: twitchRefreshToken, expiresAt: twitchExpiresAt,
    userId: twitchUserId, userLogin: twitchUserLogin,
    followedChannels, selectedChannel, selectedVodId,
    updateToken: updateTwitchToken, clearAuth: clearTwitchAuth, setFollowedChannels,
  } = useTwitchStore();

  const profileState = useProfileStore();
  const profile = resolvedProfile(profileState);

  const [activeTab, setActiveTab] = useState<"catalogue" | "library" | "spotify" | "twitch" | "activite">("catalogue");
  const [twitchInput, setTwitchInput] = useState("");
  const [vodInput, setVodInput] = useState("");
  const [vodError, setVodError] = useState("");
  const [twitchLoading, setTwitchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<TwitchChannel[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const isTwitchConnected = !!twitchToken;
  const [activeFilter, setActiveFilter] = useState<VideoMood | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPlaylistModal, setShowAddPlaylistModal] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyApiError, setSpotifyApiError] = useState<"forbidden" | "error" | null>(null);
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  const catalogueVideos = activeFilter ? defaultVideos.filter((v) => v.mood === activeFilter) : defaultVideos;
  const hasLibraryContent = customVideos.length > 0 || playlists.length > 0;
  const isSpotifyConnected = !!accessToken;

  // Refresh Spotify token if expired, then load playlists when tab opens
  useEffect(() => {
    if (activeTab !== "spotify" || !accessToken) return;

    const load = async () => {
      setSpotifyLoading(true);
      setSpotifyApiError(null);
      let token = accessToken;

      if (expiresAt && Date.now() > expiresAt - 60_000) {
        if (!refreshToken) { clearAuth(); return; }
        const result = await refreshAccessToken(refreshToken);
        if (!result) { clearAuth(); return; }
        updateToken(result.accessToken, result.expiresAt);
        token = result.accessToken;
      }

      const [profile, result] = await Promise.all([
        getSpotifyProfile(token),
        fetchMyPlaylists(token),
      ]);
      if (profile) setSpotifyProfile(profile);
      if (result.ok) {
        setPlaylists(result.playlists);
      } else {
        setSpotifyApiError(result.status === 403 ? "forbidden" : "error");
      }
      setSpotifyLoading(false);
    };

    load();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load followed channels when Twitch tab opens
  useEffect(() => {
    if (activeTab !== "twitch" || !twitchToken) return;

    const load = async () => {
      setTwitchLoading(true);
      let token = twitchToken;

      if (twitchExpiresAt && Date.now() > twitchExpiresAt - 60_000) {
        if (!twitchRefreshToken) { clearTwitchAuth(); return; }
        const result = await refreshTwitchToken(twitchRefreshToken);
        if (!result) { clearTwitchAuth(); return; }
        updateTwitchToken(result.accessToken, result.expiresAt);
        token = result.accessToken;
      }

      if (!twitchUserId) { setTwitchLoading(false); return; }

      const [followed, live] = await Promise.all([
        getFollowedChannels(token, twitchUserId),
        getLiveFollowedStreams(token, twitchUserId),
      ]);

      const liveLogins = new Set(live.map((s) => s.login));
      const merged = followed.map((ch) => {
        const liveData = live.find((s) => s.login === ch.login);
        return liveData ?? { ...ch, isLive: liveLogins.has(ch.login) };
      });
      // Live first, then alphabetical
      merged.sort((a, b) => {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });

      setFollowedChannels(merged);
      setTwitchLoading(false);
    };

    load();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!twitchInput.trim() || !twitchToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      let token = twitchToken;
      if (twitchExpiresAt && Date.now() > twitchExpiresAt - 60_000 && twitchRefreshToken) {
        const result = await refreshTwitchToken(twitchRefreshToken);
        if (result) { updateTwitchToken(result.accessToken, result.expiresAt); token = result.accessToken; }
      }
      const results = await searchChannels(token, twitchInput.trim());
      setSearchResults(results);
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [twitchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = (videoId: string) => {
    useSpotifyStore.getState().selectPlaylist(null);
    useTwitchStore.getState().clear();
    useSessionStore.getState().selectVideo(videoId);
    router.push("/settings");
  };

  const handleStartPlaylist = (id: string) => {
    useSpotifyStore.getState().selectPlaylist(null);
    useTwitchStore.getState().clear();
    useSessionStore.getState().selectPlaylist(id);
    router.push("/settings");
  };

  const handleStartSpotify = (uri: string) => {
    useSessionStore.getState().selectVideo("v1");
    useSessionStore.setState({ selectedPlaylistId: null });
    useTwitchStore.getState().clear();
    selectPlaylist(uri);
    router.push("/settings");
  };

  const handleStartTwitch = (channel: string) => {
    if (!channel.trim()) return;
    useSessionStore.getState().selectVideo("v1");
    useSessionStore.setState({ selectedPlaylistId: null });
    useSpotifyStore.getState().selectPlaylist(null);
    useTwitchStore.getState().selectChannel(channel.trim());
    router.push("/settings");
  };

  const handleStartTwitchVod = () => {
    const vodId = extractTwitchVodId(vodInput.trim());
    if (!vodId) {
      setVodError("Lien de rediffusion invalide. Colle un lien twitch.tv/videos/…");
      return;
    }
    setVodError("");
    useSessionStore.getState().selectVideo("v1");
    useSessionStore.setState({ selectedPlaylistId: null });
    useSpotifyStore.getState().selectPlaylist(null);
    useTwitchStore.getState().selectVod(vodId);
    router.push("/settings");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-foreground/[0.06] px-6 h-14 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground/90 tracking-tight">FocusFlow</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProfilePanel(true)}
            className="relative w-8 h-8 rounded-full overflow-hidden bg-foreground/10 hover:ring-2 hover:ring-foreground/30 transition-all flex-shrink-0 flex items-center justify-center"
            title="Mon profil"
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-foreground/60">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            {(isSpotifyConnected || isTwitchConnected) && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-background" />
            )}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
        {/* Tabs */}
        <div className="flex gap-1 mb-8">
          <button
            onClick={() => setActiveTab("catalogue")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === "catalogue" ? "bg-foreground/15 text-foreground" : "text-foreground/40 hover:text-foreground/70 bg-foreground/5"
            )}
          >
            Catalogue
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              activeTab === "library" ? "bg-foreground/15 text-foreground" : "text-foreground/40 hover:text-foreground/70 bg-foreground/5"
            )}
          >
            Ma bibliothèque
            {hasLibraryContent && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                activeTab === "library" ? "bg-foreground/20" : "bg-foreground/10"
              )}>
                {customVideos.length + playlists.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("spotify")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              activeTab === "spotify"
                ? "bg-[#1db954]/15 text-[#1db954]"
                : "text-foreground/40 hover:text-foreground/70 bg-foreground/5"
            )}
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify
            {isSpotifyConnected && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                activeTab === "spotify" ? "bg-[#1db954]/20" : "bg-[#1db954]/10 text-[#1db954]"
              )}>
                Premium
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("twitch")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              activeTab === "twitch"
                ? "bg-[#9146ff]/15 text-[#9146ff]"
                : "text-foreground/40 hover:text-foreground/70 bg-foreground/5"
            )}
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            Twitch
            {selectedChannel && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                activeTab === "twitch" ? "bg-[#9146ff]/20" : "bg-[#9146ff]/10 text-[#9146ff]"
              )}>
                Live
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("activite")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              activeTab === "activite" ? "bg-foreground/15 text-foreground" : "text-foreground/40 hover:text-foreground/70 bg-foreground/5"
            )}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Activité
          </button>
        </div>

        {/* ── Catalogue ──────────────────────────────────────────────────────── */}
        {activeTab === "catalogue" && (
          <>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">Choisis ton ambiance</h1>
                <p className="text-foreground/40 mt-1 text-sm">Passe ta souris sur une vidéo et clique Démarrer.</p>
              </div>
            </div>

            {/* Mood filters */}
            <div className="flex gap-2 mb-6 flex-wrap">
              <button
                onClick={() => setActiveFilter(null)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  activeFilter === null ? "bg-foreground/15 text-foreground" : "text-foreground/40 hover:text-foreground/70 bg-foreground/5"
                )}
              >
                Tout
              </button>
              {allMoods.map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveFilter(activeFilter === m ? null : m)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                    activeFilter === m ? "bg-foreground/15 text-foreground" : "text-foreground/40 hover:text-foreground/70 bg-foreground/5"
                  )}
                >
                  {moodLabels[m]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {catalogueVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  selected={selectedVideoId === video.id}
                  isCustom={false}
                  onStart={() => handleStart(video.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Bibliothèque ───────────────────────────────────────────────────── */}
        {activeTab === "library" && (
          <>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">Ma bibliothèque</h1>
                <p className="text-foreground/40 mt-1 text-sm">Tes vidéos et playlists personnelles, sauvegardées sur ton compte.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/50 hover:text-foreground text-xs font-medium transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Vidéo
                </button>
                <button
                  onClick={() => setShowAddPlaylistModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/50 hover:text-foreground text-xs font-medium transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Playlist
                </button>
              </div>
            </div>

            {!hasLibraryContent ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-foreground/25">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm">Ta bibliothèque est vide</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground text-xs font-medium transition-all">
                    Ajouter une vidéo
                  </button>
                  <button onClick={() => setShowAddPlaylistModal(true)} className="px-4 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground text-xs font-medium transition-all">
                    Ajouter une playlist
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-10">
                {/* Custom videos */}
                {customVideos.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4">Vidéos</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {customVideos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          selected={selectedVideoId === video.id}
                          isCustom={true}
                          onStart={() => handleStart(video.id)}
                          onRemove={() => removeCustomVideo(video.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Playlists */}
                {playlists.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4">Playlists</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {playlists.map((playlist) => (
                        <PlaylistCard
                          key={playlist.id}
                          playlist={playlist}
                          selected={selectedPlaylistId === playlist.id}
                          onStart={() => handleStartPlaylist(playlist.id)}
                          onRemove={() => removePlaylist(playlist.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
        {/* ── Spotify ─────────────────────────────────────────────────────────── */}
        {activeTab === "spotify" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
                Spotify
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#1db954]" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </h1>
              <p className="text-foreground/40 mt-1 text-sm">
                {isSpotifyConnected
                  ? "Tes playlists — clique sur une playlist pour démarrer."
                  : "Connecte ton compte Spotify Premium pour écouter tes playlists."}
              </p>
            </div>

            {!isSpotifyConnected ? (
              <div className="flex flex-col items-center justify-center py-24 gap-6">
                <div className="w-16 h-16 rounded-full bg-[#1db954]/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#1db954]" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground/60">Compte Spotify Premium requis</p>
                  <p className="text-xs text-foreground/30 mt-1 max-w-xs">
                    La lecture directe dans le navigateur nécessite un abonnement Premium.
                  </p>
                </div>
                <button
                  onClick={loginWithSpotify}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#1db954] hover:bg-[#1ed760] text-black font-semibold text-sm transition-all shadow-lg shadow-[#1db954]/20"
                >
                  <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Connecter avec Spotify
                </button>
              </div>
            ) : spotifyLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-6 h-6 border-2 border-foreground/10 border-t-[#1db954] rounded-full animate-spin" />
              </div>
            ) : spotifyApiError === "forbidden" ? (
              <div className="flex flex-col items-center justify-center py-24 gap-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-center max-w-sm">
                  <p className="text-sm font-medium text-foreground/70">Accès refusé par Spotify</p>
                  <p className="text-xs text-foreground/40 mt-2 leading-relaxed">
                    L&apos;application est en <strong className="text-foreground/60">mode développement</strong> — seuls les comptes ajoutés manuellement peuvent l&apos;utiliser.
                    Demande au propriétaire de l&apos;app de t&apos;ajouter dans le <strong className="text-foreground/60">Spotify Developer Dashboard</strong>.
                  </p>
                </div>
                <button
                  onClick={() => clearAuth()}
                  className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
                >
                  Déconnecter
                </button>
              </div>
            ) : spotifyApiError === "error" ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-foreground/25">
                <p className="text-sm">Erreur lors du chargement des playlists</p>
                <button
                  onClick={() => setActiveTab("spotify")}
                  className="text-xs text-foreground/30 hover:text-foreground/50 underline"
                >
                  Réessayer
                </button>
              </div>
            ) : isPremium === false ? (
              <div className="flex flex-col items-center justify-center py-24 gap-6">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground/70">Compte Spotify Free détecté</p>
                  <p className="text-xs text-foreground/40 mt-1 max-w-xs">
                    La lecture directe dans le navigateur nécessite un abonnement <strong className="text-foreground/60">Spotify Premium</strong>. Les playlists ne peuvent pas être récupérées avec un compte gratuit.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { clearAuth(); loginWithSpotify(); }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1db954] hover:bg-[#1ed760] text-black font-semibold text-sm transition-all"
                  >
                    Changer de compte
                  </button>
                  <button
                    onClick={() => clearAuth()}
                    className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
                  >
                    Déconnecter
                  </button>
                </div>
              </div>
            ) : spotifyPlaylists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-foreground/25">
                <p className="text-sm">Aucune playlist trouvée</p>
                <button
                  onClick={() => setActiveTab("spotify")}
                  className="text-xs text-foreground/30 hover:text-foreground/50 underline"
                >
                  Actualiser
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {spotifyPlaylists.map((pl) => (
                  <SpotifyPlaylistCard
                    key={pl.id}
                    playlist={pl}
                    selected={selectedPlaylistUri === pl.uri}
                    onStart={() => handleStartSpotify(pl.uri)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Twitch ──────────────────────────────────────────────────────────── */}
        {activeTab === "twitch" && (
          <>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
                  Twitch
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#9146ff]" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                </h1>
                <p className="text-foreground/40 mt-1 text-sm">
                  {isTwitchConnected
                    ? `Connecté en tant que ${twitchUserLogin} — tes abonnements Twitch.`
                    : "Connecte ton compte Twitch pour voir tes abonnements, ou entre directement un nom de chaîne."}
                </p>
              </div>
            </div>

            {/* Search input (always visible) */}
            <div className="relative mb-6 max-w-lg">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                  </svg>
                  <input
                    value={twitchInput}
                    onChange={(e) => { setTwitchInput(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !searchResults.length) handleStartTwitch(twitchInput);
                    }}
                    placeholder={isTwitchConnected ? "Rechercher une chaîne Twitch…" : "Nom du streamer (ex: lofigirl)"}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/25 transition-colors"
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border border-foreground/20 border-t-[#9146ff] rounded-full animate-spin" />
                  )}
                </div>
                <button
                  onClick={() => handleStartTwitch(twitchInput)}
                  disabled={!twitchInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9146ff] hover:bg-[#7c3ae0] disabled:opacity-30 text-white text-xs font-semibold transition-all flex-shrink-0"
                >
                  Démarrer
                </button>
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-foreground/10 rounded-xl shadow-2xl overflow-hidden z-20">
                  {searchResults.map((ch) => (
                    <button
                      key={ch.login}
                      onClick={() => { handleStartTwitch(ch.login); setTwitchInput(""); setSearchResults([]); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-foreground/5 transition-colors text-left"
                    >
                      {ch.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ch.thumbnailUrl} alt="" className="w-10 h-6 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-6 rounded bg-[#1a0a3a] flex items-center justify-center flex-shrink-0">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#9146ff]/50" fill="currentColor">
                            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{ch.displayName}</p>
                        {ch.gameName && <p className="text-xs text-foreground/40 truncate">{ch.gameName}</p>}
                      </div>
                      {ch.isLive && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          Live
                          {ch.viewerCount !== undefined && ` · ${ch.viewerCount.toLocaleString()}`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Connect Twitch CTA */}
            {!isTwitchConnected && (
              <div className="flex flex-col items-center justify-center py-16 gap-6 border border-foreground/[0.06] rounded-2xl mb-8">
                <div className="w-14 h-14 rounded-full bg-[#9146ff]/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#9146ff]" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground/60">Connecte ton compte Twitch</p>
                  <p className="text-xs text-foreground/30 mt-1 max-w-xs">
                    Pour voir tes abonnements et rechercher des chaînes directement depuis FocusFlow.
                  </p>
                </div>
                <button
                  onClick={() => loginWithTwitch()}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#9146ff] hover:bg-[#7c3ae0] text-white font-semibold text-sm transition-all shadow-lg shadow-[#9146ff]/20"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                  Connecter avec Twitch
                </button>
              </div>
            )}

            {/* Connected: followed channels */}
            {isTwitchConnected && (
              twitchLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-foreground/10 border-t-[#9146ff] rounded-full animate-spin" />
                </div>
              ) : followedChannels.length === 0 ? (
                <p className="text-foreground/25 text-sm text-center py-10">Aucun abonnement trouvé</p>
              ) : (
                <div className="flex flex-col gap-10">
                  {/* Live now */}
                  {followedChannels.some((c) => c.isLive) && (
                    <section>
                      <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        En direct maintenant
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {followedChannels.filter((c) => c.isLive).map((ch) => (
                          <TwitchChannelCard
                            key={ch.login}
                            channel={ch}
                            selected={selectedChannel === ch.login}
                            onStart={() => handleStartTwitch(ch.login)}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  {/* All followed */}
                  <section>
                    <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4">Mes abonnements</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {followedChannels.map((ch) => (
                        <TwitchChannelCard
                          key={ch.login}
                          channel={ch}
                          selected={selectedChannel === ch.login}
                          onStart={() => handleStartTwitch(ch.login)}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              )
            )}

            {/* VOD / Rediffusion */}
            <div className="mt-10">
              <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-1">Rediffusion (VOD)</p>
              <p className="text-xs text-foreground/30 mb-4">
                {"Colle le lien d'une rediffusion Twitch. Les VODs abonné uniquement nécessitent un abonnement actif au streamer."}
              </p>
              <div className="flex gap-2 max-w-lg">
                <input
                  value={vodInput}
                  onChange={(e) => { setVodInput(e.target.value); setVodError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleStartTwitchVod()}
                  placeholder="https://www.twitch.tv/videos/1234567890"
                  className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/25 transition-colors"
                />
                <button
                  onClick={handleStartTwitchVod}
                  disabled={!vodInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9146ff] hover:bg-[#7c3ae0] disabled:opacity-30 text-white text-xs font-semibold transition-all flex-shrink-0"
                >
                  Démarrer
                </button>
              </div>
              {vodError && <p className="text-red-400 text-xs mt-2">{vodError}</p>}
              {selectedVodId && (
                <p className="text-[#9146ff]/70 text-xs mt-2">VOD sélectionnée : {selectedVodId}</p>
              )}
            </div>
          </>
        )}
        {/* ── Activité ────────────────────────────────────────────────────────── */}
        {activeTab === "activite" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-foreground tracking-tight">Activité</h1>
              <p className="text-foreground/40 mt-1 text-sm">Ton historique de sessions et tes tâches accomplies.</p>
            </div>
            <StatsSection embedded />
            <CompletedTodosBacklog />
          </>
        )}

      </main>

      {/* Add video modal */}
      {showAddModal && (
        <AddVideoModal
          onClose={() => setShowAddModal(false)}
          onAdd={(v) => { addCustomVideo(v); setShowAddModal(false); }}
        />
      )}

      {/* Add playlist modal */}
      {showAddPlaylistModal && (
        <AddPlaylistModal
          onClose={() => setShowAddPlaylistModal(false)}
          onAdd={(p) => { addPlaylist(p); setShowAddPlaylistModal(false); }}
        />
      )}

      <ProfilePanel open={showProfilePanel} onClose={() => setShowProfilePanel(false)} />
    </div>
  );
}
