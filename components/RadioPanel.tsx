"use client";

// Onglet « Radio » de la section Écouter : ce qui passe en ce moment sur la
// Radio FocusFlow, la suite du programme, et « Rejoindre et lancer un focus ».
// Le programme se calcule à partir de l'heure (lib/radioProgram.ts) : même
// écran pour tout le monde au même instant, sans serveur.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useFriendsStore } from "@/store/friendsStore";
import { catalogueRadio, clockLabel, durationLabel, isListeningToRadio, radioUpcoming, sessionDeadIds, RADIO_NAME } from "@/lib/radioProgram";
import { joinRadio } from "@/lib/radioSession";

const EASE = [0.22, 1, 0.36, 1] as const;

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/35", className)}>{children}</p>;
}

/** Amis qui écoutent la radio en ce moment : activité publiée par /session ET
 *  heartbeat de focus frais (une fermeture brutale ne vide pas `activity`). */
function RadioFriends({ now }: { now: number }) {
  const { friends, loaded } = useFriendsStore();
  if (!supabase || !loaded) return null;
  const listening = friends.filter((f) => isListeningToRadio(f.stats, now));
  if (listening.length === 0) return null;
  return (
    <div className="mt-5" data-testid="radio-friends">
      <p className="text-sm text-foreground/60">
        {listening.length === 1 ? "1 ami écoute en ce moment" : `${listening.length} amis écoutent en ce moment`}
      </p>
      <div className="mt-2 flex -space-x-1.5">
        {listening.slice(0, 6).map((f) => (
          <span
            key={f.userId}
            title={f.displayName}
            className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-foreground/10 text-[10px] font-semibold text-foreground/70"
          >
            {f.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              f.displayName.charAt(0).toUpperCase()
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RadioPanel() {
  const router = useRouter();
  const reduce = useReducedMotion();
  // Heure courante : null avant le montage (le programme dépend de l'heure du
  // client, jamais calculé au rendu serveur).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden>
        <span className="anim-skeleton block h-72 rounded-2xl bg-foreground/[0.04]" />
        <span className="anim-skeleton block h-72 rounded-2xl bg-foreground/[0.04]" />
      </div>
    );
  }

  const radio = catalogueRadio();
  const slot = radio.nowPlaying(now);
  if (!slot) return null;
  const next = radioUpcoming(radio, slot.index, 4, sessionDeadIds);
  const elapsed = Math.min(slot.segmentSec, Math.max(0, (now - slot.startsAt) / 1000));
  const pct = slot.segmentSec > 0 ? (elapsed / slot.segmentSec) * 100 : 0;
  const t = slot.track;

  const rise = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0.2 : 0.5, ease: EASE } },
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">{RADIO_NAME}</h1>
        <p className="text-foreground/40 mt-1 text-sm">Tout le monde entend la même vidéo, au même moment.</p>
      </div>

      <motion.div
        className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: reduce ? 0 : 0.08 }}
      >
        {/* En direct */}
        <motion.section variants={rise} aria-label="En direct" className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-6 sm:p-7">
          <Label className="flex items-center gap-2">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-focus" aria-hidden />
            En direct · {RADIO_NAME}
          </Label>

          <div className="mt-5 flex flex-col gap-5 sm:flex-row">
            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-foreground/[0.05] sm:w-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={t.youtubeId} src={`https://img.youtube.com/vi/${t.youtubeId}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
            </div>
            <div className="min-w-0 flex-1">
              <p data-testid="radio-now-title" className="text-lg font-medium leading-snug text-foreground">{t.title}</p>
              <p className="mt-0.5 text-sm text-foreground/45">{t.channel}</p>
              <div
                className="mt-5 h-1 overflow-hidden rounded-full bg-foreground/[0.1]"
                role="progressbar"
                aria-label="Progression du titre"
                aria-valuemin={0}
                aria-valuemax={slot.segmentSec}
                aria-valuenow={Math.floor(elapsed)}
              >
                <div className="h-full rounded-full bg-focus motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[11px] tabular-nums text-foreground/40">
                <span>{durationLabel(elapsed)}</span>
                <span>{durationLabel(slot.segmentSec)}</span>
              </div>
              <RadioFriends now={now} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <motion.button
              whileTap={reduce ? undefined : { scale: 0.97 }}
              onClick={() => joinRadio(router)}
              className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Rejoindre et lancer un focus
            </motion.button>
          </div>
        </motion.section>

        {/* Programme */}
        <motion.section variants={rise} aria-label="Programme" className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-6 sm:p-7">
          <Label>Programme</Label>
          <ol className="mt-4 space-y-3" data-testid="radio-programme">
            <li className="flex gap-4 text-sm">
              <span className="w-20 shrink-0 font-mono text-[11px] leading-5 text-foreground/40">Maintenant</span>
              <span className="min-w-0 truncate text-foreground">{t.title}</span>
            </li>
            {next.map((s) => (
              <li key={s.index} className="flex gap-4 text-sm">
                <span className="w-20 shrink-0 font-mono text-[11px] leading-5 tabular-nums text-foreground/40">{clockLabel(s.startsAt)}</span>
                <span className="min-w-0 truncate text-foreground/60">{s.track.title}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs leading-relaxed text-foreground/35">Le même programme pour tout le monde, calculé à partir de l&apos;heure.</p>
        </motion.section>
      </motion.div>
    </>
  );
}
