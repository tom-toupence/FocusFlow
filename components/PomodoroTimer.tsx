"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTimerStore, TimerMode } from "@/store/timerStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modeLabels: Record<TimerMode, string> = {
  work: "Focus",
  "short-break": "Courte pause",
  "long-break": "Longue pause",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function ProgressRing({ progress, mode }: { progress: number; mode: TimerMode }) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const color =
    mode === "work" ? "#f87171" : mode === "short-break" ? "#4ade80" : "#60a5fa";

  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
      <circle
        cx="100" cy="100" r={radius}
        fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

export default function PomodoroTimer() {
  const { mode, secondsLeft, isRunning, sessionsCompleted, settings, setMode, tick, start, pause, reset, nextSession } = useTimerStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSecondsRef = useRef(secondsLeft);

  const handleSessionEnd = useCallback(() => {
    if (typeof window !== "undefined" && Notification.permission === "granted") {
      new Notification("FocusFlow", {
        body: mode === "work" ? "Session terminée ! Pause en cours." : "Pause terminée ! C'est reparti.",
        icon: "/favicon.ico",
      });
    }
    nextSession(true);
  }, [mode, nextSession]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, tick]);

  useEffect(() => {
    if (prevSecondsRef.current > 0 && secondsLeft === 0) handleSessionEnd();
    prevSecondsRef.current = secondsLeft;
  }, [secondsLeft, handleSessionEnd]);

  useEffect(() => {
    if (typeof window !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const totalSeconds = mode === "work" ? settings.workDuration * 60 : mode === "short-break" ? settings.shortBreakDuration * 60 : settings.longBreakDuration * 60;
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;

  const accentColor = mode === "work" ? "text-red-400" : mode === "short-break" ? "text-green-400" : "text-blue-400";
  const btnColor = mode === "work" ? "bg-red-500 hover:bg-red-400" : mode === "short-break" ? "bg-green-500 hover:bg-green-400" : "bg-blue-500 hover:bg-blue-400";

  return (
    <div className="flex flex-col items-center gap-7">
      {/* Mode tabs */}
      <div className="flex items-center rounded-xl bg-white/5 p-1 gap-0.5">
        {(["work", "short-break", "long-break"] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              mode === m
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/40 hover:text-white/70"
            )}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>

      {/* Ring */}
      <div className="relative w-56 h-56 flex items-center justify-center">
        <ProgressRing progress={progress} mode={mode} />
        <div className="flex flex-col items-center z-10 select-none">
          <span className={cn("text-6xl font-thin tabular-nums tracking-tight", accentColor)}>
            {formatTime(secondsLeft)}
          </span>
          <span className="text-white/40 text-xs mt-2 font-medium uppercase tracking-widest">
            {modeLabels[mode]}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={reset}
          className="rounded-xl text-white/40 hover:text-white hover:bg-white/10 w-10 h-10"
          title="Réinitialiser"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
            <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Button>

        <button
          onClick={isRunning ? pause : start}
          className={cn(
            "w-28 h-10 rounded-xl font-medium text-sm text-white transition-all duration-200 shadow-lg",
            isRunning ? "bg-white/10 hover:bg-white/15" : btnColor
          )}
        >
          {isRunning ? "Pause" : "Démarrer"}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => nextSession()}
          className="rounded-xl text-white/40 hover:text-white hover:bg-white/10 w-10 h-10"
          title="Session suivante"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
            <path d="M5 4l15 8-15 8V4z" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="19" y1="4" x2="19" y2="20" strokeLinecap="round"/>
          </svg>
        </Button>
      </div>

      {/* Session dots */}
      <div className="flex items-center gap-2">
        {Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i < sessionsCompleted % settings.sessionsBeforeLongBreak
                ? "bg-red-400 scale-110"
                : "bg-white/10"
            )}
          />
        ))}
        <span className="text-white/30 text-xs ml-1">
          {sessionsCompleted} session{sessionsCompleted !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
