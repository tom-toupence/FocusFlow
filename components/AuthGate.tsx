"use client";

/**
 * AuthGate — blocks access until the user is signed in with Google.
 * Transparent (no-op) when Supabase is not configured.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase, signInWithGoogle } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Supabase not configured, or OAuth callback page → no gate
  if (!supabase || pathname === "/auth/callback") return <>{children}</>;

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

  if (!user) return <LoginScreen />;

  return <>{children}</>;
}

function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    await signInWithGoogle();
    // Page will redirect — no need to reset loading
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex flex-col items-center justify-center px-6">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_40%,_rgba(99,_102,_241,_0.08)_0%,_transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
            <svg className="w-6 h-6 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">FocusFlow</h1>
          <p className="text-white/40 text-sm text-center leading-relaxed">
            Connecte-toi pour synchroniser ta progression sur tous tes appareils.
          </p>
        </div>

        {/* Google sign in */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-[#0d0d0f] font-semibold text-sm hover:bg-white/90 transition-all shadow-lg shadow-black/30 disabled:opacity-60"
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          {loading ? "Redirection…" : "Continuer avec Google"}
        </button>

        <p className="text-white/20 text-xs text-center leading-relaxed">
          Ton compte Google est utilisé uniquement pour t&apos;identifier.
          Aucune donnée personnelle n&apos;est collectée.
        </p>
      </div>
    </div>
  );
}
