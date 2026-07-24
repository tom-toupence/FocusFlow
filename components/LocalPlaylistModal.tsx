"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalPlaylistStore } from "@/store/localPlaylistStore";
import { playLocalPlaylist } from "@/lib/playback";
import { fetchAiQueries, fetchSearchVideos } from "@/lib/recommendations";
import { fetchMixVideos } from "@/store/playlistStore";
import AddToMenu from "@/components/AddToMenu";
import { cn } from "@/lib/utils";

// Contenu d'une playlist LOCALE (créée par l'utilisateur, via AddToMenu ou la
// File d'attente sauvegardée) : nom éditable, lecture, réordonnancement, et
// « Recommandations pour cette playlist » (coach IA scope playlist, repli mix RD).
export default function LocalPlaylistModal({
  playlistId,
  onClose,
}: {
  playlistId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const playlist = useLocalPlaylistStore((s) => s.playlists.find((p) => p.id === playlistId));
  const { renamePlaylist, removeTrack, moveTrack, addTrack } = useLocalPlaylistStore();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(playlist?.name ?? "");
  // Recommandations pour cette playlist (null = chargement).
  const [recs, setRecs] = useState<{ id: string; title: string }[] | null>(null);
  const trackCount = playlist?.tracks.length ?? 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!playlist || playlist.tracks.length === 0) { setRecs([]); return; }
      const known = new Set(playlist.tracks.map((t) => t.youtubeId));
      // Coach IA scope playlist (interprétation univers/genre)…
      const aiQueries = await fetchAiQueries({
        titles: playlist.tracks.slice(0, 20).map((t) => t.title),
        scope: "playlist",
        playlistName: playlist.name,
      });
      if (cancelled) return;
      if (aiQueries && aiQueries.length > 0) {
        const found = (await Promise.all(aiQueries.slice(0, 2).map((q) => fetchSearchVideos(q.query, 0)))).flat();
        if (cancelled) return;
        const seen = new Set<string>();
        const merged = found.filter((v) => {
          if (known.has(v.id) || seen.has(v.id)) return false;
          seen.add(v.id);
          return true;
        }).slice(0, 8);
        if (merged.length > 0) {
          setRecs(merged.map((v) => ({ id: v.id, title: v.title })));
          return;
        }
      }
      // …repli : mix RD semé sur le 1er titre.
      const seed = playlist.tracks[0].youtubeId;
      const { ids, titles } = await fetchMixVideos(`RD${seed}`, seed);
      if (cancelled) return;
      setRecs(
        ids.filter((id) => id !== seed && !known.has(id)).slice(0, 8)
          .map((id) => ({ id, title: titles[id] ?? "Titre similaire" }))
      );
    })();
    return () => { cancelled = true; };
    // Relance seulement quand la playlist ou son nombre de titres change.
  }, [playlistId, trackCount]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!playlist) return null;

  const handlePlay = () => {
    if (playLocalPlaylist(playlist.id)) {
      onClose();
      router.push("/settings");
    }
  };

  const commitName = () => {
    const name = nameDraft.trim();
    if (name) renamePlaylist(playlist.id, name);
    setEditingName(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-card border border-foreground/10 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10 gap-3">
          <div className="min-w-0 flex-1">
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setNameDraft(playlist.name); setEditingName(false); } }}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:border-foreground/25"
              />
            ) : (
              <button
                onClick={() => { setNameDraft(playlist.name); setEditingName(true); }}
                className="flex items-center gap-1.5 group min-w-0"
                title="Renommer"
              >
                <h3 className="text-sm font-semibold text-foreground truncate">{playlist.name}</h3>
                <svg className="w-3 h-3 text-foreground/25 group-hover:text-foreground/60 transition-colors flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <p className="text-xs text-foreground/40 mt-0.5">
              {playlist.tracks.length} titre{playlist.tracks.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {playlist.tracks.length > 0 && (
              <button
                onClick={handlePlay}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-foreground text-background font-semibold text-xs hover:bg-foreground/90 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                Lire
              </button>
            )}
            <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {playlist.tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-foreground/25 text-center px-6">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
              <p className="text-sm">Playlist vide</p>
              <p className="text-xs">Ajoute des titres depuis Découvrir avec le bouton ＋.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {playlist.tracks.map((t, idx) => (
                <div key={t.youtubeId} className="group flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-foreground/[0.04] transition-colors">
                  <span className="text-[11px] text-foreground/30 tabular-nums w-5 text-center flex-shrink-0">{idx + 1}</span>
                  <div className="w-14 h-9 rounded-md overflow-hidden bg-foreground/10 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.thumbnailUrl ?? `https://img.youtube.com/vi/${t.youtubeId}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground/85 truncate">{t.title}</p>
                    {t.channelName && <p className="text-[11px] text-foreground/35 truncate">{t.channelName}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => moveTrack(playlist.id, t.youtubeId, "up")}
                      disabled={idx === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 transition-all"
                      title="Monter"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button
                      onClick={() => moveTrack(playlist.id, t.youtubeId, "down")}
                      disabled={idx === playlist.tracks.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 transition-all"
                      title="Descendre"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button
                      onClick={() => removeTrack(playlist.id, t.youtubeId)}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all",
                        "sm:opacity-0 sm:group-hover:opacity-100"
                      )}
                      title="Retirer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Recommandations pour cette playlist ───────────────────────── */}
          {recs !== null && recs.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-foreground/30 uppercase tracking-widest px-2 mb-2">
                Recommandations pour cette playlist
              </p>
              <div className="flex flex-col gap-1">
                {recs.map((r) => {
                  const added = playlist.tracks.some((t) => t.youtubeId === r.id);
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-foreground/[0.04] transition-colors">
                      <div className="w-14 h-9 rounded-md overflow-hidden bg-foreground/10 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://img.youtube.com/vi/${r.id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <p className="flex-1 min-w-0 text-sm text-foreground/85 truncate">{r.title}</p>
                      <AddToMenu
                        track={{ youtubeId: r.id, title: r.title, thumbnailUrl: `https://img.youtube.com/vi/${r.id}/mqdefault.jpg` }}
                        extra={{
                          label: "Cette playlist",
                          added,
                          onAdd: () => addTrack(playlist.id, { youtubeId: r.id, title: r.title, thumbnailUrl: `https://img.youtube.com/vi/${r.id}/mqdefault.jpg` }),
                        }}
                      />
                    </div>
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
