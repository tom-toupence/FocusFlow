"use client";

import { useRouter } from "next/navigation";
import { useTimerStore } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { useStatsStore, getTodayStats, getWeekStats, getStreak, getLast119Days } from "@/store/statsStore";
import { useSessionSummaryStore } from "@/store/sessionSummaryStore";
import { useGoalStore, getTodayProgress } from "@/store/goalStore";
import { useDistractionStore, getFocusScore } from "@/store/distractionStore";
import GoalRing from "@/components/GoalRing";
import JournalReflection from "@/components/JournalReflection";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { Button } from "@/components/ff/Button";
import { Gauge } from "@/components/ff/Gauge";
import { IconCheck, IconPlay } from "@/components/ff/icons";
import { getVideoColor } from "@/data/videos";

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

// Heatmap = profondeur d'eau : plus le jour a été travaillé, plus l'eau est profonde.
const HEAT_LEVELS = [
  "bg-surface-2",
  "bg-water/35",
  "bg-water/60",
  "bg-water/85",
  "bg-water",
];

function heatLevel(minutes: number): number {
  if (minutes === 0) return 0;
  if (minutes <= 15) return 1;
  if (minutes <= 45) return 2;
  if (minutes <= 90) return 3;
  return 4;
}

// ─── Figure de relevé ─────────────────────────────────────────────────────────
// Un chiffre posé sur un filet, sans boîte (liste noire B11), sans compteur qui
// défile (E28). La couleur sodium ne marque que ce qui a atteint son repère.

function Figure({ label, value, sub, signal }: { label: string; value: string; sub?: string; signal?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className={cn("font-mono text-[28px] leading-none tabular-nums tracking-tight", signal ? "text-sodium-text" : "text-ink")}>{value}</dd>
      {sub && <dd className="text-[12px] text-ink-3 leading-tight">{sub}</dd>}
    </div>
  );
}

const WaterScene = dynamic(() => import("@/components/WaterScene"), { ssr: false });

// ─── Summary Page ─────────────────────────────────────────────────────────────

