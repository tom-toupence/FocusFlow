"use client";

import { useRouter } from "next/navigation";
import { useTimerStore } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { useStatsStore, getTodayStats, getWeekStats, getStreak, getLast119Days } from "@/store/statsStore";
import { useSessionSummaryStore } from "@/store/sessionSummaryStore";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms <= 0) return "0 min";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
  if (m > 0) return `${m} min`;
  return `${totalSecs}s`;
}

function formatMinutes(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
  return `${m} min`;
}

const HEAT_LEVELS = [
  "bg-foreground/5",
  "bg-emerald-900/60",
  "bg-emerald-700/60",
  "bg-emerald-500/70",
  "bg-emerald-400",
];

function heatLevel(minutes: number): number {
  if (minutes === 0) return 0;
  if (minutes <= 15) return 1;
  if (minutes <= 45) return 2;
  if (minutes <= 90) return 3;
  return 4;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.08]">
      <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">{label}</span>
      <span className={cn("text-3xl font-light tabular-nums tracking-tight", accent ?? "text-foreground")}>{value}</span>
      {sub && <span className="text-[11px] text-foreground/30 leading-tight">{sub}</span>}
    </div>
  );
}

// ─── Summary Page ─────────────────────────────────────────────────────────────

export default function SummaryPage() {
  const router = useRouter();
  const { sessionsCompleted, settings, resetAll } = useTimerStore();
  const { todos } = useSessionStore();
  const { days } = useStatsStore();
  const { startedAt, focusMinutesPerSession, todoDoneIdsAtStart, clearSession } = useSessionSummaryStore();

  // Session-level stats
  const sessionDurationMs = startedAt ? Date.now() - startedAt : 0;
  const focusMinutesThisSession = sessionsCompleted * focusMinutesPerSession;
  const doneIdsAtStart = new Set(todoDoneIdsAtStart);
  const todosCompletedThisSession = todos.filter((t) => t.status === "done" && !doneIdsAtStart.has(t.id));
  const totalTodos = todos.length;

  // Historical stats
  const todayStats = getTodayStats(days);
  const weekStats = getWeekStats(days);
  const streak = getStreak(days);
  const heatmapData = getLast119Days(days);

  // Month labels for heatmap
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  heatmapData.forEach((d, i) => {
    const col = Math.floor(i / 7);
    const month = new Date(d.date).getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ label: new Date(d.date).toLocaleString("fr", { month: "short" }), col });
      lastMonth = month;
    }
  });

  const handleNewSession = () => {
    clearSession();
    resetAll();
    router.push("/settings");
  };

  const handleHome = () => {
    clearSession();
    resetAll();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center px-6 border-b border-foreground/[0.06]">
        <button
          onClick={handleHome}
          className="flex items-center gap-1.5 text-sm text-foreground/40 hover:text-foreground/80 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Accueil
        </button>
        <span className="text-sm font-semibold text-foreground/80 tracking-tight mx-auto">Résumé de session</span>
        <div className="w-16" />
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-10">

        {/* Hero */}
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold text-foreground tracking-tight">
            {sessionsCompleted > 0 ? "Belle session." : "Session terminée."}
          </h1>
          <p className="text-foreground/40 text-sm">
            {sessionDurationMs > 0
              ? `Tu as travaillé pendant ${formatDuration(sessionDurationMs)}.`
              : "Voici un résumé de ta session."}
          </p>
        </div>

        {/* ── Session stats ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Cette session</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Durée totale"
              value={formatDuration(sessionDurationMs)}
              sub="temps écoulé"
            />
            <StatCard
              label="Pomodoros"
              value={String(sessionsCompleted)}
              sub={`× ${focusMinutesPerSession} min`}
              accent="text-orange-300"
            />
            <StatCard
              label="Temps de focus"
              value={formatMinutes(focusMinutesThisSession)}
              sub="concentration pure"
              accent="text-emerald-300"
            />
            <StatCard
              label="Tâches faites"
              value={`${todosCompletedThisSession.length}${totalTodos > 0 ? ` / ${totalTodos}` : ""}`}
              sub={todosCompletedThisSession.length === 0 ? "aucune cochée" : "cette session"}
              accent={todosCompletedThisSession.length > 0 ? "text-sky-300" : "text-foreground"}
            />
          </div>
        </section>

        {/* Pomodoro dots */}
        {sessionsCompleted > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Pomodoros complétés</h2>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: sessionsCompleted }).map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center"
                  title={`Session ${i + 1} — ${focusMinutesPerSession} min`}
                >
                  <svg className="w-3.5 h-3.5 text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Todos completed this session */}
        {todosCompletedThisSession.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">
              Accomplissements de la session
            </h2>
            <div className="flex flex-col gap-1.5">
              {todosCompletedThisSession.map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2 h-2 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground/70">{todo.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Historical stats ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Stats globales</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Aujourd'hui"
              value={String(todayStats.sessions)}
              sub={`${formatMinutes(todayStats.minutesWorked)} de focus`}
              accent="text-violet-300"
            />
            <StatCard
              label="Cette semaine"
              value={String(weekStats.sessions)}
              sub={`${formatMinutes(weekStats.minutesWorked)} au total`}
              accent="text-blue-300"
            />
            <StatCard
              label="Streak"
              value={`${streak} jour${streak !== 1 ? "s" : ""}`}
              sub={streak > 1 ? "consécutifs" : "continue demain !"}
              accent={streak >= 3 ? "text-orange-300" : "text-foreground"}
            />
          </div>
        </section>

        {/* ── Heatmap ───────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">Activité — 17 semaines</h2>
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-1 min-w-0">
              {/* Month labels */}
              <div className="relative h-4 mb-0.5" style={{ width: `${Math.ceil(heatmapData.length / 7) * 18}px` }}>
                {monthLabels.map(({ label, col }) => (
                  <span
                    key={`${label}-${col}`}
                    className="absolute text-[10px] text-foreground/25"
                    style={{ left: `${col * 18}px` }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              {/* Grid: 7 rows × N cols */}
              <div
                className="grid gap-1"
                style={{
                  gridTemplateRows: "repeat(7, 14px)",
                  gridTemplateColumns: `repeat(${Math.ceil(heatmapData.length / 7)}, 14px)`,
                  gridAutoFlow: "column",
                }}
              >
                {heatmapData.map((d) => (
                  <div
                    key={d.date}
                    className={cn("w-3.5 h-3.5 rounded-sm transition-colors", HEAT_LEVELS[heatLevel(d.minutes)])}
                    title={`${d.date} — ${d.minutes} min`}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 text-[10px] text-foreground/25">
            <span>Moins</span>
            {HEAT_LEVELS.map((cls, i) => (
              <div key={i} className={cn("w-3 h-3 rounded-sm", cls)} />
            ))}
            <span>Plus</span>
          </div>
        </section>

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleNewSession}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 transition-all shadow-lg shadow-black/30"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Nouvelle session
          </button>
          <button
            onClick={handleHome}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground/70 font-medium text-sm rounded-xl transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Accueil
          </button>
        </div>
      </main>
    </div>
  );
}
