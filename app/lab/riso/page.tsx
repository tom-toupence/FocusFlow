"use client";

import { useEffect, useRef, useState } from "react";
import { Bricolage_Grotesque } from "next/font/google";
import { useSimClock, clock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { RisoScene } from "@/lib/lab/riso";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400", "800"] });

export default function RisoLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<RisoScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    import("@/lib/lab/riso").then(({ createRiso }) => createRiso(canvas.current!)).then((s) => {
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "distraction") scene.current?.jitter();
    if (e === "pomodoroEnd") scene.current?.print();
  }), [sim]);
  useEffect(() => { scene.current?.set(sim.progress, sim.phase); }, [sim.progress, sim.phase]);

  return (
    <main className={`fixed inset-0 bg-[#f4efe4] ${bricolage.className}`}>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" data-paper-resize="true" />
      <div className="absolute top-8 left-8 pointer-events-none mix-blend-multiply">
        <p className="text-[#2f56a8] font-extrabold text-[clamp(4rem,11vw,9rem)] leading-[0.85] tracking-[-0.04em] tabular-nums">{clock(sim.remaining)}</p>
        <p className="text-[#ff4fa3] font-extrabold text-xl mt-2 translate-x-[2px]">
          {sim.phase === "break" ? "pause, l'encre sèche" : `tirage ${sim.pomodoros + 1}, courbe ${Math.min(25, Math.floor(sim.progress * 25) + 1)} sur 25`}
        </p>
      </div>
      {err && <p className="absolute inset-x-8 top-1/2 text-red-700">{err}</p>}
      <LabControls sim={sim} tone="light" name="4 riso" />
    </main>
  );
}
