"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "motion/react";
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
import { cleanTitle } from "@/lib/text";
import { topRepeatedVideo } from "@/lib/suggestions";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { useNotesStore } from "@/store/notesStore";
import { useTimerStore } from "@/store/timerStore";
import { cn } from "@/lib/utils";
import { Gauge } from "@/components/ff/Gauge";
import { Button } from "@/components/ff/Button";
import { IconPlay } from "@/components/ff/icons";
import { EmptyState, Skeleton } from "@/components/ff/States";
import { DUR, EASE as MOTION_EASE, STAGGER } from "@/lib/motion";

const EASE_UI = [...MOTION_EASE.ui] as [number, number, number, number];

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

// Identité Clepsydre (docs/redesign) : le jour se lit comme une hauteur d'eau.
// La colonne du jour face à sa marque d'objectif porte la décision ; la semaine
// est faite de sept colonnes ; le rail horaire est un relevé. Aucun chiffre ne
// défile (liste noire E28), aucune icône en pastille colorée (B9).

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER * 2 } },
};
const rise: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.panel, ease: EASE_UI } },
};

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sodium";

function fmtMin(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h${m > 0 ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[13px] text-ink-3", className)}>{children}</p>;
}

/** Feuille de relevé : un filet en haut, pas de boîte. */
function Sheet({ title, measure, action, children, className }: {
  title: string; measure?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <motion.section variants={rise} className={cn("border-t border-line pt-5", className)} aria-label={title}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg text-ink">{title}</h2>
        <div className="flex items-baseline gap-4">
          {measure && <span className="font-mono text-[12px] tabular-nums text-ink-3">{measure}</span>}
          {action}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </motion.section>
  );
}

/** Lien tertiaire : une action possible, pas une action proposée. */
function Quiet({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <Button variant="quiet" size="sm" onClick={onClick}>{children}</Button>;
}

/* ── La semaine : sept tours, une par soir ─────────────────────────────── */

function WeekColumns({ data, goal }: { data: { date: string; minutes: number; label: string }[]; goal: number }) {
  const today = localToday();
  const capacity = Math.max(goal * 1.25, ...data.map((d) => d.minutes), 25);
  return (
    <div className="flex items-end justify-between gap-2 sm:gap-4">
      {data.map((d) => {
        const isToday = d.date === today;
        return (
          <div key={d.date} className="flex flex-col items-center gap-2 min-w-0">
            <Gauge
              label={`${d.label}`}
              valueText={fmtMin(d.minutes)}
              value={d.minutes / capacity}
              mark={goal / capacity}
              length={112}
              thickness={isToday ? 12 : 9}
              ticks={10}
              majorEvery={5}
              live={isToday}
            />
            <span className={cn("font-mono text-[11px] tabular-nums", isToday ? "text-sodium-text" : "text-ink-3")}>{d.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-ink-3">{d.minutes || ""}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── La journée : un relevé horaire ────────────────────────────────────── */

function DayRail({
  blocks,
}: {
  blocks: { id: string; startMin: number; durationMin: number; label?: string }[];
}) {
  const START = 6 * 60;
  const span = 24 * 60 - START;
  const now = new Date();
  const nowPct = ((now.getHours() * 60 + now.getMinutes() - START) / span) * 100;

  return (
    <div>
      <div className="relative h-11 border-b border-line-strong/60">
        {[0, 25, 50, 75, 100].map((t) => (
          <span key={t} aria-hidden className="absolute bottom-0 w-px h-2 bg-line-strong/70" style={{ left: `${t}%` }} />
        ))}
        {blocks.map((b) => {
          const left = ((b.startMin - START) / span) * 100;
          const width = (b.durationMin / span) * 100;
          if (left > 100 || left + width < 0) return null;
          return (
            <div
              key={b.id}
              style={{
                left: `${Math.max(left, 0)}%`,
                width: `${Math.max(Math.min(width, 100 - Math.max(left, 0)), 3)}%`,
              }}
              className="absolute bottom-0 top-2 flex items-start overflow-hidden rounded-t-[2px] bg-water px-2 pt-1"
              title={`${formatMinOfDay(b.startMin)} · ${b.durationMin} min · ${b.label || "Focus"}`}
            >
              <span className="truncate text-[11px] font-medium text-[oklch(0.95_0.01_85)]">{b.label || "Focus"}</span>
            </div>
          );
        })}
        {nowPct >= 0 && nowPct <= 100 && (
          <span className="absolute -top-1 bottom-0 w-[2px] bg-sodium" style={{ left: `${nowPct}%` }} aria-label="Maintenant" />
        )}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-3">
        <span>06 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>00 h</span>
      </div>
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <p className="mt-2 font-mono text-[28px] leading-none tabular-nums tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-2 truncate text-[12px] text-ink-3">{sub}</p>}
    </div>
  );
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

  const capacity = Math.max(target * 1.25, progress.value, 1);
  const goalMinutes = unit === "minutes" ? target : target * 25;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-12 sm:gap-16">
      {/* En-tête : où on est, quel jour on est. Aucune action ici. */}
      <motion.header variants={rise}>
        <Label>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</Label>
        <h1 className="mt-2 font-display font-light text-[clamp(2.2rem,4.6vw,3.2rem)] leading-[1.02] tracking-[-0.015em] text-ink">
          {greeting}
        </h1>
      </motion.header>

      {/* 1. LA DÉCISION, portée par la colonne du jour */}
      <motion.section variants={rise} aria-label="Prochaine session" className="grid gap-8 sm:grid-cols-[auto_1fr] sm:gap-12 items-end">
        <div className="flex items-end gap-5">
          <Gauge
            label="Niveau du jour"
            valueText={`${progress.value} ${unit === "minutes" ? "minutes" : "pomodoros"} sur ${target}`}
            value={progress.value / capacity}
            mark={target / capacity}
            markLabel={progress.reached ? "objectif atteint" : `objectif ${target} ${unit === "minutes" ? "min" : "pomo."}`}
            length={210}
            thickness={18}
            ticks={20}
            majorEvery={4}
            reflet
          />
        </div>
        <div className="min-w-0 max-w-2xl">
          <Label>{decision.kicker}</Label>
          <h2 className="mt-3 font-display text-[clamp(1.5rem,3vw,2.1rem)] leading-[1.15] text-ink">
            {cleanTitle(decision.headline)}
          </h2>
          <p className="mt-2.5 text-[14px] text-ink-2">{decision.detail}</p>
          {nextTask && (
            <p className="mt-5 flex items-start gap-2.5 text-[14px] text-ink-2">
              <span className="mt-[9px] h-[2px] w-3 shrink-0 bg-sodium" aria-hidden />
              <span className="min-w-0">
                <span className="text-ink-3">Ensuite : </span>
                {nextTask.text}
                {openTasks > 1 && <span className="text-ink-3"> et {openTasks - 1} autre{openTasks > 2 ? "s" : ""}</span>}
              </span>
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button variant="signal" size="lg" onClick={decision.run}>
              <IconPlay size={15} />
              {decision.cta}
            </Button>
            {decision.cta !== "Choisir une ambiance" && <Quiet onClick={chooseAmbiance}>Autre ambiance</Quiet>}
            <Quiet onClick={() => onNavigateTab("organisation")}>Planifier</Quiet>
          </div>
          <div className="mt-10 flex gap-12">
            <Figure label="Série" value={`${streak} j`} sub={streak >= 7 ? "solide" : streak > 0 ? "en cours" : "à relancer"} />
            <Figure label="Aujourd'hui" value={fmtMin(today.minutesWorked)} sub={`${today.sessions} session${today.sessions !== 1 ? "s" : ""}`} />
            <div className="hidden sm:block min-w-0">
              <Label>Reste</Label>
              <p className="mt-2 font-mono text-[28px] leading-none tabular-nums tracking-tight text-ink">
                {progress.reached ? "0" : Math.max(0, target - progress.value)}
                <span className="text-[14px] text-ink-3"> {unit === "minutes" ? "min" : "pomo."}</span>
              </p>
              <p className="mt-2 text-[12px] text-ink-3">{progress.reached ? "le reste est du bonus" : "avant l'objectif"}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. LE CONTEXTE */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-14">
        <Sheet title="Sept derniers jours" measure={fmtMin(week.reduce((s, d) => s + d.minutes, 0))}>
          <WeekColumns data={week} goal={goalMinutes} />
          {peakHour !== null && (
            <p className="mt-6 text-[13px] text-ink-3">
              Tu es le plus souvent concentré vers {peakHour} h
              {Math.abs(currentHour - peakHour) <= 1 ? ", c'est maintenant." : "."}
            </p>
          )}
        </Sheet>

        <Sheet title="Ta journée" action={<Quiet onClick={() => onNavigateTab("organisation")}>Planning</Quiet>}>
          {todayBlocks.length > 0 ? (
            <>
              <DayRail blocks={todayBlocks} />
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {todayBlocks.slice(0, 4).map((b) => (
                  <span key={b.id} className="flex items-center gap-2 text-[13px] text-ink-2">
                    <span className="font-mono tabular-nums text-ink-3">{formatMinOfDay(b.startMin)}</span>
                    {b.label || "Focus"}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              className="py-0"
              title="Aucun bloc posé aujourd'hui."
              action={<Button size="sm" onClick={() => onNavigateTab("organisation")}>Poser un bloc</Button>}
            >
              Un créneau réservé à l&apos;avance tient mieux qu&apos;une bonne intention.
            </EmptyState>
          )}
        </Sheet>
      </div>

      {/* 3. LE RESTE, poids visuel volontairement plus faible */}
      {hasAside && (
        <motion.section variants={rise} aria-label="Le reste" className="grid gap-10 border-t border-line pt-8 lg:grid-cols-2">
          {activeProject && (() => {
            const st = getProjectStatus(activeProject);
            return (
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeProject.color }} aria-hidden />
                    <span className="text-[15px] font-semibold text-ink">{activeProject.name}</span>
                    <span className="text-[12px] text-ink-3">projet actif</span>
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-ink-3">
                    {activeProject.pomodorosDone}/{activeProject.pomodoroBudget}
                  </span>
                </div>
                <div className="mt-3 h-[6px] rounded-[2px] bg-surface-2 overflow-hidden" role="meter" aria-label={`Avancement de ${activeProject.name}`} aria-valuenow={Math.round(Math.min(st.pct, 1) * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full origin-left transition-transform duration-[var(--d-water)] ease-[var(--ease-settle)]" style={{ background: activeProject.color, transform: `scaleX(${Math.min(st.pct, 1)})` }} />
                </div>
                {st.daysLeft !== null && (
                  <p className="mt-3 text-[13px] text-ink-3">
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
              <div className="mt-3 flex flex-wrap gap-2">
                {routines.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { applyRoutine(r); router.push("/settings"); }}
                    className={cn(
                      "ff-press flex items-center gap-2.5 rounded-[var(--r-control)] border border-line-strong/60 px-3.5 h-9 text-[13px] text-ink-2 transition-colors hover:border-ink hover:text-ink",
                      FOCUS_RING
                    )}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color || "currentColor" }} aria-hidden />
                    <span className="font-medium">{r.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink-3">{r.workDuration} min</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentJournal && (
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <Label>Dernière réflexion</Label>
                <span
                  className="h-2 w-2 rounded-full"
                  title={MOODS.find((m) => m.value === recentJournal.mood)?.label}
                  style={{ background: MOODS.find((m) => m.value === recentJournal.mood)?.color }}
                  aria-hidden
                />
              </div>
              {recentJournal.wentWell && <p className="mt-2.5 text-[14px] leading-snug text-ink-2">{recentJournal.wentWell}</p>}
              {recentJournal.blockers && <p className="mt-1.5 text-[14px] leading-snug text-ink-3">{recentJournal.blockers}</p>}
            </div>
          )}

          {showWrapped && (
            <button
              onClick={() => router.push("/wrapped")}
              className={cn("group text-left border-l-2 border-sodium pl-4 py-1", FOCUS_RING)}
            >
              <span className="block font-display text-[17px] text-ink group-hover:underline underline-offset-4">Le relevé de ta semaine est prêt</span>
              <span className="block text-[13px] text-ink-3 mt-1">Meilleur jour, heure de pointe, carte à partager</span>
            </button>
          )}
        </motion.section>
      )}
    </motion.div>
  );
}

/** Squelette au premier rendu : le store persisté n'est pas encore hydraté. */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-12 sm:gap-16" aria-hidden>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="flex gap-12 items-end">
        <Skeleton className="h-[210px] w-[18px]" />
        <Skeleton lines={4} className="flex-1 max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
