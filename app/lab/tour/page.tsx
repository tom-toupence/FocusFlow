"use client";

import { useEffect, useRef, useState } from "react";
import { Big_Shoulders, Atkinson_Hyperlegible_Next } from "next/font/google";
import { useSimClock, clock } from "@/lib/lab/useSimClock";
import { LabControls } from "@/lib/lab/LabShell";
import type { TourScene } from "@/lib/lab/tour";
import { defaultVideos } from "@/data/videos";
import { cleanTitle } from "@/lib/text";

const sign = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"] });
const text = Atkinson_Hyperlegible_Next({ subsets: ["latin"] });
const ITEMS = defaultVideos.slice(0, 24);
const FRIENDS = [3, 10, 17];

export default function TourLab() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const scene = useRef<TourScene | null>(null);
  const sim = useSimClock(60);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const items = [...wrap.current!.querySelectorAll<HTMLElement>("[data-window]")];
    import("@/lib/lab/tour").then(({ createTour }) => createTour(canvasWrap.current!, items, FRIENDS)).then((s) => {
      if (disposed) s.dispose(); else scene.current = s;
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { disposed = true; scene.current?.dispose(); };
  }, []);

  useEffect(() => sim.on((e) => {
    if (e === "pomodoroEnd") scene.current?.halt(true);
    if (e === "distraction") scene.current?.flicker();
  }), [sim]);
  const lit = Math.floor((sim.pomodoros * 25 + (sim.phase === "work" ? sim.progress * 25 : 0)) * 0.8);
  useEffect(() => { if (sim.phase === "work") scene.current?.setLit(lit); }, [lit, sim.phase]);

  return (
    <main className={`min-h-screen bg-[#14171b] text-[#e9f2ff] ${text.className}`}>
      <div ref={canvasWrap} className="fixed inset-0 pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-28">
        <div className="flex items-end justify-between gap-8 mb-8">
          <div>
            <h1 className={`${sign.className} font-extrabold uppercase text-5xl leading-none`}>Choisis ta fenêtre</h1>
            <p className="mt-2 text-[15px] text-[#e9f2ff]/75">Survole une fenêtre pour lever le store. Les vertes : des amis en focus en ce moment.</p>
          </div>
          <p className={`${sign.className} font-extrabold text-6xl tabular-nums leading-none`}>{clock(sim.remaining)}</p>
        </div>
        <div ref={wrap} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-6">
          {ITEMS.map((v, i) => (
            <a key={v.id} href="#" data-window tabIndex={0} className="block group focus-visible:outline-2 focus-visible:outline-[#ff9a3c]">
              <span className="block aspect-[3/4] relative bg-[#0c0e11]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i % 2 ? "/city/tokyo/still-dawn.jpg" : "/city/tokyo/still.jpg"} alt="" data-texture-name="windowTexture" className="absolute inset-0 w-full h-full object-cover opacity-0" crossOrigin="anonymous" />
              </span>
              <span className="block mt-2 text-[13px] leading-snug text-[#e9f2ff]/85 line-clamp-2">{cleanTitle(v.title)}</span>
            </a>
          ))}
        </div>
      </div>
      {err && <p className="fixed inset-x-8 top-1/2 text-red-300">{err}</p>}
      <LabControls sim={sim} tone="dark" name="2·3 tour" />
    </main>
  );
}
