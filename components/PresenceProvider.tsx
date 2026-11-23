"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/store/profileStore";
import { upsertMyFriendStats } from "@/lib/friends";
import { CHEER_EVENT } from "@/store/chatStore";
import { useFriendsStore } from "@/store/friendsStore";
import { toast } from "@/components/Toast";

// Présence « en ligne » globale : tant que l'app est ouverte (n'importe quelle
// page) et qu'on est connecté, on publie un heartbeat online toutes les ~45 s.
// C'est distinct de « en focus » (géré dans /session). L'état offline est déduit
// d'un heartbeat périmé (> 90 s) côté lecteur → pas besoin d'un signal de
// fermeture fiable ; on tente quand même online:false au démontage/pagehide.
const ONLINE_BEAT_MS = 45_000;

export default function PresenceProvider() {
  // Encouragement d'un ami : un mot, où que l'on soit dans l'app.
  useEffect(() => {
    const onCheer = (e: Event) => {
      const id = (e as CustomEvent<{ senderId?: string }>).detail?.senderId;
      const name = useFriendsStore.getState().friends.find((f) => f.userId === id)?.displayName ?? "Un ami";
      toast({ title: `${name} t'encourage`, description: "Continue, tu n'es pas seul ce soir.", accent: "sky" });
    };
    window.addEventListener(CHEER_EVENT, onCheer);
    return () => window.removeEventListener(CHEER_EVENT, onCheer);
  }, []);

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
