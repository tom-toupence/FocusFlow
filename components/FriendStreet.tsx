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
  assignStreet, blindOf, frameFacade, framePause, fullZone, lightOf, POSTIT_PHONE, quadBox, usableWindows, windowRect,
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

/**
 * Bords fondus quand la photo ne couvre pas tout l'écran (le bloc de fenêtres
 * passe avant la couverture) : la façade se perd dans la nuit au lieu de
 * s'arrêter net.
 */
function edgeFade(img: Rect, c: { w: number; h: number }): CSSProperties {
  const f = (a: boolean, b: boolean, dir: string) =>
    a || b ? `linear-gradient(${dir}, ${a ? "transparent 0, #000 9%" : "#000 0"}, ${b ? "#000 91%, transparent 100%" : "#000 100%"})` : null;
  const v = f(img.y > 0.5, img.y + img.h < c.h - 0.5, "to bottom");
  const h = f(img.x > 0.5, img.x + img.w < c.w - 0.5, "to right");
  const masks = [v, h].filter(Boolean) as string[];
  if (!masks.length) return {};
  const image = masks.join(", ");
  return { maskImage: image, WebkitMaskImage: image, maskComposite: "intersect", WebkitMaskComposite: "source-in" } as CSSProperties;
}

/** Voile sous le texte de la pause : à gauche sur grand écran, en bas sur téléphone. */
function readingVeil(cw: number, ch: number, t: Rect): string {
  if (cw >= 768) {
    const r = t.x + t.w;
    return `linear-gradient(90deg, #07090d 0px, rgba(7,9,13,0.86) ${Math.max(0, r - 60)}px, rgba(7,9,13,0.2) ${r + 8}px, transparent ${r + 24}px)`;
  }
  const d = ch - t.y;
  return `linear-gradient(0deg, #07090d 0px, rgba(7,9,13,0.9) ${Math.max(0, d - 70)}px, rgba(7,9,13,0.3) ${d}px, transparent ${d + 8}px)`;
}

const RANK: Record<FriendWindowState, number> = { focus: 0, on: 1, off: 2 };
const STATE_WORD: Record<FriendWindowState, string> = { focus: "en focus", on: "en ligne", off: "hors ligne" };
const INTERACTIVE = 'button, a, input, textarea, select, label, summary, [role="button"], [role="dialog"], [contenteditable="true"]';

