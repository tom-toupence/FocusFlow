"use client";

import { useStatsStore, getTodayStats, getWeekStats, getStreak, getLast119Days, localToday } from "@/store/statsStore";
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

export default function StatsSection() {
  const { days } = useStatsStore();

  // Avoid SSR/client mismatch — only render after client mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  const today = getTodayStats(days);
  const week = getWeekStats(days);
  const streak = getStreak(days);
  const calDays = getLast119Days(days);

  // Build week grid (17 weeks × 7 days)
  // Pad the start so the first day is on the correct weekday
  const firstDate = new Date(calDays[0].date);
  const firstDow = (firstDate.getDay() + 6) % 7; // 0=Mon

  const padded: ({ date: string; minutes: number } | null)[] = [
    ...Array(firstDow).fill(null),
    ...calDays,
  ];

  // Split into weeks
  const weeks: ({ date: string; minutes: number } | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // Month labels: figure out which week starts a new month
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
    <section className="border-t border-foreground/[0.06] py-8 px-6 max-w-7xl mx-auto w-full">
      <h2 className="text-sm font-semibold text-foreground/30 uppercase tracking-widest mb-6">Activité</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Aujourd'hui" value={formatMinutes(today.minutesWorked)} sub={`${today.sessions} session${today.sessions !== 1 ? "s" : ""}`} />
        <StatCard label="Cette semaine" value={formatMinutes(week.minutesWorked)} sub={`${week.sessions} sessions`} />
        <StatCard label="Série actuelle" value={`${streak} jour${streak !== 1 ? "s" : ""}`} sub={streak > 0 ? "Continue !" : "Démarre aujourd'hui"} />
        <StatCard
          label="Moy. / jour"
          value={formatMinutes(
            Object.values(days).length > 0
              ? Math.round(Object.values(days).reduce((a, d) => a + d.minutesWorked, 0) / Object.values(days).length)
              : 0
          )}
          sub="jours actifs"
        />
      </div>

      {/* Heatmap calendar */}
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
            {/* Day labels column */}
            <div className="flex flex-col gap-1 mr-1">
              {dayLabels.map((d, i) => (
                <div key={i} className="w-3 h-3 text-[9px] text-foreground/20 flex items-center justify-center">
                  {i % 2 === 0 ? d : ""}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="w-3 h-3" />;
                  }
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
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl p-4">
      <p className="text-[11px] text-foreground/30 mb-1">{label}</p>
      <p className="text-xl font-semibold text-foreground tracking-tight">{value}</p>
      <p className="text-[11px] text-foreground/40 mt-0.5">{sub}</p>
    </div>
  );
}
