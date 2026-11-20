"use client";

import { useEffect, useRef, useState } from "react";
import { Instrument_Sans } from "next/font/google";
import { useSimClock, clock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { MaquetteScene } from "@/lib/lab/maquette";

const inst = Instrument_Sans({ subsets: ["latin"], weight: ["400", "600"] });

export default function MaquetteLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<MaquetteScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    import("@/lib/lab/maquette").then(({ createMaquette }) => {
      const s = createMaquette(canvas.current!);
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "pomodoroEnd") scene.current?.dusk(true);
    if (e === "breakEnd") scene.current?.dusk(false);
    if (e === "distraction") scene.current?.blink();
  }), [sim]);
  useEffect(() => { scene.current?.setProgress(sim.phase === "work" ? (sim.pomodoros + sim.progress) / 4 : (sim.pomodoros) / 4); }, [sim.progress, sim.phase, sim.pomodoros]);

  return (
    <main className={`fixed inset-0 bg-[#141a24] ${inst.className}`}>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div className="absolute top-6 right-6 text-right pointer-events-none">
        <p className={`text-[44px] font-semibold tabular-nums leading-none ${sim.phase === "break" ? "text-white" : "text-white"}`}>{clock(sim.remaining)}</p>
        <p className={`mt-2 text-[14px] ${sim.phase === "break" ? "text-white/80" : "text-white/75"}`}>
          {sim.phase === "break" ? "le quartier passe au soir" : `${Math.floor((sim.pomodoros * 25 + sim.progress * 25))} fenêtres allumées aujourd'hui`}
        </p>
      </div>
      {err && <p className="absolute inset-x-8 top-1/2 text-red-700">{err}</p>}
      <LabControls sim={sim} tone="dark" name="2·6 maquette de nuit" />
    </main>
  );
}
