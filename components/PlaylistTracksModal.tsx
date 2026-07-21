"use client";

import { useEffect, useState } from "react";
import { SavedPlaylist, isRadioMix, fetchPlaylistVideos, fetchMixVideos } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// Visualisation des titres d'une playlist sauvegardée (résolution serveur, comme
// en session). Pas de reorder ici : pour un ordre personnalisé, on ajoute les
// titres voulus à la File FocusFlow (réordonnable), via le bouton « + File ».
export default function PlaylistTracksModal({
  playlist,
  onClose,
}: {
  playlist: SavedPlaylist;
  onClose: () => void;
}) {
  const [tracks, setTracks] = useState<{ id: string; title: string }[] | null>(null);
  const queueItems = useQueueStore((s) => s.items);
  const addToQueue = useQueueStore((s) => s.addItem);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = isRadioMix(playlist.playlistId)
        ? await fetchMixVideos(playlist.playlistId, playlist.startVideoId).then(({ ids, titles }) =>
            ids.map((id) => ({ id, title: titles[id] ?? "Titre du mix" }))
          )
        : await fetchPlaylistVideos(playlist.playlistId);
      if (!cancelled) setTracks(result);
    })();
    return () => { cancelled = true; };
  }, [playlist.playlistId, playlist.startVideoId]);

  const handleAdd = (t: { id: string; title: string }) => {
    addToQueue({
      youtubeId: t.id,
      title: t.title,
      thumbnailUrl: `https://img.youtube.com/vi/${t.id}/mqdefault.jpg`,
    });
    toast({ title: "Ajouté à la file", description: t.title, emoji: "🎵", accent: "emerald" });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col bg-card border border-foreground/10 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{playlist.title}</h3>
            <p className="text-xs text-foreground/40 mt-0.5">
              {tracks === null ? "Chargement des titres…" : `${tracks.length} titre${tracks.length > 1 ? "s" : ""} · ajoute ceux que tu veux à ta file`}
            </p>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors flex-shrink-0 ml-3">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {tracks === null ? (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-foreground/[0.05] anim-skeleton" />
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <p className="text-sm text-foreground/35 text-center py-10">
              Impossible de récupérer les titres de cette playlist — elle sera quand même jouée normalement en session.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {tracks.map((t, idx) => {
                const inQueue = queueItems.some((i) => i.youtubeId === t.id);
                return (
                  <div key={t.id} className="group flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-foreground/[0.04] transition-colors">
                    <span className="text-[11px] text-foreground/30 tabular-nums w-5 text-center flex-shrink-0">{idx + 1}</span>
                    <div className="w-14 h-9 rounded-md overflow-hidden bg-foreground/10 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://img.youtube.com/vi/${t.id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <p className="flex-1 min-w-0 text-sm text-foreground/85 truncate">{t.title}</p>
                    <button
                      onClick={() => handleAdd(t)}
                      disabled={inQueue}
                      className={cn(
                        "flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                        inQueue
                          ? "text-foreground/25 bg-foreground/5 cursor-default"
                          : "text-foreground/60 hover:text-foreground bg-foreground/5 hover:bg-foreground/10"
                      )}
                      title={inQueue ? "Déjà dans la file" : "Ajouter à la File FocusFlow"}
                    >
                      {inQueue ? "Dans la file" : "+ File"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
