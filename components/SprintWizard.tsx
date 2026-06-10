"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSprintStore, getSprintStatus } from "@/store/sprintStore";
import { usePlanStore, formatMinOfDay } from "@/store/planStore";
import { localToday } from "@/store/statsStore";
import { moodLabels } from "@/data/videos";
import {
  requestSprintPlan, localSprintPlan, applySprintPlan,
  launchSprintSession, recalcSprint, endSprint, type SprintPlan,
} from "@/lib/sprint";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

export default function SprintWizard() {
  const router = useRouter();
  const { sprint } = useSprintStore();
  const { blocks } = usePlanStore();

  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState("");
  const [deadline, setDeadline] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [startTime, setStartTime] = useState("09:00");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<SprintPlan | null>(null);

  const startMin = (() => {
    const [h, m] = startTime.split(":").map(Number);
    return (h || 9) * 60 + (m || 0);
  })();

  const canGenerate = objective.trim().length >= 3 && deadline >= localToday();

  const generate = async (forceLocal = false) => {
    if (!canGenerate) return;
    setLoading(true);
    const p = forceLocal
      ? localSprintPlan(objective.trim(), deadline, dailyMinutes, startMin)
      : await requestSprintPlan(objective.trim(), deadline, dailyMinutes, startMin);
    setPlan(p);
    setLoading(false);
  };

  const validate = () => {
    if (!plan) return;
    applySprintPlan(plan, objective.trim(), deadline, dailyMinutes, startMin);
    setOpen(false);
    setPlan(null);
    setObjective("");
    toast({
      title: "Sprint lancé 🏃",
      description: `${plan.days.length} bloc${plan.days.length > 1 ? "s" : ""} planifié${plan.days.length > 1 ? "s" : ""} jusqu'au ${deadline}. Pense à la synchro calendrier !`,
      emoji: "🎯",
      accent: "emerald",
    });
  };

  // ── Active sprint card ─────────────────────────────────────────────────────
  if (sprint) {
    const st = getSprintStatus(sprint, blocks);
    return (
      <section className="rounded-2xl border border-foreground/[0.08] bg-gradient-to-br from-rose-500/[0.06] to-transparent p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-1">
              Sprint en cours · {st.overdue ? "deadline dépassée ⚠️" : `J-${st.daysLeft}`}
            </p>
            <h2 className="text-base font-semibold text-foreground leading-snug">{sprint.objective}</h2>
            <p className="text-xs text-foreground/40 mt-0.5">
              Échéance {new Date(sprint.deadline + "T00:00:00").toLocaleDateString("fr", DAY_FMT)} · mood {moodLabels[sprint.mood]}
            </p>
          </div>
          <span className="text-xs text-foreground/50 tabular-nums flex-shrink-0">
            {st.blocksDone}/{st.blocksTotal} blocs
          </span>
        </div>

        <div className="h-2 rounded-full bg-foreground/[0.06] overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-rose-400 transition-all"
            style={{ width: `${st.blocksTotal > 0 ? (st.blocksDone / st.blocksTotal) * 100 : 0}%` }}
          />
        </div>

        {st.missed > 0 && (
          <p className="text-xs text-amber-500/90 mb-3">
            ⚠️ {st.missed} bloc{st.missed > 1 ? "s" : ""} manqué{st.missed > 1 ? "s" : ""} — recalcule le plan pour redistribuer le travail.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {st.todayBlock && (
            <button
              onClick={() => {
                launchSprintSession(sprint, st.todayBlock!.durationMin);
                router.push("/session");
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all shadow-lg shadow-black/20"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Go — bloc de {formatMinOfDay(st.todayBlock.startMin)} ({st.todayBlock.durationMin} min)
            </button>
          )}
          {st.missed > 0 && (
            <button
              onClick={() => { recalcSprint(sprint); toast({ title: "Plan recalculé", description: "Le travail restant a été redistribué.", emoji: "🔄" }); }}
              className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium transition-all"
            >
              Recalculer le plan
            </button>
          )}
          <button
            onClick={() => { endSprint(sprint); toast({ title: "Sprint terminé", description: "Les blocs restants ont été retirés du planning.", emoji: "🏁" }); }}
            className="px-4 py-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground/60 text-xs font-medium transition-all"
          >
            Terminer le sprint
          </button>
        </div>
      </section>
    );
  }

  // ── No sprint: CTA + wizard modal ──────────────────────────────────────────
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sprint deadline</h2>
          <p className="text-xs text-foreground/40 mt-0.5">
            Un objectif + une date limite → le coach planifie tes blocs jour par jour.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-300 text-xs font-semibold transition-all"
        >
          🏃 Nouveau sprint
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="bg-background border border-foreground/10 rounded-2xl shadow-2xl shadow-black/20 w-full max-w-lg p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-sm font-semibold text-foreground">🏃 Nouveau sprint</h2>
              <p className="text-xs text-foreground/45 mt-1 leading-relaxed">
                Le coach répartit le travail jusqu&apos;à ta deadline : blocs dans le planning
                (→ ton calendrier si la synchro est active), tâches dans le Kanban, et une ambiance adaptée.
              </p>
            </div>

            {/* Form */}
            <div className="flex flex-col gap-3">
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ton objectif… (ex. « Préparer l'examen de droit du 25 juin »)"
                rows={2}
                className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25 resize-none"
              />
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-foreground/35 uppercase tracking-wider">Deadline</span>
                  <input
                    type="date"
                    min={localToday()}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="bg-foreground/5 border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-foreground/35 uppercase tracking-wider">Min/jour</span>
                  <select
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(parseInt(e.target.value))}
                    className="bg-foreground/5 border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none"
                  >
                    {[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-foreground/35 uppercase tracking-wider">Heure</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-foreground/5 border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none"
                  />
                </label>
              </div>
              <button
                onClick={() => generate()}
                disabled={!canGenerate || loading}
                className="py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 disabled:opacity-30 transition-all"
              >
                {loading ? "Le coach réfléchit…" : plan ? "Régénérer le plan" : "Générer le plan"}
              </button>
            </div>

            {/* Preview */}
            {plan && !loading && (
              <div className="flex flex-col gap-3 border-t border-foreground/[0.08] pt-4">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest">Plan proposé</p>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                    plan.source === "ai" ? "bg-violet-500/15 text-violet-400" : "bg-foreground/10 text-foreground/40"
                  )}>
                    {plan.source === "ai" ? "✨ IA" : "local"}
                  </span>
                  <span className="ml-auto text-[10px] text-foreground/35">mood : {moodLabels[plan.mood] ?? plan.mood}</span>
                </div>

                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                  {plan.days.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-foreground/[0.04] text-xs">
                      <span className="text-foreground/45 w-20 flex-shrink-0 capitalize">
                        {new Date(d.date + "T00:00:00").toLocaleDateString("fr", DAY_FMT)}
                      </span>
                      <span className="text-foreground/35 tabular-nums flex-shrink-0">{formatMinOfDay(d.startMin)}</span>
                      <span className="flex-1 text-foreground/75 truncate">{d.label}</span>
                      <span className="text-foreground/30 flex-shrink-0">{d.durationMin}m</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {plan.tasks.map((t, i) => (
                    <span key={i} className="text-[11px] px-2 py-1 rounded-lg bg-foreground/[0.05] text-foreground/60">
                      {t.text} <span className="text-foreground/30">×{t.pomodoroEstimate}🍅</span>
                    </span>
                  ))}
                </div>

                <button
                  onClick={validate}
                  className="py-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-600 dark:text-emerald-300 text-sm font-semibold transition-all"
                >
                  ✓ Valider — ajouter au planning et au Kanban
                </button>
              </div>
            )}

            <button onClick={() => setOpen(false)} className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
