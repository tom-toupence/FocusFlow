"use client";

import { useEffect, useRef, useState } from "react";
import { IBM_Plex_Sans_Condensed } from "next/font/google";
import { useSimClock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { CounterScene } from "@/lib/lab/counter";

const plex = IBM_Plex_Sans_Condensed({ subsets: ["latin"], weight: ["400", "600"] });

export default function CounterLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<CounterScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    import("@/lib/lab/counter").then(({ createCounter }) => createCounter(canvas.current!)).then((s) => {
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "pomodoroEnd") { scene.current?.pomodoroEnd(sim.pomodoros + 1); scene.current?.breakMode(true); }
    if (e === "breakEnd") scene.current?.breakMode(false);
    if (e === "distraction") scene.current?.knock();
  }), [sim]);

  const minutes = Math.ceil(sim.remaining / 60);
  useEffect(() => { if (sim.phase === "work") scene.current?.show(sim.pomodoros, minutes); }, [minutes, sim.phase, sim.pomodoros]);

  return (
    <main className={`fixed inset-0 bg-[#d9d4cb] text-[#2b2925] ${plex.className}`}>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div className="absolute bottom-24 inset-x-0 flex justify-center gap-24 text-[13px] uppercase tracking-[0.06em] pointer-events-none">
        <span>pomodoros</span><span>{sim.phase === "break" ? "pause" : "minutes"}</span>
      </div>
      {err && <p className="absolute inset-x-8 top-1/2 text-red-700">{err}</p>}
      <LabControls sim={sim} tone="light" name="6 compteur" />
    </main>
  );
}
