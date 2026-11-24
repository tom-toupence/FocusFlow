"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { goalReachable } from "@/lib/agendaFit";
import {
  formatHM, nextHalfHours, parseHM, planFromScratch, suggestStopAt,
  type StopSettings,
} from "@/lib/stopPlan";
import { useGoalStore, goalUnitLabel } from "@/store/goalStore";
import { useStatsStore, getTodayStats } from "@/store/statsStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";

/**
 * « Tu t'arrêtes à quelle heure ? » : heure d'arrêt facultative de la session.
 * Montre les cycles que FocusFlow en déduit, et dit si l'objectif du jour tient.
 * Contrôlé : la valeur (epoch ms ou null) vit dans la page de réglages.
 */
function StopAtPickerInner({
  settings,
  value,
  onChange,
  initialNow,
}: {
  initialNow: number;
  settings: StopSettings;
  value: number | null;
  onChange: (stopAt: number | null) => void;
}) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const entries = usePlayHistoryStore((s) => s.entries);
  const days = useStatsStore((s) => s.days);
  const goalUnit = useGoalStore((s) => s.unit);
  const goalTarget = useGoalStore((s) => s.target);

  const suggestion = suggestStopAt(entries, now);
  const halves = nextHalfHours(now);
  const chips = [...halves];
  if (suggestion != null && !chips.includes(suggestion)) chips.push(suggestion);
  chips.sort((a, b) => a - b);

  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isChip = value != null && chips.includes(value);

  const pick = (ms: number | null) => {
    setError(null);
    setFreeText("");
    onChange(ms);
  };

  const onFree = (text: string) => {
    setFreeText(text);
    if (!text) {
      setError(null);
      onChange(null);
      return;
    }
    let ms = parseHM(text, now);
    if (ms == null) return;
    // Tôt le matin, une heure passée vise demain (travailler tard, arrêt à 00:30).
    if (ms <= now && new Date(ms).getHours() < 6) ms += 24 * 60 * 60_000;
    if (ms <= now) {
      setError("Cette heure est déjà passée.");
      return;
    }
    setError(null);
    onChange(ms);
  };

  const plan = value != null && value > now ? planFromScratch(value, now, settings) : null;
  const work = plan ? plan.cycles.filter((c) => c.mode === "work") : [];
  const last = work[work.length - 1];
  const lastMin = last ? Math.round(last.seconds / 60) : 0;
  const longShortened = plan
    ? plan.cycles.some((c) => c.mode === "long-break" && c.seconds < settings.longBreakDuration * 60)
    : false;

  let sentence = "";
  if (plan) {
    if (work.length === 0) sentence = "Pas assez de temps pour un pomodoro. La session démarrera sans heure d'arrêt.";
    else {
      sentence = `${work.length} pomodoro${work.length > 1 ? "s" : ""} possible${work.length > 1 ? "s" : ""}.`;
      if (lastMin !== settings.workDuration) sentence += ` Le dernier dure ${lastMin} min pour finir pile à ${formatHM(value!)}.`;
      else sentence += ` Le dernier finit à ${formatHM(plan.endsAt)}.`;
      if (longShortened) sentence += " La longue pause est raccourcie.";
    }
  }

  let goalLine: { lead: string; rest: string } | null = null;
  if (plan && work.length > 0) {
    const today = getTodayStats(days);
    const doneToday = goalUnit === "pomodoros" ? today.sessions : today.minutesWorked;
    const lead = `Objectif du jour : ${goalUnitLabel(goalUnit, goalTarget)}.`;
    const r = goalReachable(plan, doneToday, { unit: goalUnit, target: goalTarget });
    if (doneToday >= goalTarget) goalLine = { lead, rest: "Déjà atteint." };
    else if (r.reachable) goalLine = { lead, rest: "Atteignable." };
    else if (r.stopAtNeeded != null) goalLine = { lead, rest: `Atteignable si tu t'arrêtes à ${formatHM(r.stopAtNeeded)}.` };
    else goalLine = { lead, rest: "Pas atteignable aujourd'hui." };
  }

  const span = plan ? Math.max(1, value! - now) : 1;
  const showLabels = work.length <= 12;

  const chipCls = (on: boolean) =>
    cn(
      "h-9 px-3 rounded-lg border font-mono tabular-nums text-sm transition-colors",
      on
        ? "border-focus bg-focus/10 text-foreground"
        : "border-foreground/[0.1] text-foreground/60 hover:border-foreground/25 hover:text-foreground/85",
    );

  return (
    <div data-testid="stop-at">
      <p className="text-xs font-semibold text-foreground/30 font-mono uppercase tracking-[0.14em] mb-3">Heure d&apos;arrêt</p>
      <p className="text-sm font-medium text-foreground mb-3">Tu t&apos;arrêtes à quelle heure ?</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => pick(null)} aria-pressed={value == null} className={cn(chipCls(value == null), "font-sans")}>
          Pas d&apos;heure
        </button>
        {chips.map((ms) => (
          <button
            key={ms}
            type="button"
            onClick={() => pick(ms)}
            aria-pressed={value === ms}
            title={ms === suggestion ? "Ton heure de fin habituelle" : undefined}
            className={chipCls(value === ms)}
          >
            {formatHM(ms)}
            {ms === suggestion && <span className="ml-1.5 font-sans text-[10px] text-foreground/40">habituel</span>}
          </button>
        ))}
        <label className="flex items-center gap-2 text-xs text-foreground/40">
          ou
          <input
            type="time"
            value={freeText || (value != null && !isChip ? formatHM(value) : "")}
            onChange={(e) => onFree(e.target.value)}
            aria-label="Heure d'arrêt libre"
            className="h-9 rounded-lg border border-foreground/[0.1] bg-transparent px-2 font-mono tabular-nums text-sm text-foreground/80 outline-none focus:border-focus"
          />
        </label>
      </div>
      {error && <p role="status" className="mt-2 text-xs text-red-400">{error}</p>}

      {plan && (
        <div className="mt-4 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/35">
            Il est {formatHM(now)}. Jusqu&apos;à {formatHM(value!)}
          </p>
          <div className="relative mt-3 h-9" aria-hidden>
            {plan.cycles.filter((c) => c.mode === "work").map((c) => {
              const isLast = c === last && lastMin !== settings.workDuration;
              return (
                <div
                  key={c.start}
                  className={cn(
                    "absolute top-0 h-full rounded-lg border flex items-center justify-center font-mono text-[10px] tabular-nums",
                    isLast ? "border-focus bg-focus/10 text-foreground" : "border-foreground/[0.12] bg-foreground/[0.04] text-foreground/60",
                  )}
                  style={{ left: `${((c.start - now) / span) * 100}%`, width: `calc(${((c.end - c.start) / span) * 100}% - 3px)` }}
                >
                  {showLabels ? Math.round(c.seconds / 60) : ""}
                </div>
              );
            })}
          </div>
          <p data-testid="stop-sentence" className="mt-3 text-sm text-foreground/60">{sentence}</p>
          {goalLine && (
            <p data-testid="stop-goal" className="mt-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/45">
              <span className="text-foreground">{goalLine.lead}</span> {goalLine.rest}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function StopAtPicker(props: {
  settings: StopSettings;
  value: number | null;
  onChange: (stopAt: number | null) => void;
}) {
  // L'heure et l'historique n'existent qu'au montage : le rendu serveur (autre fuseau,
  // stores non relus) ne doit pas servir de base à l'hydratation.
  const [now, setNow] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);
  if (now == null) {
    return (
      <div data-testid="stop-at">
        <p className="text-xs font-semibold text-foreground/30 font-mono uppercase tracking-[0.14em] mb-3">Heure d&apos;arrêt</p>
        <p className="text-sm font-medium text-foreground mb-3">Tu t&apos;arrêtes à quelle heure ?</p>
        <div className="h-9" />
      </div>
    );
  }
  return <StopAtPickerInner {...props} initialNow={now} />;
}
