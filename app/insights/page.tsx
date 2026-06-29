"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStatsStore } from "@/store/statsStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";
import { useDistractionStore, getFocusScore } from "@/store/distractionStore";
import { useAchievementsStore } from "@/store/achievementsStore";
import { useSessionStore } from "@/store/sessionStore";
import { useJournalStore, MOODS } from "@/store/journalStore";
import { getWeekDetail, totalXp, getLevelInfo } from "@/lib/progression";
import { exportStatsCsv, exportHistoryCsv, exportAllJson } from "@/lib/export";
import { cn } from "@/lib/utils";

function fmtMin(min: number): string {
  if (min <= 0) return "0";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

function localDateMinus(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function InsightsPage() {
  const router = useRouter();
  const { days } = useStatsStore();
  const { entries: history } = usePlayHistoryStore();
  const { byDate: distractionsByDate } = useDistractionStore();
  const { unlocked } = useAchievementsStore();
  const { todos } = useSessionStore();
  const { entries: journal } = useJournalStore();

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // ── Focus by hour of day ──────────────────────────────────────────────────
  const byHour = Array(24).fill(0) as number[];
  for (const e of history) byHour[new Date(e.timestamp).getHours()] += e.minutes;
  const maxHour = Math.max(...byHour, 1);
  const peakHour = byHour.indexOf(maxHour);

  // ── Focus by weekday ──────────────────────────────────────────────────────
  const byWeekday = Array(7).fill(0) as number[];
  for (const d of Object.values(days)) {
    const wd = (new Date(d.date + "T00:00:00").getDay() + 6) % 7;
    byWeekday[wd] += d.minutesWorked;
  }
  const maxWeekday = Math.max(...byWeekday, 1);

  // ── Focus Score trend (last 14 active days) ───────────────────────────────
  const trend = Array.from({ length: 14 }, (_, i) => {
    const date = localDateMinus(13 - i);
    const sessions = days[date]?.sessions ?? 0;
    const distractions = distractionsByDate[date] ?? 0;
    return { date, sessions, distractions, score: getFocusScore(sessions, distractions), active: sessions > 0 || distractions > 0 };
  });
  const activeTrend = trend.filter((t) => t.active);
  const avgScore = activeTrend.length > 0
    ? Math.round(activeTrend.reduce((a, t) => a + t.score, 0) / activeTrend.length)
    : 100;

  // ── Week-over-week comparison ─────────────────────────────────────────────
  const thisWeek = getWeekDetail(days);
  let lastWeekMin = 0, lastWeekSessions = 0;
  for (let i = 7; i < 14; i++) {
    const d = days[localDateMinus(i)];
    if (d) { lastWeekMin += d.minutesWorked; lastWeekSessions += d.sessions; }
  }
  const weekDelta = lastWeekMin > 0 ? Math.round(((thisWeek.minutes - lastWeekMin) / lastWeekMin) * 100) : null;

  // ── Estimation accuracy (from todos with both fields) ─────────────────────
  const estimated = todos.filter((t) => (t.pomodoroEstimate ?? 0) > 0 && (t.pomodorosUsed ?? 0) > 0);
  const totalEst = estimated.reduce((a, t) => a + (t.pomodoroEstimate ?? 0), 0);
  const totalUsed = estimated.reduce((a, t) => a + (t.pomodorosUsed ?? 0), 0);
  const accuracy = totalUsed > 0 ? Math.round((totalEst / totalUsed) * 100) : null;

  // ── XP & niveau (dérivés des stats + succès) ──────────────────────────────
  const xp = totalXp(days, Object.keys(unlocked).length);
  const level = getLevelInfo(xp);

  // ── Humeur ↔ focus (journal × minutes du jour) ────────────────────────────
  const moodAgg: Record<number, { sum: number; count: number }> = {};
  for (const e of journal) {
    const min = days[e.date]?.minutesWorked ?? 0;
    if (!moodAgg[e.mood]) moodAgg[e.mood] = { sum: 0, count: 0 };
    moodAgg[e.mood].sum += min;
    moodAgg[e.mood].count++;
  }
  const moodRows = MOODS.map((m) => {
    const agg = moodAgg[m.value];
    return { ...m, avg: agg ? Math.round(agg.sum / agg.count) : 0, count: agg?.count ?? 0 };
  });
  const maxMoodAvg = Math.max(...moodRows.map((r) => r.avg), 1);
  const hasMoodData = moodRows.some((r) => r.count > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center px-6 border-b border-foreground/[0.06] sticky top-0 bg-background/90 backdrop-blur-md z-10">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-foreground/40 hover:text-foreground/80 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Accueil
        </button>
        <span className="text-sm font-semibold text-foreground/80 tracking-tight mx-auto">Statistiques détaillées</span>
        <div className="w-16" />
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 flex flex-col gap-10">
        {/* Intro */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">Tes insights</h1>
          <p className="text-foreground/40 mt-1 text-sm">Comprends quand et comment tu te concentres le mieux.</p>
        </div>

        {/* XP & niveau */}
        <section className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-violet-600/15 via-fuchsia-600/[0.06] to-transparent border border-violet-500/20">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/15 text-violet-200 flex-shrink-0">
            <span className="text-xl font-bold tabular-nums">{level.level}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Niveau {level.level} · {level.title}</p>
              <span className="text-[11px] text-foreground/40 tabular-nums">{level.xpInLevel} / {level.xpForNext} XP</span>
            </div>
            <div className="h-2 mt-2 rounded-full bg-foreground/[0.08] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all" style={{ width: `${Math.round(level.progress * 100)}%` }} />
            </div>
            <p className="text-[10px] text-foreground/30 mt-1.5">{xp.toLocaleString("fr-FR")} XP cumulés · sessions, minutes, succès et série.</p>
          </div>
        </section>

        {/* Highlights */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Highlight label="Score de focus moyen" value={`${avgScore}`} sub="14 derniers jours" accent="emerald" />
          <Highlight label="Heure la plus productive" value={byHour[peakHour] > 0 ? `${peakHour}h` : "—"} sub="cumul de focus" accent="violet" />
          <Highlight
            label="Cette semaine"
            value={fmtMin(thisWeek.minutes)}
            sub={weekDelta === null ? "première semaine" : `${weekDelta >= 0 ? "+" : ""}${weekDelta}% vs S-1`}
            accent={weekDelta !== null && weekDelta < 0 ? "red" : "sky"}
          />
          <Highlight
            label="Précision d'estimation"
            value={accuracy === null ? "—" : `${accuracy}%`}
            sub={accuracy === null ? "pas assez de données" : "estimé / réel"}
            accent="amber"
          />
        </section>

        {/* Focus by hour */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Focus par heure de la journée</h2>
          <div className="flex items-end gap-0.5 h-32 bg-foreground/[0.02] rounded-xl p-3">
            {byHour.map((m, h) => (
              <div key={h} className="flex-1 flex flex-col items-center justify-end gap-1 group relative h-full">
                <div
                  title={`${h}h — ${fmtMin(m)}`}
                  className={cn("w-full rounded-sm transition-all", m > 0 ? (h === peakHour ? "bg-violet-400" : "bg-violet-500/40") : "bg-foreground/[0.05]")}
                  style={{ height: `${Math.max((m / maxHour) * 100, m > 0 ? 6 : 2)}%` }}
                />
                {h % 6 === 0 && <span className="text-[8px] text-foreground/25">{h}h</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Focus by weekday */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Focus par jour de la semaine</h2>
          <div className="flex items-end gap-2 h-28">
            {byWeekday.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex flex-col justify-end" style={{ height: "84px" }}>
                  <div
                    title={fmtMin(m)}
                    className={cn("w-full rounded-md transition-all", m > 0 ? "bg-sky-500/60" : "bg-foreground/[0.05]")}
                    style={{ height: `${Math.max((m / maxWeekday) * 100, m > 0 ? 8 : 4)}%` }}
                  />
                </div>
                <span className="text-[10px] text-foreground/30">{WEEKDAYS[i]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Focus Score trend */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Évolution du Focus Score</h2>
          {activeTrend.length === 0 ? (
            <p className="text-xs text-foreground/30 py-6 text-center">Pas encore assez de données. Marque tes distractions pendant les sessions (touche D).</p>
          ) : (
            <div className="flex items-end gap-1.5 h-28">
              {trend.map((t) => (
                <div key={t.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <div
                    title={`${t.date} — score ${t.score} (${t.distractions} distraction${t.distractions !== 1 ? "s" : ""})`}
                    className={cn(
                      "w-full rounded-sm transition-all",
                      !t.active ? "bg-foreground/[0.04]"
                        : t.score >= 80 ? "bg-emerald-400"
                        : t.score >= 50 ? "bg-amber-400" : "bg-red-400"
                    )}
                    style={{ height: `${t.active ? Math.max(t.score, 6) : 3}%` }}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-foreground/30">Le Focus Score = pomodoros / (pomodoros + distractions) × 100.</p>
        </section>

        {/* Humeur ↔ focus */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Humeur et concentration</h2>
          {!hasMoodData ? (
            <p className="text-xs text-foreground/30 py-6 text-center">Pas encore de réflexions. Note ton humeur en fin de session (résumé) pour voir le lien avec ton focus.</p>
          ) : (
            <>
              <div className="flex items-end gap-3 h-32 bg-foreground/[0.02] rounded-xl p-3">
                {moodRows.map((r) => (
                  <div key={r.value} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                    <span className="text-[10px] text-foreground/40 tabular-nums">{r.count > 0 ? fmtMin(r.avg) : ""}</span>
                    <div className="w-full flex flex-col justify-end flex-1">
                      <div
                        title={`${r.label} — ${fmtMin(r.avg)} de focus en moyenne (${r.count} jour${r.count !== 1 ? "s" : ""})`}
                        className={cn("w-full rounded-md transition-all", r.count > 0 ? "bg-fuchsia-500/50" : "bg-foreground/[0.05]")}
                        style={{ height: `${r.count > 0 ? Math.max((r.avg / maxMoodAvg) * 100, 6) : 3}%` }}
                      />
                    </div>
                    <span className="text-lg" title={r.label}>{r.emoji}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-foreground/30">Minutes de focus moyennes selon l&apos;humeur notée ce jour-là.</p>
            </>
          )}
        </section>

        {/* Export */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Exporter mes données</h2>
          <div className="flex flex-wrap gap-2">
            <ExportButton label="Stats (CSV)" onClick={() => exportStatsCsv(days)} />
            <ExportButton label="Historique (CSV)" onClick={() => exportHistoryCsv(history)} />
            <ExportButton
              label="Sauvegarde complète (JSON)"
              onClick={() => exportAllJson({ days, history, distractions: distractionsByDate, achievements: unlocked })}
            />
          </div>
          <p className="text-[10px] text-foreground/30">Tes données restent sur ton appareil — l&apos;export te permet de les garder ou de les analyser ailleurs.</p>
        </section>
      </main>
    </div>
  );
}

function Highlight({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: "emerald" | "violet" | "sky" | "amber" | "red" }) {
  const accentText = {
    emerald: "text-emerald-300", violet: "text-violet-300", sky: "text-sky-300", amber: "text-amber-300", red: "text-red-300",
  }[accent];
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.08]">
      <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest leading-tight">{label}</span>
      <span className={cn("text-2xl font-light tabular-nums tracking-tight", accentText)}>{value}</span>
      <span className="text-[11px] text-foreground/30 leading-tight">{sub}</span>
    </div>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground/70 hover:text-foreground text-xs font-medium transition-all"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
