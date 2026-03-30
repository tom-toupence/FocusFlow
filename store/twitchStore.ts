"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TwitchChannel } from "@/lib/twitch";

export type { TwitchChannel };

interface TwitchState {
  // Auth (persisted)
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  userId: string | null;
  userLogin: string | null;
  userDisplayName: string | null;
  avatarUrl: string | null;
  followedChannels: TwitchChannel[];
  /** Supabase user ID that owns this Twitch connection — used to detect user switches */
  supabaseUserId: string | null;

  // Selected content (persisted)
  selectedChannel: string | null;
  selectedVodId: string | null;

  // Actions
  setAuth: (accessToken: string, refreshToken: string, expiresAt: number) => void;
  updateToken: (accessToken: string, expiresAt: number) => void;
  clearAuth: () => void;
  setUser: (userId: string, userLogin: string, userDisplayName: string, avatarUrl: string | null) => void;
  setFollowedChannels: (channels: TwitchChannel[]) => void;
  selectChannel: (channel: string | null) => void;
  selectVod: (vodId: string | null) => void;
  clear: () => void;
  setOwner: (userId: string) => void;
}

export const useTwitchStore = create<TwitchState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      userId: null,
      userLogin: null,
      userDisplayName: null,
      avatarUrl: null,
      followedChannels: [],
      supabaseUserId: null,
      selectedChannel: null,
      selectedVodId: null,

      setAuth: (accessToken, refreshToken, expiresAt) =>
        set({ accessToken, refreshToken, expiresAt }),

      updateToken: (accessToken, expiresAt) =>
        set({ accessToken, expiresAt }),

      clearAuth: () =>
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          userId: null,
          userLogin: null,
          userDisplayName: null,
          avatarUrl: null,
          followedChannels: [],
          supabaseUserId: null,
        }),

      setUser: (userId, userLogin, userDisplayName, avatarUrl) =>
        set({ userId, userLogin, userDisplayName, avatarUrl }),
      setFollowedChannels: (channels) => set({ followedChannels: channels }),
      selectChannel: (channel) => set({ selectedChannel: channel, selectedVodId: null }),
      selectVod: (vodId) => set({ selectedVodId: vodId, selectedChannel: null }),
      clear: () => set({ selectedChannel: null, selectedVodId: null }),
      setOwner: (userId) => set({ supabaseUserId: userId }),
    }),
    {
      name: "focusflow-twitch",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        expiresAt: s.expiresAt,
        userId: s.userId,
        userLogin: s.userLogin,
        userDisplayName: s.userDisplayName,
        avatarUrl: s.avatarUrl,
        followedChannels: s.followedChannels,
        supabaseUserId: s.supabaseUserId,
        selectedChannel: s.selectedChannel,
        selectedVodId: s.selectedVodId,
      }),
    }
  )
);

export function extractTwitchVodId(url: string): string | null {
  const m1 = url.match(/twitch\.tv\/videos\/(\d+)/);
  if (m1) return m1[1];
  const m2 = url.match(/twitch\.tv\/\w+\/v\/(\d+)/);
  if (m2) return m2[1];
  if (/^\d{8,12}$/.test(url.trim())) return url.trim();
  return null;
}
