"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!supabase) { router.replace("/"); return; }

    // Extract just the code value from ?code=...
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { router.replace("/"); return; }

    supabase.auth.exchangeCodeForSession(code).then(() => {
      router.replace("/");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        <span className="text-white/30 text-xs">Connexion en cours…</span>
      </div>
    </div>
  );
}
