"use client";

import { useEffect, useRef, useState } from "react";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import { useSimClock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { QuaiScene } from "@/lib/lab/quai";

const text = Atkinson_Hyperlegible_Next({ subsets: ["latin"] });

export default function QuaiLab() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<QuaiScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    import("@/lib/lab/quai").then(({ createQuai }) => createQuai(host.current!)).then((s) => {
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "pomodoroEnd") scene.current?.arrive();
    if (e === "breakEnd") scene.current?.depart();
    if (e === "distraction") scene.current?.delay();
  }), [sim]);
  useEffect(() => { if (sim.phase === "work") scene.current?.set(sim.remaining, sim.progress); }, [sim.remaining, sim.progress, sim.phase]);

  return (
    <main className={`fixed inset-0 bg-[#0a0d11] text-[#e9f2ff] ${text.className}`}>
      <div ref={host} className="absolute inset-0" />
      <p className="absolute bottom-16 left-[5vw] max-w-sm text-[15px] text-[#e9f2ff]/80 pointer-events-none">
        {sim.phase === "break" ? "Le train est à quai. Pause dans sa lumière." : "Tu travailles jusqu'au prochain train."}
      </p>
      {err && <p className="absolute inset-x-8 top-1/2 text-red-300">{err}</p>}
      <LabControls sim={sim} tone="dark" name="2·4 quai" />
    </main>
  );
}
