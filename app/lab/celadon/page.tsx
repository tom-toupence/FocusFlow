"use client";

import { useEffect, useRef, useState } from "react";
import { Gowun_Dodum } from "next/font/google";
import { useSimClock, clock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { CeladonScene } from "@/lib/lab/celadon";

const gowun = Gowun_Dodum({ weight: "400", subsets: ["latin"] });

export default function CeladonLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<CeladonScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    import("@/lib/lab/celadon").then(({ createCeladon }) => createCeladon(canvas.current!)).then((s) => {
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "pomodoroEnd") { scene.current?.pomodoroEnd(); scene.current?.breakMode(true); }
    if (e === "breakEnd" || e === "start") scene.current?.breakMode(false);
    if (e === "distraction") scene.current?.bump();
  }), [sim]);

  useEffect(() => { scene.current?.setLevel(sim.phase === "work" ? sim.progress : 1); }, [sim.progress, sim.phase]);

  return (
    <main className={`fixed inset-0 bg-[#e9e3d8] text-[#2f2a22] ${gowun.className}`}>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div className="absolute top-8 left-8 right-8 flex items-baseline justify-between pointer-events-none">
        <p className="text-[15px] tracking-wide">émaillure n° {sim.pomodoros + 1}</p>
        <p className="text-[64px] leading-none tabular-nums">{clock(sim.remaining)}</p>
      </div>
      <p className="absolute top-24 right-8 text-[14px] opacity-70">{sim.phase === "break" ? "le four refroidit" : "l'émail monte"}</p>
      {err && <p className="absolute inset-x-8 top-1/2 text-red-700">{err}</p>}
      <LabControls sim={sim} tone="light" name="1 céladon" />
    </main>
  );
}
