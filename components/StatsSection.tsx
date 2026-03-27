"use client";

import { useStatsStore, getTodayStats, getWeekStats, getStreak, getLast119Days, getLast7Days, getTotalStats, getBestDay, localToday } from "@/store/statsStore";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function formatMinutes(min: number): string {
  if (min === 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getIntensity(minutes: number): number {
  if (minutes === 0) return 0;
  if (minutes <= 15) return 1;
  if (minutes <= 45) return 2;
  if (minutes <= 90) return 3;
  return 4;
}

const intensityClasses = [
  "bg-foreground/5",
  "bg-emerald-900/60",
  "bg-emerald-700/70",
  "bg-emerald-500/80",
  "bg-emerald-400",
];

const dayLabels = ["L", "M", "M", "J", "V", "S", "D"];
const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function StatsSection({ embedded }: { embedded?: boolean }) {
  const { days } = useStatsStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const today = getTodayStats(days);
  const week = getWeekStats(days);
  const streak = getStreak(days);
  const total = getTotalStats(days);
  const bestDay = getBestDay(days);
  const last7 = getLast7Days(days);
  const calDays = getLast119Days(days);

  const maxMinutes7 = Math.max(...last7.map((d) => d.minutes), 1);

  // Build week grid (17 weeks × 7 days)
  const firstDate = new Date(calDays[0].date);
  const firstDow = (firstDate.getDay() + 6) % 7;

  const padded: ({ date: string; minutes: number } | null)[] = [
    ...Array(firstDow).fill(null),
    ...calDays,
  ];

  const weeks: ({ date: string; minutes: number } | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  const monthLabels: { weekIndex: number; label: string }[] = [];
  weeks.forEach((week, wi) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;
    const d = new Date(firstDay.date);
    if (d.getDate() <= 7) {
      monthLabels.push({ weekIndex: wi, label: monthNames[d.getMonth()] });
    }
  });

  return (
    <section className={cn(embedded ? "pb-8" : "border-t border-foreground/[0.06] py-8 px-6 max-w-7xl mx-auto w-full")}>
      {!embedded && <h2 className="text-sm font-semibold text-foreground/30 uppercase tracking-widest mb-6">Activité</h2>}

      {/* ── Aujourd'hui & semaine ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Aujourd'hui"
          value={formatMinutes(today.minutesWorked)}
          sub={`${today.sessions} session${today.sessions !== 1 ? "s" : ""}`}
          accent="emerald"
        />
        <StatCard
          label="Cette semaine"
          value={formatMinutes(week.minutesWorked)}
          sub={`${week.sessions} sessions`}
          accent="sky"
        />
        <StatCard
          label="Série en cours"
          value={`${streak} jour${streak !== 1 ? "s" : ""}`}
          sub={streak >= 7 ? "🔥 En feu !" : streak > 0 ? "Continue !" : "Démarre aujourd'hui"}
          accent="orange"
        />
        <StatCard
          label="Meilleur jour"
          value={bestDay ? formatMinutes(bestDay.minutesWorked) : "—"}
          sub={bestDay ? formatDate(bestDay.date) : "Aucune session"}
          accent="violet"
        />
      </div>

      {/* ── All-time ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-foreground/30">Temps total</p>
            <p className="text-lg font-semibold text-foreground tracking-tight">{formatMinutes(total.minutesWorked)}</p>
          </div>
        </div>
        <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2v20M2 12h20" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-foreground/30">Sessions totales</p>
            <p className="text-lg font-semibold text-foreground tracking-tight">{total.sessions}</p>
          </div>
        </div>
        <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
              <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-foreground/30">Jours actifs</p>
            <p className="text-lg font-semibold text-foreground tracking-tight">{total.activeDays}</p>
          </div>
        </div>
      </div>

      {/* ── 7 derniers jours ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4">7 derniers jours</p>
        <div className="flex items-end gap-2 h-24">
          {last7.map((day) => {
            const pct = maxMinutes7 > 0 ? day.minutes / maxMinutes7 : 0;
            const isToday = day.date === localToday();
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex flex-col justify-end" style={{ height: "72px" }}>
                  <div
                    title={day.minutes > 0 ? formatMinutes(day.minutes) : "Aucune session"}
                    className={cn(
                      "w-full rounded-md transition-all",
                      day.minutes > 0
                        ? isToday ? "bg-emerald-400" : "bg-emerald-600/70"
                        : "bg-foreground/[0.05]"
                    )}
                    style={{ height: `${Math.max(pct * 100, day.minutes > 0 ? 8 : 4)}%` }}
                  />
                </div>
                <span className={cn("text-[10px]", isToday ? "text-foreground/70 font-semibold" : "text-foreground/25")}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-end gap-2 mt-1">
          {last7.map((day) => (
            <div key={day.date} className="flex-1 text-center">
              {day.minutes > 0 && (
                <span className="text-[9px] text-foreground/25">{formatMinutes(day.minutes)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Heatmap calendar ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4">Calendrier</p>
        <div className="overflow-x-auto pb-2">
          <div className="inline-flex flex-col gap-1 min-w-max">
            {/* Month labels */}
            <div className="flex gap-1 ml-6">
              {weeks.map((_, wi) => {
                const label = monthLabels.find((m) => m.weekIndex === wi);
                return (
                  <div key={wi} className="w-3 text-[9px] text-foreground/25 text-center">
                    {label ? label.label : ""}
                  </div>
                );
              })}
            </div>

            {/* Day rows */}
            <div className="flex gap-1">
              <div className="flex flex-col gap-1 mr-1">
                {dayLabels.map((d, i) => (
                  <div key={i} className="w-3 h-3 text-[9px] text-foreground/20 flex items-center justify-center">
                    {i % 2 === 0 ? d : ""}
                  </div>
                ))}
              </div>

              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day, di) => {
                    if (!day) return <div key={di} className="w-3 h-3" />;
                    const intensity = getIntensity(day.minutes);
                    const isToday = day.date === localToday();
                    return (
                      <div
                        key={di}
                        title={`${day.date}: ${formatMinutes(day.minutes)}`}
                        className={cn(
                          "w-3 h-3 rounded-sm transition-colors",
                          intensityClasses[intensity],
                          isToday && "ring-1 ring-foreground/40"
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-1.5 mt-1 ml-6">
              <span className="text-[9px] text-foreground/25 mr-0.5">Moins</span>
              {intensityClasses.map((cls, i) => (
                <div key={i} className={cn("w-3 h-3 rounded-sm", cls)} />
              ))}
              <span className="text-[9px] text-foreground/25 ml-0.5">Plus</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: "emerald" | "sky" | "orange" | "violet" }) {
  const accentClasses = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    sky: "bg-sky-500/10 border-sky-500/20 text-sky-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  };
  return (
    <div className={cn("border rounded-xl p-4", accentClasses[accent])}>
      <p className="text-[11px] opacity-70 mb-1">{label}</p>
      <p className="text-xl font-semibold text-foreground tracking-tight">{value}</p>
      <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}
