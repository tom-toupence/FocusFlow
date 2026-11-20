"use client";

import { useEffect, useRef, useState } from "react";
import { Archivo_Black } from "next/font/google";
import { useSimClock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { BlocksScene } from "@/lib/lab/blocks";

const archivo = Archivo_Black({ weight: "400", subsets: ["latin"] });

export default function BlocksLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<BlocksScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    import("@/lib/lab/blocks").then(({ createBlocks }) => createBlocks(canvas.current!)).then((s) => {
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "pomodoroEnd") scene.current?.collapse();
    if (e === "breakEnd") scene.current?.reset(25);
    if (e === "distraction") scene.current?.shake();
  }), [sim]);

  const minutes = Math.ceil(sim.remaining / 60);
  useEffect(() => { if (sim.phase === "work") scene.current?.setMinutes(minutes); }, [minutes, sim.phase]);

  return (
    <main className="fixed inset-0 bg-[#efe8da] text-[#1b1b1b]">
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div className={`absolute top-6 left-6 ${archivo.className} text-[13px] uppercase tracking-[0.02em] leading-tight pointer-events-none`}>
        <p>{sim.phase === "break" ? "Pause : le tas reste" : "Minutes restantes"}</p>
        <p className="text-[#2440c8]">Pomodoro {sim.pomodoros + 1}</p>
      </div>
      {err && <p className="absolute inset-x-8 top-1/2 text-red-700">{err}</p>}
      <LabControls sim={sim} tone="light" name="2 chiffres" />
    </main>
  );
}
