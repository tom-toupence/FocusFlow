"use client";
// Le lecteur de la session, quelle que soit la source. Monte le bon lecteur
// (YouTube via son adaptateur, Spotify, Twitch), l'habillage qui va avec, et
// remonte l'adaptateur à la page. C'est le SEUL endroit qui distingue les
// sources : la page ne pilote qu'un `PlayerAdapter`.
import { useEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from "react";
import SpotifyPlayer from "@/components/SpotifyPlayer";
import TwitchPlayer from "@/components/TwitchPlayer";
import { usePlaybackPrefsStore } from "@/store/playbackPrefsStore";
import type { ExtendedEvent, PlayerAdapter } from "@/lib/playback/types";
import { YouTubeAdapter } from "@/lib/playback/youtube";
import type { SessionMedia as Media } from "@/lib/playback/useSessionMedia";

interface Props {
  media: Media;
  /** Lecture voulue (travail, minuteur en marche). */
  playing: boolean;
  isBreak: boolean;
  volume: number;
  /** Identifiant de la piste en cours (pulsation du halo à chaque titre). */
  trackId?: string;
  /** Setter React : le nettoyage ne retire que SON adaptateur. */
  onAdapter: Dispatch<SetStateAction<PlayerAdapter | null>>;
  onExtended: (e: ExtendedEvent, kind: Media["kind"]) => void;
  /** Décor quand la source n'a pas d'image (Spotify) : la ville. */
  backdrop: ReactNode;
}

export default function SessionMedia({ media, playing, isBreak, volume, trackId, onAdapter, onExtended, backdrop }: Props) {
  const { kind, youtube } = media;
  // Valeurs courantes lues à la création de l'adaptateur YouTube, sans en
  // faire des dépendances (il n'est recréé que quand la source change).
  const latest = useRef({ playing, volume, onAdapter, onExtended, youtube });
  useEffect(() => { latest.current = { playing, volume, onAdapter, onExtended, youtube }; });

  const ytKey = youtube ? JSON.stringify(youtube.type === "queue" ? youtube.tracks.map((t) => t.id) : youtube) : "";
  useEffect(() => {
    const src = latest.current.youtube;
    if (!src) return;
    const { shuffle, loop } = usePlaybackPrefsStore.getState();
    const a = new YouTubeAdapter("yt-player", src, {
      volume: latest.current.volume,
      shuffle,
      loop,
      playing: latest.current.playing,
      onExtended: (e) => latest.current.onExtended(e, "youtube"),
    });
    latest.current.onAdapter(a);
    return () => { a.destroy(); latest.current.onAdapter((cur) => (cur === a ? null : cur)); };
  }, [ytKey]);

  const loop = usePlaybackPrefsStore((s) => s.loop);

  return (
    <>
      {kind === "spotify" && media.spotify ? (
        <>
          {/* Aucune image avec Spotify : la ville sert de décor. Démontée
              pendant la halte (qui a la sienne) : jamais deux scènes. */}
          {!isBreak && backdrop}
          <SpotifyPlayer
            shouldPlay={playing}
            playlistUri={media.spotify.playlistUri}
            backdrop={false}
            controls={false}
            initialLoop={loop}
            onAdapter={onAdapter}
            onExtended={(e) => onExtended(e, "spotify")}
          />
        </>
      ) : kind === "twitch" && media.twitch ? (
        <TwitchPlayer channel={media.twitch.channel} vodId={media.twitch.vodId} token={media.twitch.token} volume={volume} onAdapter={onAdapter} />
      ) : (
        <div id="yt-player" className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }} />
      )}

      {/* Vignette et halo : pas sur Twitch (luminosité naturelle du flux). */}
      {!isBreak && kind !== "twitch" && (
        <>
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.45)_100%)]" />
          <div
            key={`halo-${trackId ?? ""}`}
            className="absolute inset-0 pointer-events-none anim-halo-pulse"
            style={{ boxShadow: "inset 0 0 160px 20px color-mix(in oklab, var(--ambient) 55%, transparent)", opacity: 0.35 }}
          />
        </>
      )}

      {/* Contenu réservé aux abonnés : repli vers la source. */}
      {media.external && !isBreak && (
        <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-10 px-3 max-w-full">
          <a
            href={media.external.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/70 backdrop-blur-md border border-[#9146ff]/30 text-white/70 hover:text-white hover:border-[#9146ff]/60 text-xs font-medium transition-all"
          >
            <TwitchGlyph className="w-3.5 h-3.5 text-[#9146ff]" />
            Contenu réservé aux abonnés ? {media.external.label}
            <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      )}
    </>
  );
}

export function TwitchGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  );
}
