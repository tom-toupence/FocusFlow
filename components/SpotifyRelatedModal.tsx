"use client";
// Titres proches d'une playlist Spotify, hors session. Même échantillonnage
// que la lecture continue (graines réparties sur toute la playlist, titres
// phares de leurs artistes). Hors session il n'y a pas de lecteur où mettre
// un titre en file, et les autorisations demandées à Spotify n'incluent pas la
// modification des playlists : chaque titre s'ouvre donc dans Spotify. En
// session, le panneau « À venir » permet de les ajouter à la suite.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { suggestForPlaylist } from "@/lib/playback/spotifySuggest";
import type { Track } from "@/lib/playback/types";

export default function SpotifyRelatedModal({ playlist, onClose }: { playlist: { uri: string; name: string }; onClose: () => void }) {
  // undefined = chargement ; null = non connecté ; [] = rien trouvé.
  const [list, setList] = useState<Track[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    suggestForPlaylist(playlist.uri).then((r) => { if (!cancelled) setList(r); }).catch(() => { if (!cancelled) setList([]); });
    return () => { cancelled = true; };
  }, [playlist.uri]);

  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtn.current?.focus(); // focus initial dans la boîte de dialogue
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotify-related-title"
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-card border border-foreground/10 rounded-[6px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10">
          <div className="min-w-0">
            <h3 id="spotify-related-title" className="text-sm font-semibold text-foreground truncate">Titres proches de « {playlist.name} »</h3>
            <p className="text-xs text-ink-3 mt-0.5">Choisis-en un pour l&apos;écouter dans Spotify. En session, ajoute-les à la suite depuis « À venir ».</p>
          </div>
          <button ref={closeBtn} onClick={onClose} aria-label="Fermer" className="text-ink-3 hover:text-foreground transition-colors flex-shrink-0 ml-3">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {list === undefined ? (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 rounded-[4px] bg-foreground/[0.05] anim-skeleton" />)}
            </div>
          ) : list === null ? (
            <p className="text-sm text-ink-3 text-center py-6">Ta connexion Spotify a expiré. Reconnecte-toi pour voir des titres proches.</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-ink-3 text-center py-6">Aucun titre proche trouvé (playlist vide, réseau ou limite de requêtes). Réessaie plus tard.</p>
          ) : (
            <ul className="flex flex-col">
              {list.map((t) => (
                <li key={t.id}>
                  <a
                    href={`https://open.spotify.com/track/${t.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-2 py-2 rounded-[4px] hover:bg-foreground/[0.05] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{t.title}</p>
                      {t.subtitle && <p className="text-xs text-ink-3 truncate">{t.subtitle}</p>}
                    </div>
                    <span className="text-[11px] text-ink-3 flex-shrink-0">Ouvrir dans Spotify</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
