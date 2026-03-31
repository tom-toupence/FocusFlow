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
}

interface PlaylistState {
  playlists: SavedPlaylist[];
  addPlaylist: (p: Omit<SavedPlaylist, "id">) => void;
  removePlaylist: (id: string) => void;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set) => ({
      playlists: [],
      addPlaylist: (p) => {
        const newPlaylist = { ...p, id: `pl-${Date.now()}` };
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
    }),
    { name: "focusflow-playlists" }
  )
);

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
