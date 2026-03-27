"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { handleTwitchCallback, getCurrentUser } from "@/lib/twitch";
import { useTwitchStore } from "@/store/twitchStore";

function TwitchCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuth, setUser } = useTwitchStore();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code || !state) {
      router.replace("/?twitch_error=1");
      return;
    }

    handleTwitchCallback(code, state).then(async (result) => {
      if (!result) {
        router.replace("/?twitch_error=1");
        return;
      }

      setAuth(result.accessToken, result.refreshToken, result.expiresAt);

      const user = await getCurrentUser(result.accessToken);
      if (user) setUser(user.id, user.login);

      router.replace("/");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
