"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleSpotifyCallback } from "@/lib/spotify";
import { useSpotifyStore } from "@/store/spotifyStore";

export default function SpotifyCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useSpotifyStore((s) => s.setAuth);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code || !state) {
      router.replace("/");
      return;
    }

    handleSpotifyCallback(code, state).then((result) => {
      if (result) {
        setAuth(result.accessToken, result.refreshToken, result.expiresAt);
      }
      router.replace("/");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-[#1db954] rounded-full animate-spin" />
        <p className="text-sm text-foreground/40">Connexion Spotify…</p>
      </div>
    </div>
  );
}
