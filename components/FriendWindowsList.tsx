"use client";

// Les fenêtres allumées, côté liste : tous les amis, une petite fenêtre
// allumée ou éteinte, le prénom et ce qu'il écoute ou fait. Discrète et
// repliable (repliée sur téléphone). Survol d'une ligne : sa fenêtre pulse
// dans la rue. Jamais de minutes, de série ni de classement.
//
// Aucun ami (ou pas de Supabase) : ne rend rien.
import { useEffect, useMemo, useState } from "react";
import { useFriendsStore } from "@/store/friendsStore";
import { useFriendWindowsStore } from "@/store/friendWindowsStore";
import { firstName, friendActivityLine, friendWindowState, sortByWindowState, type FriendWindowState } from "@/lib/rue/friendWindows";
import { useNowTick } from "@/components/FriendWindowsLayer";
import { cn } from "@/lib/utils";

function WindowGlyph({ state }: { state: FriendWindowState }) {
  const lit = state !== "off";
  return (
    <svg viewBox="0 0 16 16" className={cn("h-4 w-4 shrink-0", lit ? "text-sodium" : "text-white/30")} aria-hidden>
      <rect x="2" y="1.5" width="12" height="13" rx="1" fill={lit ? "currentColor" : "none"} fillOpacity={state === "focus" ? 0.95 : 0.6} stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1.5v13M2 8h12" stroke={lit ? "rgba(7,9,13,0.55)" : "currentColor"} strokeWidth="1.1" />
    </svg>
  );
}

export default function FriendWindowsList({ className }: { className?: string }) {
  const friends = useFriendsStore((s) => s.friends);
  const setHighlight = useFriendWindowsStore((s) => s.setHighlight);
  const has = friends.length > 0;
  const now = useNowTick(has);
  const [open, setOpen] = useState(false);
  // Repliée par défaut (téléphone), ouverte au montage sur grand écran : pas
  // de mismatch d'hydratation, pas d'ouverture puis fermeture visible.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, []);
  useEffect(() => () => setHighlight(null), [setHighlight]);

  const rows = useMemo(() => sortByWindowState(friends, now), [friends, now]);
  if (!has) return null;
  const lit = rows.filter((f) => friendWindowState(f.stats, now) !== "off").length;

  return (
    <section
      aria-label="Amis"
      className={cn("w-[15rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-night/75 text-white backdrop-blur-sm", className)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <WindowGlyph state={lit ? "on" : "off"} />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">Amis</span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-white/45">{lit} en ligne</span>
        <svg viewBox="0 0 24 24" className={cn("h-3 w-3 text-white/45 motion-safe:transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="max-h-[40vh] overflow-y-auto border-t border-white/10 py-1">
          {rows.map((f) => {
            const st = friendWindowState(f.stats, now);
            return (
              <li
                key={f.userId}
                tabIndex={0}
                onPointerEnter={() => setHighlight(f.userId)}
                onPointerLeave={() => setHighlight(null)}
                onFocus={() => setHighlight(f.userId)}
                onBlur={() => setHighlight(null)}
                className="flex items-center gap-2.5 px-3 py-1.5 outline-none hover:bg-white/5 focus-visible:bg-white/10"
              >
                <WindowGlyph state={st} />
                <div className="min-w-0">
                  <p className={cn("truncate text-xs", st === "off" ? "text-white/45" : "text-white/90")}>{firstName(f.displayName)}</p>
                  <p className={cn("truncate text-[11px]", st === "off" ? "text-white/30" : "text-white/55")}>{friendActivityLine(f.stats, now)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
