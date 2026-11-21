"use client";

// LAB 3 · piste C : 3D temps réel, assets Poly Haven.
import { useEffect, useRef, useState } from "react";
import type { Alley3D } from "@/lib/lab/alley3d";

export default function Alley3DLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const s = useRef<Alley3D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [halt, setHalt] = useState(false);
  useEffect(() => {
    let dead = false;
    import("@/lib/lab/alley3d").then(({ createAlley3D }) => createAlley3D(canvas.current!))
      .then((x) => { if (dead) x.dispose(); else { s.current = x; (window as unknown as { __ready: boolean }).__ready = true; } })
      .catch((e) => setErr(String(e?.stack ?? e)));
    return () => { dead = true; s.current?.dispose(); };
  }, []);
  return (
    <main className="fixed inset-0 bg-black text-white">
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      {err && <pre className="absolute inset-8 text-red-300 text-xs whitespace-pre-wrap">{err}</pre>}
      <div data-lab-controls className="absolute bottom-4 left-4 flex gap-2">
        <button className="px-3 py-1.5 text-[13px] border border-white/30" onClick={() => { setHalt(!halt); s.current?.halt(!halt); }}>{halt ? "reprise" : "fin de pomodoro"}</button>
      </div>
    </main>
  );
}
