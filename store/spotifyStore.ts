"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SpotifyPlaylist, SpotifyTrack } from "@/lib/spotify";

export type { SpotifyPlaylist, SpotifyTrack };

interface SpotifyState {
  // Persisted
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  playlists: SpotifyPlaylist[];
  selectedPlaylistUri: string | null;

  // Runtime (not persisted)
  currentTrack: SpotifyTrack | null;
  deviceId: string | null;

  // Actions
  setAuth: (accessToken: string, refreshToken: string, expiresAt: number) => void;
  updateToken: (accessToken: string, expiresAt: number) => void;
  clearAuth: () => void;
  setPlaylists: (playlists: SpotifyPlaylist[]) => void;
  selectPlaylist: (uri: string | null) => void;
  setCurrentTrack: (track: SpotifyTrack | null) => void;
  setDeviceId: (id: string | null) => void;
}

export const useSpotifyStore = create<SpotifyState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      playlists: [],
      selectedPlaylistUri: null,
      currentTrack: null,
      deviceId: null,

      setAuth: (accessToken, refreshToken, expiresAt) =>
        set({ accessToken, refreshToken, expiresAt }),

      updateToken: (accessToken, expiresAt) =>
        set({ accessToken, expiresAt }),

      clearAuth: () =>
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          playlists: [],
          selectedPlaylistUri: null,
          currentTrack: null,
          deviceId: null,
        }),

      setPlaylists: (playlists) => set({ playlists }),
      selectPlaylist: (uri) => set({ selectedPlaylistUri: uri }),
      setCurrentTrack: (track) => set({ currentTrack: track }),
      setDeviceId: (id) => set({ deviceId: id }),
    }),
    {
      name: "focusflow-spotify",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        expiresAt: s.expiresAt,
        playlists: s.playlists,
        selectedPlaylistUri: s.selectedPlaylistUri,
      }),
    }
  )
);
