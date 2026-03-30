"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleSpotifyCallback, getSpotifyProfile } from "@/lib/spotify";
import { useSpotifyStore } from "@/store/spotifyStore";

function SpotifyCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useSpotifyStore((s) => s.setAuth);
  const setProfile = useSpotifyStore((s) => s.setProfile);
  const handled = useRef(false);
  const [failed, setFailed] = useState(false);

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

    handleSpotifyCallback(code, state).then(async (result) => {
      if (result) {
        setAuth(result.accessToken, result.refreshToken, result.expiresAt);
        const profile = await getSpotifyProfile(result.accessToken);
        if (profile) setProfile(profile);
        router.replace("/");
      } else {
        setFailed(true);
        setTimeout(() => router.replace("/"), 3000);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground/70">Connexion Spotify échouée</p>
          <p className="text-xs text-foreground/35">Réessaie depuis l&apos;application. Redirection…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-[#1db954] rounded-full animate-spin" />
        <p className="text-sm text-foreground/40">Connexion Spotify…</p>
      </div>
    </div>
  );
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense>
      <SpotifyCallbackInner />
    </Suspense>
  );
}
