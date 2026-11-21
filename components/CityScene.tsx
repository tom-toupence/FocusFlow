"use client";

// La ruelle (scène de production) en React. À charger en `next/dynamic`
// là où elle sert : landing, overlay de pause, session Spotify, résumé.
// JAMAIS par-dessus une vidéo qui joue (règle produit).
//
// Pilotage déclaratif (phase, panneau, amis, heure) + impératif via ref pour
// les événements de ville ponctuels (flicker, extend, goal).
// La scène est une vraie photo de ruelle en 2.5D (lib/city/PhotoRenderer,
// lab 3). Replis : sans WebGL2, ou effets coupés, la photo fixe. Reduced
// motion : la scène est rendue mais rien ne bouge (une image par changement).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import { CITY_CREDIT, type CityPhase, type CityRenderer } from "@/lib/city/types";
import type { PhotoSceneDef } from "@/lib/city/PhotoRenderer";

/** La ruelle de production (photo CC BY 4.0, voir docs/redesign/ASSETS.md). */
const ALLEY: PhotoSceneDef = {
  base: "/city/alley",
  board: [[0.690, 0.081], [0.783, 0.078], [0.783, 0.262], [0.690, 0.266]],
  focus: 0.3,
  vanish: [0.5, 0.56],
  frameX: 0.72, // en portrait : le point de fuite à gauche, le panneau LED entier à droite
  rain: 0.85,
  wet: 1,
};
import { cn } from "@/lib/utils";
import { usePrefsStore } from "@/store/prefsStore";

// Désactivation globale du WebGL au déploiement : NEXT_PUBLIC_DISABLE_WEBGL=1.
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
  /** Crédit de la photo (CC BY) en bas à droite ; false si la page le donne ailleurs. */
  credit?: boolean;
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
  { phase = "work", board = "", friends = 0, time = "auto", className, label, credit = true },
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
    import("@/lib/city/PhotoRenderer")
      .then(async ({ createPhotoCity, supportsPhotoCity }) => {
        if (disposed || !canvas.current) return;
        if (!supportsPhotoCity()) { setFailed(true); return; }
        // Le panneau LED est dessiné avec Doto : on attend la police.
        const doto = getComputedStyle(document.documentElement).getPropertyValue("--font-doto").trim();
        if (doto) await document.fonts?.load(`800 48px ${doto}`).catch(() => {});
        const c = await createPhotoCity(canvas.current, ALLEY, { ...init.current, reducedMotion: !!reduce });
        if (disposed) c.dispose(); else r.current = c;
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

  // Repli : la photo elle-même ; au petit matin, désaturée et éclaircie.
  return (
    <div className={cn("relative overflow-hidden", dawn ? "bg-[#9fadba]" : "bg-[#0b1016]", className)}>
      <div
        className="absolute inset-0"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {failed || off ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/city/alley/photo-m.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[72%_50%]"
            style={dawn ? { filter: "saturate(0.45) brightness(1.35) hue-rotate(-8deg)" } : undefined}
            draggable={false}
          />
        ) : (
          <canvas ref={canvas} className="absolute inset-0 w-full h-full block" />
        )}
      </div>
      {credit && (
        <a
          href={CITY_CREDIT.href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 right-2 z-10 text-[10px] text-white/55 hover:text-white/85 underline-offset-2 hover:underline"
        >
          {CITY_CREDIT.text}
        </a>
      )}
    </div>
  );
});

export default CityScene;
