"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useFriendsDrawer } from "@/store/friendsDrawerStore";
import { useProfileStore } from "@/store/profileStore";
import { cn } from "@/lib/utils";

// Réserve la place du tiroir « Amis » sur desktop : quand il est ouvert, le
// contenu se réduit (padding droit) au lieu d'être recouvert → panneau DOCKÉ,
// intégré à la page. Sur mobile le tiroir reste un overlay (pas de push).
// Doit rester synchro avec la carte flottante de FriendsDrawer (300px + marges)
// ET avec sa condition d'affichage (connecté, hors /session) — sinon la landing
// se retrouverait décalée pour un tiroir invisible.
export default function FriendsLayoutShell({ children }: { children: React.ReactNode }) {
  const open = useFriendsDrawer((s) => s.open);
  const email = useProfileStore((s) => s.googleEmail);
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pattern `mounted` du projet : le store est persisté, on ne décide qu'après hydratation
    setMounted(true);
  }, []);
  const docked = mounted && open && !!supabase && !!email && !pathname?.startsWith("/session");
  return (
    <div className={cn("transition-[padding] duration-300 ease-out", docked && "md:pr-[320px]")}>
      {children}
    </div>
  );
}
