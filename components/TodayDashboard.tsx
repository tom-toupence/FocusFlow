"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useGoalStore, getTodayProgress } from "@/store/goalStore";
import { useStatsStore, getTodayStats, getStreak, getLast7Days } from "@/store/statsStore";
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
import { topRepeatedVideo } from "@/lib/suggestions";
import { useCountUp } from "@/lib/useCountUp";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { useNotesStore } from "@/store/notesStore";
import { useTimerStore } from "@/store/timerStore";
import GoalRing from "@/components/GoalRing";
import { cn } from "@/lib/utils";

// Tableau de bord « Aujourd'hui » : bento asymétrique plutôt qu'une pile de
// cartes identiques. Un seul accent (token `focus`), le reste en niveaux de
// foreground. Le mouvement est motivé : entrée en cascade (hiérarchie de
// lecture), barres de la semaine qui poussent (le chiffre devient une forme),
// pression tactile sur les actions. Tout se replie sous prefers-reduced-motion.
//
// DENSITÉ VOULUE : BASSE (3/10). Grands intervalles entre les blocs, tuiles
// largement rembourrées, peu d'éléments par ligne, chiffres au grand corps.
// Si tu ajoutes une tuile ici, demande-toi d'abord laquelle enlever.

function fmtMin(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m} min`;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};
const tile: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Conteneur de tuile : bordure fine, pas d'ombre portée, léger lift au survol. */
function Tile({
  className,
  children,
  interactive = false,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={tile}
      whileHover={interactive && !reduce ? { y: -2 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      onClick={onClick}
      className={cn(
        "relative rounded-3xl border border-foreground/[0.08] bg-foreground/[0.025] p-7 sm:p-8",
        interactive && "cursor-pointer hover:border-foreground/20 hover:bg-foreground/[0.05] transition-colors",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/35">{children}</p>;
}

function PlayIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/** Bouton d'action principal : pression physique au clic. */
function PrimaryAction({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 motion-safe:active:translate-y-px motion-safe:active:scale-[0.98]",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Semaine en barres : les 7 derniers jours, aujourd'hui en accent. */
function WeekBars({ data, unitMax }: { data: { date: string; minutes: number; label: string }[]; unitMax: number }) {
  const reduce = useReducedMotion();
  const today = localToday();
  return (
    <div className="flex h-36 items-end gap-2 sm:gap-3">
      {data.map((d, i) => {
        const ratio = unitMax > 0 ? d.minutes / unitMax : 0;
        const isToday = d.date === today;
        return (
          <div key={d.date} className="group flex flex-1 flex-col items-center gap-3">
            <div className="relative flex w-full flex-1 items-end">
              <motion.div
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.55, delay: 0.1 + i * 0.045, ease: EASE }}
                style={{ height: `${Math.max(ratio * 100, d.minutes > 0 ? 6 : 2)}%`, transformOrigin: "bottom" }}
                className={cn(
                  "w-full rounded-md",
                  isToday ? "bg-focus" : d.minutes > 0 ? "bg-foreground/25" : "bg-foreground/[0.07]"
                )}
              />
              <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] tabular-nums text-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                {d.minutes}
              </span>
            </div>
            <span
              className={cn(
                "font-mono text-[10px] uppercase",
                isToday ? "text-foreground/70" : "text-foreground/30"
              )}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Métrique nue : pas de carte, juste du rythme typographique. */
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <p className="mt-3 font-mono text-[28px] leading-none tabular-nums tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-2 truncate text-[12px] text-foreground/35">{sub}</p>}
    </div>
  );
}

function CountMetric({ label, num, format, sub }: {
  label: string;
  num: number;
  format: (v: number) => string;
  sub?: string;
}) {
  const animated = useCountUp(num);
  return <Metric label={label} value={format(Math.round(animated))} sub={sub} />;
}

/** Rail horaire du jour : les blocs planifiés placés sur 6h → 24h. */
function DayRail({ blocks }: { blocks: { id: string; startMin: number; durationMin: number; label?: string }[] }) {
  const reduce = useReducedMotion();
  const START = 6 * 60;
  const END = 24 * 60;
  const span = END - START;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nowPct = ((nowMin - START) / span) * 100;

  return (
    <div className="mt-6">
      <div className="relative h-12 rounded-xl bg-foreground/[0.05]">
        {blocks.map((b, i) => {
          const left = ((b.startMin - START) / span) * 100;
          const width = (b.durationMin / span) * 100;
          if (left > 100 || left + width < 0) return null;
          return (
            <motion.div
              key={b.id}
              initial={reduce ? false : { opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.45, delay: 0.15 + i * 0.06, ease: EASE }}
              style={{
                left: `${Math.max(left, 0)}%`,
                width: `${Math.max(Math.min(width, 100 - Math.max(left, 0)), 2.5)}%`,
                transformOrigin: "left",
              }}
              className="absolute inset-y-1.5 flex items-center overflow-hidden rounded-lg bg-focus/25 px-2.5"
              title={`${formatMinOfDay(b.startMin)} · ${b.durationMin} min · ${b.label || "Focus"}`}
            >
              <span className="truncate text-[10px] font-medium text-foreground/75">{b.label || "Focus"}</span>
            </motion.div>
          );
        })}
        {nowPct >= 0 && nowPct <= 100 && (
          <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${nowPct}%` }} aria-hidden />
        )}
      </div>
      <div className="mt-2.5 flex justify-between font-mono text-[10px] text-foreground/25">
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>00h</span>
      </div>
    </div>
  );
}

