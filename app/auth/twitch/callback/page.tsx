"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { handleTwitchCallback, getCurrentUser } from "@/lib/twitch";
import { useTwitchStore } from "@/store/twitchStore";

function TwitchCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuth, setUser } = useTwitchStore();
  const ran = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code || !state) {
      setFailed(true);
      setTimeout(() => router.replace("/"), 3000);
      return;
    }

    handleTwitchCallback(code, state).then(async (result) => {
      if (!result) {
        setFailed(true);
        setTimeout(() => router.replace("/"), 3000);
        return;
      }

      setAuth(result.accessToken, result.refreshToken, result.expiresAt);

      const user = await getCurrentUser(result.accessToken);
      if (user) setUser(user.id, user.login, user.displayName, user.avatarUrl);

      router.replace("/");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" strokeLinecap="round" />
              <line x1="9" y1="9" x2="15" y2="15" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-foreground/80 text-sm font-medium">Connexion Twitch échouée</p>
            <p className="text-foreground/40 text-xs mt-1">Redirection dans 3 secondes…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-foreground/10 border-t-[#9146ff] rounded-full animate-spin" />
        <p className="text-foreground/40 text-sm">Connexion Twitch…</p>
      </div>
    </div>
  );
}

export default function TwitchCallbackPage() {
  return (
    <Suspense>
      <TwitchCallbackInner />
    </Suspense>
  );
}
