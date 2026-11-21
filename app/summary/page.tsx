"use client";

import { useEffect, useRef } from "react";
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
import type { CityHandle } from "@/components/CityScene";
import { Button } from "@/components/ff/Button";
import { Gauge } from "@/components/ff/Gauge";
import { IconCheck, IconPlay } from "@/components/ff/icons";

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
  "bg-konbini/30",
  "bg-konbini/55",
  "bg-konbini/80",
  "bg-konbini",
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

// Emplacement réservé à la hauteur du bandeau : pas de saut de mise en page.
const CityScene = dynamic(() => import("@/components/CityScene"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-44 sm:h-60 bg-[#0b1016]" />,
});

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
    // Un mois entamé en fin de grille ne doit pas chevaucher le suivant.
    const prev = monthLabels[monthLabels.length - 1];
    if (month !== lastMonth && (!prev || col - prev.col >= 3)) {
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

  // L'écran sur le toit affiche le bilan ; objectif du jour tenu = une vague de lumière.
  const board = sessionsCompleted > 0 ? `${sessionsCompleted} POMODORO${sessionsCompleted > 1 ? "S" : ""}` : "FIN";
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

      {/* La ville en bandeau : halte de fin de session, l'écran affiche le bilan. */}
      <SummaryCity board={board} goalReached={goalProgress.reached} label={`La ville à la fin de la session : ${board.toLowerCase()}`} />

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
              sub={focusScore >= 80 ? "rue calme" : focusScore >= 50 ? "quelques coupures" : "beaucoup d'interruptions"}
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
              {goalProgress.reached ? "Objectif du jour atteint." : "L'objectif du jour n'est pas encore atteint."}
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
            <span>Éteint</span>
            {HEAT_LEVELS.map((cls, i) => <div key={i} className={cn("w-3 h-3 rounded-[2px]", cls)} />)}
            <span>Allumé</span>
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

/** Bandeau de la ville ; si l'objectif du jour est tenu, une vague de lumière passe une fois. */
function SummaryCity({ board, goalReached, label }: { board: string; goalReached: boolean; label: string }) {
  const city = useRef<CityHandle>(null);
  useEffect(() => {
    if (!goalReached) return;
    const id = setTimeout(() => city.current?.goal(), 1800);
    return () => clearTimeout(id);
  }, [goalReached]);
  return <CityScene ref={city} phase="break" board={board} className="h-44 sm:h-60" label={label} />;
}
