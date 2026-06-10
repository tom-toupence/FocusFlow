"use client";

import { useState, useEffect } from "react";
import { useJournalStore, MOODS, moodByDate } from "@/store/journalStore";
import { useStatsStore } from "@/store/statsStore";
import { cn } from "@/lib/utils";

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export default function JournalTimeline() {
  const { entries, removeEntry } = useJournalStore();
  const { days } = useStatsStore();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Mood ↔ productivity correlation over the last days that have a reflection.
  const moods = moodByDate(entries);
  const correlationDays = Object.keys(moods).sort().slice(-10).map((date) => ({
    date,
    mood: moods[date],
    minutes: days[date]?.minutesWorked ?? 0,
  }));
  const maxMin = Math.max(...correlationDays.map((d) => d.minutes), 1);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Journal & humeur</h2>
        <p className="text-xs text-foreground/40 mt-0.5">Tes réflexions de fin de session et le lien humeur ↔ focus.</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-foreground/25 text-center py-8">Aucune réflexion. Termine une session pour en ajouter une.</p>
      ) : (
        <>
          {/* Mood vs focus */}
          {correlationDays.length > 1 && (
            <div className="mb-5 p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
              <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest mb-3">Humeur vs focus</p>
              <div className="flex items-end gap-2 h-20">
                {correlationDays.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${fmtDate(d.date)} — ${Math.round(d.minutes)} min`}>
                    <span className="text-sm">{MOODS.find((m) => m.value === Math.round(d.mood))?.emoji}</span>
                    <div className="w-full flex flex-col justify-end" style={{ height: "44px" }}>
                      <div className="w-full rounded-sm bg-emerald-500/50" style={{ height: `${Math.max((d.minutes / maxMin) * 100, d.minutes > 0 ? 8 : 3)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entries */}
          <div className="flex flex-col gap-2">
            {entries.slice(0, 30).map((e) => (
              <div key={e.id} className="group flex items-start gap-3 px-4 py-3 rounded-xl bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors">
                <span className="text-xl flex-shrink-0" title={MOODS.find((m) => m.value === e.mood)?.label}>{MOODS.find((m) => m.value === e.mood)?.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-foreground/40">{fmtDate(e.date)}</span>
                    {e.pomodoros ? <span className="text-[10px] text-foreground/30">· {e.pomodoros} 🍅</span> : null}
                  </div>
                  {e.wentWell && <p className="text-sm text-foreground/70 leading-snug mt-0.5">✅ {e.wentWell}</p>}
                  {e.blockers && <p className="text-sm text-foreground/50 leading-snug">⚡ {e.blockers}</p>}
                  {!e.wentWell && !e.blockers && <p className="text-xs text-foreground/30 italic mt-0.5">Pas de note</p>}
                </div>
                <button onClick={() => removeEntry(e.id)} className={cn("opacity-0 group-hover:opacity-100 text-foreground/20 hover:text-red-400 transition-all flex-shrink-0")}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
