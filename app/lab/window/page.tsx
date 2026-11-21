"use client";

// LAB 4 · la fenêtre : capture TOKYO NIGHT (fournie par l utilisateur).
import { useEffect, useRef, useState } from "react";
import type { CityRenderer } from "@/lib/city/types";



export default function WindowLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const r = useRef<CityRenderer | null>(null);
  const [halt, setHalt] = useState(false);
  const [dawn, setDawn] = useState(false);
  const [min, setMin] = useState(25);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    import("@/lib/city/TokyoRenderer").then(({ createTokyoCity }) => createTokyoCity(canvas.current!, { board: "25 MIN" }))
      .then((c) => { if (dead) c.dispose(); else { r.current = c; (window as unknown as { __ready: boolean }).__ready = true; } })
      .catch((e) => setErr(String(e?.stack ?? e)));
    return () => { dead = true; r.current?.dispose(); r.current = null; };
  }, []);

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
      </div>
    </main>
  );
}
