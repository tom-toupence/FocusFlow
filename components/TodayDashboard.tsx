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

// ═══════════════════════════════════════════════════════════════════════════
// TABLEAU DE BORD « AUJOURD'HUI » — organisé autour d'UNE décision.
//
// Problème corrigé (refonte ergonomie) : la version précédente offrait cinq
// façons concurrentes de lancer une session (bouton d'en-tête, « Reprendre »,
// « Lancer le bloc », « Lancer maintenant », « Attaquer celle-ci »), toutes de
// poids visuel équivalent, au milieu d'une dizaine de tuiles égales. Il fallait
// tout lire pour décider.
//
// Structure retenue, de haut en bas :
//   1. LA DÉCISION  — une seule carte, une seule action primaire. Elle choisit
//      d'elle-même la chose la plus pertinente (bloc de sprint > reprise de ton
//      ambiance habituelle > choisir une ambiance) et montre la tâche qui suit.
//      Les autres chemins deviennent des liens discrets sous le bouton.
//   2. L'ÉTAT       — objectif, série, focus du jour : une bande typographique
//      sans cartes (une carte ne se justifie que si l'élévation dit quelque
//      chose).
//   3. LE CONTEXTE  — la semaine en barres, puis le rail horaire du jour.
//   4. LE RESTE     — projet, routines, réflexion, récap : zone allégée, poids
//      visuel volontairement plus faible.
//
// DENSITÉ VOULUE : BASSE (3/10). Avant d'ajouter un bloc ici, demande-toi
// lequel disparaît.
// ═══════════════════════════════════════════════════════════════════════════

