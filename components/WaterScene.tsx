"use client";

// Scène d'eau (Clepsydre) en React. À charger en `next/dynamic` là où elle
// sert : landing, overlay de pause, session Spotify, résumé. JAMAIS par-dessus
// une vidéo qui joue (règle produit, cf. 02-CONCEPTS « Arbitrage »).
//
// Pilotage déclaratif (level, swell, reflet) + impératif via ref
// (drop, stone, overflow) pour les événements ponctuels.
// Replis : sans WebGL2 → image statique CSS soignée (même composition :
// horizon, rive, échelle) ; reduced-motion → une image fixe, rien ne bouge.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { WaterRenderer, supportsWebGL2 } from "@/lib/water/WaterRenderer";
import { cn } from "@/lib/utils";
import { usePrefsStore } from "@/store/prefsStore";

// Désactivation globale de la 3D au déploiement : NEXT_PUBLIC_DISABLE_WEBGL=1.
const WEBGL_DISABLED = process.env.NEXT_PUBLIC_DISABLE_WEBGL === "1";

export interface WaterHandle {
  drop: (x?: number, y?: number, strength?: number) => void;
  stone: () => void;
  overflow: (settleTo: number) => void;
}

interface Props {
  /** Hauteur de l'eau sur l'échelle, 0..1. */
  level: number;
  /** Houle (lecture active) 0..1. */
  swell?: number;
  /** Couleur de la vidéo (reflet sur la rive). */
  reflet?: string;
  pole?: boolean;
  /** Position horizontale de l'échelle (-1 gauche … 1 droite). */
  poleX?: number;
  className?: string;
  /** Texte alternatif : ce que la scène signifie (« Niveau : 12 min sur 25 »). */
  label?: string;
}

const WaterScene = forwardRef<WaterHandle, Props>(function WaterScene(
  { level, swell = 0, reflet = "#3d4a6b", pole = true, poleX = -0.55, className, label },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const r = useRef<WaterRenderer | null>(null);
  const reduce = useReducedMotion();
  const effects = usePrefsStore((s) => s.waterEffects);
  // Composant chargé sans SSR : on peut sonder WebGL2 dès le premier rendu.
  const [failed, setFailed] = useState(() => typeof window !== "undefined" && !supportsWebGL2());
  const off = WEBGL_DISABLED || !effects;
  // Valeurs initiales figées au montage (les mises à jour passent par les effets).
  const init = useRef({ level, swell, reflet, pole, poleX });

  useEffect(() => {
    if (off || failed || !canvas.current) return;
    try {
      r.current = new WaterRenderer(canvas.current, { ...init.current, reducedMotion: !!reduce });
    } catch (e) {
      console.warn("[WaterScene] repli statique :", e instanceof Error ? e.message : e);
      // Échec d'un système externe (GPU) : bascule différée vers le repli.
      queueMicrotask(() => setFailed(true));
    }
    return () => { r.current?.dispose(); r.current = null; };
  }, [reduce, off, failed]);

  useEffect(() => { r.current?.setLevel(level); }, [level]);
  useEffect(() => { r.current?.setSwell(swell); }, [swell]);
  useEffect(() => { r.current?.setReflet(reflet); }, [reflet]);
  useEffect(() => { r.current?.setPole(pole, poleX); }, [pole, poleX]);

  useImperativeHandle(ref, () => ({
    drop: (x, y, s) => r.current?.drop(x, y, s),
    stone: () => r.current?.stone(),
    overflow: (to) => r.current?.overflow(to),
  }), []);

  return (
    <div className={cn("relative overflow-hidden bg-[oklch(0.13_0.02_248)]", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {failed || off ? (
        <StaticWater level={level} reflet={reflet} pole={pole} poleX={poleX} />
      ) : (
        <canvas ref={canvas} className="absolute inset-0 w-full h-full block" />
      )}
    </div>
  );
});

export default WaterScene;

/** Repli sans WebGL : la même composition en CSS (ciel, rive, eau, échelle). */
function StaticWater({ level, reflet, pole, poleX }: { level: number; reflet: string; pole: boolean; poleX: number }) {
  const horizon = 47; // % depuis le haut
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 top-0" style={{ height: `${horizon}%`, background: `linear-gradient(180deg, oklch(0.16 0.02 252), color-mix(in oklab, oklch(0.2 0.02 252) 82%, ${reflet}))` }} />
      <div
        className="absolute inset-x-0"
        style={{
          top: `calc(${horizon}% - 2px)`,
          height: 3,
          backgroundImage: `radial-gradient(circle, color-mix(in oklab, ${reflet} 40%, oklch(0.85 0.1 70)) 0 1px, transparent 1.5px)`,
          backgroundSize: "9px 3px",
          opacity: 0.8,
        }}
      />
      <div className="absolute inset-x-0 bottom-0" style={{ top: `${horizon}%`, background: `linear-gradient(180deg, color-mix(in oklab, oklch(0.16 0.025 245) 80%, ${reflet}), oklch(0.09 0.02 245))` }} />
      {pole && (
        <div
          className="absolute w-[1.2%] min-w-2 rounded-[1px]"
          style={{
            left: `${50 + poleX * 22}%`,
            top: "18%",
            bottom: `${30 + level * 22}%`,
            background: "repeating-linear-gradient(180deg, oklch(0.82 0.01 85) 0 6px, oklch(0.3 0.02 250) 6px 7px)",
            boxShadow: "inset -3px 0 0 oklch(0.82 0.01 85)",
          }}
        />
      )}
    </div>
  );
}