export default function TodayDashboard({ onNavigateTab }: { onNavigateTab: (tab: "catalogue" | "organisation") => void }) {
  const router = useRouter();
  const { unit, target } = useGoalStore();
  const { days } = useStatsStore();
  const { entries } = usePlayHistoryStore();
  const { todos, getAllVideos } = useSessionStore();
  const { routines } = useRoutineStore();
  const { projects, activeProjectId } = useProjectStore();
  const { entries: journal } = useJournalStore();
  const { blocks } = usePlanStore();
  const { lastSeenWeekStart } = useWrappedStore();
  const { sprint } = useSprintStore();

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return <DashboardSkeleton />;

  const today = getTodayStats(days);
  const streak = getStreak(days);
  const progress = getTodayProgress(days, unit, target);
  const week = getLast7Days(days);
  const weekMax = Math.max(...week.map((d) => d.minutes), 25);
  const weekTotal = week.reduce((s, d) => s + d.minutes, 0);
  const nextTask = todos.find((t) => t.status !== "done") ?? null;
  const openTasks = todos.filter((t) => t.status !== "done").length;
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const todayBlocks = blocksForDate(blocks, localToday()).filter((b) => !b.done);
  const recentJournal = journal[0] ?? null;

  const byHour = Array(24).fill(0) as number[];
  for (const e of entries) byHour[new Date(e.timestamp).getHours()] += e.minutes;
  const maxHour = Math.max(...byHour);
  const peakHour = maxHour > 0 ? byHour.indexOf(maxHour) : null;
  const currentHour = new Date().getHours();

  const greeting = currentHour < 6 ? "Bonne nuit" : currentHour < 12 ? "Bonjour" : currentHour < 18 ? "Bon après-midi" : "Bonsoir";

  const lastWeek = weekDates(-1);
  const lastWeekMinutes = lastWeek.reduce((s, d) => s + (days[d]?.minutesWorked ?? 0), 0);
  const showWrappedBanner = lastWeekMinutes > 0 && lastSeenWeekStart !== lastWeek[0];

  const startSession = () => onNavigateTab("catalogue");

  const suggestion = topRepeatedVideo(entries);
  const suggestedVideo = suggestion ? getAllVideos().find((v) => v.youtubeId === suggestion.youtubeId) : null;
  const suggestionTimely = suggestion?.peakHour != null && Math.abs(currentHour - suggestion.peakHour) <= 1;
  const launchSuggested = () => {
    if (!suggestedVideo) return;
    // « Reprendre » en un clic : dernière ambiance + preset Pomodoro persisté
    // → session directe, sans repasser par /settings.
    useSpotifyStore.getState().selectPlaylist(null);
    useTwitchStore.getState().clear();
    useSessionStore.getState().selectVideo(suggestedVideo.id);
    useSessionStore.getState().clearDone();
    useNotesStore.getState().clearAll();
    // Timer neuf : sans ce reset, le mode/temps restant d'une session
    // précédente (interrompue) survivrait à la navigation SPA.
    useTimerStore.getState().resetAll();
    router.push("/session");
  };

  const sprintStatus = sprint ? getSprintStatus(sprint, blocks) : null;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-8 sm:gap-10">
      {/* En-tête */}
      <motion.div variants={tile} className="flex flex-col gap-6 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/35">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[46px]">
            {greeting}
          </h1>
        </div>
        <PrimaryAction onClick={startSession} className="px-6 py-3 shadow-lg shadow-black/10">
          <PlayIcon />
          Démarrer une session
        </PrimaryAction>
      </motion.div>

      {/* Reprise : la vidéo la plus relancée, avec sa vraie miniature */}
      {suggestedVideo && (
        <Tile className="overflow-hidden p-0" interactive onClick={launchSuggested}>
          <div className="flex items-stretch gap-4">
            <div className="relative w-28 shrink-0 overflow-hidden sm:w-44">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${suggestedVideo.youtubeId}/mqdefault.jpg`}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                <PlayIcon className="w-6 h-6" />
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-4 pr-5">
              <Label>{suggestionTimely ? "C'est ton heure habituelle" : "Reprendre"}</Label>
              <p className="truncate text-[15px] font-medium text-foreground">{suggestedVideo.title}</p>
              <p className="text-xs text-foreground/40">
                Lancée {suggestion!.count} fois
                {suggestion!.peakHour != null ? `, souvent vers ${suggestion!.peakHour}h` : ""}
              </p>
            </div>
          </div>
        </Tile>
      )}

      {/* Bento principal : objectif (5) + semaine (7) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <Tile className="flex items-center gap-7 lg:col-span-5">
          <GoalRing progress={progress} size={132} stroke={10} />
          <div className="min-w-0">
            <Label>Objectif du jour</Label>
            <p className="mt-3 text-[17px] leading-snug text-foreground/80">
              {progress.reached
                ? "Atteint. Le reste est du bonus."
                : `Encore ${Math.max(0, target - progress.value)} ${unit === "minutes" ? "min" : `pomodoro${target - progress.value !== 1 ? "s" : ""}`}`}
            </p>
            <button
              onClick={startSession}
              className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-focus transition-opacity hover:opacity-70"
            >
              Lancer maintenant
            </button>
          </div>
        </Tile>

        <Tile className="lg:col-span-7">
          <div className="flex items-start justify-between gap-4">
            <Label>Sept derniers jours</Label>
            <p className="font-mono text-[11px] tabular-nums text-foreground/40">{fmtMin(weekTotal)}</p>
          </div>
          <div className="mt-8">
            <WeekBars data={week} unitMax={weekMax} />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-8 border-t border-foreground/[0.07] pt-7">
            <CountMetric label="Série" num={streak} format={(v) => `${v} j`} sub={streak >= 7 ? "solide" : streak > 0 ? "en cours" : "à relancer"} />
            <CountMetric label="Aujourd'hui" num={today.minutesWorked} format={fmtMin} sub={`${today.sessions} session${today.sessions !== 1 ? "s" : ""}`} />
          </div>
          {peakHour !== null && (
            <p className="mt-6 text-[13px] text-foreground/40">
              Tu es le plus souvent concentré vers {peakHour}h
              {Math.abs(currentHour - peakHour) <= 1 ? ", c'est maintenant." : "."}
            </p>
          )}
        </Tile>
      </div>

      {/* Sprint actif */}
      {sprint && sprintStatus && (
        <Tile className="flex flex-col gap-4 border-focus/25 bg-focus/[0.05] sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Label>
              Sprint · {sprintStatus.overdue ? "deadline dépassée" : `J-${sprintStatus.daysLeft}`} · {sprintStatus.blocksDone}/{sprintStatus.blocksTotal} blocs
            </Label>
            <p className="mt-1.5 truncate text-[15px] font-medium text-foreground">{sprint.objective}</p>
            <p className="mt-0.5 text-xs text-foreground/45">
              {sprintStatus.todayBlock ? (
                <>
                  Aujourd&apos;hui : {formatMinOfDay(sprintStatus.todayBlock.startMin)}, {sprintStatus.todayBlock.durationMin} min
                  {sprintStatus.missed > 0 && `, ${sprintStatus.missed} bloc${sprintStatus.missed > 1 ? "s" : ""} en retard`}
                </>
              ) : sprintStatus.missed > 0 ? (
                `${sprintStatus.missed} bloc${sprintStatus.missed > 1 ? "s" : ""} en retard, recalcule depuis Organisation`
              ) : (
                "Rien de prévu aujourd'hui, repos mérité"
              )}
            </p>
          </div>
          {sprintStatus.todayBlock && (
            <PrimaryAction
              onClick={() => {
                launchSprintSession(sprint, sprintStatus.todayBlock!.durationMin);
                router.push("/session");
              }}
            >
              <PlayIcon />
              Lancer le bloc
            </PrimaryAction>
          )}
        </Tile>
      )}

      {/* Journée : rail horaire (7) + prochaine tâche (5) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <Tile className="lg:col-span-7">
          <div className="flex items-center justify-between gap-4">
            <Label>Ta journée</Label>
            <button
              onClick={() => onNavigateTab("organisation")}
              className="text-[11px] text-foreground/40 transition-colors hover:text-foreground"
            >
              Planning
            </button>
          </div>
          {todayBlocks.length > 0 ? (
            <>
              <DayRail blocks={todayBlocks} />
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
                {todayBlocks.slice(0, 4).map((b) => (
                  <span key={b.id} className="flex items-center gap-2 text-xs text-foreground/60">
                    <span className="font-mono tabular-nums text-foreground/35">{formatMinOfDay(b.startMin)}</span>
                    {b.label || "Focus"}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed border-foreground/10 px-4 py-6">
              <p className="text-sm text-foreground/45">Aucun bloc posé aujourd&apos;hui.</p>
              <button
                onClick={() => onNavigateTab("organisation")}
                className="rounded-lg border border-foreground/12 px-3 py-1.5 text-xs text-foreground/70 transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                Poser un bloc
              </button>
            </div>
          )}
        </Tile>

        <Tile className="flex flex-col lg:col-span-5">
          <div className="flex items-center justify-between gap-4">
            <Label>Prochaine tâche</Label>
            {openTasks > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-foreground/35">{openTasks} en attente</span>
            )}
          </div>
          {nextTask ? (
            <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
              <p className="text-[15px] leading-snug text-foreground/85">{nextTask.text}</p>
              <button
                onClick={startSession}
                className="self-start font-mono text-[11px] uppercase tracking-[0.12em] text-focus transition-opacity hover:opacity-70"
              >
                Attaquer celle-ci
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-1 flex-col items-start justify-center gap-3 rounded-xl border border-dashed border-foreground/10 px-4 py-6">
              <p className="text-sm text-foreground/45">Ta liste est vide.</p>
              <button
                onClick={startSession}
                className="rounded-lg border border-foreground/12 px-3 py-1.5 text-xs text-foreground/70 transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                Planifier une tâche
              </button>
            </div>
          )}
        </Tile>
      </div>

      {/* Projet actif */}
      {activeProject && (() => {
        const st = getProjectStatus(activeProject);
        return (
          <Tile>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeProject.color }} aria-hidden />
                <p className="text-sm font-semibold text-foreground">{activeProject.name}</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/35">projet actif</span>
              </div>
              <span className="font-mono text-xs tabular-nums text-foreground/45">
                {activeProject.pomodorosDone}/{activeProject.pomodoroBudget}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.min(st.pct, 1) }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
                style={{ background: activeProject.color, transformOrigin: "left" }}
                className="h-full w-full rounded-full"
              />
            </div>
            {st.daysLeft !== null && (
              <p className="mt-2.5 text-[11px] text-foreground/40">
                {st.overdue
                  ? "Deadline dépassée"
                  : `${st.daysLeft} j restants, vise ${st.perDayNeeded} pomodoro${(st.perDayNeeded ?? 0) > 1 ? "s" : ""} par jour`}
                {!st.overdue && (st.onTrack ? ", sur la bonne voie" : ", prends de l'avance")}
              </p>
            )}
          </Tile>
        );
      })()}

      {/* Routines : rangée de pastilles, pas une grille de cartes */}
      {routines.length > 0 && (
        <motion.div variants={tile}>
          <Label>Routines</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {routines.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  applyRoutine(r);
                  router.push("/settings");
                }}
                className="group flex items-center gap-2.5 rounded-xl border border-foreground/[0.09] bg-foreground/[0.025] px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-foreground/25 hover:bg-foreground/[0.06] motion-safe:active:scale-[0.98]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color || "currentColor" }} aria-hidden />
                <span className="font-medium">{r.name}</span>
                <span className="font-mono text-[10px] tabular-nums text-foreground/35">{r.workDuration}min</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Bas de page : récap hebdo + dernière réflexion */}
      {(showWrappedBanner || recentJournal) && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          {showWrappedBanner && (
            <Tile interactive onClick={() => router.push("/wrapped")} className="flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-focus/15 text-focus">
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20V4M4 20h16M8 16l3.5-4.5 3 2.5L20 8" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Ton récap de la semaine est prêt</p>
                <p className="text-xs text-foreground/45">Temps de focus, meilleur jour, badges, carte à partager.</p>
              </div>
            </Tile>
          )}
          {recentJournal && (
            <Tile>
              <div className="flex items-center justify-between">
                <Label>Dernière réflexion</Label>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  title={MOODS.find((m) => m.value === recentJournal.mood)?.label}
                  style={{ background: MOODS.find((m) => m.value === recentJournal.mood)?.color }}
                  aria-hidden
                />
              </div>
              {recentJournal.wentWell && <p className="mt-3 text-sm leading-snug text-foreground/75">{recentJournal.wentWell}</p>}
              {recentJournal.blockers && <p className="mt-1.5 text-sm leading-snug text-foreground/45">{recentJournal.blockers}</p>}
            </Tile>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** Squelette au premier rendu (le store persisté n'est pas encore hydraté). */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="mb-2 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <span className="anim-skeleton block h-3 w-40 rounded bg-foreground/10" />
          <span className="anim-skeleton block h-9 w-52 rounded bg-foreground/10" />
        </div>
        <span className="anim-skeleton block h-11 w-48 rounded-xl bg-foreground/10" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <span className="anim-skeleton block h-[164px] rounded-2xl bg-foreground/[0.06] lg:col-span-5" />
        <span className="anim-skeleton block h-[164px] rounded-2xl bg-foreground/[0.06] lg:col-span-7" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <span className="anim-skeleton block h-32 rounded-2xl bg-foreground/[0.06] lg:col-span-7" />
        <span className="anim-skeleton block h-32 rounded-2xl bg-foreground/[0.06] lg:col-span-5" />
      </div>
    </div>
  );
}
