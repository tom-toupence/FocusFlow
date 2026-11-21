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

/** Un relevé sous filet : libellé, valeur, précision. Pas de carte en dégradé. */
function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "taxi" }) {
  return (
    <div className="border-t border-line pt-3">
      <p className="font-mono uppercase tracking-[0.14em] text-[11px] text-ink-3">{label}</p>
      <p className={cn("mt-1 font-display text-4xl leading-none", accent === "taxi" ? "text-taxi" : "text-foreground")}>{value}</p>
      {sub && <p className="mt-1.5 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

const DAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

/** Les soirs allumés : une tour par jour, un étage par tranche de 25 min. */
function Evenings({ perDay }: { perDay: number[] }) {
  const max = Math.max(1, ...perDay);
  const best = perDay.some((m) => m > 0) ? perDay.indexOf(Math.max(...perDay)) : -1;
  const floors = 10;
  return (
    <div className="grid grid-cols-7 gap-2 sm:gap-4" role="img" aria-label={`Focus par jour : ${perDay.map((m, i) => `${["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][i]} ${m} min`).join(", ")}`}>
      {perDay.map((m, d) => {
        const lit = m > 0 ? Math.max(1, Math.round((m / max) * floors)) : 0;
        return (
          <div key={d} className="flex flex-col items-center gap-2">
            <div className="w-full flex flex-col-reverse gap-[3px]">
              {Array.from({ length: floors }, (_, f) => (
                <span
                  key={f}
                  className={cn("h-2.5 rounded-[1px]", f < lit ? (d === best && f === lit - 1 ? "bg-taxi" : "bg-konbini") : "bg-surface-2")}
                />
              ))}
            </div>
            <span className="font-mono text-[11px] text-ink-3">{DAY_SHORT[d]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function WrappedPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 flex items-center px-6 border-b border-foreground/[0.06]">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Retour
        </button>
        <span className="text-sm font-semibold text-ink tracking-tight mx-auto">Ma semaine</span>
        <div className="w-16" />
      </header>

      <WrappedContent />
    </div>
  );
}

export function WrappedContent() {
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

  const moodLabel = data?.avgMood != null
    ? MOODS[Math.min(4, Math.max(0, Math.round(data.avgMood) - 1))].label
    : null;

  if (!data) return null;

  return (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-10">
          {/* Title */}
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[13px] font-semibold text-ink-3 mb-1">
                {weekOffset === -1 ? "Ta semaine passée" : "Semaine en cours"} · {wrappedWeekLabel(data)}
              </p>
              <h1 className="text-3xl sm:text-4xl text-foreground">
                {data.minutes > 0 ? "Voilà ce que tu as accompli" : "Une semaine calme"}
              </h1>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setWeekOffset(-1)}
                className={cn("px-2.5 py-1 rounded-[4px] transition-colors", weekOffset === -1 ? "bg-foreground/10 text-foreground" : "text-ink-3 hover:text-ink-2")}
              >
                Passée
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className={cn("px-2.5 py-1 rounded-[4px] transition-colors", weekOffset === 0 ? "bg-foreground/10 text-foreground" : "text-ink-3 hover:text-ink-2")}
              >
                En cours
              </button>
            </div>
          </div>

          {/* Le temps de focus sur le panneau à points. */}
          <div className="rounded-[4px] bg-[#05070a] border border-white/10 px-5 sm:px-7 py-5 sm:py-6">
            <p className="font-led text-sodium text-5xl sm:text-7xl leading-none [text-shadow:0_0_14px_rgba(255,154,60,0.4)]">
              {formatWrappedMinutes(data.minutes)}
            </p>
            <p className="mt-3 text-sm text-white/70">
              de focus{data.deltaPct !== null ? `, ${data.deltaPct >= 0 ? "+" : ""}${data.deltaPct} % sur la semaine d'avant` : ", première semaine mesurée"}
            </p>
          </div>

          <section aria-labelledby="soirs">
            <h2 id="soirs" className="text-lg mb-4">Les soirs allumés</h2>
            <Evenings perDay={data.perDay} />
          </section>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
            <Stat label="Sessions" value={String(data.sessions)} />
            <Stat label="Soirs actifs" value={`${data.activeDays} / 7`} />
            <Stat label="Meilleur soir" value={data.bestDay?.label ?? "aucun"} sub={data.bestDay ? formatWrappedMinutes(data.bestDay.minutes) : undefined} accent={data.bestDay ? "taxi" : undefined} />
            <Stat label="Heure de pointe" value={data.peakHour !== null ? `${data.peakHour} h` : "aucune"} />
            <Stat label="Humeur moyenne" value={data.avgMood !== null ? data.avgMood.toFixed(1) : "aucune"} sub={data.avgMood !== null ? moodLabel ?? undefined : "pas de réflexion notée"} />
            <Stat label="Distractions" value={String(data.distractions)} sub={data.distractions === 0 && data.sessions > 0 ? "rue calme" : "marquées pendant le focus"} />
            <div className="col-span-2 border-t border-line pt-3">
              <p className="font-mono uppercase tracking-[0.14em] text-[11px] text-ink-3">Badges débloqués</p>
              <p className="mt-1.5 text-sm text-foreground">{data.badges.length ? data.badges.map((b) => b.title).join(", ") : <span className="text-ink-3">Aucun cette semaine</span>}</p>
            </div>
          </div>

          {data.topPlay && (
            <div className="flex items-center gap-4 border-t border-line pt-4">
              {data.topPlay.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.topPlay.thumbnailUrl} alt="" className="w-20 h-12 rounded-[3px] object-cover flex-shrink-0" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-mono uppercase tracking-[0.14em] text-[11px] text-ink-3">Ce qui jouait derrière</p>
                <p className="mt-1 text-sm font-medium text-foreground truncate">{data.topPlay.title}</p>
                <p className="text-xs text-ink-3 truncate">{data.topPlay.subtitle}</p>
              </div>
              <span className="text-sm text-ink-3 tabular-nums flex-shrink-0">{formatWrappedMinutes(data.topPlay.totalMinutes)}</span>
            </div>
          )}

          {/* Share */}
          <div className="flex flex-col items-center gap-2 pt-2 pb-8">
            <WrappedShareCard data={data} />
            <p className="text-[11px] text-ink-3">Image 1080×1350 générée en local, rien n&apos;est envoyé en ligne.</p>
          </div>
        </main>
  );
}
