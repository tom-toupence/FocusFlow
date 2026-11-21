"use client";

// LAB 3 · 2.5D photographique : vraie photo + profondeur + shader.
import { useEffect, useRef, useState } from "react";
import type { CityRenderer } from "@/lib/city/types";
import type { PhotoSceneDef } from "@/lib/city/PhotoRenderer";

const SCENES: Record<string, PhotoSceneDef> = {
  alley: {
    base: "/lab/city/alley",
    board: [[0.690, 0.081], [0.783, 0.078], [0.783, 0.262], [0.690, 0.266]],
    focus: 0.3,
    vanish: [0.5, 0.56],
    rain: 0.85,
    wet: 1,
  },
  konbini: { base: "/lab/city/konbini", focus: 0.25, vanish: [0.5, 0.8], rain: 0.9, wet: 1 },
};

export default function PhotoLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const r = useRef<CityRenderer | null>(null);
  const [scene, setScene] = useState("alley");
  const [halt, setHalt] = useState(false);
  const [dawn, setDawn] = useState(false);
  const [min, setMin] = useState(25);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const q = new URLSearchParams(location.search).get("scene");
    if (q && SCENES[q] && q !== scene) { setScene(q); return; }
    import("@/lib/city/PhotoRenderer").then(({ createPhotoCity }) => createPhotoCity(canvas.current!, SCENES[scene], { board: "25 MIN" }))
      .then((c) => { if (dead) c.dispose(); else r.current = c; })
      .catch((e) => setErr(String(e?.message ?? e)));
    return () => { dead = true; r.current?.dispose(); r.current = null; };
  }, [scene]);

  const b = "px-3 py-1.5 text-[13px] border border-white/30 hover:border-white/70 rounded-[3px]";
  return (
    <main className="fixed inset-0 bg-black text-[#e9f2ff]">
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      {err && <pre className="absolute inset-8 text-red-300 text-xs whitespace-pre-wrap">{err}</pre>}
      <div data-lab-controls className="absolute bottom-4 left-4 flex flex-wrap gap-2 bg-black/50 p-2">
        <button className={b} onClick={() => { setHalt(!halt); r.current?.setPhase(halt ? "work" : "break"); }}>{halt ? "reprise" : "fin de pomodoro"}</button>
        <button className={b} onClick={() => r.current?.flicker()}>distraction</button>
        <button className={b} onClick={() => r.current?.extend()}>playlist</button>
        <button className={b} onClick={() => r.current?.goal()}>objectif</button>
        <button className={b} onClick={() => { const m = min <= 1 ? 25 : min - 1; setMin(m); r.current?.setBoard(`${m} MIN`); }}>minute</button>
        <button className={b} onClick={() => { setDawn(!dawn); r.current?.setDawn(dawn ? 0 : 1); }}>{dawn ? "nuit" : "petit matin"}</button>
        <button className={b} onClick={() => setScene(scene === "alley" ? "konbini" : "alley")}>scène : {scene}</button>
      </div>
    </main>
  );
}
