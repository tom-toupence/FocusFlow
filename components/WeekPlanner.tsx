"use client";

import { useState } from "react";
import { usePlanStore, weekDates, blocksForDate, plannedMinutes, formatMinOfDay } from "@/store/planStore";
import { useStatsStore } from "@/store/statsStore";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function fmt(min: number): string {
  if (min <= 0) return "0";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m : ""}` : `${m}m`;
}

export default function WeekPlanner() {
  const { blocks, addBlock, removeBlock, toggleDone } = usePlanStore();
  const { days: stats } = useStatsStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [start, setStart] = useState("09:00");
  const [duration, setDuration] = useState(50);
  const [label, setLabel] = useState("");

  const dates = weekDates(weekOffset);
  const todayStr = weekDates(0)[(new Date().getDay() + 6) % 7];

  const submit = (date: string) => {
    const [h, m] = start.split(":").map(Number);
    addBlock({ date, startMin: (h || 0) * 60 + (m || 0), durationMin: Math.max(5, duration), label: label.trim() });
    setLabel(""); setAddingDate(null);
  };

  const weekLabel = weekOffset === 0 ? "Cette semaine" : weekOffset === 1 ? "Semaine prochaine" : weekOffset === -1 ? "Semaine dernière" : `${dates[0]} → ${dates[6]}`;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Planning de la semaine</h2>
          <p className="text-xs text-foreground/40 mt-0.5">Pose tes blocs de focus, compare prévu vs réalisé.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="w-7 h-7 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/60 flex items-center justify-center">‹</button>
          <span className="text-xs text-foreground/50 w-32 text-center">{weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="w-7 h-7 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/60 flex items-center justify-center">›</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {dates.map((date, i) => {
          const dayBlocks = blocksForDate(blocks, date);
          const planned = plannedMinutes(blocks, date);
          const realized = stats[date]?.minutesWorked ?? 0;
          const isToday = date === todayStr;
          const dayNum = new Date(date + "T00:00:00").getDate();
          return (
            <div key={date} className={cn("rounded-xl border p-2 flex flex-col gap-2 min-h-[120px]", isToday ? "border-foreground/25 bg-foreground/[0.04]" : "border-foreground/[0.06] bg-foreground/[0.02]")}>
              <div className="flex items-center justify-between">
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isToday ? "text-foreground/70" : "text-foreground/35")}>{DAY_LABELS[i]} {dayNum}</span>
                <button onClick={() => { setAddingDate(addingDate === date ? null : date); }} className="w-4 h-4 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground/50 flex items-center justify-center text-xs">+</button>
              </div>

              {addingDate === date && (
                <div className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-foreground/[0.04]">
                  <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" className="bg-foreground/5 border border-foreground/10 rounded px-1.5 py-1 text-[11px] text-foreground placeholder:text-foreground/25 focus:outline-none" />
                  <div className="flex gap-1">
                    <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="bg-foreground/5 border border-foreground/10 rounded px-1 py-1 text-[10px] text-foreground flex-1 focus:outline-none" />
                    <input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 50)} className="bg-foreground/5 border border-foreground/10 rounded px-1 py-1 text-[10px] text-foreground w-12 focus:outline-none" title="minutes" />
                  </div>
                  <button onClick={() => submit(date)} className="text-[10px] py-1 rounded bg-foreground text-background font-medium">Ajouter</button>
                </div>
              )}

              <div className="flex flex-col gap-1 flex-1">
                {dayBlocks.map((b) => (
                  <div key={b.id} className={cn("group flex items-center gap-1 px-1.5 py-1 rounded text-[11px]", b.done ? "bg-emerald-500/10" : "bg-foreground/[0.05]")}>
                    <button onClick={() => toggleDone(b.id)} className={cn("w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center", b.done ? "bg-emerald-500 border-emerald-500" : "border-foreground/25")}>
                      {b.done && <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4}><path d="M5 13l4 4L19 7" strokeLinecap="round" /></svg>}
                    </button>
                    <span className="text-foreground/40 tabular-nums">{formatMinOfDay(b.startMin)}</span>
                    <span className={cn("flex-1 truncate", b.done ? "text-foreground/40 line-through" : "text-foreground/75")}>{b.label || "Focus"}</span>
                    <button onClick={() => removeBlock(b.id)} className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-400 flex-shrink-0">×</button>
                  </div>
                ))}
              </div>

              {(planned > 0 || realized > 0) && (
                <div className="text-[9px] text-foreground/35 border-t border-foreground/[0.06] pt-1">
                  Prévu {fmt(planned)} · Fait <span className={cn(realized >= planned && planned > 0 ? "text-emerald-400" : "text-foreground/50")}>{fmt(realized)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
