"use client";

import { useEffect, useRef, useState } from "react";
import { useSpotifyStore } from "@/store/spotifyStore";
import { startPlayback, setRepeat, setShuffle as apiSetShuffle, refreshAccessToken } from "@/lib/spotify";

// ─── Spotify SDK types ────────────────────────────────────────────────────────

interface SpotifySDKPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (data: unknown) => void) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  setVolume: (vol: number) => Promise<void>;
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
    currentTrack, shuffle,
    setDeviceId, setCurrentTrack, updateToken, clearAuth,
  } = useSpotifyStore();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const [showVolume, setShowVolume] = useState(false);

  // Refs for values used inside SDK callbacks (avoids stale closures)
  const playerRef = useRef<SpotifySDKPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const shouldPlayRef = useRef(shouldPlay);
  const tokenRef = useRef(accessToken);
  const refreshTokenRef = useRef(refreshToken);
  const expiresAtRef = useRef(expiresAt);
  const shuffleRef = useRef(shuffle);
  const playlistUriRef = useRef(playlistUri);
  const initCalledRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  // Tracks which playlistUri was last successfully started — prevents double-start
  const playlistStartedRef = useRef<string | null>(null);

  useEffect(() => { shouldPlayRef.current = shouldPlay; }, [shouldPlay]);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { refreshTokenRef.current = refreshToken; }, [refreshToken]);
  useEffect(() => { expiresAtRef.current = expiresAt; }, [expiresAt]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { playlistUriRef.current = playlistUri; }, [playlistUri]);

  const getValidToken = async (): Promise<string | null> => {
    if (!tokenRef.current) return null;
    if (expiresAtRef.current && Date.now() < expiresAtRef.current - 60_000) {
      return tokenRef.current;
    }
    if (!refreshTokenRef.current) { clearAuth(); return null; }
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    refreshPromiseRef.current = refreshAccessToken(refreshTokenRef.current).then((result) => {
      refreshPromiseRef.current = null;
      if (!result) { clearAuth(); return null; }
      updateToken(result.accessToken, result.expiresAt);
      tokenRef.current = result.accessToken;
      expiresAtRef.current = result.expiresAt;
      return result.accessToken;
    });
    return refreshPromiseRef.current;
  };

  // Single entry point for starting/switching playback — ensures correct order:
  // shuffle → play → repeat (avoids mid-stream track jump caused by late shuffle call)
  const doPlay = async (token: string, device_id: string, uri: string) => {
    await apiSetShuffle(token, device_id, shuffleRef.current);
    await startPlayback(token, device_id, uri);
    await setRepeat(token, device_id, "context");
    playlistStartedRef.current = uri;
  };

  const initPlayer = () => {
    if (initCalledRef.current || playerRef.current || !window.Spotify) return;
    initCalledRef.current = true;
    setStatus("connecting");

    const player = new window.Spotify.Player({
      name: "FocusFlow",
      getOAuthToken: (cb) => {
        getValidToken().then((token) => { if (token) cb(token); });
      },
      volume,
    });

    player.addListener("ready", async (data: unknown) => {
      const { device_id } = data as { device_id: string };
      deviceIdRef.current = device_id;
      setDeviceId(device_id);
      setStatus("ready");

      if (!shouldPlayRef.current || !playlistUriRef.current) return;

      const token = await getValidToken();
      if (!token) return;

      try {
        await doPlay(token, device_id, playlistUriRef.current);
      } catch (err) {
        console.error("[Spotify] doPlay error:", err);
        setErrorMsg("Erreur de lecture");
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
      setStatus("connecting");
    });

    player.addListener("initialization_error", (data: unknown) => {
      const msg = (data as { message: string }).message;
      setStatus("error");
      setErrorMsg(`Init: ${msg}`);
    });

    player.addListener("authentication_error", (data: unknown) => {
      const msg = (data as { message: string }).message;
      console.error("[Spotify] auth error:", msg);
      setStatus("error");
      setErrorMsg(`Auth: ${msg}`);
      clearAuth();
    });

    player.addListener("account_error", (data: unknown) => {
      const msg = (data as { message: string }).message;
      console.error("[Spotify] account error (Premium?):", msg);
      setStatus("error");
      setErrorMsg("Compte Spotify Premium requis");
    });

    player.connect();
    playerRef.current = player;
  };

  // ── SDK init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (window.Spotify?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        document.head.appendChild(script);
      }
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      pollInterval = setInterval(() => {
        if (window.Spotify?.Player) {
          clearInterval(pollInterval!);
          pollInterval = null;
          initPlayer();
        }
      }, 100);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      playerRef.current?.disconnect();
      playerRef.current = null;
      initCalledRef.current = false;
      playlistStartedRef.current = null;
      deviceIdRef.current = null;
      setDeviceId(null);
      setCurrentTrack(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Playlist switch (only when URI changes, NOT on device reconnect) ──────
  // Intentionally NOT including deviceId in deps — the ready listener owns the
  // initial start. This effect only handles user-triggered playlist changes.
  useEffect(() => {
    if (!playlistStartedRef.current) return; // not started yet — ready listener will handle it
    if (playlistStartedRef.current === playlistUri) return;
    if (!deviceIdRef.current) return;

    setCurrentTrack(null);
    const device_id = deviceIdRef.current;
    getValidToken().then(async (token) => {
      if (!token || !deviceIdRef.current) return;
      try {
        await doPlay(token, device_id, playlistUri);
      } catch (err) {
        console.error("[Spotify] playlist switch error:", err);
      }
    });
  }, [playlistUri]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play / pause ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current) return;
    if (shouldPlay) playerRef.current.resume().catch(() => {});
    else playerRef.current.pause().catch(() => {});
  }, [shouldPlay]);

  // ── Volume ───────────────────────────────────────────────────────────────
  const handleVolumeChange = (v: number) => {
    setVolumeState(v);
    playerRef.current?.setVolume(v).catch(() => {});
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
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

      {currentTrack?.albumArt && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={currentTrack.albumArt}
            alt={currentTrack.albumName ?? ""}
            className="w-56 h-56 rounded-2xl shadow-2xl shadow-black/80 object-cover opacity-80"
          />
        </div>
      )}

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

      {currentTrack && (
        <div className="absolute bottom-20 left-6 flex items-end gap-4 z-10">
          {currentTrack.albumArt && (
            <img
              src={currentTrack.albumArt}
              alt=""
              className="w-11 h-11 rounded-xl shadow-lg flex-shrink-0 object-cover"
            />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-tight drop-shadow truncate max-w-[180px]">
              {currentTrack.name}
            </p>
            <p className="text-white/50 text-xs drop-shadow truncate max-w-[180px]">
              {currentTrack.artist}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Volume */}
            <div className="relative flex items-center gap-1.5">
              {showVolume && (
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 accent-[#1db954] cursor-pointer"
                />
              )}
              <button
                onClick={() => setShowVolume((v) => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white transition-all"
                title="Volume"
              >
                {volume === 0 ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
                    <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>

            {/* Previous */}
            <button
              onClick={() => playerRef.current?.previousTrack().catch(() => {})}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white transition-all"
              title="Piste précédente"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4l-10 8 10 8V4zM5 4v16h2V4H5z"/>
              </svg>
            </button>

            {/* Skip */}
            <button
              onClick={() => playerRef.current?.nextTrack().catch(() => {})}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white transition-all"
              title="Piste suivante"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 4l10 8-10 8V4zM19 4v16h-2V4h2z"/>
              </svg>
            </button>

            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#1db954] ml-0.5 flex-shrink-0" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