export default function FriendStreet({ layout = "pause", className, label }: Props) {
  const facade = FACADES[0];
  const friends = useFriendsStore((s) => s.friends);
  const myName = useFriendsStore((s) => s.myInvite?.username ?? null);
  const highlight = useFriendWindowsStore((s) => s.highlight);
  const setOffFrame = useFriendWindowsStore((s) => s.setOffFrame);
  const now = useNowTick(friends.length > 0);
  const box = useRef<HTMLDivElement>(null);
  // Taille du conteneur et bloc de texte de la pause ([data-pause-text], dans la
  // page) : la façade se cadre dans la place libre. Regroupé par image.
  const [size, setSize] = useState<{ w: number; h: number; text: Rect | null } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const t = layout === "pause" ? document.querySelector("[data-pause-text]")?.getBoundingClientRect() : null;
      const text = t && t.width > 0 ? { x: Math.round(t.left - r.left), y: Math.round(t.top - r.top), w: Math.round(t.width), h: Math.round(t.height) } : null;
      const w = Math.round(r.width), h = Math.round(r.height);
      setSize((s) => (s && s.w === w && s.h === h && JSON.stringify(s.text) === JSON.stringify(text) ? s : { w, h, text }));
    };
    const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(measure); });
    ro.observe(el);
    const textEl = layout === "pause" ? document.querySelector("[data-pause-text]") : null;
    if (textEl) ro.observe(textEl);
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [layout]);

  const frame = useMemo(() => {
    if (!size) return null;
    if (layout === "pause") return framePause(size.w, size.h, size.text, facade);
    const zone = fullZone(size.w, size.h);
    return { zone, img: frameFacade(size.w, size.h, zone, facade) };
  }, [size, layout, facade]);
  const img: Rect | null = frame?.img ?? null;
  // Fenêtres visibles : le cadrage les met toutes dans la place libre ; ce
  // filtre ne sert que de garde-fou (très petit écran), jamais à attribuer.
  const visibleKey = useMemo(() => {
    if (!frame || !size) return "";
    return usableWindows(facade.windows, frame.img, frame.zone, size.w < 768 && layout === "pause" ? [POSTIT_PHONE] : []).join(",");
  }, [frame, size, layout, facade]);
  const visible = useMemo(() => new Set(visibleKey ? visibleKey.split(",").map(Number) : []), [visibleKey]);

  // Clé d'état stable : rien n'est recalculé tant qu'aucun ami ne change d'état.
  const stateKey = useMemo(
    () => friends.map((f) => `${f.userId}:${friendWindowState(f.stats, now)}`).sort().join("|"),
    [friends, now],
  );
  const meId = myName ?? getCurrentUserId() ?? "toi";
  const assignment = useMemo(() => {
    const list = stateKey ? stateKey.split("|").map((e) => {
      const i = e.lastIndexOf(":");
      const st = e.slice(i + 1) as FriendWindowState;
      return { id: e.slice(0, i), rank: RANK[st] };
    }) : [];
    return assignStreet(meId, list, facade.windows.map((w) => w.id), facade.id);
  }, [stateKey, meId, facade]);

  const all = useMemo<Win[]>(() => {
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
  const wins = useMemo(() => all.filter((w) => visible.has(w.windowId)), [all, visible]);

  // Amis dont la fenêtre est masquée : « hors cadre » dans la liste.
  useEffect(() => {
    if (!size) return;
    setOffFrame(all.filter((w) => w.userId && !visible.has(w.windowId)).map((w) => w.userId!).sort());
  }, [all, visible, size, setOffFrame]);
  useEffect(() => () => setOffFrame([]), [setOffFrame]);

  // Survol (souris), toucher ou focus clavier d'une fenêtre : bulle avec le
  // prénom et l'activité, dans un portail (au-dessus du texte et de la liste).
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const bubbleAt = (key: string, r: { left: number; top: number; width: number }) =>
    ({ key, x: Math.min(window.innerWidth - 110, Math.max(110, r.left + r.width / 2)), y: r.top - 8 });
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
        if (!hit) return touch ? h : null;     // la souris sort de la fenêtre : la bulle se ferme
        if (h?.key === hit.key) return h;
        return bubbleAt(hit.key, { left: rect.left + hit.r.x, top: rect.top + hit.r.y, width: hit.r.w });
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
    // Un toucher sur un bouton, un lien, un champ ou un dialogue n'ouvre pas de bulle.
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return;
      queue(e);
    };
    const leave = () => setHover((h) => (h && !last?.touch ? null : h));
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      if (raf) cancelAnimationFrame(raf);
      if (clear) clearTimeout(clear);
    };
    // img dérive de size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wins, size, facade]);

  const hovered = hover ? wins.find((w) => w.key === hover.key) : null;
  const activityOf = (w: Win) => (w.me ? "En pause" : friendActivityLine(friends.find((f) => f.userId === w.userId)?.stats ?? null, now));
  // Résumé complet pour les lecteurs d'écran (les fenêtres masquées comprises).
  const summary = all.map((w) => {
    const act = activityOf(w);
    const st = w.me ? "en pause" : STATE_WORD[w.state];
    return `${w.name}, ${st}${act && act.toLowerCase() !== st ? ` : ${act}` : ""}${visible.has(w.windowId) ? "" : " (hors cadre)"}`;
  }).join(" ; ");
  let neon = 0;

  return (
    <div ref={box} className={cn("overflow-hidden bg-night", className)} role="group" aria-label={label} data-testid="friend-street">
      <p className="sr-only">{summary ? `Fenêtres de la façade. ${summary}.` : "Fenêtres de la façade."}</p>
      {img && (
        <div className="absolute" style={{ left: img.x, top: img.y, width: img.w, height: img.h, ...edgeFade(img, size!) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={(el) => { if (el?.complete && el.naturalWidth && !loaded) setLoaded(true); }}
            onLoad={() => setLoaded(true)}
            src={facadePhoto(facade.id)}
            srcSet={`${facadePhoto(facade.id, true)} 1200w, ${facadePhoto(facade.id)} 2400w`}
            sizes={`${Math.round(img.w)}px`}
            alt=""
            className="ff-street-photo absolute inset-0 h-full w-full"
            draggable={false}
          />
          {/* Les fenêtres n'apparaissent qu'une fois la photo chargée (fondu). */}
          <div role="list" aria-label="Fenêtres de tes amis" className={cn("ff-layer absolute inset-0", loaded && "is-on")} data-loaded={loaded ? "1" : "0"}>
            {wins.map((w) => {
              const b = quadBox(facade.windows.find((x) => x.id === w.windowId)!.quad);
              const lit = w.state !== "off";
              // Néons décalés : jamais deux qui battent en même temps.
              const delay = w.light === "neon" ? neon++ * 0.45 : 0;
              return (
                <div
                  key={w.key}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${w.name}, ${w.me ? "en pause" : STATE_WORD[w.state]}. ${activityOf(w)}`}
                  onFocus={(e) => setHover(bubbleAt(w.key, e.currentTarget.getBoundingClientRect()))}
                  onBlur={() => setHover((h) => (h?.key === w.key ? null : h))}
                  className="ff-win"
                  data-testid="ff-win"
                  data-window={w.windowId}
                  data-state={w.state}
                  data-lit={lit ? "1" : "0"}
                  data-light={w.light}
                  data-blind={w.blind}
                  data-me={w.me ? "1" : undefined}
                  data-hi={(w.userId && w.userId === highlight) || w.key === hover?.key ? "1" : undefined}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, ...LIGHT_STYLE[w.light], ["--ff-delay" as string]: `${delay}s` }}
                >
                  <span className="ff-win__glass" />
                  <span className="ff-win__light" />
                  <span className="ff-win__blind" />
                  <span className="ff-win__screen" />
                  <span className="ff-win__frame" />
                  <span className="ff-plate" data-testid="ff-plate" aria-hidden>{w.name}</span>
                </div>
              );
            })}
          </div>
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
          <p className="truncate text-[11px] text-white/60">{activityOf(hovered)}</p>
        </div>,
        document.body,
      )}
      {/* Voile de lecture calé sur le texte de la pause : il s'arrête avant la façade. */}
      {layout === "pause" && size?.text && <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: readingVeil(size.w, size.h, size.text) }} />}
      <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-white/45">{facade.credit}</p>
    </div>
  );
}
