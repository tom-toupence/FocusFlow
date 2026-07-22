"use client";

import { useEffect, useState } from "react";
import { useQueueStore } from "@/store/queueStore";
import { useSessionStore } from "@/store/sessionStore";
import { useLocalPlaylistStore, LocalTrack } from "@/store/localPlaylistStore";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// Menu « ＋ » réutilisable, identique partout dans le volet musique (Découvrir,
// recherche, titres de playlist, bibliothèque) : Lire (optionnel) · File
// d'attente · Ma bibliothèque · Ajouter à une playlist locale (+ créer).
// Lit lui-même les stores concernés pour afficher les états « déjà ajouté ».
// Desktop = popover ; mobile (<sm) = bottom-sheet.
export default function AddToMenu({
  track,
  onPlay,
  extra,
}: {
  track: LocalTrack;
  onPlay?: () => void;
  extra?: { label: string; added: boolean; onAdd: () => void };
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const queueItems = useQueueStore((s) => s.items);
  const addToQueue = useQueueStore((s) => s.addItem);
  const customVideos = useSessionStore((s) => s.customVideos);
  const addCustomVideo = useSessionStore((s) => s.addCustomVideo);
  const playlists = useLocalPlaylistStore((s) => s.playlists);
  const addTrack = useLocalPlaylistStore((s) => s.addTrack);
  const createPlaylist = useLocalPlaylistStore((s) => s.createPlaylist);

  if (!mounted) return null;

  const inQueue = queueItems.some((i) => i.youtubeId === track.youtubeId);
  const inLibrary = customVideos.some((v) => v.youtubeId === track.youtubeId);

  const close = () => {
    setOpen(false);
    setCreating(false);
    setNewName("");
  };

  const handleAddQueue = () => {
    if (inQueue) { close(); return; }
    addToQueue({
      youtubeId: track.youtubeId,
      title: track.title,
      channelName: track.channelName,
      thumbnailUrl: track.thumbnailUrl,
    });
    toast({ title: "Ajouté à la file", description: track.title, emoji: "🎵", accent: "emerald" });
    close();
  };

  const handleAddLibrary = () => {
    if (inLibrary) { close(); return; }
    addCustomVideo({
      id: `disc-${track.youtubeId}`,
      title: track.title,
      channel: track.channelName ?? "YouTube",
      youtubeId: track.youtubeId,
      mood: "lofi",
      custom: true,
    });
    toast({ title: "Ajouté à ta bibliothèque", description: track.title, emoji: "📚", accent: "emerald" });
    close();
  };

  const handleAddToPlaylist = (playlistId: string, name: string, already: boolean) => {
    if (already) { close(); return; }
    addTrack(playlistId, track);
    toast({ title: "Ajouté à la playlist", description: `${track.title} → « ${name} »`, emoji: "🎶", accent: "emerald" });
    close();
  };

  const handleCreatePlaylist = () => {
    const name = newName.trim();
    if (!name) return;
    createPlaylist(name, track);
    toast({ title: "Playlist créée", description: name, emoji: "🎶", accent: "emerald" });
    close();
  };

  const menu = (
    <div className="flex flex-col gap-0.5 p-1.5">
      {extra && (
        <MenuButton label={extra.label} done={extra.added} onClick={() => { if (!extra.added) extra.onAdd(); close(); }} />
      )}
      {onPlay && (
        <button
          onClick={() => { onPlay(); close(); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-foreground hover:bg-foreground/[0.06] transition-colors min-h-[40px]"
        >
          <PlayGlyph /> Lire
        </button>
      )}
      <MenuButton label="File d'attente" done={inQueue} onClick={handleAddQueue} icon={<QueueGlyph />} />
      <MenuButton label="Ma bibliothèque" done={inLibrary} onClick={handleAddLibrary} icon={<LibraryGlyph />} />

      <div className="h-px bg-foreground/10 my-1 mx-2" />
      <p className="px-3 pt-0.5 pb-1.5 text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">
        Ajouter à une playlist
      </p>
      {playlists.length > 0 && (
        <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
          {playlists.map((p) => {
            const already = p.tracks.some((t) => t.youtubeId === track.youtubeId);
            return (
              <MenuButton key={p.id} label={p.name} done={already} onClick={() => handleAddToPlaylist(p.id, p.name, already)} />
            );
          })}
        </div>
      )}
      {creating ? (
        <div className="flex items-center gap-1.5 px-2 py-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreatePlaylist();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Nom de la playlist…"
            className="flex-1 min-w-0 bg-foreground/5 border border-foreground/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25"
          />
          <button
            onClick={handleCreatePlaylist}
            disabled={!newName.trim()}
            className="px-2.5 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold disabled:opacity-30 flex-shrink-0"
          >
            OK
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-medium text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors min-h-[40px]"
        >
          <PlusGlyph /> Nouvelle playlist…
        </button>
      )}
    </div>
  );

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Ajouter à…"
        className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/15 text-foreground/70 hover:text-foreground transition-all flex-shrink-0"
      >
        <PlusGlyph />
      </button>

      {open && (
        <>
          {/* Backdrop invisible (desktop) / assombri (mobile) qui ferme au clic. */}
          <div
            className="fixed inset-0 z-[129] bg-black/50 sm:bg-transparent"
            onClick={(e) => { e.stopPropagation(); close(); }}
          />

          {/* Desktop : popover absolu sous le bouton */}
          <div
            className="hidden sm:block absolute z-[130] right-0 top-full mt-1 w-64 bg-card border border-foreground/10 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {menu}
          </div>

          {/* Mobile : bottom-sheet */}
          <div
            className="sm:hidden fixed inset-x-0 bottom-0 z-[130] rounded-t-2xl bg-card border-t border-foreground/10 p-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-foreground/15 mx-auto mb-2" />
            {menu}
          </div>
        </>
      )}
    </div>
  );
}

function MenuButton({
  label,
  done,
  onClick,
  icon,
}: {
  label: string;
  done: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors min-h-[40px]",
        done ? "text-foreground/30 cursor-default" : "text-foreground/85 hover:bg-foreground/[0.06]"
      )}
    >
      {icon && <span className="flex-shrink-0 text-foreground/50">{icon}</span>}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {done && <CheckGlyph />}
    </button>
  );
}

function PlayGlyph() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  );
}
function QueueGlyph() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="8" y1="6" x2="21" y2="6" strokeLinecap="round" /><line x1="8" y1="12" x2="21" y2="12" strokeLinecap="round" /><line x1="8" y1="18" x2="14" y2="18" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function LibraryGlyph() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusGlyph() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function CheckGlyph() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