export default function SummaryPage() {
  const router = useRouter();
  const { sessionsCompleted, settings, flowMinutesTotal, resetAll } = useTimerStore();
  const { todos } = useSessionStore();
  const { days } = useStatsStore();
  const { startedAt, focusMinutesPerSession, todoDoneIdsAtStart, clearSession } = useSessionSummaryStore();
  const { unit: goalUnit, target: goalTarget } = useGoalStore();
  const { sessionCount: distractionCount } = useDistractionStore();

  // Session-level stats
  const sessionDurationMs = startedAt ? Date.now() - startedAt : 0;
  const focusMinutesThisSession = settings.preset === "flowtime"
    ? flowMinutesTotal
    : sessionsCompleted * focusMinutesPerSession;
  const doneIdsAtStart = new Set(todoDoneIdsAtStart);
  const todosCompletedThisSession = todos.filter((t) => t.status === "done" && !doneIdsAtStart.has(t.id));
  const totalTodos = todos.length;

  // Historical stats
  const todayStats = getTodayStats(days);
  const weekStats = getWeekStats(days);
  const streak = getStreak(days);
  const heatmapData = getLast119Days(days);
  const goalProgress = getTodayProgress(days, goalUnit, goalTarget);
  const focusScore = getFocusScore(sessionsCompleted, distractionCount);

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

  const allVideos = useSessionStore.getState().getAllVideos();
  const sessionVideo = allVideos.find((v) => v.id === useSessionStore.getState().selectedVideoId);
  const reflet = sessionVideo ? getVideoColor(sessionVideo) : "#3d4a6b";
  // L'eau se pose au niveau de la session, sur une échelle où 2 h remplissent l'échelle.
  const waterLevel = Math.min(1, 0.12 + (focusMinutesThisSession / 120) * 0.8);
  const headline =
    sessionsCompleted > 0
      ? `${sessionsCompleted} pomodoro${sessionsCompleted > 1 ? "s" : ""}, ${formatMinutes(focusMinutesThisSession)} de focus.`
      : focusMinutesThisSession > 0
        ? `${formatMinutes(focusMinutesThisSession)} de focus.`
        : "Session terminée.";

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="h-14 flex items-center px-4 sm:px-8 border-b border-line">
        <Button variant="quiet" onClick={handleHome}>Accueil</Button>
        <span className="font-display text-lg text-ink mx-auto">Relevé de session</span>
        <span className="w-16" />
      </header>

      {/* L'eau se pose au niveau atteint par la session */}
      <WaterScene level={waterLevel} swell={0} reflet={reflet} poleX={0.55} className="h-44 sm:h-56" label={`Niveau de la session : ${formatMinutes(focusMinutesThisSession)}`} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-8 py-12 flex flex-col gap-14">
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-light text-[clamp(2rem,4.5vw,2.9rem)] leading-tight text-ink">{headline}</h1>
          <p className="text-ink-2 text-[15px]">
            {sessionDurationMs > 0 ? `Session ouverte pendant ${formatDuration(sessionDurationMs)}.` : "Voici le relevé de ta session."}
          </p>
        </div>

        <section aria-label="Cette session">
          <h2 className="font-display text-xl text-ink mb-5">Cette session</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-7">
            <Figure label="Durée" value={formatDuration(sessionDurationMs)} sub="temps écoulé" />
            <Figure label="Pomodoros" value={String(sessionsCompleted)} sub={`de ${focusMinutesPerSession} min`} />
            <Figure label="Focus" value={formatMinutes(focusMinutesThisSession)} sub="temps compté" />
            <Figure
              label="Tâches"
              value={`${todosCompletedThisSession.length}${totalTodos > 0 ? ` / ${totalTodos}` : ""}`}
              sub={todosCompletedThisSession.length === 0 ? "aucune cochée" : "terminées pendant la session"}
            />
            <Figure
              label="Score de focus"
              value={String(focusScore)}
              sub={focusScore >= 80 ? "surface calme" : focusScore >= 50 ? "quelques remous" : "beaucoup d'interruptions"}
              signal={focusScore >= 80 && sessionsCompleted > 0}
            />
            <Figure label="Distractions" value={String(distractionCount)} sub={distractionCount === 0 ? "aucune notée" : "notées avec D"} />
          </dl>
          {sessionsCompleted > 0 && (
            <div className="mt-8 flex items-end gap-3" aria-label={`${sessionsCompleted} pomodoros terminés`}>
              {Array.from({ length: Math.min(sessionsCompleted, 12) }).map((_, i) => (
                <Gauge
                  key={i}
                  label={`Pomodoro ${i + 1}`}
                  valueText={`${focusMinutesPerSession} minutes`}
                  value={1}
                  length={56}
                  thickness={10}
                  ticks={5}
                  majorEvery={5}
                  reflet
                />
              ))}
              {sessionsCompleted > 12 && <span className="font-mono text-[12px] text-ink-3">+{sessionsCompleted - 12}</span>}
            </div>
          )}
        </section>

        <JournalReflection pomodoros={sessionsCompleted} />

        {todosCompletedThisSession.length > 0 && (
          <section aria-label="Accomplissements">
            <h2 className="font-display text-xl text-ink mb-4">Ce qui est fait</h2>
            <ul className="flex flex-col">
              {todosCompletedThisSession.map((todo) => (
                <li key={todo.id} className="flex items-center gap-3 py-2.5 border-b border-line text-[15px] text-ink-2">
                  <IconCheck size={16} className="text-sodium-text shrink-0" />
                  {todo.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Objectif du jour" className="grid sm:grid-cols-[auto_1fr] gap-8 items-end">
          <GoalRing progress={goalProgress} size={150} />
          <div>
            <h2 className="font-display text-xl text-ink">
              {goalProgress.reached ? "L'eau a passé le trait du jour." : "Le trait du jour n'est pas encore atteint."}
            </h2>
            <p className="mt-2 text-[15px] text-ink-2 leading-relaxed">
              {goalProgress.reached
                ? "Ton objectif quotidien est tenu. Ce qui vient en plus compte quand même."
                : `Encore ${goalUnit === "minutes"
                    ? `${Math.max(0, goalTarget - goalProgress.value)} min`
                    : `${Math.max(0, goalTarget - goalProgress.value)} pomodoro${goalTarget - goalProgress.value !== 1 ? "s" : ""}`} pour l'atteindre.`}
            </p>
          </div>
        </section>

        <section aria-label="Sur la durée">
          <h2 className="font-display text-xl text-ink mb-5">Sur la durée</h2>
          <dl className="grid grid-cols-3 gap-x-8">
            <Figure label="Aujourd'hui" value={formatMinutes(todayStats.minutesWorked)} sub={`${todayStats.sessions} session${todayStats.sessions !== 1 ? "s" : ""}`} />
            <Figure label="Cette semaine" value={formatMinutes(weekStats.minutesWorked)} sub={`${weekStats.sessions} sessions`} />
            <Figure label="Série" value={`${streak} j`} sub={streak > 1 ? "consécutifs" : "reviens demain pour l'allonger"} />
          </dl>
        </section>

        <section aria-label="Dix-sept semaines" className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-ink">Dix-sept semaines</h2>
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-1 min-w-0">
              <div className="relative h-4 mb-0.5" style={{ width: `${Math.ceil(heatmapData.length / 7) * 18}px` }}>
                {monthLabels.map(({ label, col }) => (
                  <span key={`${label}-${col}`} className="absolute font-mono text-[11px] text-ink-3" style={{ left: `${col * 18}px` }}>
                    {label}
                  </span>
                ))}
              </div>
              <div
                className="grid gap-1"
                style={{ gridTemplateRows: "repeat(7, 14px)", gridTemplateColumns: `repeat(${Math.ceil(heatmapData.length / 7)}, 14px)`, gridAutoFlow: "column" }}
              >
                {heatmapData.map((d) => (
                  <div key={d.date} className={cn("w-3.5 h-3.5 rounded-[2px]", HEAT_LEVELS[heatLevel(d.minutes)])} title={`${d.date}, ${d.minutes} min`} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <span>Sec</span>
            {HEAT_LEVELS.map((cls, i) => <div key={i} className={cn("w-3 h-3 rounded-[2px]", cls)} />)}
            <span>Profond</span>
          </div>
        </section>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="signal" size="lg" onClick={handleNewSession} className="flex-1 min-w-48">
            <IconPlay size={15} />
            Nouvelle session
          </Button>
          <Button variant="line" size="lg" onClick={handleHome}>Accueil</Button>
        </div>
      </main>
    </div>
  );
}
