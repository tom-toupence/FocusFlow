// Suggestions Spotify, partagées par la session (file à venir) et par les
// cartes de playlist. L'endpoint `recommendations` est fermé aux nouvelles
// applications depuis novembre 2024 : on échantillonne des graines sur toute
// la playlist (pickSeeds) et on prend les titres phares de leur artiste.
import { fetchArtistTopTracks, fetchPlaylistTracks, refreshAccessToken, type PlaylistTrackLite } from "@/lib/spotify";
import { useSpotifyStore } from "@/store/spotifyStore";
import { interleave, pickSeeds } from "./continuation";
import type { Track } from "./types";

/** Jeton valide (rafraîchi s'il expire dans la minute), ou null. */
export async function validSpotifyToken(): Promise<string | null> {
  const { accessToken, refreshToken, expiresAt, updateToken } = useSpotifyStore.getState();
  if (!accessToken) return null;
  if (!expiresAt || Date.now() < expiresAt - 60_000) return accessToken;
  if (!refreshToken) return null;
  const r = await refreshAccessToken(refreshToken);
  if (!r) return null;
  updateToken(r.accessToken, r.expiresAt, r.refreshToken);
  return r.accessToken;
}

/** Titres proches d'une graine : titres phares de son premier artiste. */
export const recommendFor = (token: string, byId: Map<string, PlaylistTrackLite>) => async (seed: string) => {
  const artist = byId.get(seed)?.artistIds[0];
  if (!artist) return [];
  const top = await fetchArtistTopTracks(token, artist);
  return top.map((t) => ({ id: t.id, title: t.name, subtitle: t.artists }));
};

export async function suggestFromTracks(
  token: string,
  tracks: PlaylistTrackLite[],
  opts: { seeds?: string[]; exclude?: Iterable<string>; limit?: number } = {},
): Promise<Track[]> {
  const ids = tracks.map((t) => t.id);
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const picked = opts.seeds?.length ? opts.seeds : pickSeeds(ids, null, 4);
  const rec = recommendFor(token, byId);
  const lists = await Promise.all(picked.map((s) => rec(s).catch(() => [])));
  const have = new Set([...ids, ...(opts.exclude ?? [])]);
  return interleave(lists, have, opts.limit ?? 10).map((t) => ({ id: t.id, title: t.title, subtitle: t.subtitle, source: "spotify" as const, suggested: true }));
}

// Cache par playlist (10 min) : rouvrir le modal ne refait pas une requête par artiste.
const cache = new Map<string, { at: number; list: Track[] }>();
const TTL = 10 * 60_000;

/** Suggestions pour une playlist (hors session), par son URI. null = non connecté. */
export async function suggestForPlaylist(playlistUri: string, limit = 12): Promise<Track[] | null> {
  const hit = cache.get(playlistUri);
  if (hit && Date.now() - hit.at < TTL) return hit.list;
  const token = await validSpotifyToken();
  if (!token) return null;
  const tracks = await fetchPlaylistTracks(token, playlistUri);
  if (!tracks.length) return [];
  const list = await suggestFromTracks(token, tracks, { limit });
  if (list.length) cache.set(playlistUri, { at: Date.now(), list });
  return list;
}
