"use client";

import { useEffect, useRef, useState } from "react";
import { useSimClock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { PressScene } from "@/lib/lab/press";

export default function PressLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<PressScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const c = canvas.current!;
    c.width = c.clientWidth; c.height = c.clientHeight;
    import("@/lib/lab/press").then(({ createPress }) => createPress(c)).then((s) => {
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => { if (e === "distraction") scene.current?.misprint(); }), [sim]);
  useEffect(() => { scene.current?.set(sim.progress, sim.remaining, sim.phase); }, [sim.progress, sim.remaining, sim.phase]);

  return (
    <main className="fixed inset-0 bg-[#ebe5d6]">
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      {err && <p className="absolute inset-x-8 top-1/2 text-red-700 font-mono">{err}</p>}
      <LabControls sim={sim} tone="light" name="3 presse" />
    </main>
  );
}
