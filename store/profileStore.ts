"use client";

import { create } from "zustand";

interface ProfileState {
  // From Google OAuth (populated at login)
  googleName: string | null;
  googleAvatar: string | null;
  googleEmail: string | null;

  // Custom overrides (persisted in Supabase profiles table)
  customDisplayName: string | null;
  customAvatarData: string | null; // base64 data URL, canvas-resized to 128×128

  setGoogleProfile: (name: string | null, avatar: string | null, email: string | null) => void;
  setCustomProfile: (displayName: string | null, avatarData: string | null) => void;
  setCustomDisplayName: (name: string | null) => void;
  setCustomAvatarData: (data: string | null) => void;
  clear: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  googleName: null,
  googleAvatar: null,
  googleEmail: null,
  customDisplayName: null,
  customAvatarData: null,

  setGoogleProfile: (googleName, googleAvatar, googleEmail) =>
    set({ googleName, googleAvatar, googleEmail }),

  setCustomProfile: (customDisplayName, customAvatarData) =>
    set({ customDisplayName, customAvatarData }),

  setCustomDisplayName: (customDisplayName) => set({ customDisplayName }),
  setCustomAvatarData: (customAvatarData) => set({ customAvatarData }),

  clear: () =>
    set({
      googleName: null,
      googleAvatar: null,
      googleEmail: null,
      customDisplayName: null,
      customAvatarData: null,
    }),
}));

// Helper: resolves the best display name and avatar to show
export function resolvedProfile(store: Pick<ProfileState, "googleName" | "googleAvatar" | "customDisplayName" | "customAvatarData">) {
  return {
    displayName: store.customDisplayName || store.googleName || "Utilisateur",
    avatarUrl: store.customAvatarData || store.googleAvatar || null,
  };
}
