"use client";

// Coquille commune des prototypes : barre de contrôle minimale (Lancer, Fin
// de phase, Distraction, Piste) et compteur d'images par seconde mesuré
// (window.__labFps, lu par le script de capture pour LAB.md).
import { useEffect, useState } from "react";
import type { SimClock } from "@/lib/lab/useSimClock";

export function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0, n = 0, t0 = performance.now();
    const loop = (now: number) => {
      n++;
      if (now - t0 >= 1000) {
        const v = Math.round((n * 1000) / (now - t0));
        setFps(v);
        (window as unknown as { __labFps: number }).__labFps = v;
        n = 0; t0 = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

/** Les scènes publient leurs mesures (ms CPU par image, triangles, appels). */
export function reportInfo(info: { cpuMs?: number; triangles?: number; calls?: number }) {
  const w = window as unknown as { __labInfo?: Record<string, number> };
  w.__labInfo = { ...(w.__labInfo ?? {}), ...info } as Record<string, number>;
}

export function LabControls({ sim, tone = "dark", name }: { sim: SimClock; tone?: "dark" | "light"; name: string }) {
  const fps = useFps();
  const c = tone === "dark" ? "text-white/80 border-white/25 hover:border-white/70" : "text-black/75 border-black/25 hover:border-black/70";
  return (
    <div className={`fixed bottom-3 left-3 z-50 flex flex-wrap items-center gap-2 text-[12px] font-mono ${tone === "dark" ? "text-white/70" : "text-black/70"}`} data-lab-controls>
      <span className="mr-1">{name}</span>
      <button className={`border px-2 py-1 ${c}`} onClick={sim.start}>lancer</button>
      <button className={`border px-2 py-1 ${c}`} onClick={sim.skip}>fin de phase</button>
      <button className={`border px-2 py-1 ${c}`} onClick={sim.distraction}>distraction</button>
      <button className={`border px-2 py-1 ${c}`} onClick={sim.track}>piste</button>
      <span className="ml-1 tabular-nums">{fps} i/s · {sim.phase}</span>
    </div>
  );
}
