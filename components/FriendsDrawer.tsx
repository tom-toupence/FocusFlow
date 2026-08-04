"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useFriendsDrawer } from "@/store/friendsDrawerStore";
import { useFriendsStore } from "@/store/friendsStore";
import { useChatStore, totalUnread } from "@/store/chatStore";
import { isOnline, sendFriendRequest } from "@/lib/friends";
import { useProfileStore } from "@/store/profileStore";
import { toast } from "@/components/Toast";
import FriendsPanel from "@/components/FriendsPanel";
import FriendChat from "@/components/FriendChat";
import FriendRequests from "@/components/FriendRequests";
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
  const unread = useChatStore((s) => s.unread);
  const closeChat = useChatStore((s) => s.closeChat);

  const onlineCount = friends.filter((f) => isOnline(f.stats)).length;
  const unreadTotal = totalUnread(unread);
  const notif = pending.length; // demandes reçues = pastille d'alerte (priorité)

  // Pattern `mounted` : `email` vient d'un store persisté, on attend le montage
  // client pour décider d'afficher (sinon mismatch d'hydratation).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Ouvert par défaut sur desktop (façon launcher) ; fermé sur mobile pour ne
  // pas masquer l'écran. Seulement une fois CONNECTÉ (pas sur la landing).
  useEffect(() => {
    if (email && window.matchMedia("(min-width: 768px)").matches) useFriendsDrawer.getState().setOpen(true);
  }, [email]);

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
        if (r === "sent" || r === "accepted") { toast({ title: r === "accepted" ? "Vous êtes amis" : "Demande envoyée", accent: "emerald" }); refresh(); }
        else if (r === "invalid_code") toast({ title: "Lien d'invitation invalide", accent: "amber" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Échap : ferme d'abord la conversation ouverte, puis le tiroir.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (useChatStore.getState().openFriendId) closeChat();
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, closeChat]);

  // Masqué pendant la session, si Supabase n'est pas configuré (mode local), et
  // tant qu'on n'est pas connecté → donc absent de la landing page.
  if (!supabase || !mounted || !email || pathname?.startsWith("/session")) return null;

  return (
    <>
      {/* Languette d'ouverture (bord droit) — pastille de statut, masquée à l'ouverture */}
      <button
        onClick={toggle}
        aria-label="Ouvrir le panneau des amis"
        className={cn(
          "group fixed right-0 top-1/2 -translate-y-1/2 z-[55] flex flex-col items-center gap-1.5 pl-2.5 pr-2 py-3.5 rounded-l-2xl bg-background/80 backdrop-blur-md border border-r-0 border-foreground/10 shadow-lg shadow-black/10 text-foreground/55 hover:text-foreground hover:pr-3 transition-all duration-200",
          open && "opacity-0 pointer-events-none translate-x-2"
        )}
      >
        <span className="relative">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {notif > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">{notif}</span>
          ) : unreadTotal > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-sky-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">{unreadTotal > 9 ? "9+" : unreadTotal}</span>
          ) : onlineCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
          ) : null}
        </span>
        <span className="text-[9px] font-semibold tracking-tight [writing-mode:vertical-rl] rotate-180">Amis</span>
      </button>

      {/* Scrim mobile uniquement (dim + clic = fermer). Sur desktop, pas de
          scrim : le tiroir cohabite avec le contenu, qui reste cliquable. */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "md:hidden fixed inset-0 z-[59] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Panneau — carte flottante arrondie (marges) pour un rendu intégré/moins carré */}
      <aside
        className={cn(
          "fixed top-2 right-2 bottom-2 z-[60] w-[300px] max-w-[calc(100vw-1rem)] flex flex-col rounded-2xl bg-background border border-foreground/[0.09] shadow-2xl shadow-black/25 overflow-hidden transition-all duration-300 ease-out",
          open ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+0.75rem)] opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between pl-4 pr-2 h-14 flex-shrink-0 border-b border-foreground/[0.05]">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Amis</h2>
            {onlineCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{onlineCount} en ligne
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <FriendRequests />
            {/* Repli (chevron) plutôt qu'une croix : on « range » le panneau sur le côté */}
            <button onClick={() => setOpen(false)} aria-label="Réduire le panneau" className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-all">
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden">
          {/* Panneau (liste) + conversation qui glisse par-dessus */}
          <div className="absolute inset-0 overflow-y-auto p-4">
            {/* Monté uniquement à l'ouverture → refresh/subscribe au bon moment */}
            {open && <FriendsPanel />}
          </div>
          {open && <FriendChat />}
        </div>
      </aside>
    </>
  );
}
