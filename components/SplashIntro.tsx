"use client";

import { useEffect, useState } from "react";
import { Water } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";

// Écran d'arrivée : le wordmark « FocusFlow » ondule sous une surface d'eau
// (shader WebGL Paper Shaders — effet goutte d'eau/caustiques), puis fondu vers
// le site. Joué à chaque chargement complet de la page (monté dans le layout
// racine → pas rejoué lors des navigations SPA).
// Replis : prefers-reduced-motion ou WebGL2 absent → wordmark statique + fondu.

const SHOW_MS = 2800; // durée des ondulations
const FADE_MS = 700;  // fondu de sortie

export default function SplashIntro() {
  const [phase, setPhase] = useState<"show" | "fading" | "done">("show");
  // null = évaluation en cours (SSR + 1er paint : wordmark statique).
  const [canShader, setCanShader] = useState<boolean | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Capacités + rendu du wordmark en canvas → texture du shader.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webgl = false;
    try {
      webgl = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webgl = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShader(!reduced && webgl);
    if (reduced || !webgl) return;

    let cancelled = false;
    (async () => {
      try { await document.fonts?.ready; } catch { /* police système en repli */ }
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 900;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0a0a0c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f3f4f6";
      ctx.font = "600 176px Geist, 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("FocusFlow", canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillStyle = "rgba(243,244,246,0.35)";
      ctx.font = "400 40px Geist, 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("Respire. Focus. Flow.", canvas.width / 2, canvas.height / 2 + 130);
      setImageUrl(canvas.toDataURL("image/png"));
    })();
    return () => { cancelled = true; };
  }, []);

  // Déroulé : ondulations → fondu → démontage. Clic / touche = skip.
  useEffect(() => {
    if (phase === "show") {
      const t = setTimeout(() => setPhase("fading"), SHOW_MS);
      return () => clearTimeout(t);
    }
    if (phase === "fading") {
      const t = setTimeout(() => setPhase("done"), FADE_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "show") return;
    const skip = () => setPhase("fading");
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[200] bg-[#0a0a0c] flex items-center justify-center select-none transition-opacity ease-out",
        phase === "fading" ? "opacity-0 duration-700" : "opacity-100 duration-300"
      )}
    >
      {canShader && imageUrl ? (
        <Water
          image={imageUrl}
          colorBack="#0a0a0c"
          colorHighlight="#7dd3fc"
          highlights={0.12}
          layering={0.5}
          edges={0.25}
          waves={0.55}
          caustic={0.55}
          size={1.1}
          speed={1}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        // Repli statique (reduced motion / pas de WebGL2 / texture pas prête)
        <div className="flex flex-col items-center gap-4 anim-ambient-in">
          <h1 className="text-5xl sm:text-7xl font-semibold text-white tracking-tight">FocusFlow</h1>
          <p className="text-white/35 text-sm sm:text-base">Respire. Focus. Flow.</p>
        </div>
      )}
    </div>
  );
}
