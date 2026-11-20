"use client";

import { useEffect, useRef, useState } from "react";
import { Big_Shoulders, Atkinson_Hyperlegible_Next } from "next/font/google";
import { useSimClock, clock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { KonbiniScene } from "@/lib/lab/konbini";

const sign = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"] });
const text = Atkinson_Hyperlegible_Next({ subsets: ["latin"] });

export default function KonbiniLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<KonbiniScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    import("@/lib/lab/konbini").then(({ createKonbini }) => createKonbini(canvas.current!)).then((s) => {
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "pomodoroEnd") scene.current?.enter(true);
    if (e === "breakEnd") scene.current?.enter(false);
    if (e === "distraction") scene.current?.passerby();
  }), [sim]);
  useEffect(() => { if (sim.phase === "work") scene.current?.progress(sim.progress); }, [sim.progress, sim.phase]);

  return (
    <main className={`fixed inset-0 bg-[#0b1119] text-[#e9f2ff] ${text.className}`}>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div className="absolute top-10 left-[5vw] pointer-events-none">
        <p className={`${sign.className} font-extrabold uppercase leading-[0.82] text-[clamp(4rem,10vw,8.5rem)] tabular-nums tracking-[-0.01em]`}>{clock(sim.remaining)}</p>
        <p className="mt-3 text-[15px] text-[#e9f2ff]/80">{sim.phase === "break" ? "Pause. Tu es entré dans la lumière." : "La rue s'éteint peu à peu. Le magasin, jamais."}</p>
      </div>
      {err && <p className="absolute inset-x-8 top-1/2 text-red-300">{err}</p>}
      <LabControls sim={sim} tone="dark" name="2·2 supérette" />
    </main>
  );
}
