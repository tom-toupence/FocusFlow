"use client";

// La ruelle (scène 3D de production) en React. À charger en `next/dynamic`
// là où elle sert : landing, overlay de pause, session Spotify, résumé.
// JAMAIS par-dessus une vidéo qui joue (règle produit).
//
// Pilotage déclaratif (phase, panneau, amis, heure) + impératif via ref pour
// les événements de ville ponctuels (flicker, extend, goal).
// Replis : sans WebGL, ou « effets 3D » coupés → photo fixe de la même scène
// (rendue par la scène elle-même, public/city/). Reduced motion : la scène
// est rendue mais rien ne bouge (aucune boucle, une image par changement).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import type { CityPhase, CityRenderer } from "@/lib/city/CityRenderer";
import { cn } from "@/lib/utils";
import { usePrefsStore } from "@/store/prefsStore";

// Désactivation globale de la 3D au déploiement : NEXT_PUBLIC_DISABLE_WEBGL=1.
const WEBGL_DISABLED = process.env.NEXT_PUBLIC_DISABLE_WEBGL === "1";

export interface CityHandle {
  flicker: () => void;
  extend: () => void;
  goal: () => void;
}

interface Props {
  phase?: CityPhase;
  /** Texte du panneau à LED (ex. « 12 MIN »), lettres latines et chiffres. */
  board?: string;
  /** Nombre d'amis en focus : autant de fenêtres vertes (max 12). */
  friends?: number;
  /** "auto" suit le thème (clair = petit matin), sinon forcé. */
  time?: "auto" | "night" | "dawn";
  className?: string;
  /** Texte alternatif : ce que la scène signifie. */
  label?: string;
}

/** Thème courant (classe .dark sur <html>), réactif. */
function useIsDark() {
  return useSyncExternalStore(
    (cb) => {
      const mo = new MutationObserver(cb);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => mo.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => true,
  );
}

const CityScene = forwardRef<CityHandle, Props>(function CityScene(
  { phase = "work", board = "", friends = 0, time = "auto", className, label },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const r = useRef<CityRenderer | null>(null);
  const reduce = useReducedMotion();
  const effects = usePrefsStore((s) => s.sceneEffects);
  const dark = useIsDark();
  const dawn = time === "dawn" || (time === "auto" && !dark) ? 1 : 0;
  const [failed, setFailed] = useState(false);
  const off = WEBGL_DISABLED || !effects;
  // Valeurs initiales figées au montage (les mises à jour passent par les effets).
  const init = useRef({ phase, board, friends, dawn });

  useEffect(() => {
    if (off || failed || !canvas.current) return;
    let disposed = false;
    import("@/lib/city/CityRenderer")
      .then(({ createCity, supportsWebGL }) => {
        if (disposed || !canvas.current) return;
        if (!supportsWebGL()) { setFailed(true); return; }
        r.current = createCity(canvas.current, { ...init.current, reducedMotion: !!reduce });
      })
      .catch((e) => {
        console.warn("[CityScene] repli statique :", e instanceof Error ? e.message : e);
        setFailed(true);
      });
    return () => { disposed = true; r.current?.dispose(); r.current = null; };
  }, [reduce, off, failed]);

  useEffect(() => { r.current?.setPhase(phase); }, [phase]);
  useEffect(() => { r.current?.setBoard(board); }, [board]);
  useEffect(() => { r.current?.setFriends(friends); }, [friends]);
  useEffect(() => { r.current?.setDawn(dawn); }, [dawn]);

  useImperativeHandle(ref, () => ({
    flicker: () => r.current?.flicker(),
    extend: () => r.current?.extend(),
    goal: () => r.current?.goal(),
  }), []);

  const still = dawn ? "/city/ruelle-dawn.jpg" : "/city/ruelle-night.jpg";
  return (
    <div
      className={cn("relative overflow-hidden", dawn ? "bg-[#c3ccd4]" : "bg-[#0b1119]", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {failed || off ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      ) : (
        <canvas ref={canvas} className="absolute inset-0 w-full h-full block" />
      )}
    </div>
  );
});

export default CityScene;
