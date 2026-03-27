"use client";

import { useStatsStore, getTodayStats, getWeekStats, getStreak, getLast119Days, getLast7Days, getTotalStats, getBestDay, localToday } from "@/store/statsStore";
import { usePlayHistoryStore, getTopPlays, PlayType } from "@/store/playHistoryStore";
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
  const { entries: historyEntries } = usePlayHistoryStore();

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
  const topPlays = getTopPlays(historyEntries);
  const recentPlays = historyEntries.slice(0, 10);

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

      {/* ── Top lectures ─────────────────────────────────────────────────────── */}
      {topPlays.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4">Top lectures</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {topPlays.map((play) => (
              <div key={play.mediaKey} className="flex items-center gap-3 bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl p-3 min-w-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-foreground/[0.06]">
                  {play.thumbnailUrl ? (
                    <img src={play.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PlayTypeIcon type={play.type} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate leading-tight">{play.title}</p>
                  <p className="text-[11px] text-foreground/40 truncate">{play.subtitle}</p>
                  <p className="text-[10px] text-foreground/25 mt-0.5">{formatMinutes(play.totalMinutes)} · {play.playCount}×</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Écoutes récentes ─────────────────────────────────────────────────── */}
      {recentPlays.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4">Écoutes récentes</p>
          <div className="flex flex-col gap-1.5">
            {recentPlays.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors group">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-foreground/[0.06]">
                  {entry.thumbnailUrl ? (
                    <img src={entry.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PlayTypeIcon type={entry.type} small />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{entry.title}</p>
                  <p className="text-[11px] text-foreground/35 truncate">{entry.subtitle}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-foreground/40">{formatMinutes(entry.minutes)}</p>
                  <p className="text-[10px] text-foreground/20">{formatDate(entry.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

function PlayTypeIcon({ type, small }: { type: PlayType; small?: boolean }) {
  const sz = small ? "w-3.5 h-3.5" : "w-4 h-4";
  if (type === "spotify") return (
    <svg className={cn(sz, "text-[#1db954]")} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
  if (type === "twitch-live" || type === "twitch-vod") return (
    <svg className={cn(sz, "text-[#9146ff]")} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  );
  return (
    <svg className={cn(sz, "text-red-500")} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
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
