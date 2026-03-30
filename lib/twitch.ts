"use client";

const CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID ?? "";

function getRedirectUri(): string {
  if (process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/twitch/callback`;
  }
  return "";
}

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

export async function loginWithTwitch(forceVerify = false): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();

  localStorage.setItem("twitch_code_verifier", verifier);
  localStorage.setItem("twitch_auth_state", state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: "user:read:follows",
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  if (forceVerify) params.set("force_verify", "true");

  window.location.href = `https://id.twitch.tv/oauth2/authorize?${params}`;
}

export async function handleTwitchCallback(
  code: string,
  state: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  const savedState = localStorage.getItem("twitch_auth_state");
  const verifier = localStorage.getItem("twitch_code_verifier");
  if (!savedState || state !== savedState || !verifier) return null;

  localStorage.removeItem("twitch_auth_state");
  localStorage.removeItem("twitch_code_verifier");

  const res = await fetch("/api/twitch/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshTwitchToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number } | null> {
  const res = await fetch("/api/twitch/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwitchChannel {
  login: string;
  displayName: string;
  isLive: boolean;
  thumbnailUrl?: string;
  gameName?: string;
  viewerCount?: number;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function twitchFetch(token: string, url: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": CLIENT_ID,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getCurrentUser(
  token: string
): Promise<{ id: string; login: string; displayName: string; avatarUrl: string | null } | null> {
  const data = await twitchFetch(token, "https://api.twitch.tv/helix/users");
  if (!data?.data?.[0]) return null;
  const u = data.data[0];
  return {
    id: u.id,
    login: u.login,
    displayName: u.display_name,
    avatarUrl: u.profile_image_url ?? null,
  };
}

export async function getFollowedChannels(
  token: string,
  userId: string
): Promise<TwitchChannel[]> {
  const channels: TwitchChannel[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL("https://api.twitch.tv/helix/channels/followed");
    url.searchParams.set("user_id", userId);
    url.searchParams.set("first", "100");
    if (cursor) url.searchParams.set("after", cursor);

    const data = await twitchFetch(token, url.toString());
    if (!data) break;

    for (const item of data.data ?? []) {
      channels.push({
        login: item.broadcaster_login,
        displayName: item.broadcaster_name,
        isLive: false,
      });
    }
    cursor = data.pagination?.cursor ?? null;
  } while (cursor);

  return channels;
}

export async function getLiveFollowedStreams(
  token: string,
  userId: string
): Promise<TwitchChannel[]> {
  const streams: TwitchChannel[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL("https://api.twitch.tv/helix/streams/followed");
    url.searchParams.set("user_id", userId);
    url.searchParams.set("first", "100");
    if (cursor) url.searchParams.set("after", cursor);

    const data = await twitchFetch(token, url.toString());
    if (!data) break;

    for (const s of data.data ?? []) {
      streams.push({
        login: s.user_login,
        displayName: s.user_name,
        isLive: true,
        thumbnailUrl: s.thumbnail_url
          ?.replace("{width}", "320")
          .replace("{height}", "180"),
        gameName: s.game_name,
        viewerCount: s.viewer_count,
      });
    }
    cursor = data.pagination?.cursor ?? null;
  } while (cursor);

  return streams;
}

export async function searchChannels(
  token: string,
  query: string
): Promise<TwitchChannel[]> {
  const url = new URL("https://api.twitch.tv/helix/search/channels");
  url.searchParams.set("query", query);
  url.searchParams.set("first", "8");

  const data = await twitchFetch(token, url.toString());
  if (!data?.data) return [];

  return data.data.map((item: {
    broadcaster_login: string;
    display_name: string;
    is_live: boolean;
    game_name?: string;
  }) => ({
    login: item.broadcaster_login,
    displayName: item.display_name,
    isLive: item.is_live,
    thumbnailUrl: item.is_live
      ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${item.broadcaster_login}-320x180.jpg`
      : undefined,
    gameName: item.game_name,
  }));
}
