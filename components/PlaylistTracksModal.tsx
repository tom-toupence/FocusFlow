"use client";

import { useEffect, useState } from "react";
import {
  SavedPlaylist,
  isRadioMix,
  fetchPlaylistVideos,
  fetchMixVideos,
  usePlaylistStore,
} from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

interface Track { id: string; title: string; }

// Visualisation des titres d'une playlist sauvegardée (résolution serveur, comme
// en session) + recommandations liées. « + Playlist » ajoute un titre recommandé
// aux extras de la playlist (joués à sa suite — on ne peut pas modifier une
// playlist YouTube elle-même) ; « + File » l'ajoute à la File FocusFlow.
export default function PlaylistTracksModal({
  playlist,
  onClose,
}: {
  playlist: SavedPlaylist;
  onClose: () => void;
}) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [recs, setRecs] = useState<Track[] | null>(null);
  const queueItems = useQueueStore((s) => s.items);
  const addToQueue = useQueueStore((s) => s.addItem);
  // Version vivante de la playlist (extras mis à jour en direct).
  const live = usePlaylistStore((s) => s.playlists.find((p) => p.id === playlist.id)) ?? playlist;
  const extras = live.extraVideos ?? [];
  const { addExtraVideo, removeExtraVideo } = usePlaylistStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = isRadioMix(playlist.playlistId)
        ? await fetchMixVideos(playlist.playlistId, playlist.startVideoId).then(({ ids, titles }) =>
            ids.map((id) => ({ id, title: titles[id] ?? "Titre du mix" }))
          )
        : await fetchPlaylistVideos(playlist.playlistId, playlist.startVideoId);
      if (cancelled) return;
      setTracks(result);

      // Recommandations : mix radio YouTube semé sur le 1er titre de la playlist.
      const seed = result[0]?.id ?? playlist.startVideoId;
      if (!seed) { setRecs([]); return; }
      const { ids, titles } = await fetchMixVideos(`RD${seed}`, seed);
      if (cancelled) return;
      const known = new Set(result.map((t) => t.id));
      setRecs(
        ids
          .filter((id) => id !== seed && !known.has(id))
          .slice(0, 8)
          .map((id) => ({ id, title: titles[id] ?? "Titre similaire" }))
      );
    })();
    return () => { cancelled = true; };
  }, [playlist.playlistId, playlist.startVideoId]);

  const handleAddQueue = (t: Track) => {
    addToQueue({
      youtubeId: t.id,
      title: t.title,
      thumbnailUrl: `https://img.youtube.com/vi/${t.id}/mqdefault.jpg`,
    });
    toast({ title: "Ajouté à la file", description: t.title, emoji: "🎵", accent: "emerald" });
  };

  const handleAddToPlaylist = (t: Track) => {
    addExtraVideo(live.id, t);
    toast({ title: "Ajouté à la playlist", description: `${t.title} sera joué à la suite de « ${live.title} ».`, emoji: "🎶", accent: "emerald" });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-card border border-foreground/10 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{live.title}</h3>
            <p className="text-xs text-foreground/40 mt-0.5">
              {tracks === null
                ? "Chargement des titres…"
                : `${tracks.length} titre${tracks.length > 1 ? "s" : ""}${extras.length > 0 ? ` + ${extras.length} ajouté${extras.length > 1 ? "s" : ""}` : ""}`}
            </p>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors flex-shrink-0 ml-3">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
          {/* ── Titres de la playlist ─────────────────────────────────────── */}
          {tracks === null ? (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-foreground/[0.05] anim-skeleton" />
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <p className="text-sm text-foreground/35 text-center py-6">
              Impossible de récupérer les titres de cette playlist — elle sera quand même jouée normalement en session.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {tracks.map((t, idx) => (
                <TrackRow key={t.id} track={t} index={idx + 1}>
                  <ActionButton
                    disabled={queueItems.some((i) => i.youtubeId === t.id)}
                    labelOn="Dans la file"
                    labelOff="+ File"
                    onClick={() => handleAddQueue(t)}
                  />
                </TrackRow>
              ))}
            </div>
          )}

          {/* ── Titres ajoutés par l'utilisateur ──────────────────────────── */}
          {extras.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-foreground/30 uppercase tracking-widest px-2 mb-2">
                Ajoutés par toi — joués à la suite
              </p>
              <div className="flex flex-col gap-1">
                {extras.map((t, idx) => (
                  <TrackRow key={t.id} track={t} index={(tracks?.length ?? 0) + idx + 1}>
                    <button
                      onClick={() => removeExtraVideo(live.id, t.id)}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Retirer de la playlist"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                    </button>
                  </TrackRow>
                ))}
              </div>
            </div>
          )}

          {/* ── Recommandations liées ─────────────────────────────────────── */}
          {recs !== null && recs.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-foreground/30 uppercase tracking-widest px-2 mb-2">
                Recommandations liées
              </p>
              <div className="flex flex-col gap-1">
                {recs.map((t) => {
                  const added = extras.some((e) => e.id === t.id);
                  return (
                    <TrackRow key={t.id} track={t}>
                      <ActionButton
                        disabled={added}
                        labelOn="Ajouté"
                        labelOff="+ Playlist"
                        onClick={() => handleAddToPlaylist(t)}
                      />
                      <ActionButton
                        disabled={queueItems.some((i) => i.youtubeId === t.id)}
                        labelOn="Dans la file"
                        labelOff="+ File"
                        onClick={() => handleAddQueue(t)}
                      />
                    </TrackRow>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackRow({ track, index, children }: { track: Track; index?: number; children: React.ReactNode }) {
  return (
    <div className="group flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-foreground/[0.04] transition-colors">
      {index !== undefined && (
        <span className="text-[11px] text-foreground/30 tabular-nums w-5 text-center flex-shrink-0">{index}</span>
      )}
      <div className="w-14 h-9 rounded-md overflow-hidden bg-foreground/10 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://img.youtube.com/vi/${track.id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="flex-1 min-w-0 text-sm text-foreground/85 truncate">{track.title}</p>
      <div className="flex items-center gap-1 flex-shrink-0">{children}</div>
    </div>
  );
}

function ActionButton({ disabled, labelOn, labelOff, onClick }: { disabled: boolean; labelOn: string; labelOff: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
        disabled
          ? "text-foreground/25 bg-foreground/5 cursor-default"
          : "text-foreground/60 hover:text-foreground bg-foreground/5 hover:bg-foreground/10"
      )}
    >
      {disabled ? labelOn : labelOff}
    </button>
  );
}
