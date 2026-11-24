"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useTimerStore, type TimerMode } from "@/store/timerStore";
import { remainingSeconds, formatClock } from "@/lib/timerClock";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<TimerMode, string> = {
  work: "Focus",
  "short-break": "Pause",
  "long-break": "Longue pause",
};

const HIDDEN_ON = ["/session", "/summary"];

/** Raccourci vers la session en cours, visible partout sauf sur la session et son résumé. */
export default function SessionReturnPill() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const active = useTimerStore((s) => s.active);
  const mode = useTimerStore((s) => s.mode);
  const isRunning = useTimerStore((s) => s.isRunning);
  const endsAt = useTimerStore((s) => s.endsAt);
  const secondsLeft = useTimerStore((s) => s.secondsLeft);
  const flowSeconds = useTimerStore((s) => s.flowSeconds);
  const flowStartedAt = useTimerStore((s) => s.flowStartedAt);
  const flowtime = useTimerStore((s) => s.settings.preset === "flowtime");

  const visible = mounted && active && !HIDDEN_ON.includes(pathname);

  // Rafraîchi chaque seconde, seulement quand la pastille est affichée.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible || !isRunning) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible, isRunning]);

  if (!visible) return null;

  const isFlowWork = flowtime && mode === "work";
  let shown: number;
  if (isFlowWork) {
    shown = isRunning && flowStartedAt != null ? Math.max(0, Math.floor((now - flowStartedAt) / 1000)) : flowSeconds;
  } else {
    shown = isRunning && endsAt != null ? remainingSeconds(endsAt, now) : secondsLeft;
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed z-40 left-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:left-24 md:bottom-4"
    >
      <Link
        href="/session"
        aria-label="Retour à la session en cours"
        className="flex items-center gap-3 rounded-xl border border-foreground/[0.12] bg-card px-3.5 py-2.5 shadow-lg transition-colors hover:bg-foreground/[0.06] active:scale-[0.98]"
      >
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-focus", isRunning && "motion-safe:animate-pulse")}
        />
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-medium text-foreground">Session en cours</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/35">
            {isRunning ? MODE_LABEL[mode] : `${MODE_LABEL[mode]}, en pause`}
          </span>
        </span>
        <span className="font-mono text-[15px] tabular-nums text-focus">{formatClock(shown)}</span>
      </Link>
    </motion.div>
  );
}
