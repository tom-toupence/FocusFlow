"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGoalStore, getTodayProgress } from "@/store/goalStore";
import { useStatsStore, getTodayStats, getStreak } from "@/store/statsStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";
import { useSessionStore } from "@/store/sessionStore";
import { useRoutineStore } from "@/store/routineStore";
import { useProjectStore, getProjectStatus } from "@/store/projectStore";
import { useJournalStore, MOODS } from "@/store/journalStore";
import { usePlanStore, blocksForDate, formatMinOfDay, weekDates } from "@/store/planStore";
import { useWrappedStore } from "@/store/wrappedStore";
import { useSprintStore, getSprintStatus } from "@/store/sprintStore";
import { launchSprintSession } from "@/lib/sprint";
import { localToday } from "@/store/statsStore";
import { applyRoutine } from "@/lib/routines";
import GoalRing from "@/components/GoalRing";
import { cn } from "@/lib/utils";

function fmtMin(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m} min`;
}

export default function TodayDashboard({ onNavigateTab }: { onNavigateTab: (tab: "catalogue" | "organisation") => void }) {
  const router = useRouter();
  const { unit, target } = useGoalStore();
  const { days } = useStatsStore();
  const { entries } = usePlayHistoryStore();
  const { todos } = useSessionStore();
  const { routines } = useRoutineStore();
  const { projects, activeProjectId } = useProjectStore();
  const { entries: journal } = useJournalStore();
  const { blocks } = usePlanStore();
  const { lastSeenWeekStart } = useWrappedStore();
  const { sprint } = useSprintStore();

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const today = getTodayStats(days);
  const streak = getStreak(days);
  const progress = getTodayProgress(days, unit, target);
  const nextTask = todos.find((t) => t.status !== "done") ?? null;
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const todayBlocks = blocksForDate(blocks, localToday()).filter((b) => !b.done);
  const recentJournal = journal[0] ?? null;

  // Peak productive hour from play history
  const byHour = Array(24).fill(0) as number[];
  for (const e of entries) byHour[new Date(e.timestamp).getHours()] += e.minutes;
  const maxHour = Math.max(...byHour);
  const peakHour = maxHour > 0 ? byHour.indexOf(maxHour) : null;
  const currentHour = new Date().getHours();

  const hour = new Date().getHours();
  const greeting = hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  // Weekly recap banner: last completed week had focus time and hasn't been viewed yet
  const lastWeek = weekDates(-1);
  const lastWeekMinutes = lastWeek.reduce((s, d) => s + (days[d]?.minutesWorked ?? 0), 0);
  const showWrappedBanner = lastWeekMinutes > 0 && lastSeenWeekStart !== lastWeek[0];

  // Let the user pick their video / ambiance first (the catalogue routes to /settings on select).
  const startSession = () => onNavigateTab("catalogue");

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">{greeting} 👋</h1>
          <p className="text-foreground/40 mt-1 text-sm capitalize">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={startSession}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all shadow-lg shadow-black/20"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Démarrer une session
        </button>
      </div>

      {/* Weekly recap banner */}
      {showWrappedBanner && (
        <button
          onClick={() => router.push("/wrapped")}
          className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-transparent border border-violet-500/25 hover:border-violet-500/50 transition-all text-left group"
        >
          <span className="text-2xl">🎉</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Ton récap de la semaine est prêt !</p>
            <p className="text-xs text-foreground/45">Temps de focus, meilleur jour, badges… et une carte à partager.</p>
          </div>
          <span className="text-xs text-violet-300 font-medium flex-shrink-0 group-hover:translate-x-0.5 transition-transform">Voir →</span>
        </button>
      )}

      {/* Top row: goal + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Goal */}
        <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.08]">
          <GoalRing progress={progress} size={88} stroke={8} />
          <div>
            <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest">Objectif du jour</p>
            <p className="text-sm text-foreground/70 mt-1 leading-snug">
              {progress.reached ? "Atteint, bravo ✦" : `Encore ${unit === "minutes" ? `${Math.max(0, target - progress.value)} min` : `${Math.max(0, target - progress.value)} pomodoro${target - progress.value !== 1 ? "s" : ""}`}`}
            </p>
          </div>
        </div>
        {/* Streak + today */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Stat label="Série" value={`${streak}j`} accent="text-orange-300" sub={streak >= 7 ? "🔥 en feu" : streak > 0 ? "continue" : "démarre"} />
          <Stat label="Focus aujourd'hui" value={fmtMin(today.minutesWorked)} accent="text-emerald-300" sub={`${today.sessions} session${today.sessions !== 1 ? "s" : ""}`} />
        </div>
      </div>

      {/* Active sprint: today's block + Go */}
      {sprint && (() => {
        const st = getSprintStatus(sprint, blocks);
        return (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-rose-500/[0.08] to-transparent border border-rose-500/20">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-0.5">
                🏃 Sprint · {st.overdue ? "deadline dépassée ⚠️" : `J-${st.daysLeft}`} · {st.blocksDone}/{st.blocksTotal} blocs
              </p>
              <p className="text-sm font-medium text-foreground truncate">{sprint.objective}</p>
              {st.todayBlock ? (
                <p className="text-xs text-foreground/45 mt-0.5">
                  Aujourd&apos;hui : {formatMinOfDay(st.todayBlock.startMin)} · {st.todayBlock.durationMin} min
                  {st.missed > 0 && <span className="text-amber-500/90"> · {st.missed} bloc{st.missed > 1 ? "s" : ""} en retard</span>}
                </p>
              ) : (
                <p className="text-xs text-foreground/45 mt-0.5">
                  {st.missed > 0 ? `${st.missed} bloc${st.missed > 1 ? "s" : ""} en retard — recalcule depuis l’onglet Organisation` : "Rien de prévu aujourd’hui — repos mérité"}
                </p>
              )}
            </div>
            {st.todayBlock && (
              <button
                onClick={() => {
                  launchSprintSession(sprint, st.todayBlock!.durationMin);
                  router.push("/session");
                }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all shadow-lg shadow-black/20 flex-shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                Go
              </button>
            )}
          </div>
        );
      })()}

      {/* Suggestion */}
      {peakHour !== null && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/[0.07] border border-violet-500/15">
          <span className="text-lg">💡</span>
          <p className="text-xs text-foreground/60 leading-snug">
            Tu es souvent le plus concentré vers <strong className="text-violet-300">{peakHour}h</strong>.
            {Math.abs(currentHour - peakHour) <= 1 ? " C'est le moment idéal — lance-toi !" : " Garde un créneau pour tes tâches importantes."}
          </p>
        </div>
      )}

      {/* Next task + planned blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="px-5 py-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
          <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">Prochaine tâche</p>
          {nextTask ? (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="flex-1 text-sm text-foreground/80 min-w-0 break-words">{nextTask.text}</span>
              <button onClick={startSession} className="text-xs text-foreground/40 hover:text-foreground transition-colors flex-shrink-0">Faire →</button>
            </div>
          ) : (
            <p className="text-sm text-foreground/30">Aucune tâche en attente. <button onClick={startSession} className="text-foreground/50 hover:text-foreground underline">Planifier</button></p>
          )}
        </div>
        <div className="px-5 py-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
          <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">Blocs planifiés aujourd&apos;hui</p>
          {todayBlocks.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {todayBlocks.slice(0, 3).map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-sm text-foreground/70">
                  <span className="text-[11px] text-foreground/40 tabular-nums w-10">{formatMinOfDay(b.startMin)}</span>
                  <span className="flex-1 truncate">{b.label || "Focus"}</span>
                  <span className="text-[10px] text-foreground/30">{b.durationMin}m</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground/30">Rien de planifié. <button onClick={() => onNavigateTab("organisation")} className="text-foreground/50 hover:text-foreground underline">Voir l&apos;organisation</button></p>
          )}
        </div>
      </div>

      {/* Routines */}
      {routines.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">Lancer une routine</p>
          <div className="flex flex-wrap gap-2">
            {routines.map((r) => (
              <button
                key={r.id}
                onClick={() => { applyRoutine(r); router.push("/settings"); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-foreground/10 text-sm text-foreground/80 transition-all"
              >
                <span className="text-base">{r.emoji}</span>
                <span className="font-medium">{r.name}</span>
                <span className="text-[10px] text-foreground/35">{r.workDuration}min</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active project */}
      {activeProject && (() => {
        const st = getProjectStatus(activeProject);
        return (
          <div className="px-5 py-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: activeProject.color }} />
                <p className="text-sm font-semibold text-foreground">{activeProject.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/40">projet actif</span>
              </div>
              <span className="text-xs text-foreground/40 tabular-nums">{activeProject.pomodorosDone}/{activeProject.pomodoroBudget} 🍅</span>
            </div>
            <div className="h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${st.pct * 100}%`, background: activeProject.color }} />
            </div>
            {st.daysLeft !== null && (
              <p className="text-[11px] text-foreground/40 mt-2">
                {st.overdue ? "⚠️ Deadline dépassée" : `${st.daysLeft}j restants · vise ${st.perDayNeeded} pomodoro${(st.perDayNeeded ?? 0) > 1 ? "s" : ""}/jour`}
                {!st.overdue && (st.onTrack ? " · sur la bonne voie ✓" : " · prends de l'avance")}
              </p>
            )}
          </div>
        );
      })()}

      {/* Recent reflection */}
      {recentJournal && (
        <div className="px-5 py-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest">Dernière réflexion</p>
            <span className="text-lg" title={MOODS.find((m) => m.value === recentJournal.mood)?.label}>
              {MOODS.find((m) => m.value === recentJournal.mood)?.emoji}
            </span>
          </div>
          {recentJournal.wentWell && <p className="text-sm text-foreground/70 leading-snug">✅ {recentJournal.wentWell}</p>}
          {recentJournal.blockers && <p className="text-sm text-foreground/50 leading-snug mt-1">⚡ {recentJournal.blockers}</p>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.08]">
      <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">{label}</span>
      <span className={cn("text-2xl font-light tabular-nums tracking-tight", accent)}>{value}</span>
      <span className="text-[11px] text-foreground/30">{sub}</span>
    </div>
  );
}
