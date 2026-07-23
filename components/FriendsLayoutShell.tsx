"use client";

import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useFriendsDrawer } from "@/store/friendsDrawerStore";
import { cn } from "@/lib/utils";

// Réserve la place du tiroir « Amis » sur desktop : quand il est ouvert, le
// contenu se réduit (padding droit) au lieu d'être recouvert → panneau DOCKÉ,
// intégré à la page. Sur mobile le tiroir reste un overlay (pas de push).
// Doit rester synchro avec la largeur du panneau dans FriendsDrawer (300px).
export default function FriendsLayoutShell({ children }: { children: React.ReactNode }) {
  const open = useFriendsDrawer((s) => s.open);
  const pathname = usePathname();
  const docked = open && !!supabase && !pathname?.startsWith("/session");
  return (
    <div className={cn("transition-[padding] duration-300 ease-out", docked && "md:pr-[300px]")}>
      {children}
    </div>
  );
}
