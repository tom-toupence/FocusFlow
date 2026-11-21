"use client";

// Objectif du jour, version Clepsydre : la COLONNE d'eau du jour face à sa
// marque gravée. Le nom « GoalRing » est conservé pour ne pas toucher aux
// appelants (résumé, statistiques, accueil) ; ce n'est plus un anneau.
// La colonne est graduée pour que l'objectif tombe aux 4/5 : on voit le
// dépassement (« bonus ») sans que l'eau sorte du tube.
import { Gauge } from "@/components/ff/Gauge";
import { GoalProgress, goalUnitLabel } from "@/store/goalStore";
import { cn } from "@/lib/utils";

export default function GoalRing({
  progress,
  size = 120,
  className,
}: {
  progress: GoalProgress;
  size?: number;
  /** Conservé pour compatibilité, ignoré (la colonne a son épaisseur). */
  stroke?: number;
  className?: string;
}) {
  const capacity = Math.max(progress.target * 1.25, progress.value, 1);
  const value = progress.value / capacity;
  const mark = progress.target / capacity;
  const pct = Math.round(progress.ratio * 100);
  const unit = goalUnitLabel(progress.unit, progress.value);
  return (
    <div className={cn("inline-flex items-end gap-4", className)}>
      <Gauge
        label="Objectif du jour"
        valueText={`${unit} sur ${progress.target}${progress.reached ? ", objectif atteint" : ""}`}
        value={value}
        mark={mark}
        length={size}
        thickness={14}
        ticks={20}
        majorEvery={4}
        reflet
      />
      <div className="pb-0.5">
        <p className={cn("font-mono text-[28px] leading-none tabular-nums tracking-tight", progress.reached ? "text-sodium-text" : "text-ink")}>
          {progress.reached ? "Atteint" : `${pct} %`}
        </p>
        <p className="mt-2 font-mono text-[12px] tabular-nums text-ink-3">
          {unit} / {progress.target}
        </p>
      </div>
    </div>
  );
}
