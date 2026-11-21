"use client";

import { useEffect, useRef, useState } from "react";
import { Big_Shoulders, Atkinson_Hyperlegible_Next } from "next/font/google";
import { useSimClock, clock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { ToitsScene } from "@/lib/lab/toits";

const sign = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"] });
const text = Atkinson_Hyperlegible_Next({ subsets: ["latin"] });

export default function ToitsLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ToitsScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    import("@/lib/lab/toits").then(({ createToits }) => {
      const s = createToits(canvas.current!);
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "pomodoroEnd") scene.current?.sunUp(true);
    if (e === "breakEnd") scene.current?.sunUp(false);
    if (e === "distraction") scene.current?.wake();
  }), [sim]);
  useEffect(() => { if (sim.phase === "work") scene.current?.dawn(sim.progress); }, [sim.progress, sim.phase]);

  return (
    <main className={`fixed inset-0 bg-[#c8d2dc] text-[#1d232b] ${text.className}`}>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div className="absolute bottom-16 right-[5vw] text-right pointer-events-none">
        <p className={`${sign.className} font-extrabold uppercase leading-[0.82] text-[clamp(4rem,10vw,8.5rem)] tabular-nums tracking-[-0.01em]`}>{clock(sim.remaining)}</p>
        <p className="mt-3 text-[15px] text-[#1d232b]/80">{sim.phase === "break" ? "Pause. Le soleil passe au-dessus des tours." : "L'aube avance, les fenêtres s'éteignent une à une."}</p>
      </div>
      {err && <p className="absolute inset-x-8 top-1/2 text-red-300">{err}</p>}
      <LabControls sim={sim} tone="light" name="2·5 toits" />
    </main>
  );
}
