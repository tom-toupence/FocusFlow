"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useFriendsDrawer } from "@/store/friendsDrawerStore";
import { useFriendsStore } from "@/store/friendsStore";
import { isActivelyFocusing, sendFriendRequest } from "@/lib/friends";
import { useProfileStore } from "@/store/profileStore";
import { toast } from "@/components/Toast";
import FriendsPanel from "@/components/FriendsPanel";
import { cn } from "@/lib/utils";

// Tiroir « Amis » façon launcher de jeu (Riot/Fortnite) : languette fixe sur le
// bord droit + panneau qui glisse depuis la droite, ouvrable/fermable partout…
// SAUF pendant la session vidéo (`/session`), où l'on reste concentré.
export default function FriendsDrawer() {
  const pathname = usePathname();
  const { open, setOpen, toggle } = useFriendsDrawer();
  const email = useProfileStore((s) => s.googleEmail);
  const friends = useFriendsStore((s) => s.friends);
  const pending = useFriendsStore((s) => s.pending);
  const refresh = useFriendsStore((s) => s.refresh);

  const focusingCount = friends.filter((f) => isActivelyFocusing(f.stats)).length;
  const notif = pending.length; // demandes reçues = pastille d'alerte

  // Ouvert par défaut sur desktop (façon launcher) ; fermé sur mobile pour ne
  // pas masquer l'écran. Une seule fois au montage (SSR-safe → pas de mismatch).
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) useFriendsDrawer.getState().setOpen(true);
  }, []);

  // Rafraîchit à l'ouverture (le Realtime maintient ensuite à jour).
  useEffect(() => { if (open && email) refresh(); }, [open, email, refresh]);

  // Lien d'invitation ?add=<code> : ouvre le tiroir et envoie la demande une fois
  // connecté. Nettoie l'URL. (Attend l'auth : email non nul.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("add");
    if (!code) return;
    setOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("add");
    window.history.replaceState({}, "", url.toString());
    if (email) {
      sendFriendRequest(code).then((r) => {
        if (r === "sent" || r === "accepted") { toast({ title: r === "accepted" ? "Vous êtes amis 🎉" : "Demande envoyée ✦", emoji: "👥", accent: "emerald" }); refresh(); }
        else if (r === "invalid_code") toast({ title: "Lien d'invitation invalide", emoji: "👥", accent: "amber" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Ferme sur Échap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Masqué pendant la session, et si Supabase n'est pas configuré (mode local).
  if (!supabase || pathname?.startsWith("/session")) return null;

  return (
    <>
      {/* Languette d'ouverture (bord droit) — masquée quand le tiroir est ouvert */}
      <button
        onClick={toggle}
        aria-label="Ouvrir le panneau des amis"
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-[55] flex flex-col items-center gap-1 pl-2 pr-1.5 py-3 rounded-l-xl bg-background/90 backdrop-blur-md border border-r-0 border-foreground/10 shadow-lg text-foreground/60 hover:text-foreground hover:pr-2.5 transition-all",
          open && "opacity-0 pointer-events-none"
        )}
      >
        <span className="relative">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {notif > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{notif}</span>
          )}
          {notif === 0 && focusingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
          )}
        </span>
        <span className="text-[9px] font-semibold tracking-tight [writing-mode:vertical-rl] rotate-180">Amis</span>
      </button>

      {/* Scrim mobile uniquement (dim + clic = fermer). Sur desktop, pas de
          scrim : le tiroir cohabite avec le contenu, qui reste cliquable. */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "md:hidden fixed inset-0 z-[59] bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Panneau */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-[60] h-full w-[300px] max-w-[calc(100vw-1rem)] flex flex-col bg-background border-l border-foreground/10 shadow-2xl shadow-black/30 transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-foreground/[0.08] flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-foreground/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="text-sm font-semibold text-foreground">Amis</h2>
            {focusingCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{focusingCount} en focus
              </span>
            )}
          </div>
          <button onClick={() => setOpen(false)} aria-label="Fermer" className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {/* Monté uniquement à l'ouverture → refresh/subscribe au bon moment */}
          {open && <FriendsPanel />}
        </div>
      </aside>
    </>
  );
}
