"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/store/profileStore";
import { upsertMyFriendStats } from "@/lib/friends";

// Présence « en ligne » globale : tant que l'app est ouverte (n'importe quelle
// page) et qu'on est connecté, on publie un heartbeat online toutes les ~45 s.
// C'est distinct de « en focus » (géré dans /session). L'état offline est déduit
// d'un heartbeat périmé (> 90 s) côté lecteur → pas besoin d'un signal de
// fermeture fiable ; on tente quand même online:false au démontage/pagehide.
const ONLINE_BEAT_MS = 45_000;

export default function PresenceProvider() {
  const email = useProfileStore((s) => s.googleEmail);

  useEffect(() => {
    if (!supabase || !email) return;
    const beat = () => upsertMyFriendStats({ online: true, onlineHeartbeat: Date.now() });
    beat();
    const timer = setInterval(beat, ONLINE_BEAT_MS);
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    const onExit = () => { upsertMyFriendStats({ online: false }); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onExit);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onExit);
      upsertMyFriendStats({ online: false });
    };
  }, [email]);

  return null;
}
