"use client";

/**
 * AuthGate — blocks access until the user is signed in with Google.
 * Transparent (no-op) when Supabase is not configured.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { isHandoffGuest } from "@/lib/remote/handoffApply";

// Lazy-load : la landing (photo plein écran + motion) n'est chargée QUE pour les
// visiteurs NON connectés → le bundle in-app (session/dashboard) n'en paie pas
// le coût.
const LandingPage = dynamic(() => import("@/components/LandingPage"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-[#0a0a0c]" />,
});

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Supabase not configured, or any OAuth callback page → no gate
  const isCallbackRoute = pathname === "/auth/callback"
    || pathname === "/auth/spotify/callback"
    || pathname === "/auth/twitch/callback";
  // Télécommande et reprise sur le téléphone (lot 7) : sans compte.
  const isPhoneRoute = pathname?.startsWith("/remote/") || pathname?.startsWith("/handoff/");
  if (!supabase || isCallbackRoute || isPhoneRoute) return <>{children}</>;

  return <AuthGateInner pathname={pathname}>{children}</AuthGateInner>;
}

function AuthGateInner({ children, pathname }: { children: React.ReactNode; pathname: string | null }) {
  const [user, setUser] = useState<User | null | "loading">("loading");
  // Session reprise depuis un ordinateur sans compte sur ce téléphone : la
  // session et son résumé restent ouverts dans cet onglet (local seulement).
  const [guest, setGuest] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setGuest(isHandoffGuest()), []);

  useEffect(() => {
    // Get current session
    supabase!.auth.getUser().then(({ data }) => setUser(data.user ?? null));

    // Listen for auth changes (e.g. after OAuth redirect)
    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (user === "loading") {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    );
  }

  if (!user && !(guest && (pathname === "/session" || pathname === "/summary"))) return <LandingPage />;

  return <>{children}</>;
}
