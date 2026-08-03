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

// Lazy-load : la landing (React Three Fiber + three + motion) n'est chargée QUE
// pour les visiteurs NON connectés → le bundle in-app (session/dashboard) reste
// léger et ne paie pas le coût de three.js.
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
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    );
  }

  if (!user) return <LandingPage />;

  return <>{children}</>;
}
