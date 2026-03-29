"use client";

import { useEffect, useRef } from "react";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { loginWithSpotify } from "@/lib/spotify";
import { loginWithTwitch } from "@/lib/twitch";

interface Props {
  open: boolean;
  onClose: () => void;
}

function UserAvatar({
  url,
  name,
  color,
  size = 10,
}: {
  url: string | null;
  name: string | null;
  color: string;
  size?: number;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: `${color}25` }}
    >
      <span className="font-semibold text-sm" style={{ color }}>
        {(name ?? "?")[0].toUpperCase()}
      </span>
    </div>
  );
}

export default function AccountsPanel({ open, onClose }: Props) {
  const spotify = useSpotifyStore();
  const twitch = useTwitchStore();
  const panelRef = useRef<HTMLDivElement>(null);

  const isSpotifyConnected = !!spotify.accessToken;
  const isTwitchConnected = !!twitch.accessToken;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-4 top-[60px] z-50 w-76 bg-background border border-foreground/[0.09] rounded-2xl shadow-2xl shadow-black/20 overflow-hidden"
        style={{ width: 300 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/[0.06]">
          <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
            Services connectés
          </p>
          <button
            onClick={onClose}
            className="text-foreground/25 hover:text-foreground/60 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-3 space-y-2">
          {/* ── Spotify ── */}
          <div className="rounded-xl p-3.5 bg-foreground/[0.03] border border-foreground/[0.06]">
            <div className="flex items-center gap-2 mb-0.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#1db954] flex-shrink-0" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span className="text-xs font-semibold text-foreground/50">Spotify</span>
              <div className={`ml-auto w-1.5 h-1.5 rounded-full ${isSpotifyConnected ? "bg-[#1db954]" : "bg-foreground/15"}`} />
            </div>

            {isSpotifyConnected ? (
              <>
                <div className="flex items-center gap-2.5 mt-2.5">
                  <UserAvatar url={spotify.avatarUrl} name={spotify.displayName} color="#1db954" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{spotify.displayName ?? "Spotify"}</p>
                      {spotify.isPremium === true && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#1db954]/15 text-[#1db954] font-bold tracking-wide flex-shrink-0">PREMIUM</span>
                      )}
                      {spotify.isPremium === false && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-400 font-bold tracking-wide flex-shrink-0">FREE</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-foreground/[0.05]">
                  <button
                    onClick={() => { spotify.clearAuth(); loginWithSpotify(); }}
                    className="text-[11px] text-foreground/45 hover:text-foreground/80 transition-colors"
                  >
                    Changer de compte
                  </button>
                  <span className="text-foreground/15 text-xs">·</span>
                  <button
                    onClick={() => { spotify.clearAuth(); onClose(); }}
                    className="text-[11px] text-foreground/35 hover:text-red-400 transition-colors"
                  >
                    Déconnecter
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => { loginWithSpotify(); onClose(); }}
                className="w-full mt-2.5 py-2 rounded-lg bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-semibold transition-all"
              >
                Connecter Spotify
              </button>
            )}
          </div>

          {/* ── Twitch ── */}
          <div className="rounded-xl p-3.5 bg-foreground/[0.03] border border-foreground/[0.06]">
            <div className="flex items-center gap-2 mb-0.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#9146ff] flex-shrink-0" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
              </svg>
              <span className="text-xs font-semibold text-foreground/50">Twitch</span>
              <div className={`ml-auto w-1.5 h-1.5 rounded-full ${isTwitchConnected ? "bg-[#9146ff]" : "bg-foreground/15"}`} />
            </div>

            {isTwitchConnected ? (
              <>
                <div className="flex items-center gap-2.5 mt-2.5">
                  <UserAvatar url={twitch.avatarUrl} name={twitch.userDisplayName ?? twitch.userLogin} color="#9146ff" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {twitch.userDisplayName ?? twitch.userLogin ?? "Twitch"}
                    </p>
                    {twitch.userLogin && twitch.userDisplayName && twitch.userDisplayName !== twitch.userLogin && (
                      <p className="text-[11px] text-foreground/30 truncate">@{twitch.userLogin}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-foreground/[0.05]">
                  <button
                    onClick={() => { twitch.clearAuth(); loginWithTwitch(true); }}
                    className="text-[11px] text-foreground/45 hover:text-foreground/80 transition-colors"
                  >
                    Changer de compte
                  </button>
                  <span className="text-foreground/15 text-xs">·</span>
                  <button
                    onClick={() => { twitch.clearAuth(); onClose(); }}
                    className="text-[11px] text-foreground/35 hover:text-red-400 transition-colors"
                  >
                    Déconnecter
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => { loginWithTwitch(); onClose(); }}
                className="w-full mt-2.5 py-2 rounded-lg bg-[#9146ff] hover:bg-[#7c3ae0] text-white text-xs font-semibold transition-all"
              >
                Connecter Twitch
              </button>
            )}
          </div>
        </div>

        {!isSpotifyConnected && !isTwitchConnected && (
          <p className="text-[11px] text-foreground/20 text-center pb-4 px-4">
            Connecte tes services pour accéder à tes playlists et streams.
          </p>
        )}
      </div>
    </>
  );
}
