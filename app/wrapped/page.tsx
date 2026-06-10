"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStatsStore } from "@/store/statsStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";
import { useAchievementsStore } from "@/store/achievementsStore";
import { useJournalStore, MOODS } from "@/store/journalStore";
import { useDistractionStore } from "@/store/distractionStore";
import { useWrappedStore } from "@/store/wrappedStore";
import { computeWrapped, formatWrappedMinutes, wrappedWeekLabel } from "@/lib/wrapped";
import WrappedShareCard from "@/components/WrappedShareCard";
import { cn } from "@/lib/utils";

function Panel({
  label,
  value,
  sub,
  className,
  big = false,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
  big?: boolean;
}) {
  return (
    <div className={cn("flex flex-col justify-end gap-1 p-6 rounded-3xl border border-foreground/[0.08] overflow-hidden relative", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-widest opacity-50">{label}</span>
      <span className={cn("font-extralight tracking-tight tabular-nums", big ? "text-6xl" : "text-4xl")}>{value}</span>
      {sub && <span className="text-xs opacity-50 leading-snug">{sub}</span>}
    </div>
  );
}

export default function WrappedPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [weekOffset, setWeekOffset] = useState(-1);

  const { days } = useStatsStore();
  const { entries: history } = usePlayHistoryStore();
  const { unlocked } = useAchievementsStore();
  const { entries: journal } = useJournalStore();
  const { byDate: distractions } = useDistractionStore();
  const { markSeen } = useWrappedStore();

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const data = mounted
    ? computeWrapped(weekOffset, days, history, unlocked, journal, distractions)
    : null;

  // Opening the recap of the last completed week dismisses the dashboard banner
  useEffect(() => {
    if (mounted && weekOffset === -1 && data) markSeen(data.weekStart);
  }, [mounted, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const moodEmoji = data?.avgMood != null
    ? MOODS[Math.min(4, Math.max(0, Math.round(data.avgMood) - 1))].emoji
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 flex items-center px-6 border-b border-foreground/[0.06]">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-foreground/40 hover:text-foreground/80 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Retour
        </button>
        <span className="text-sm font-semibold text-foreground/80 tracking-tight mx-auto">Ma semaine</span>
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setWeekOffset(-1)}
            className={cn("px-2.5 py-1 rounded-lg transition-colors", weekOffset === -1 ? "bg-foreground/10 text-foreground" : "text-foreground/35 hover:text-foreground/60")}
          >
            Passée
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={cn("px-2.5 py-1 rounded-lg transition-colors", weekOffset === 0 ? "bg-foreground/10 text-foreground" : "text-foreground/35 hover:text-foreground/60")}
          >
            En cours
          </button>
        </div>
      </header>

      {!data ? null : (
        <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
          {/* Title */}
          <div>
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-1">
              {weekOffset === -1 ? "Ta semaine passée" : "Semaine en cours"} · {wrappedWeekLabel(data)}
            </p>
            <h1 className="text-3xl font-light text-foreground tracking-tight">
              {data.minutes > 0 ? "Voilà ce que tu as accompli ✨" : "Une semaine calme…"}
            </h1>
          </div>

          {/* Hero + grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Panel
              label="Temps de focus"
              value={formatWrappedMinutes(data.minutes)}
              sub={
                data.deltaPct !== null
                  ? `${data.deltaPct >= 0 ? "+" : ""}${data.deltaPct}% vs semaine précédente`
                  : "première semaine mesurée"
              }
              big
              className="col-span-2 md:col-span-2 row-span-2 min-h-56 bg-gradient-to-br from-violet-600/30 via-violet-900/20 to-transparent text-foreground"
            />
            <Panel label="Sessions" value={String(data.sessions)} className="bg-foreground/[0.04] text-foreground" />
            <Panel label="Jours actifs" value={`${data.activeDays}/7`} className="bg-foreground/[0.04] text-foreground" />
            <Panel
              label="Meilleur jour"
              value={data.bestDay?.label ?? "—"}
              sub={data.bestDay ? formatWrappedMinutes(data.bestDay.minutes) : undefined}
              className="bg-gradient-to-br from-emerald-600/25 to-transparent text-foreground"
            />
            <Panel
              label="Heure de pointe"
              value={data.peakHour !== null ? `${data.peakHour}h` : "—"}
              className="bg-gradient-to-br from-sky-600/25 to-transparent text-foreground"
            />
          </div>

          {/* Top play */}
          {data.topPlay && (
            <div className="flex items-center gap-4 p-5 rounded-3xl border border-foreground/[0.08] bg-foreground/[0.03]">
              {data.topPlay.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.topPlay.thumbnailUrl} alt="" className="w-20 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-20 h-14 rounded-xl bg-foreground/10 flex items-center justify-center flex-shrink-0 text-xl">🎵</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest mb-0.5">Ambiance préférée</p>
                <p className="text-sm font-medium text-foreground truncate">{data.topPlay.title}</p>
                <p className="text-xs text-foreground/40 truncate">{data.topPlay.subtitle}</p>
              </div>
              <span className="text-sm text-foreground/50 tabular-nums flex-shrink-0">
                {formatWrappedMinutes(data.topPlay.totalMinutes)}
              </span>
            </div>
          )}

          {/* Badges + mood + distractions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-5 rounded-3xl border border-foreground/[0.08] bg-gradient-to-br from-amber-600/15 to-transparent">
              <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest mb-2">Badges débloqués</p>
              {data.badges.length === 0 ? (
                <p className="text-sm text-foreground/30">Aucun cette semaine</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.badges.map((b) => (
                    <p key={b.id} className="text-sm text-foreground">
                      {b.emoji} <span className="font-medium">{b.title}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
            <Panel
              label="Humeur moyenne"
              value={data.avgMood !== null ? `${moodEmoji} ${data.avgMood.toFixed(1)}` : "—"}
              sub={data.avgMood !== null ? "d'après ton journal" : "pas de réflexion notée"}
              className="bg-foreground/[0.04] text-foreground"
            />
            <Panel
              label="Distractions"
              value={String(data.distractions)}
              sub={data.distractions === 0 && data.sessions > 0 ? "focus parfait 🔥" : "marquées pendant le focus"}
              className="bg-foreground/[0.04] text-foreground"
            />
          </div>

          {/* Share */}
          <div className="flex flex-col items-center gap-2 pt-2 pb-8">
            <WrappedShareCard data={data} />
            <p className="text-[11px] text-foreground/25">Image 1080×1350 générée en local — rien n&apos;est envoyé en ligne.</p>
          </div>
        </main>
      )}
    </div>
  );
}
