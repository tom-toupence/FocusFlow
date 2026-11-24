"use client";

// « Ta rue » : l'écran de pause quand tu as des amis. Une vraie façade de nuit
// (photo, fenêtres annotées à la main) où chaque ami EST une fenêtre :
// allumée s'il est en ligne, plus vive (lueur d'écran) s'il est en focus,
// éteinte s'il est hors ligne. Ta fenêtre aussi, plaque « Toi », lumière
// tamisée (tu es en pause). Allumage : interrupteur (fondu) ou néon qui
// s'amorce en trois battements, sous 3 Hz ; rien sous mouvement réduit.
//
// Tout est en CSS (calques par fenêtre, styles dans globals.css, « .ff-win ») :
// aucun travail par image côté JS. Le JS ne tourne qu'au redimensionnement,
// quand l'état d'un ami change, et au survol (une fois par image au plus).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { getCurrentUserId } from "@/lib/authState";
import { FACADES, facadePhoto } from "@/lib/rue/facades";
import {
  assignStreet, blindOf, coverLayout, fullZones, lightOf, pauseZones, quadBox, usableWindows, windowRect,
  type Blind, type Light, type Rect,
} from "@/lib/rue/friendStreet";
import { firstName, friendActivityLine, friendWindowState, type FriendWindowState } from "@/lib/rue/friendWindows";
import { useFriendsStore } from "@/store/friendsStore";
import { useFriendWindowsStore } from "@/store/friendWindowsStore";
import { useNowTick } from "@/components/FriendWindowsLayer";
import { cn } from "@/lib/utils";

const LIGHT_STYLE: Record<Light, CSSProperties> = {
  tungstene: {
    "--ff-light": "radial-gradient(120% 150% at 50% 10%, #ffdca3 0%, #f2a654 45%, #7d461d 100%)",
    "--ff-glow": "rgba(255,170,85,0.5)",
  } as CSSProperties,
  lampe: {
    "--ff-light": "radial-gradient(85% 130% at 20% 85%, #ffe9be 0%, #eaa75a 38%, #5e351a 90%)",
    "--ff-glow": "rgba(255,195,120,0.42)",
  } as CSSProperties,
  neon: {
    "--ff-light": "linear-gradient(180deg, #f5fbff 0%, #d3e6f4 50%, #8aa6bc 100%)",
    "--ff-glow": "rgba(190,226,255,0.45)",
  } as CSSProperties,
};

interface Props {
  /** « pause » : fenêtres hors du texte de la pause ; « full » : toute la photo (banc d'essai). */
  layout?: "pause" | "full";
  className?: string;
  label: string;
}

interface Win {
  key: string;
  windowId: number;
  name: string;
  state: FriendWindowState;
  me: boolean;
  light: Light;
  blind: Blind;
  userId: string | null;
}

