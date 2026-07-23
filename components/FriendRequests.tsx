"use client";

import { useEffect, useRef, useState } from "react";
import { useFriendsStore } from "@/store/friendsStore";
import { acceptRequest, removeFriendship } from "@/lib/friends";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// Notification de demandes d'amis façon launcher League of Legends : une cloche
// avec pastille rouge dans l'en-tête ; au clic, un popover liste les demandes
// reçues avec Accepter / Refuser.
export default function FriendRequests() {
  const pending = useFriendsStore((s) => s.pending);
  const refresh = useFriendsStore((s) => s.refresh);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Ferme le popover au clic extérieur / Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey, true); };
  }, [open]);

  // Le popover ne s'affiche que si `count > 0` (garde de rendu) → pas besoin de
  // le fermer explicitement quand la dernière demande est traitée.
  const count = pending.length;

  const accept = async (id: string) => {
    setBusy(id);
    const ok = await acceptRequest(id);
    setBusy(null);
    if (ok) { toast({ title: "Ami ajouté 🎉", accent: "emerald" }); refresh(); }
    else toast({ title: "Impossible d'accepter", accent: "amber" });
  };
  const decline = async (id: string) => {
    setBusy(id);
    const ok = await removeFriendship(id);
    setBusy(null);
    if (ok) refresh();
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => count > 0 && setOpen((v) => !v)}
        aria-label={count > 0 ? `${count} demande${count > 1 ? "s" : ""} d'ami` : "Aucune demande d'ami"}
        className={cn(
          "relative w-8 h-8 flex items-center justify-center rounded-lg transition-all",
          count > 0 ? "text-foreground hover:bg-foreground/5" : "text-foreground/30",
          open && "bg-foreground/5"
        )}
      >
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">{count}</span>
        )}
      </button>

      {open && count > 0 && (
        <div className="absolute right-0 top-full mt-2 w-72 z-10 rounded-xl bg-background border border-foreground/10 shadow-2xl shadow-black/40 overflow-hidden anim-section-in">
          <div className="px-3.5 py-2.5 border-b border-foreground/[0.07] flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/45">Demandes reçues</span>
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 text-[10px] font-bold flex items-center justify-center">{count}</span>
          </div>
          <div className="max-h-[min(60vh,20rem)] overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {pending.map((p) => (
              <div key={p.friendshipId} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-foreground/[0.03]">
                <MiniAvatar url={p.avatarUrl} name={p.displayName} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{p.displayName}</p>
                  <p className="text-[10px] text-foreground/35">veut devenir ton ami</p>
                </div>
                <button onClick={() => accept(p.friendshipId)} disabled={busy === p.friendshipId} title="Accepter"
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 transition-all">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button onClick={() => decline(p.friendshipId)} disabled={busy === p.friendshipId} title="Refuser"
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-foreground/5 text-foreground/40 hover:text-foreground/70 disabled:opacity-40 transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniAvatar({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-foreground/10 flex items-center justify-center ring-1 ring-foreground/[0.06] flex-shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-[11px] font-semibold text-foreground/60">{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
