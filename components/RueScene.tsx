"use client";

// Une rue de nuit en projection caméra (lib/rue), en composant React.
// Servi à la landing (avec le défilement), à la halte de la session et au
// mode Spotify (aucune vidéo ne joue). Jamais par-dessus une vidéo.
//
// Repli : la photo fixe de la scène (still.webp) si WebGL2 matériel est
// indisponible ou si l'utilisateur préfère réduire les animations.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createRue, supportsRue, type RueMode, type RueRenderer } from "@/lib/rue/RueRenderer";
import { RUE_SCENES, rueBase, rueStill, type RueSceneInfo } from "@/lib/rue/scenes";
import { cn } from "@/lib/utils";

export interface RueHandle {
  /** Fin de pomodoro : la rue se coupe puis se rallume. */
  pomodoroDone(): void;
  /** Objectif du jour atteint : une vague de lumière. */
  goal(): void;
  /** Passe à la rue suivante. */
  next(): void;
  /** Avancée de la caméra pilotée par le défilement (0..1). */
  setScroll(v: number): void;
}

interface Props {
  /** Identifiants des scènes, dans l'ordre (défaut : toutes). */
  scenes?: string[];
  mode?: RueMode;
  /** Avancée de la nuit (0..1). */
  night?: number;
  /** Durée d'une scène en secondes ; `null` = ne change jamais d'elle-même. */
  interval?: [number, number] | null;
  /** Suspend le rendu (ex. section hors écran). */
  paused?: boolean;
  /** Le pointeur fait bouger légèrement la caméra. */
  pointer?: boolean;
  onScene?: (scene: RueSceneInfo) => void;
  className?: string;
  label: string;
}

const RueScene = forwardRef<RueHandle, Props>(function RueScene(
  { scenes, mode = "work", night = 0, interval = [15, 20], paused = false, pointer = true, onScene, className, label },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const r = useRef<RueRenderer | null>(null);
  const [fallback, setFallback] = useState(false);
  const [current, setCurrent] = useState(0);
  const list = useRef<RueSceneInfo[]>([]);
  const ids = (scenes ?? RUE_SCENES.map((s) => s.id)).join(",");
  const onSceneRef = useRef(onScene);
  useEffect(() => { onSceneRef.current = onScene; }, [onScene]);
  const modeRef = useRef(mode);
  const nightRef = useRef(night);
  useEffect(() => { modeRef.current = mode; nightRef.current = night; }, [mode, night]);
  const scrollRef = useRef(0);

  useImperativeHandle(ref, () => ({
    pomodoroDone: () => r.current?.pomodoroDone(),
    goal: () => r.current?.goal(),
    next: () => r.current?.nextScene(),
    setScroll: (v) => { scrollRef.current = v; r.current?.setScroll(v); },
  }), []);

  useEffect(() => {
    const chosen = ids.split(",").map((id) => RUE_SCENES.find((s) => s.id === id)).filter((s): s is RueSceneInfo => !!s);
    list.current = chosen;
    if (!chosen.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !canvas.current || !supportsRue()) {
      setFallback(true);
      onSceneRef.current?.(chosen[0]);
      return;
    }
    let disposed = false;
    const iv: [number, number] = interval ? interval : [1e9, 1e9];
    createRue(canvas.current, {
      scenes: chosen.map((s) => ({ base: rueBase(s.id), style: s.style, frameY: s.frameY })),
      interval: iv,
      onScene: (i) => { setCurrent(i); onSceneRef.current?.(chosen[i]); },
      reducedMotion: false,
    })
      .then((x) => {
        if (disposed) { x.dispose(); return; }
        r.current = x;
        x.setMode(modeRef.current);
        x.setNight(nightRef.current);
        x.setScroll(scrollRef.current);
        onSceneRef.current?.(chosen[0]);
      })
      .catch((e) => { console.warn("[rue] repli image fixe :", e); setFallback(true); });
    return () => { disposed = true; r.current?.dispose(); r.current = null; };
    // L'intervalle est lu à la création seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  useEffect(() => { r.current?.setMode(mode); }, [mode]);
  useEffect(() => { r.current?.setNight(night); }, [night]);
  useEffect(() => { r.current?.setPaused(paused); }, [paused]);

  useEffect(() => {
    if (!pointer || fallback) return;
    const move = (e: PointerEvent) => r.current?.pointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [pointer, fallback]);

  const still = list.current[current] ?? RUE_SCENES.find((s) => s.id === ids.split(",")[0]) ?? RUE_SCENES[0];

  return (
    <div className={cn("overflow-hidden bg-night", className)} role="img" aria-label={label}>
      {fallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={rueStill(still.id)} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <canvas ref={canvas} aria-hidden className="absolute inset-0 w-full h-full block" />
      )}
    </div>
  );
});

export default RueScene;
