"use client";

// La ville (scène de production) en React. À charger en `next/dynamic`
// là où elle sert : landing, overlay de pause, session Spotify, résumé.
// JAMAIS par-dessus une vidéo qui joue (règle produit).
//
// Pilotage déclaratif (phase, panneau, amis, heure) + impératif via ref pour
// les événements de ville ponctuels (flicker, extend, goal).
// La scène est « la fenêtre » : la capture TOKYO NIGHT vue d'en haut
// (lib/city/TokyoRenderer, lab 4). Replis : sans WebGL2, ou effets coupés,
// une image fixe de la même scène. Reduced
// motion : la scène est rendue mais rien ne bouge (une image par changement).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import { CITY_CREDIT, type CityPhase, type CityRenderer } from "@/lib/city/types";
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
  /** Lacet de la caméra (radians) : une page avec texte à gauche tourne à gauche. */
  yaw?: number;
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
  { phase = "work", board = "", friends = 0, time = "auto", className, label, credit = true, yaw = 0 },
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
  const init = useRef({ phase, board, friends, dawn, yaw });

  useEffect(() => {
    if (off || failed || !canvas.current) return;
    let disposed = false;
    import("@/lib/city/TokyoRenderer")
      .then(async ({ createTokyoCity, supportsTokyoCity }) => {
        if (disposed || !canvas.current) return;
        if (!supportsTokyoCity()) { setFailed(true); return; }
        // Le panneau LED est dessiné avec Doto : on attend la police.
        const doto = getComputedStyle(document.documentElement).getPropertyValue("--font-doto").trim();
        if (doto) await document.fonts?.load(`800 48px ${doto}`).catch(() => {});
        const c = await createTokyoCity(canvas.current, { ...init.current, reducedMotion: !!reduce });
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

  // Repli : une image fixe rendue par la scène elle-même (nuit et petit matin).
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
            src={dawn ? "/city/tokyo/still-dawn.jpg" : "/city/tokyo/still.jpg"}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
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
