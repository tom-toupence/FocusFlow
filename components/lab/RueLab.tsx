"use client";
// Banc d'essai du visuel « rue de nuit en projection caméra » : plusieurs
// photos libres de droits qui se relaient toutes les 15 à 20 secondes.
import { useEffect, useRef, useState } from "react";
import { createRue, supportsRue, type RueRenderer } from "@/lib/rue/RueRenderer";
import { RUE_SCENES, type RueSceneInfo } from "@/lib/rue/scenes";

type SceneInfo = RueSceneInfo;

export default function RueLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const r = useRef<RueRenderer | null>(null);
  const [scenes, setScenes] = useState<SceneInfo[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");
  const [night, setNight] = useState(0);
  const [style, setStyle] = useState<number | null>(null);
  const [panel, setPanel] = useState(true);

  // Le manifeste des scènes (produit avec scripts/rue/).
  useEffect(() => {
    let list = RUE_SCENES;
    // ?scene=<id> : commencer par cette scène.
    const params = new URLSearchParams(window.location.search);
    // ?only=a,b,c : seulement ces scènes (aperçu d'un lot de photos).
    const only = params.get("only")?.split(",").filter(Boolean);
    if (only?.length) list = list.filter((s) => only.includes(s.id));
    const at = Math.max(0, list.findIndex((s) => s.id === params.get("scene")));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScenes([...list.slice(at), ...list.slice(0, at)]);
  }, []);

  useEffect(() => {
    if (!scenes) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canvas.current || !supportsRue()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFallback(true);
      return;
    }
    // ?record : horloge manuelle pilotée par la capture vidéo (window.__rue).
    const params = new URLSearchParams(window.location.search);
    const record = params.has("record");
    const every = Number(params.get("every")) || 0;           // durée imposée (captures)
    let disposed = false;
    createRue(canvas.current, {
      scenes: scenes.map((s) => ({ base: `/rue/${s.id}`, style: s.style, frameY: s.frameY })),
      interval: every ? [every, every] : [15, 20],
      onScene: (i) => { setCurrent(i); setStyle(null); },
      reducedMotion: reduce,
      manualClock: record,
    })
      .then((x) => {
        if (disposed) { x.dispose(); return; }
        r.current = x;
        if (record) (window as unknown as { __rue?: RueRenderer }).__rue = x;
      })
      .catch((e) => { console.warn("[rue] repli :", e); setFallback(true); });
    const move = (e: PointerEvent) => r.current?.pointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener("pointermove", move);
    return () => { disposed = true; window.removeEventListener("pointermove", move); r.current?.dispose(); r.current = null; };
  }, [scenes]);

  useEffect(() => { r.current?.setMode(mode); }, [mode]);
  useEffect(() => { r.current?.setNight(night); }, [night]);
  useEffect(() => { if (style !== null) r.current?.setStyle(style); }, [style]);

  const scene = scenes?.[current];
  const shownStyle = style ?? scene?.style ?? 1;

  return (
    <main className="fixed inset-0 bg-black text-white">
      {fallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/rue/${scene?.id ?? "pont"}/still.webp`} alt="Rue de nuit sous la pluie, enseignes lumineuses" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <canvas ref={canvas} className="absolute inset-0 w-full h-full block" aria-label="Rue de nuit sous la pluie, enseignes lumineuses" role="img" />
      )}

      <div className="absolute top-3 left-3 z-10 text-xs">
        <button onClick={() => setPanel((v) => !v)} className="px-2 py-1 rounded bg-black/60 border border-white/15">
          {panel ? "Masquer les réglages" : "Réglages"}
        </button>
        {panel && (
          <div className="mt-2 w-64 p-3 rounded bg-black/70 backdrop-blur border border-white/10 space-y-3">
            <p className="text-white/60">Lab : rues de nuit en projection caméra. Une nouvelle scène toutes les 15 à 20 s.</p>
            <p className="text-white/85">{scene ? `${current + 1} / ${scenes?.length} · ${scene.label}` : "Chargement…"}</p>
            <button onClick={() => r.current?.nextScene()} className="w-full py-1 rounded border border-white/20">Scène suivante</button>
            <div className="flex gap-2">
              {(["work", "break"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`flex-1 py-1 rounded border ${mode === m ? "bg-white text-black border-white" : "border-white/20"}`}>
                  {m === "work" ? "Travail" : "Pause"}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-white/60">Avancée de la nuit : {Math.round(night * 100)} %</span>
              <input type="range" min={0} max={1} step={0.01} value={night} onChange={(e) => setNight(parseFloat(e.target.value))} className="w-full" />
            </label>
            <label className="block">
              <span className="text-white/60">Étalonnage néon : {Math.round(shownStyle * 100)} %</span>
              <input type="range" min={0} max={1} step={0.01} value={shownStyle} onChange={(e) => setStyle(parseFloat(e.target.value))} className="w-full" />
            </label>
            <div className="flex gap-2">
              <button onClick={() => r.current?.pomodoroDone()} className="flex-1 py-1 rounded border border-white/20">Fin de pomodoro</button>
              <button onClick={() => r.current?.goal()} className="flex-1 py-1 rounded border border-white/20">Objectif</button>
            </div>
            {fallback && <p className="text-amber-300/80">Image fixe : WebGL2 matériel indisponible (ou mouvement réduit).</p>}
          </div>
        )}
      </div>
      {scene && !scene.href && (
        <p className="absolute bottom-2 right-3 z-10 text-[10px] text-white/60">{scene.credit}</p>
      )}
      {scene && scene.href && (
        <a href={scene.href} target="_blank" rel="noopener noreferrer" className="absolute bottom-2 right-3 z-10 text-[10px] text-white/60 hover:text-white/90">
          {scene.credit}
        </a>
      )}
    </main>
  );
}
