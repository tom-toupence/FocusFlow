"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCurrentUserId } from "@/lib/authState";
import { upsertLocalPlaylist, deleteLocalPlaylist } from "@/lib/db";

// Playlists LOCALES nommées : collections de vidéos YouTube créées PAR
// l'utilisateur dans l'app (≠ SavedPlaylist qui référence une playlist YouTube
// existante, ≠ File d'attente qui est l'espace de lecture éphémère unique).
// Jouées via la file maison : chargées dans queueStore + selectQueue().

export interface LocalTrack {
  youtubeId: string;
  title: string;
  channelName?: string;
  thumbnailUrl?: string;
}

export interface LocalPlaylist {
  id: string;
  name: string;
  tracks: LocalTrack[];
  createdAt: number;
  updatedAt: number;
}

interface LocalPlaylistState {
  playlists: LocalPlaylist[];
  /** Crée une playlist (avec un premier titre optionnel) et retourne son id. */
  createPlaylist: (name: string, firstTrack?: LocalTrack) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  /** Ajoute un titre (dédup par youtubeId). Retourne false si déjà présent. */
  addTrack: (playlistId: string, track: LocalTrack) => boolean;
  removeTrack: (playlistId: string, youtubeId: string) => void;
  moveTrack: (playlistId: string, youtubeId: string, dir: "up" | "down") => void;
}

function syncUp(p: LocalPlaylist | undefined) {
  const userId = getCurrentUserId();
  if (userId && p) upsertLocalPlaylist(userId, p);
}

export const useLocalPlaylistStore = create<LocalPlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],

      createPlaylist: (name, firstTrack) => {
        const now = Date.now();
        const playlist: LocalPlaylist = {
          id: crypto.randomUUID(),
          name: name.trim() || "Nouvelle playlist",
          tracks: firstTrack ? [firstTrack] : [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ playlists: [...s.playlists, playlist] }));
        syncUp(playlist);
        return playlist.id;
      },

      renamePlaylist: (id, name) => {
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p
          ),
        }));
        syncUp(get().playlists.find((p) => p.id === id));
      },

      deletePlaylist: (id) => {
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
        const userId = getCurrentUserId();
        if (userId) deleteLocalPlaylist(userId, id);
      },

      addTrack: (playlistId, track) => {
        const target = get().playlists.find((p) => p.id === playlistId);
        if (!target) return false;
        if (target.tracks.some((t) => t.youtubeId === track.youtubeId)) return false;
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId ? { ...p, tracks: [...p.tracks, track], updatedAt: Date.now() } : p
          ),
        }));
        syncUp(get().playlists.find((p) => p.id === playlistId));
        return true;
      },

      removeTrack: (playlistId, youtubeId) => {
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, tracks: p.tracks.filter((t) => t.youtubeId !== youtubeId), updatedAt: Date.now() }
              : p
          ),
        }));
        syncUp(get().playlists.find((p) => p.id === playlistId));
      },

      moveTrack: (playlistId, youtubeId, dir) => {
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            const tracks = [...p.tracks];
            const idx = tracks.findIndex((t) => t.youtubeId === youtubeId);
            const swap = dir === "up" ? idx - 1 : idx + 1;
            if (idx === -1 || swap < 0 || swap >= tracks.length) return p;
            [tracks[idx], tracks[swap]] = [tracks[swap], tracks[idx]];
            return { ...p, tracks, updatedAt: Date.now() };
          }),
        }));
        syncUp(get().playlists.find((p) => p.id === playlistId));
      },
    }),
    { name: "focusflow-local-playlists" }
  )
);
