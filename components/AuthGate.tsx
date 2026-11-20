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

// Lazy-load : la landing (photo plein écran + motion) n'est chargée QUE pour les
// visiteurs NON connectés → le bundle in-app (session/dashboard) n'en paie pas
// le coût.
const LandingPage = dynamic(() => import("@/components/LandingPage"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-[#0b0f18]" />,
});

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Supabase not configured, or any OAuth callback page → no gate
  const isCallbackRoute = pathname === "/auth/callback"
    || pathname === "/auth/spotify/callback"
    || pathname === "/auth/twitch/callback";
  if (!supabase || isCallbackRoute) return <>{children}</>;

  return <AuthGateInner>{children}</AuthGateInner>;
}

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | "loading">("loading");

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
      <div className="min-h-screen bg-bg flex items-center justify-center" aria-busy="true" aria-label="Chargement">
        <span className="ff-wait block w-24 h-[2px] bg-sodium" />
      </div>
    );
  }

  if (!user) return <LandingPage />;

  return <>{children}</>;
}
