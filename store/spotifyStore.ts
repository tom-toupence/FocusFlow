"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SpotifyPlaylist, SpotifyTrack, SpotifyProfile } from "@/lib/spotify";

export type { SpotifyPlaylist, SpotifyTrack };

interface SpotifyState {
  // Persisted
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  playlists: SpotifyPlaylist[];
  selectedPlaylistUri: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isPremium: boolean | null;
  /** Supabase user ID that owns this Spotify connection — used to detect user switches */
  supabaseUserId: string | null;
  /** true = lecture aléatoire, false = dans l'ordre */
  shuffle: boolean;

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
  setProfile: (profile: SpotifyProfile) => void;
  setOwner: (userId: string) => void;
  setShuffle: (shuffle: boolean) => void;
}

export const useSpotifyStore = create<SpotifyState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      playlists: [],
      selectedPlaylistUri: null,
      displayName: null,
      avatarUrl: null,
      isPremium: null,
      supabaseUserId: null,
      shuffle: true,
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
          displayName: null,
          avatarUrl: null,
          isPremium: null,
          supabaseUserId: null,
          currentTrack: null,
          deviceId: null,
        }),

      setPlaylists: (playlists) => set({ playlists }),
      selectPlaylist: (uri) => set({ selectedPlaylistUri: uri }),
      setCurrentTrack: (track) => set({ currentTrack: track }),
      setDeviceId: (id) => set({ deviceId: id }),
      setProfile: ({ displayName, avatarUrl, isPremium }) =>
        set({ displayName, avatarUrl, isPremium }),
      setOwner: (userId) => set({ supabaseUserId: userId }),
      setShuffle: (shuffle) => set({ shuffle }),
    }),
    {
      name: "focusflow-spotify",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        expiresAt: s.expiresAt,
        playlists: s.playlists,
        selectedPlaylistUri: s.selectedPlaylistUri,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        isPremium: s.isPremium,
        supabaseUserId: s.supabaseUserId,
        shuffle: s.shuffle,
      }),
    }
  )
);
