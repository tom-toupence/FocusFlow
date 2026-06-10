"use client";

import { useStatsStore } from "@/store/statsStore";
import { useAchievementsStore } from "@/store/achievementsStore";
import { totalXp, getLevelInfo, getWeeklyChallenges, getGarden, Plant } from "@/lib/progression";
import { cn } from "@/lib/utils";

// ── Plant glyph ────────────────────────────────────────────────────────────────

function PlantGlyph({ plant }: { plant: Plant | null }) {
  if (!plant) {
    return (
      <div className="flex flex-col items-center justify-end h-12">
        <div className="w-6 h-1.5 rounded-full bg-foreground/[0.06]" />
      </div>
    );
  }
  const emoji = plant.stage === 3 ? "🌳" : plant.stage === 2 ? "🌷" : plant.stage === 1 ? "🌱" : "•";
  const size = plant.stage === 3 ? "text-2xl" : plant.stage === 2 ? "text-xl" : "text-base";
  return (
    <div className="flex flex-col items-center justify-end h-12">
      <span className={cn(size, "leading-none")}>{emoji}</span>
      <div className="w-6 h-1.5 rounded-full bg-emerald-900/40 mt-0.5" />
    </div>
  );
}

export default function ProgressionPanel() {
  const { days } = useStatsStore();
  const { unlocked } = useAchievementsStore();

  const xp = totalXp(days, Object.keys(unlocked).length);
  const level = getLevelInfo(xp);
  const challenges = getWeeklyChallenges(days);
  const garden = getGarden(days);
  const dayLetters = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* ── Level & XP ─────────────────────────────────────────────────────── */}
      <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-violet-200 tabular-nums">{level.level}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Niveau {level.level} · {level.title}</p>
            <p className="text-xs text-foreground/40">{level.xp.toLocaleString("fr-FR")} XP au total</p>
          </div>
        </div>
        <div>
          <div className="h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-700"
              style={{ width: `${Math.round(level.progress * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-foreground/30 mt-1.5 text-right tabular-nums">
            {level.xpInLevel} / {level.xpForNext} XP → niveau {level.level + 1}
          </p>
        </div>
        <p className="text-[10px] text-foreground/30 leading-relaxed">
          Tu gagnes de l&apos;XP à chaque pomodoro, minute de focus, succès débloqué et jour de série.
        </p>
      </div>

      {/* ── Focus garden ──────────────────────────────────────────────────── */}
      <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">Jardin de focus</p>
          <span className="text-[10px] text-foreground/30">cette semaine</span>
        </div>
        <div className="flex items-end justify-between gap-1 flex-1">
          {garden.map((plant, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <PlantGlyph plant={plant} />
              <span className="text-[9px] text-foreground/25">{dayLetters[i]}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-foreground/30 leading-relaxed">
          Chaque jour de focus fait pousser une plante : 🌱 dès 25 min, 🌷 dès 1 h, 🌳 dès 2 h.
        </p>
      </div>

      {/* ── Weekly challenges ─────────────────────────────────────────────── */}
      <div className="lg:col-span-2 bg-foreground/[0.03] border border-foreground/[0.06] rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Défis de la semaine</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {challenges.map((c) => (
            <div key={c.id} className={cn(
              "rounded-xl p-3 border",
              c.done ? "bg-emerald-500/[0.07] border-emerald-500/20" : "bg-foreground/[0.02] border-foreground/[0.06]"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{c.emoji}</span>
                <span className="text-[11px] text-foreground/60 leading-tight flex-1">{c.label}</span>
                {c.done && <span className="text-emerald-400 text-xs">✓</span>}
              </div>
              <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", c.done ? "bg-emerald-400" : "bg-foreground/40")}
                  style={{ width: `${(c.current / c.target) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-foreground/30 mt-1 tabular-nums">{c.current} / {c.target}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