export default function FriendStreet({ layout = "pause", className, label }: Props) {
  const facade = FACADES[0];
  const friends = useFriendsStore((s) => s.friends);
  const highlight = useFriendWindowsStore((s) => s.highlight);
  const now = useNowTick(friends.length > 0);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const img: Rect | null = size ? coverLayout(size.w, size.h, facade.width, facade.height, facade.focusX) : null;
  const poolKey = useMemo(() => {
    if (!size || !img) return "";
    const z = layout === "pause" ? pauseZones(size.w, size.h, size.w >= 768) : fullZones(size.w, size.h, size.w >= 768);
    return usableWindows(facade.windows, img, z.zone, z.avoid).join(",");
    // img dérive de size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, layout, facade]);

  // Clé d'état stable : rien n'est recalculé tant qu'aucun ami ne change d'état.
  const stateKey = useMemo(
    () => friends.map((f) => `${f.userId}:${friendWindowState(f.stats, now)}`).sort().join("|"),
    [friends, now],
  );
  const meId = getCurrentUserId() ?? "toi";
  const assignment = useMemo(() => {
    const pool = poolKey ? poolKey.split(",").map(Number) : [];
    const ids = stateKey ? stateKey.split("|").map((e) => e.slice(0, e.lastIndexOf(":"))) : [];
    return assignStreet(meId, ids, pool, facade.id);
  }, [poolKey, stateKey, meId, facade.id]);

  const wins = useMemo<Win[]>(() => {
    const out: Win[] = [];
    if (assignment.me) out.push({ key: "toi", windowId: assignment.me, name: "Toi", state: "on", me: true, light: "tungstene", blind: "rideau", userId: null });
    for (const f of friends) {
      const id = assignment.friends.get(f.userId);
      if (!id) continue;
      out.push({
        key: f.userId, windowId: id, name: firstName(f.displayName), state: friendWindowState(f.stats, now), me: false,
        light: lightOf(f.userId), blind: blindOf(f.userId), userId: f.userId,
      });
    }
    return out;
    // Les états viennent de stateKey (stable) ; `now` seul ne doit pas tout relancer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment, friends, stateKey]);

  // Survol (souris) ou toucher d'une fenêtre : bulle avec le prénom et l'activité.
  // Position de la bulle en coordonnées de la fenêtre du navigateur : elle est
  // rendue dans un portail, au-dessus du texte de la pause et de la liste.
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !img || !wins.length) return;
    const rects = wins.map((w) => ({ key: w.key, r: windowRect(facade.windows.find((x) => x.id === w.windowId)!, img) }));
    let rect = el.getBoundingClientRect();
    const onResize = () => { rect = el.getBoundingClientRect(); };
    let raf = 0, clear: ReturnType<typeof setTimeout> | null = null;
    let last: { x: number; y: number; touch: boolean } | null = null;
    const pick = () => {
      raf = 0;
      if (!last) return;
      const px = last.x - rect.left, py = last.y - rect.top;
      const hit = rects.find(({ r }) => px >= r.x - 4 && px <= r.x + r.w + 4 && py >= r.y - 4 && py <= r.y + r.h + 20);
      const touch = last.touch;
      setHover((h) => {
        if (!hit) return touch ? h : null;
        if (h?.key === hit.key) return h;
        const x = Math.min(window.innerWidth - 110, Math.max(110, rect.left + hit.r.x + hit.r.w / 2));
        return { key: hit.key, x, y: rect.top + hit.r.y - 8 };
      });
      if (touch) {
        if (clear) clearTimeout(clear);
        clear = setTimeout(() => setHover(null), 3000);
      }
    };
    const queue = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" };
      if (!raf) raf = requestAnimationFrame(pick);
    };
    const move = (e: PointerEvent) => { if (e.pointerType !== "touch") queue(e); };
    const down = (e: PointerEvent) => { if (e.pointerType === "touch") queue(e); };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      if (raf) cancelAnimationFrame(raf);
      if (clear) clearTimeout(clear);
    };
    // img dérive de size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wins, size, facade]);

  const hovered = hover ? wins.find((w) => w.key === hover.key) : null;
  const hoveredFriend = hovered?.userId ? friends.find((f) => f.userId === hovered.userId) : null;

  return (
    <div ref={box} className={cn("overflow-hidden bg-night", className)} role="img" aria-label={label} data-testid="friend-street">
      {img && (
        <div className="absolute" style={{ left: img.x, top: img.y, width: img.w, height: img.h }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={facadePhoto(facade.id)}
            srcSet={`${facadePhoto(facade.id, true)} 1200w, ${facadePhoto(facade.id)} 2400w`}
            sizes={`${Math.round(img.w)}px`}
            alt=""
            className="ff-street-photo absolute inset-0 h-full w-full"
            draggable={false}
          />
          {wins.map((w) => {
            const b = quadBox(facade.windows.find((x) => x.id === w.windowId)!.quad);
            const lit = w.state !== "off";
            return (
              <div
                key={w.key}
                className="ff-win"
                data-testid="ff-win"
                data-state={w.state}
                data-lit={lit ? "1" : "0"}
                data-light={w.light}
                data-blind={w.blind}
                data-me={w.me ? "1" : undefined}
                data-hi={(w.userId && w.userId === highlight) || w.key === hover?.key ? "1" : undefined}
                aria-hidden
                style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, ...LIGHT_STYLE[w.light] }}
              >
                <span className="ff-win__glass" />
                <span className="ff-win__light" />
                <span className="ff-win__blind" />
                <span className="ff-win__screen" />
                <span className="ff-win__frame" />
                <span className="ff-plate" data-testid="ff-plate">{w.name}</span>
              </div>
            );
          })}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_45%,transparent_45%,rgba(4,6,10,0.55)_100%)]" />
        </div>
      )}
      {hovered && hover && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[110] max-w-[13rem] -translate-x-1/2 -translate-y-full rounded-lg border border-white/15 bg-night/95 px-2.5 py-1.5 text-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.9)]"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="truncate text-xs font-medium">{hovered.name}</p>
          <p className="truncate text-[11px] text-white/60">{hovered.me ? "En pause" : friendActivityLine(hoveredFriend?.stats ?? null, now)}</p>
        </div>,
        document.body,
      )}
      <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-white/45">{facade.credit}</p>
    </div>
  );
}
