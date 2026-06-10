"use client";

import { useState } from "react";
import { useJournalStore, MOODS } from "@/store/journalStore";
import { cn } from "@/lib/utils";

/** Post-session reflection: mood + what went well + blockers. Shown on the summary. */
export default function JournalReflection({ pomodoros }: { pomodoros: number }) {
  const { addEntry } = useJournalStore();
  const [mood, setMood] = useState<number | null>(null);
  const [wentWell, setWentWell] = useState("");
  const [blockers, setBlockers] = useState("");
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (mood === null) return;
    addEntry({ mood, wentWell: wentWell.trim(), blockers: blockers.trim(), pomodoros });
    setSaved(true);
  };

  if (saved) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Réflexion</h2>
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
          <span className="text-xl">{MOODS.find((m) => m.value === mood)?.emoji}</span>
          <p className="text-sm text-foreground/70">Réflexion enregistrée. À retrouver dans ton journal.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Comment s&apos;est passée cette session ?</h2>
      <div className="px-5 py-4 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.08] flex flex-col gap-4">
        {/* Mood */}
        <div className="flex items-center justify-center gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              title={m.label}
              className={cn("w-11 h-11 rounded-xl text-2xl flex items-center justify-center transition-all", mood === m.value ? "bg-foreground/15 ring-1 ring-foreground/30 scale-110" : "bg-foreground/5 hover:bg-foreground/10 opacity-70 hover:opacity-100")}
            >
              {m.emoji}
            </button>
          ))}
        </div>
        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-foreground/40 uppercase tracking-wider">✅ Ce qui a bien marché</label>
            <input value={wentWell} onChange={(e) => setWentWell(e.target.value)} placeholder="Une victoire, un focus profond…"
              className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-foreground/40 uppercase tracking-wider">⚡ Ce qui t&apos;a bloqué</label>
            <input value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Une distraction, une difficulté…"
              className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25" />
          </div>
        </div>
        <button onClick={save} disabled={mood === null} className="py-2.5 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 disabled:opacity-30 transition-all">
          Enregistrer ma réflexion
        </button>
      </div>
    </section>
  );
}
