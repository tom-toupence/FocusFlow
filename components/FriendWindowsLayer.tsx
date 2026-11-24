"use client";

// Les fenêtres allumées, côté rue : chaque ami a sa fenêtre dans la scène
// (choix déterministe, lib/rue/friendWindows.ts). En ligne = allumée, en focus
// = plus vive, hors ligne = éteinte ; de focus à pause, elle grésille.
// Survol ou toucher d'une fenêtre : le prénom et ce qu'il écoute.
//
// Aucun ami (ou pas de Supabase) : rien n'est calculé ni envoyé au moteur.
import { useEffect, useMemo, useRef, useState } from "react";
import type { RueRenderer } from "@/lib/rue/RueRenderer";
import type { RueSceneInfo } from "@/lib/rue/scenes";
import {
  assignFriendWindows, firstName, FLICKER_MS, friendActivityLine, friendsForStreet, friendWindowState,
  type FriendWindow, type FriendWindowState, type RueWindow,
} from "@/lib/rue/friendWindows";
import { useFriendsStore } from "@/store/friendsStore";
import { useFriendWindowsStore } from "@/store/friendWindowsStore";

interface Props {
  renderer: RueRenderer | null;
  scene: RueSceneInfo | null;
}

/** Horloge à 20 s : l'état « en ligne » dépend de la fraîcheur des battements. */
export function useNowTick(active: boolean, ms = 20_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

export default function FriendWindowsLayer({ renderer, scene }: Props) {
  const friends = useFriendsStore((s) => s.friends);
  const highlight = useFriendWindowsStore((s) => s.highlight);
  const has = friends.length > 0;
  const now = useNowTick(has);
  const sceneId = scene && !scene.day ? scene.id : null;

  // Fenêtres de la scène courante (lues une fois par scène, seulement s'il y a des amis).
  const [windows, setWindows] = useState<{ sceneId: string; list: RueWindow[] } | null>(null);
  useEffect(() => {
    if (!renderer || !sceneId || !has) return;
    let off = false;
    renderer.windows().then((r) => { if (!off) setWindows({ sceneId, list: r.windows }); }).catch(() => {});
    return () => { off = true; };
  }, [renderer, sceneId, has]);

  const street = useMemo(() => (has ? friendsForStreet(friends, now) : []), [friends, now, has]);
  const assignment = useMemo(() => {
    if (!sceneId || !windows || windows.sceneId !== sceneId) return new Map<string, number>();
    return assignFriendWindows(street.map((f) => f.userId), windows.list, sceneId);
  }, [street, windows, sceneId]);

  // État de chaque ami -> uniforms du moteur, seulement quand il change.
  const prev = useRef(new Map<string, FriendWindowState>());
  const flicker = useRef(new Map<string, number>());
  const sent = useRef(false);
  useEffect(() => {
    if (!renderer) return;
    const t = Date.now();
    const list: FriendWindow[] = [];
    for (const f of street) {
      const st = friendWindowState(f.stats, now);
      const before = prev.current.get(f.userId);
      if (before === "focus" && st !== "focus") flicker.current.set(f.userId, t);
      prev.current.set(f.userId, st);
      const id = assignment.get(f.userId);
      if (!id) continue;
      const fa = flicker.current.get(f.userId);
      list.push({ windowId: id, state: st, flickerAt: fa && t - fa < FLICKER_MS ? fa : undefined });
    }
    // Sans ami ni fenêtre, on ne touche pas au moteur (sauf pour vider un état précédent).
    if (!list.length && !sent.current) return;
    renderer.setFriendWindows(list);
    sent.current = list.length > 0;
  }, [renderer, street, assignment, now]);

  // Survol d'une ligne de la liste : la fenêtre de cet ami pulse.
  useEffect(() => {
    if (!renderer || !has) return;
    renderer.highlightWindow(highlight ? assignment.get(highlight) ?? null : null);
  }, [renderer, highlight, assignment, has]);

  // Survol (souris) ou toucher d'une fenêtre dans la rue : petit libellé.
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ userId: string; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!renderer || !assignment.size) return;
    const owner = new Map([...assignment].map(([u, w]) => [w, u]));
    let clear: ReturnType<typeof setTimeout> | null = null;
    const pick = (e: PointerEvent) => {
      const el = box.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      let best: { userId: string; x: number; y: number; d: number } | null = null;
      for (const w of renderer.locateFriendWindows()) {
        const d = Math.hypot(w.x - px, w.y - py);
        const userId = owner.get(w.id);
        if (userId && d < Math.max(16, w.r * 1.8) && (!best || d < best.d)) best = { userId, x: w.x, y: w.y - Math.max(8, w.r), d };
      }
      setHover((h) => (best ? (h?.userId === best.userId ? h : { userId: best.userId, x: best.x, y: best.y }) : h && e.pointerType !== "touch" ? null : h));
      if (e.pointerType === "touch") {
        if (clear) clearTimeout(clear);
        clear = setTimeout(() => setHover(null), 3000);
      }
    };
    const move = (e: PointerEvent) => { if (e.pointerType !== "touch") pick(e); };
    const down = (e: PointerEvent) => { if (e.pointerType === "touch") pick(e); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      if (clear) clearTimeout(clear);
    };
  }, [renderer, assignment]);

  const hovered = hover && assignment.has(hover.userId) ? friends.find((f) => f.userId === hover.userId) : null;
  if (!has) return null;
  return (
    <div ref={box} aria-hidden className="absolute inset-0 pointer-events-none">
      {hovered && hover && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full max-w-[16rem] rounded-lg border border-white/15 bg-night/90 px-2.5 py-1.5 text-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.9)]"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="truncate text-xs font-medium">{firstName(hovered.displayName)}</p>
          <p className="truncate text-[11px] text-white/60">{friendActivityLine(hovered.stats, now)}</p>
        </div>
      )}
    </div>
  );
}
