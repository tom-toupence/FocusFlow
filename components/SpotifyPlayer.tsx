"use client";

import { useEffect, useRef, useState } from "react";
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

type Status = "loading" | "connecting" | "ready" | "error";

export default function SpotifyPlayer({ shouldPlay, playlistUri }: Props) {
  const {
    accessToken, refreshToken, expiresAt,
    currentTrack, deviceId,
    setDeviceId, setCurrentTrack, updateToken, clearAuth,
  } = useSpotifyStore();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    console.log("[Spotify] initPlayer called");
    setStatus("connecting");

    const player = new window.Spotify.Player({
      name: "FocusFlow",
      getOAuthToken: (cb) => {
        console.log("[Spotify] getOAuthToken called");
        getValidToken().then((token) => {
          if (token) {
            console.log("[Spotify] token provided to SDK");
            cb(token);
          } else {
            console.error("[Spotify] no valid token available");
          }
        });
      },
      volume: 0.8,
    });

    player.addListener("ready", async (data: unknown) => {
      const { device_id } = data as { device_id: string };
      console.log("[Spotify] ready, device_id:", device_id);
      deviceIdRef.current = device_id;
      setDeviceId(device_id);
      setStatus("ready");

      if (shouldPlayRef.current && playlistUri) {
        const token = await getValidToken();
        if (token) {
          console.log("[Spotify] starting playback:", playlistUri);
          const res = await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ context_uri: playlistUri }),
            }
          );
          console.log("[Spotify] startPlayback response:", res.status, res.statusText);
          if (!res.ok) {
            const body = await res.text();
            console.error("[Spotify] startPlayback error body:", body);
            setErrorMsg(`Playback error ${res.status}: ${body}`);
          } else {
            playlistStartedRef.current = playlistUri;
          }
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

    player.addListener("not_ready", (data: unknown) => {
      console.warn("[Spotify] not_ready:", data);
      deviceIdRef.current = null;
      setDeviceId(null);
      setStatus("connecting");
    });

    player.addListener("initialization_error", (data: unknown) => {
      const msg = (data as { message: string }).message;
      console.error("[Spotify] initialization_error:", msg);
      setStatus("error");
      setErrorMsg(`Init error: ${msg}`);
    });

    player.addListener("authentication_error", (data: unknown) => {
      const msg = (data as { message: string }).message;
      console.error("[Spotify] authentication_error:", msg);
      setStatus("error");
      setErrorMsg(`Auth error: ${msg}`);
      clearAuth();
    });

    player.addListener("account_error", (data: unknown) => {
      const msg = (data as { message: string }).message;
      console.error("[Spotify] account_error (Premium required?):", msg);
      setStatus("error");
      setErrorMsg(`Account error: ${msg}`);
    });

    player.addListener("playback_error", (data: unknown) => {
      const msg = (data as { message: string }).message;
      console.error("[Spotify] playback_error:", msg);
    });

    player.connect().then((success) => {
      console.log("[Spotify] player.connect() result:", success);
    });

    playerRef.current = player;
  };

  // ── SDK init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    console.log("[Spotify] mounting, accessToken present");

    if (window.Spotify?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        console.log("[Spotify] loading SDK script");
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        document.head.appendChild(script);
      }
      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log("[Spotify] SDK ready callback");
        initPlayer();
      };
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setDeviceId(null);
      setCurrentTrack(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start / switch playlist ───────────────────────────────────────────────
  useEffect(() => {
    if (!deviceIdRef.current || !playlistUri) return;
    if (playlistStartedRef.current === playlistUri) return;
    getValidToken().then(async (token) => {
      if (token && deviceIdRef.current) {
        await startPlayback(token, deviceIdRef.current, playlistUri);
        playlistStartedRef.current = playlistUri;
      }
    });
  }, [playlistUri, deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play / pause ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current) return;
    if (shouldPlay) {
      playerRef.current.resume().catch(() => {});
    } else {
      playerRef.current.pause().catch(() => {});
    }
  }, [shouldPlay]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Background */}
      {currentTrack?.albumArt ? (
        <img
          src={currentTrack.albumArt}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110"
          style={{ filter: "blur(24px) brightness(0.5)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a1a] to-black" />
      )}

      {/* Album art centered */}
      {currentTrack?.albumArt && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={currentTrack.albumArt}
            alt={currentTrack.albumName ?? ""}
            className="w-56 h-56 rounded-2xl shadow-2xl shadow-black/80 object-cover opacity-80"
          />
        </div>
      )}

      {/* Status indicator while connecting */}
      {status !== "ready" && !currentTrack && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            {status === "error" ? (
              <>
                <p className="text-red-400 text-sm font-medium">Erreur Spotify</p>
                {errorMsg && <p className="text-red-400/60 text-xs max-w-xs text-center">{errorMsg}</p>}
              </>
            ) : (
              <>
                <div className="w-6 h-6 border-2 border-white/20 border-t-[#1db954] rounded-full animate-spin" />
                <p className="text-white/40 text-xs">
                  {status === "loading" ? "Chargement…" : "Connexion Spotify…"}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Track info */}
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
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#1db954] ml-1 flex-shrink-0" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
      )}
    </div>
  );
}
