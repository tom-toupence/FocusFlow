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
): Promise<{ accessToken: string; expiresAt: number } | null> {
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
  };
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

export async function startPlayback(
  accessToken: string,
  deviceId: string,
  contextUri: string
): Promise<void> {
  const playUrl = new URL("https://api.spotify.com/v1/me/player/play");
  playUrl.searchParams.set("device_id", deviceId);
  await fetch(playUrl.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ context_uri: contextUri }),
  });
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

export async function setShuffle(
  accessToken: string,
  deviceId: string,
  state: boolean
): Promise<void> {
  const url = new URL("https://api.spotify.com/v1/me/player/shuffle");
  url.searchParams.set("state", String(state));
  url.searchParams.set("device_id", deviceId);
  await fetch(url.toString(), {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function setRepeat(
  accessToken: string,
  deviceId: string,
  state: "track" | "context" | "off"
): Promise<void> {
  const repeatUrl = new URL("https://api.spotify.com/v1/me/player/repeat");
  repeatUrl.searchParams.set("state", state);
  repeatUrl.searchParams.set("device_id", deviceId);
  await fetch(repeatUrl.toString(), {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
