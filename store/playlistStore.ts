"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCurrentUserId } from "@/lib/authState";
import { upsertPlaylist, deletePlaylist } from "@/lib/db";

export interface SavedPlaylist {
  id: string;
  playlistId: string;      // YouTube playlist ID (ex: "PLxxxxxxxx" ou "RDxxxxxxxx" pour les mixes)
  startVideoId?: string;   // Vidéo de départ — obligatoire pour les mixes (RD*), optionnel sinon
  title: string;
  channelName?: string;
  thumbnailUrl?: string;
  // Titres ajoutés PAR L'UTILISATEUR à cette playlist (recommandations « + Playlist »).
  // On ne peut pas modifier une playlist YouTube : ces extras sont joués à la
  // suite des titres résolus de la playlist.
  extraVideos?: { id: string; title: string }[];
}

interface PlaylistState {
  playlists: SavedPlaylist[];
  addPlaylist: (p: Omit<SavedPlaylist, "id">) => void;
  removePlaylist: (id: string) => void;
  addExtraVideo: (playlistId: string, video: { id: string; title: string }) => void;
  removeExtraVideo: (playlistId: string, videoId: string) => void;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set) => ({
      playlists: [],
      addPlaylist: (p) => {
        const newPlaylist = { ...p, id: crypto.randomUUID() };
        set((s) => ({ playlists: [...s.playlists, newPlaylist] }));
        const userId = getCurrentUserId();
        if (userId) {
          upsertPlaylist(userId, newPlaylist);
        } else {
          console.warn("[playlistStore] addPlaylist: pas de userId, write DB ignoré");
        }
      },
      removePlaylist: (id) => {
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
        const userId = getCurrentUserId();
        if (userId) deletePlaylist(userId, id);
      },
      addExtraVideo: (playlistId, video) => {
        let updated: SavedPlaylist | undefined;
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            if ((p.extraVideos ?? []).some((v) => v.id === video.id)) return p;
            updated = { ...p, extraVideos: [...(p.extraVideos ?? []), video] };
            return updated;
          }),
        }));
        const userId = getCurrentUserId();
        if (userId && updated) upsertPlaylist(userId, updated);
      },
      removeExtraVideo: (playlistId, videoId) => {
        let updated: SavedPlaylist | undefined;
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            updated = { ...p, extraVideos: (p.extraVideos ?? []).filter((v) => v.id !== videoId) };
            return updated;
          }),
        }));
        const userId = getCurrentUserId();
        if (userId && updated) upsertPlaylist(userId, updated);
      },
    }),
    { name: "focusflow-playlists" }
  )
);

// Un « mix radio » YouTube (RD…) est une playlist infinie PERSONNALISÉE, non
// reproductible en embed via l'API IFrame (le player renvoie des recommandations
// génériques ≠ les morceaux attendus). On les détecte pour les résoudre côté serveur.
// Exception : RDCLAK… sont des playlists officielles YouTube Music, embarquables normalement.
export function isRadioMix(listId: string): boolean {
  return listId.startsWith("RD") && !listId.startsWith("RDCLAK");
}

// Résout un mix radio en une liste ordonnée de videoIds (+ titres connus) via
// notre route serveur (parse de la page YouTube — aucune clé requise).
// Retourne { ids: [] } si échec.
export async function fetchMixVideos(
  listId: string,
  seedVideoId?: string
): Promise<{ ids: string[]; titles: Record<string, string> }> {
  try {
    const params = new URLSearchParams({ list: listId });
    if (seedVideoId) params.set("seed", seedVideoId);
    const res = await fetch(`/api/youtube/mix?${params.toString()}`);
    if (!res.ok) return { ids: [], titles: {} };
    const data = await res.json();
    return {
      ids: Array.isArray(data.videoIds) ? data.videoIds : [],
      titles: data.titles && typeof data.titles === "object" ? data.titles : {},
    };
  } catch {
    return { ids: [], titles: {} };
  }
}

// Résout une vraie playlist YouTube (PL/OL/UU/FL/…) en liste ordonnée de vidéos
// { id, title } via notre route serveur. Retourne [] si échec (→ repli natif).
export async function fetchPlaylistVideos(
  listId: string,
  seedVideoId?: string
): Promise<{ id: string; title: string }[]> {
  try {
    const params = new URLSearchParams({ list: listId });
    if (seedVideoId) params.set("seed", seedVideoId);
    const res = await fetch(`/api/youtube/playlist?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.videos) ? data.videos : [];
  } catch {
    return [];
  }
}

// Extrait le playlist ID depuis une URL YouTube (list=PLxxx)
export function extractPlaylistId(url: string): string | null {
  try {
    return new URL(url.trim()).searchParams.get("list");
  } catch {
    return null;
  }
}

// Extrait le video ID depuis une URL YouTube (v=xxxxx)
export function extractFirstVideoId(url: string): string | null {
  try {
    return new URL(url.trim()).searchParams.get("v");
  } catch {
    return null;
  }
}

// Fetche les métadonnées via oEmbed YouTube (pas besoin de clé API)
export async function fetchPlaylistMeta(url: string): Promise<{
  title?: string;
  channelName?: string;
  thumbnailUrl?: string;
}> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!res.ok) return {};
    const data = await res.json();
    return {
      title: data.title,
      channelName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    };
  } catch {
    return {};
  }
}
