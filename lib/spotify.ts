"use client";

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";

function getRedirectUri(): string {
  if (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/spotify/callback`;
  }
  return "";
}

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginWithSpotify(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();

  localStorage.setItem("spotify_code_verifier", verifier);
  localStorage.setItem("spotify_auth_state", state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    show_dialog: "true", // force account picker so switching accounts always works
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleSpotifyCallback(
  code: string,
  state: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  const verifier = localStorage.getItem("spotify_code_verifier");
  const savedState = localStorage.getItem("spotify_auth_state");

  if (!verifier || state !== savedState) return null;

  localStorage.removeItem("spotify_code_verifier");
  localStorage.removeItem("spotify_auth_state");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number; refreshToken: string } | null> {
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      // PKCE : Spotify fait tourner les refresh tokens — il FAUT stocker le
      // nouveau, sinon le refresh suivant échoue et l'utilisateur est déconnecté.
      refreshToken: data.refresh_token ?? refreshToken,
    };
  } catch {
    return null;
  }
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface SpotifyPlaylist {
  id: string;
  uri: string;
  name: string;
  imageUrl?: string;
  trackCount: number;
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  albumArt?: string;
  albumName?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export type PlaylistsResult =
  | { ok: true; playlists: SpotifyPlaylist[] }
  | { ok: false; status: number };

export async function fetchMyPlaylists(accessToken: string): Promise<PlaylistsResult> {
  const playlists: SpotifyPlaylist[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";

  try {
    while (url) {
      const currentUrl: string = url;
      const res = await fetch(currentUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false, status: res.status };
      const data = await res.json();
      for (const item of data.items ?? []) {
        if (!item) continue;
        playlists.push({
          id: item.id,
          uri: item.uri,
          name: item.name,
          imageUrl: item.images?.[0]?.url,
          trackCount: item.tracks?.total ?? 0,
        });
      }
      url = data.next ?? null;
    }
  } catch {
    return { ok: false, status: 0 };
  }

  return { ok: true, playlists };
}

export interface PlaybackResult {
  ok: boolean;
  status: number;
}

export async function startPlayback(
  accessToken: string,
  deviceId: string,
  contextUri: string,
  offsetPosition?: number
): Promise<PlaybackResult> {
  const playUrl = new URL("https://api.spotify.com/v1/me/player/play");
  playUrl.searchParams.set("device_id", deviceId);
  try {
    const res = await fetch(playUrl.toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        context_uri: contextUri,
        ...(offsetPosition !== undefined ? { offset: { position: offsetPosition } } : {}),
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export interface SpotifyProfile {
  displayName: string;
  avatarUrl: string | null;
  isPremium: boolean;
}

export async function getSpotifyProfile(accessToken: string): Promise<SpotifyProfile | null> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    displayName: data.display_name || data.id || "Utilisateur Spotify",
    avatarUrl: data.images?.[0]?.url ?? null,
    isPremium: data.product === "premium",
  };
}

// ─── Spotify Connect : contrôle à distance (sans SDK) ────────────────────────
// Utilisé quand le navigateur ne supporte pas le Web Playback SDK (Firefox) :
// on pilote l'app Spotify ouverte sur un autre appareil (PC, téléphone…).

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
}

interface RawDevice {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
}

export async function getDevices(accessToken: string): Promise<SpotifyDevice[]> {
  try {
    const res = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.devices ?? []) as RawDevice[])
      .filter((d) => d.id && !d.is_restricted)
      .map((d) => ({
        id: d.id as string,
        name: d.name,
        type: d.type,
        isActive: d.is_active,
        isRestricted: d.is_restricted,
      }));
  } catch {
    return [];
  }
}

interface RawTrackItem {
  name: string;
  artists?: Array<{ name: string }>;
  album?: { name?: string; images?: Array<{ url: string }> };
}

export async function getCurrentlyPlaying(
  accessToken: string
): Promise<{ track: SpotifyTrack | null; isPlaying: boolean } | null> {
  try {
    const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 204) return { track: null, isPlaying: false };
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.item as RawTrackItem | null;
    return {
      isPlaying: !!data.is_playing,
      track: item
        ? {
            name: item.name,
            artist: (item.artists ?? []).map((a) => a.name).join(", "),
            albumName: item.album?.name,
            albumArt: item.album?.images?.[0]?.url,
          }
        : null,
    };
  } catch {
    return null;
  }
}

async function playerCommand(accessToken: string, method: "PUT" | "POST", path: string): Promise<void> {
  try {
    await fetch(`https://api.spotify.com/v1/me/player/${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch { /* best effort */ }
}

export const pausePlayback = (token: string) => playerCommand(token, "PUT", "pause");
export const resumePlayback = (token: string) => playerCommand(token, "PUT", "play");
export const skipNext = (token: string) => playerCommand(token, "POST", "next");
export const skipPrevious = (token: string) => playerCommand(token, "POST", "previous");
export const setRemoteVolume = (token: string, percent: number) =>
  playerCommand(token, "PUT", `volume?volume_percent=${Math.round(Math.max(0, Math.min(100, percent)))}`);

export async function setShuffle(
  accessToken: string,
  deviceId: string,
  state: boolean
): Promise<void> {
  const url = new URL("https://api.spotify.com/v1/me/player/shuffle");
  url.searchParams.set("state", String(state));
  url.searchParams.set("device_id", deviceId);
  try {
    await fetch(url.toString(), {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch { /* best effort */ }
}

export async function setRepeat(
  accessToken: string,
  deviceId: string,
  state: "track" | "context" | "off"
): Promise<void> {
  const repeatUrl = new URL("https://api.spotify.com/v1/me/player/repeat");
  repeatUrl.searchParams.set("state", state);
  repeatUrl.searchParams.set("device_id", deviceId);
  try {
    await fetch(repeatUrl.toString(), {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch { /* best effort */ }
}
