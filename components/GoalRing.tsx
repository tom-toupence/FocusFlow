"use client";

import { cn } from "@/lib/utils";
import { GoalProgress, goalUnitLabel } from "@/store/goalStore";

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
  const offset = circ * (1 - progress.ratio);
  const pct = Math.round(progress.ratio * 100);

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
            "transition-all duration-700",
            progress.reached ? "text-emerald-400" : "text-violet-400"
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {progress.reached ? (
          <>
            <span className="text-emerald-400 text-lg">✦</span>
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
