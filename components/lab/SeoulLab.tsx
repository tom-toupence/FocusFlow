"use client";
// Banc d'essai du visuel « rue de Séoul en 2.5D », avant toute intégration.
import { useEffect, useRef, useState } from "react";
import { createSeoul, supportsSeoul, type SeoulRenderer } from "@/lib/seoul/SeoulRenderer";

export default function SeoulLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const r = useRef<SeoulRenderer | null>(null);
  const [fallback, setFallback] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");
  const [night, setNight] = useState(0);
  const [panel, setPanel] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canvas.current || !supportsSeoul()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFallback(true);
      return;
    }
    let disposed = false;
    // ?record : horloge manuelle pilotée par la capture vidéo (window.__seoul).
    const record = new URLSearchParams(window.location.search).has("record");
    createSeoul(canvas.current, { reducedMotion: reduce, manualClock: record })
      .then((x) => {
        if (disposed) { x.dispose(); return; }
        r.current = x;
        if (record) (window as unknown as { __seoul?: SeoulRenderer }).__seoul = x;
      })
      .catch((e) => { console.warn("[seoul] repli :", e); setFallback(true); });
    const move = (e: PointerEvent) => r.current?.pointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener("pointermove", move);
    return () => { disposed = true; window.removeEventListener("pointermove", move); r.current?.dispose(); r.current = null; };
  }, []);

  useEffect(() => { r.current?.setMode(mode); }, [mode]);
  useEffect(() => { r.current?.setNight(night); }, [night]);

  return (
    <main className="fixed inset-0 bg-black text-white">
      {fallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/lab/seoul/still.webp" alt="Rue commerçante sous la pluie, la nuit" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <canvas ref={canvas} className="absolute inset-0 w-full h-full block" aria-label="Rue commerçante sous la pluie, la nuit" role="img" />
      )}

      <div className="absolute top-3 left-3 z-10 text-xs">
        <button onClick={() => setPanel((v) => !v)} className="px-2 py-1 rounded bg-black/60 border border-white/15">
          {panel ? "Masquer les réglages" : "Réglages"}
        </button>
        {panel && (
          <div className="mt-2 w-64 p-3 rounded bg-black/70 backdrop-blur border border-white/10 space-y-3">
            <p className="text-white/60">Lab : rue de nuit en 2.5D (photo, profondeur, plans reconstitués).</p>
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
            <div className="flex gap-2">
              <button onClick={() => r.current?.pomodoroDone()} className="flex-1 py-1 rounded border border-white/20">Fin de pomodoro</button>
              <button onClick={() => r.current?.goal()} className="flex-1 py-1 rounded border border-white/20">Objectif</button>
            </div>
            {fallback && <p className="text-amber-300/80">Image fixe : WebGL2 matériel indisponible (ou mouvement réduit).</p>}
          </div>
        )}
      </div>
      <p className="absolute bottom-2 right-3 z-10 text-[10px] text-white/55">Photo : Nocalz (droits à vérifier avant toute mise en production)</p>
    </main>
  );
}
