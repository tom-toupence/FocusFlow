"use client";

import { useEffect, useRef } from "react";
import { useSpotifyStore } from "@/store/spotifyStore";
import { startPlayback, refreshAccessToken } from "@/lib/spotify";

// ─── Spotify SDK types ────────────────────────────────────────────────────────

interface SpotifySDKPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (data: unknown) => void) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
}

declare global {
  interface Window {
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifySDKPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  shouldPlay: boolean;
  playlistUri: string;
}

export default function SpotifyPlayer({ shouldPlay, playlistUri }: Props) {
  const {
    accessToken, refreshToken, expiresAt,
    currentTrack, deviceId,
    setDeviceId, setCurrentTrack, updateToken, clearAuth,
  } = useSpotifyStore();

  const playerRef = useRef<SpotifySDKPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(deviceId);
  const playlistStartedRef = useRef<string | null>(null);
  const shouldPlayRef = useRef(shouldPlay);
  const tokenRef = useRef(accessToken);
  const refreshTokenRef = useRef(refreshToken);
  const expiresAtRef = useRef(expiresAt);

  useEffect(() => { shouldPlayRef.current = shouldPlay; }, [shouldPlay]);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { refreshTokenRef.current = refreshToken; }, [refreshToken]);
  useEffect(() => { expiresAtRef.current = expiresAt; }, [expiresAt]);
  useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);

  const getValidToken = async (): Promise<string | null> => {
    if (!tokenRef.current) return null;
    // Token still valid (with 60s buffer)
    if (expiresAtRef.current && Date.now() < expiresAtRef.current - 60_000) {
      return tokenRef.current;
    }
    if (!refreshTokenRef.current) { clearAuth(); return null; }
    const result = await refreshAccessToken(refreshTokenRef.current);
    if (!result) { clearAuth(); return null; }
    updateToken(result.accessToken, result.expiresAt);
    tokenRef.current = result.accessToken;
    expiresAtRef.current = result.expiresAt;
    return result.accessToken;
  };

  const initPlayer = () => {
    if (playerRef.current || !window.Spotify) return;

    const player = new window.Spotify.Player({
      name: "FocusFlow",
      getOAuthToken: (cb) => {
        getValidToken().then((token) => { if (token) cb(token); });
      },
      volume: 0.8,
    });

    player.addListener("ready", async (data: unknown) => {
      const { device_id } = data as { device_id: string };
      deviceIdRef.current = device_id;
      setDeviceId(device_id);
      if (shouldPlayRef.current) {
        const token = await getValidToken();
        if (token && playlistUri) {
          await startPlayback(token, device_id, playlistUri);
          playlistStartedRef.current = playlistUri;
        }
      }
    });

    player.addListener("player_state_changed", (state: unknown) => {
      if (!state) return;
      const s = state as {
        track_window?: {
          current_track?: {
            name: string;
            artists: Array<{ name: string }>;
            album: { name: string; images: Array<{ url: string }> };
          };
        };
      };
      const track = s.track_window?.current_track;
      if (track) {
        setCurrentTrack({
          name: track.name,
          artist: track.artists.map((a) => a.name).join(", "),
          albumName: track.album.name,
          albumArt: track.album.images[0]?.url,
        });
      }
    });

    player.addListener("not_ready", () => {
      deviceIdRef.current = null;
      setDeviceId(null);
    });

    player.addListener("authentication_error", () => clearAuth());

    player.connect();
    playerRef.current = player;
  };

  // ── SDK init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;

    if (window.Spotify?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        document.head.appendChild(script);
      }
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setDeviceId(null);
      setCurrentTrack(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start / switch playlist when URI or device changes ──────────────────────
  useEffect(() => {
    if (!deviceIdRef.current || !playlistUri) return;
    if (playlistStartedRef.current === playlistUri) return;
    getValidToken().then((token) => {
      if (token && deviceIdRef.current) {
        startPlayback(token, deviceIdRef.current, playlistUri);
        playlistStartedRef.current = playlistUri;
      }
    });
  }, [playlistUri, deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play / pause ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current) return;
    if (shouldPlay) {
      playerRef.current.resume().catch(() => {});
    } else {
      playerRef.current.pause().catch(() => {});
    }
  }, [shouldPlay]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Album art background */}
      {currentTrack?.albumArt ? (
        <img
          src={currentTrack.albumArt}
          alt={currentTrack.albumName ?? ""}
          className="absolute inset-0 w-full h-full object-cover scale-110"
          style={{ filter: "blur(24px) brightness(0.5)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a1a] to-black" />
      )}

      {/* Sharp album art — centered */}
      {currentTrack?.albumArt && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={currentTrack.albumArt}
            alt={currentTrack.albumName ?? ""}
            className="w-56 h-56 rounded-2xl shadow-2xl shadow-black/80 object-cover opacity-80"
          />
        </div>
      )}

      {/* Track info — bottom left (above the session controls) */}
      {currentTrack && (
        <div className="absolute bottom-20 left-6 flex items-center gap-3 z-10">
          {currentTrack.albumArt && (
            <img
              src={currentTrack.albumArt}
              alt=""
              className="w-11 h-11 rounded-xl shadow-lg flex-shrink-0 object-cover"
            />
          )}
          <div>
            <p className="text-white text-sm font-semibold leading-tight drop-shadow">{currentTrack.name}</p>
            <p className="text-white/50 text-xs drop-shadow">{currentTrack.artist}</p>
          </div>
          {/* Spotify logo */}
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#1db954] ml-1 flex-shrink-0" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
      )}
    </div>
  );
}
