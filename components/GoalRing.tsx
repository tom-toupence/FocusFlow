"use client";

import { cn } from "@/lib/utils";
import { GoalProgress, goalUnitLabel } from "@/store/goalStore";
import { useCountUp } from "@/lib/useCountUp";

/** SVG progress ring for the daily focus goal. */
export default function GoalRing({
  progress,
  size = 120,
  stroke = 9,
}: {
  progress: GoalProgress;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // Remplissage animé avec léger overshoot élastique au montage (reduced-motion
  // → valeur finale directe). Le % au centre suit la même animation.
  const animatedRatio = useCountUp(progress.ratio, 900, true);
  const clamped = Math.max(0, Math.min(1, animatedRatio));
  const offset = circ * (1 - clamped);
  const pct = Math.round(Math.min(clamped, progress.ratio) * 100);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-foreground/[0.08]"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={cn(
            // transition-colors seulement : le dashoffset est déjà animé en JS
            // (useCountUp) — une transition CSS par-dessus le ferait traîner.
            "transition-colors duration-700",
            progress.reached ? "text-emerald-400" : "text-violet-400"
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {progress.reached ? (
          <>
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Atteint</span>
          </>
        ) : (
          <>
            <span className="text-2xl font-light text-foreground tabular-nums leading-none">{pct}%</span>
            <span className="text-[10px] text-foreground/40 mt-1 tabular-nums">
              {goalUnitLabel(progress.unit, progress.value)} / {progress.target}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