const EASE = [0.16, 1, 0.3, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function fmtMin(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m} min`;
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/35", className)}>{children}</p>
  );
}

function PlayIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/** Panneau secondaire : contour discret, aucune ombre portée. */
function Panel({
  children,
  className,
  as = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  const Comp = as === "section" ? motion.section : motion.div;
  return (
    <Comp variants={rise} className={cn("rounded-3xl border border-foreground/[0.08] p-7 sm:p-8", className)}>
      {children}
    </Comp>
  );
}

/** Lien tertiaire : une action possible, pas une action proposée. */
function Quiet({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded text-[13px] text-foreground/45 underline-offset-4 transition-colors hover:text-foreground hover:underline",
        FOCUS_RING
      )}
    >
      {children}
    </button>
  );
}

/* ── Contexte : la semaine en barres ───────────────────────────────────── */

function WeekBars({ data }: { data: { date: string; minutes: number; label: string }[] }) {
  const reduce = useReducedMotion();
  const today = localToday();
  const max = Math.max(...data.map((d) => d.minutes), 25);

  return (
    <div className="flex h-32 items-end gap-2 sm:gap-3">
      {data.map((d, i) => {
        const isToday = d.date === today;
        return (
          <div key={d.date} className="group flex flex-1 flex-col items-center gap-3">
            <div className="relative flex w-full flex-1 items-end">
              <motion.div
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.55, delay: 0.12 + i * 0.05, ease: EASE }}
                style={{ height: `${Math.max((d.minutes / max) * 100, d.minutes > 0 ? 6 : 2)}%`, transformOrigin: "bottom" }}
                className={cn(
                  "w-full rounded-md transition-colors",
                  isToday ? "bg-focus" : d.minutes > 0 ? "bg-foreground/25 group-hover:bg-foreground/40" : "bg-foreground/[0.07]"
                )}
              />
              <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] tabular-nums text-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                {d.minutes}
              </span>
            </div>
            <span className={cn("font-mono text-[10px] uppercase", isToday ? "text-foreground/70" : "text-foreground/30")}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Contexte : le rail horaire du jour ────────────────────────────────── */

function DayRail({
  blocks,
}: {
  blocks: { id: string; startMin: number; durationMin: number; label?: string }[];
}) {
  const reduce = useReducedMotion();
  const START = 6 * 60;
  const span = 24 * 60 - START;
  const now = new Date();
  const nowPct = ((now.getHours() * 60 + now.getMinutes() - START) / span) * 100;

  return (
    <div>
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
              transition={{ duration: 0.45, delay: 0.18 + i * 0.06, ease: EASE }}
              style={{
                left: `${Math.max(left, 0)}%`,
                width: `${Math.max(Math.min(width, 100 - Math.max(left, 0)), 3)}%`,
                transformOrigin: "left",
              }}
              className="absolute inset-y-1.5 flex items-center overflow-hidden rounded-lg bg-focus/25 px-2.5"
              title={`${formatMinOfDay(b.startMin)} · ${b.durationMin} min · ${b.label || "Focus"}`}
            >
              <span className="truncate text-[11px] font-medium text-foreground/80">{b.label || "Focus"}</span>
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

/* ── État : une bande typographique, sans cartes ───────────────────────── */

function StatFigure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <Label>{label}</Label>
      <p className="mt-3 font-mono text-[30px] leading-none tabular-nums tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-2 truncate text-[12px] text-foreground/35">{sub}</p>}
    </div>
  );
}

function CountFigure({
  label,
  num,
  format,
  sub,
}: {
  label: string;
  num: number;
  format: (v: number) => string;
  sub?: string;
}) {
  const animated = useCountUp(num);
  return <StatFigure label={label} value={format(Math.round(animated))} sub={sub} />;
}

/* ══════════════════════════════════════════════════════════════════════════
   Composant
   ══════════════════════════════════════════════════════════════════════════ */

export default function TodayDashboard({
  onNavigateTab,
}: {
  onNavigateTab: (tab: "catalogue" | "organisation") => void;
}) {
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
  const nextTask = todos.find((t) => t.status !== "done") ?? null;
  const openTasks = todos.filter((t) => t.status !== "done").length;
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const todayBlocks = blocksForDate(blocks, localToday()).filter((b) => !b.done);
  const recentJournal = journal[0] ?? null;
  const sprintStatus = sprint ? getSprintStatus(sprint, blocks) : null;

  const byHour = Array(24).fill(0) as number[];
  for (const e of entries) byHour[new Date(e.timestamp).getHours()] += e.minutes;
  const maxHour = Math.max(...byHour);
  const peakHour = maxHour > 0 ? byHour.indexOf(maxHour) : null;
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 6 ? "Bonne nuit" : currentHour < 12 ? "Bonjour" : currentHour < 18 ? "Bon après-midi" : "Bonsoir";

  const lastWeek = weekDates(-1);
  const lastWeekMinutes = lastWeek.reduce((s, d) => s + (days[d]?.minutesWorked ?? 0), 0);
  const showWrapped = lastWeekMinutes > 0 && lastSeenWeekStart !== lastWeek[0];

  const suggestion = topRepeatedVideo(entries);
  const suggestedVideo = suggestion ? getAllVideos().find((v) => v.youtubeId === suggestion.youtubeId) : null;
  const suggestionTimely = suggestion?.peakHour != null && Math.abs(currentHour - suggestion.peakHour) <= 1;

  const chooseAmbiance = () => onNavigateTab("catalogue");

  const resume = () => {
    if (!suggestedVideo) return chooseAmbiance();
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

  const runSprintBlock = () => {
    if (!sprint || !sprintStatus?.todayBlock) return;
    launchSprintSession(sprint, sprintStatus.todayBlock.durationMin);
    router.push("/session");
  };

  // ── LA décision : une seule action primaire, choisie par priorité ──────
  const decision: { kicker: string; headline: string; detail: string; cta: string; run: () => void } =
    sprint && sprintStatus?.todayBlock
      ? {
          kicker: sprintStatus.overdue ? "Sprint, deadline dépassée" : `Sprint, J-${sprintStatus.daysLeft}`,
          headline: sprint.objective,
          detail: `Bloc du jour à ${formatMinOfDay(sprintStatus.todayBlock.startMin)}, ${sprintStatus.todayBlock.durationMin} minutes${
            sprintStatus.missed > 0
              ? `, ${sprintStatus.missed} bloc${sprintStatus.missed > 1 ? "s" : ""} en retard`
              : ""
          }`,
          cta: "Lancer le bloc",
          run: runSprintBlock,
        }
      : suggestedVideo
        ? {
            kicker: suggestionTimely ? "C'est ton heure habituelle" : "Reprendre",
            headline: suggestedVideo.title,
            detail: `Lancée ${suggestion!.count} fois${
              suggestion!.peakHour != null ? `, souvent vers ${suggestion!.peakHour}h` : ""
            }`,
            cta: "Reprendre",
            run: resume,
          }
        : {
            kicker: "Première session",
            headline: "Choisis une ambiance et lance-toi",
            detail: "Un paysage du catalogue, ta playlist, Spotify ou un stream Twitch.",
            cta: "Choisir une ambiance",
            run: chooseAmbiance,
          };

  const hasAside = Boolean(activeProject || routines.length > 0 || recentJournal || showWrapped);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-10 sm:gap-14">
      {/* En-tête : où on est, quel jour on est. Aucune action ici. */}
      <motion.header variants={rise} className="pt-1">
        <Label>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</Label>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[44px]">
          {greeting}
        </h1>
      </motion.header>

      {/* 1. LA DÉCISION */}
      <motion.section
        variants={rise}
        aria-label="Prochaine session"
        className="relative overflow-hidden rounded-[2rem] border border-foreground/[0.1] bg-foreground/[0.04] p-8 sm:p-10"
      >
        <div className="flex flex-col gap-9 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="min-w-0 max-w-2xl">
            <Label>{decision.kicker}</Label>
            <h2 className="mt-4 text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[30px]">
              {decision.headline}
            </h2>
            <p className="mt-3 text-[14px] text-foreground/45">{decision.detail}</p>

            {nextTask && (
              <p className="mt-7 flex items-start gap-2.5 text-[14px] text-foreground/70">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-focus" aria-hidden />
                <span className="min-w-0">
                  <span className="text-foreground/40">Ensuite : </span>
                  {nextTask.text}
                  {openTasks > 1 && (
                    <span className="text-foreground/35"> et {openTasks - 1} autre{openTasks > 2 ? "s" : ""}</span>
                  )}
                </span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end">
            <button
              onClick={decision.run}
              className={cn(
                "inline-flex items-center gap-2.5 rounded-2xl bg-foreground px-7 py-4 text-[15px] font-semibold text-background transition-all duration-300 hover:bg-foreground/90 motion-safe:active:translate-y-px motion-safe:active:scale-[0.98]",
                FOCUS_RING
              )}
            >
              <PlayIcon />
              {decision.cta}
            </button>
            {/* Les autres chemins existent, mais ne se disputent plus l'attention. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {decision.cta !== "Choisir une ambiance" && <Quiet onClick={chooseAmbiance}>Autre ambiance</Quiet>}
              <Quiet onClick={() => onNavigateTab("organisation")}>Planifier</Quiet>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. L'ÉTAT */}
      <motion.section variants={rise} aria-label="Où tu en es aujourd'hui">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-12">
          <div className="flex shrink-0 items-center gap-6">
            <GoalRing progress={progress} size={116} stroke={9} />
            <div className="min-w-0">
              <Label>Objectif du jour</Label>
              <p className="mt-3 text-[16px] leading-snug text-foreground/80">
                {progress.reached
                  ? "Atteint. Le reste est du bonus."
                  : `Encore ${Math.max(0, target - progress.value)} ${
                      unit === "minutes" ? "min" : `pomodoro${target - progress.value !== 1 ? "s" : ""}`
                    }`}
              </p>
            </div>
          </div>

          <div className="flex flex-1 gap-10 border-foreground/[0.08] sm:border-l sm:pl-12">
            <CountFigure
              label="Série"
              num={streak}
              format={(v) => `${v} j`}
              sub={streak >= 7 ? "solide" : streak > 0 ? "en cours" : "à relancer"}
            />
            <CountFigure
              label="Focus aujourd'hui"
              num={today.minutesWorked}
              format={fmtMin}
              sub={`${today.sessions} session${today.sessions !== 1 ? "s" : ""}`}
            />
          </div>
        </div>
      </motion.section>

      {/* 3. LE CONTEXTE */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <Panel>
          <div className="flex items-baseline justify-between gap-4">
            <Label>Sept derniers jours</Label>
            <p className="font-mono text-[11px] tabular-nums text-foreground/40">
              {fmtMin(week.reduce((s, d) => s + d.minutes, 0))}
            </p>
          </div>
          <div className="mt-8">
            <WeekBars data={week} />
          </div>
          {peakHour !== null && (
            <p className="mt-7 text-[13px] text-foreground/40">
              Tu es le plus souvent concentré vers {peakHour}h
              {Math.abs(currentHour - peakHour) <= 1 ? ", c'est maintenant." : "."}
            </p>
          )}
        </Panel>

        <Panel>
          <div className="flex items-baseline justify-between gap-4">
            <Label>Ta journée</Label>
            <button
              onClick={() => onNavigateTab("organisation")}
              className={cn("rounded text-[12px] text-foreground/40 transition-colors hover:text-foreground", FOCUS_RING)}
            >
              Planning
            </button>
          </div>
          {todayBlocks.length > 0 ? (
            <>
              <div className="mt-8">
                <DayRail blocks={todayBlocks} />
              </div>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {todayBlocks.slice(0, 4).map((b) => (
                  <span key={b.id} className="flex items-center gap-2 text-[13px] text-foreground/60">
                    <span className="font-mono tabular-nums text-foreground/35">{formatMinOfDay(b.startMin)}</span>
                    {b.label || "Focus"}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-foreground/10 px-6 py-8">
              <p className="text-[14px] text-foreground/45">
                Aucun bloc posé aujourd&apos;hui. Réserver un créneau double les chances de s&apos;y tenir.
              </p>
              <button
                onClick={() => onNavigateTab("organisation")}
                className={cn(
                  "rounded-xl border border-foreground/12 px-4 py-2 text-[13px] text-foreground/70 transition-colors hover:border-foreground/30 hover:text-foreground",
                  FOCUS_RING
                )}
              >
                Poser un bloc
              </button>
            </div>
          )}
        </Panel>
      </div>

      {/* 4. LE RESTE — poids visuel volontairement plus faible */}
      {hasAside && (
        <motion.section variants={rise} aria-label="Le reste" className="flex flex-col gap-7 border-t border-foreground/[0.07] pt-10">
          {activeProject && (() => {
            const st = getProjectStatus(activeProject);
            return (
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeProject.color }} aria-hidden />
                    <span className="text-[15px] font-medium text-foreground">{activeProject.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/35">projet actif</span>
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-foreground/45">
                    {activeProject.pomodorosDone}/{activeProject.pomodoroBudget}
                  </span>
                </div>
                <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: Math.min(st.pct, 1) }}
                    transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
                    style={{ background: activeProject.color, transformOrigin: "left" }}
                    className="h-full w-full rounded-full"
                  />
                </div>
                {st.daysLeft !== null && (
                  <p className="mt-3 text-[12px] text-foreground/40">
                    {st.overdue
                      ? "Deadline dépassée"
                      : `${st.daysLeft} j restants, vise ${st.perDayNeeded} pomodoro${(st.perDayNeeded ?? 0) > 1 ? "s" : ""} par jour`}
                    {!st.overdue && (st.onTrack ? ", sur la bonne voie" : ", prends de l'avance")}
                  </p>
                )}
              </div>
            );
          })()}

          {routines.length > 0 && (
            <div>
              <Label>Routines</Label>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {routines.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      applyRoutine(r);
                      router.push("/settings");
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border border-foreground/[0.09] px-4 py-2.5 text-[13px] text-foreground/75 transition-all hover:border-foreground/25 hover:text-foreground motion-safe:active:scale-[0.98]",
                      FOCUS_RING
                    )}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color || "currentColor" }} aria-hidden />
                    <span className="font-medium">{r.name}</span>
                    <span className="font-mono text-[10px] tabular-nums text-foreground/35">{r.workDuration}min</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(recentJournal || showWrapped) && (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-10">
              {recentJournal && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <Label>Dernière réflexion</Label>
                    <span
                      className="h-2 w-2 rounded-full"
                      title={MOODS.find((m) => m.value === recentJournal.mood)?.label}
                      style={{ background: MOODS.find((m) => m.value === recentJournal.mood)?.color }}
                      aria-hidden
                    />
                  </div>
                  {recentJournal.wentWell && (
                    <p className="mt-3 text-[14px] leading-snug text-foreground/70">{recentJournal.wentWell}</p>
                  )}
                  {recentJournal.blockers && (
                    <p className="mt-1.5 text-[14px] leading-snug text-foreground/45">{recentJournal.blockers}</p>
                  )}
                </div>
              )}
              {showWrapped && (
                <button
                  onClick={() => router.push("/wrapped")}
                  className={cn(
                    "group flex shrink-0 items-center gap-3 rounded-2xl border border-foreground/[0.1] px-5 py-4 text-left transition-colors hover:border-foreground/25",
                    FOCUS_RING
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-focus/12 text-focus">
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 20V4M4 20h16M8 16l3.5-4.5 3 2.5L20 8" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium text-foreground">Ton récap de la semaine</span>
                    <span className="block text-[12px] text-foreground/45">Meilleur jour, badges, carte à partager</span>
                  </span>
                </button>
              )}
            </div>
          )}
        </motion.section>
      )}
    </motion.div>
  );
}

/** Squelette au premier rendu : le store persisté n'est pas encore hydraté. */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10 sm:gap-14" aria-hidden>
      <div className="flex flex-col gap-3 pt-1">
        <span className="anim-skeleton block h-3 w-44 rounded bg-foreground/10" />
        <span className="anim-skeleton block h-10 w-56 rounded bg-foreground/10" />
      </div>
      <span className="anim-skeleton block h-[15rem] rounded-[2rem] bg-foreground/[0.06]" />
      <div className="flex gap-12">
        <span className="anim-skeleton block h-[7rem] w-[7rem] shrink-0 rounded-full bg-foreground/[0.06]" />
        <span className="anim-skeleton block h-[7rem] flex-1 rounded-2xl bg-foreground/[0.04]" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <span className="anim-skeleton block h-64 rounded-3xl bg-foreground/[0.06]" />
        <span className="anim-skeleton block h-64 rounded-3xl bg-foreground/[0.06]" />
      </div>
    </div>
  );
}
