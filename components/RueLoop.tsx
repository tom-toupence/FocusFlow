"use client";

// La rue en BOUCLE VIDÉO : les 34 scènes (rues de nuit, ruelles, rizières…) rendues à l'avance par le
// moteur (lib/rue, pluie, néons, caméra qui respire), enchaînées par des
// fondus, en une seule vidéo qui boucle sans couture. Fond de la landing.
//
// Pourquoi une vidéo plutôt que le moteur WebGL en direct : même rendu sur
// toutes les machines (téléphone, portable sans GPU, navigateur en logiciel),
// une fraction du coût batterie, et aucune coupure entre deux rues.
// Produite par scripts/rue/loop.sh (voir le README du dossier).
//
// Repli : sous `prefers-reduced-motion` ou en économie de données, la photo
// fixe de la première rue (le poster), sans lecture.
import { useEffect, useRef, useState } from "react";
import { RUE_SCENES, rueStill, type RueSceneInfo } from "@/lib/rue/scenes";
import { cn } from "@/lib/utils";

/** Ordre des rues dans la vidéo (doit suivre scripts/rue/loop.sh). */
export const RUE_LOOP_ORDER = [
  "kabukicho", "pont", "sannenzaka", "ninenzaka", "hoian-nuit", "dotonbori",
  "sapa", "sapa-vallee", "avenue", "ruelle", "kanazawa", "takayama",
  "gion-nuit", "shirakawa", "tegallalang", "batad", "carrefour", "ecrans",
  "hoian", "ubud-maisons", "banaue", "bandung", "manhattan", "times-square",
  "seattle", "reine", "sakrisoy", "geiranger", "bryggen", "viaduc",
  "pavillon", "boulevard", "fleuve", "tours",
];
/** Durée de chaque rue dans la boucle, fondu compris (secondes). */
const SEG = 4.5;
/** Moitié du fondu : la rue suivante prend le dessus au milieu du fondu. */
const HALF_FADE = 0.6;

interface Props {
  onScene?: (scene: RueSceneInfo) => void;
  className?: string;
  label: string;
}

const sceneAt = (t: number) => {
  const i = Math.floor((t + HALF_FADE) / SEG) % RUE_LOOP_ORDER.length;
  return RUE_SCENES.find((s) => s.id === RUE_LOOP_ORDER[i]) ?? RUE_SCENES[0];
};

export default function RueLoop({ onScene, className, label }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(true);
  const [src, setSrc] = useState<{ webm: string; mp4: string } | null>(null);
  const onSceneRef = useRef(onScene);
  useEffect(() => { onSceneRef.current = onScene; }, [onScene]);

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    // Économie de données ou connexion lente : la photo fixe suffit.
    if (conn?.saveData || /(^|-)2g$|^3g$/.test(conn?.effectiveType ?? "")) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const q = window.matchMedia("(max-width: 767px)").matches ? "720" : "1080";
    const apply = () => {
      if (mq.matches) { setSrc(null); setStill(true); }
      else setSrc({ webm: `/rue/loop/rue-${q}.webm`, mp4: `/rue/loop/rue-${q}.mp4` });
    };
    // Chargée seulement une fois la page affichée et le navigateur au repos :
    // un visiteur qui repart tout de suite ne télécharge pas la vidéo.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let idle = 0;
    const timer = window.setTimeout(() => {
      idle = w.requestIdleCallback ? w.requestIdleCallback(apply, { timeout: 2000 }) : window.setTimeout(apply, 0);
    }, 1500);
    mq.addEventListener("change", apply);
    return () => {
      window.clearTimeout(timer);
      if (idle) { if (w.cancelIdleCallback) w.cancelIdleCallback(idle); else window.clearTimeout(idle); }
      mq.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v || !src) return;
    let last = "";
    const tick = () => {
      const s = sceneAt(v.currentTime);
      if (s.id !== last) { last = s.id; onSceneRef.current?.(s); }
    };
    const playing = () => setStill(false);
    v.addEventListener("timeupdate", tick);
    v.addEventListener("playing", playing);
    v.play().catch(() => { /* lecture auto refusée (mode économie) : le poster reste */ });
    return () => { v.removeEventListener("timeupdate", tick); v.removeEventListener("playing", playing); };
  }, [src]);

  return (
    <div className={cn("overflow-hidden bg-night", className)} role="img" aria-label={label}>
      {/* Fond FIXE : aucun zoom au défilement (redimensionner la vidéo à
          chaque pas la faisait trembler, retour utilisateur 2026-11-23). */}
      <div className="absolute inset-0">
        {/* Le poster reste dessous : la vidéo apparaît en fondu par-dessus. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rueStill(RUE_LOOP_ORDER[0])} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {src && (
          <video
            ref={video}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden
            className={cn("absolute inset-0 w-full h-full object-cover transition-opacity duration-1000", still ? "opacity-0" : "opacity-100")}
          >
            <source src={src.webm} type='video/webm; codecs="av01.0.08M.08"' />
            <source src={src.mp4} type="video/mp4" />
          </video>
        )}
      </div>
    </div>
  );
}
