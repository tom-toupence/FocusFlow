"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTimerStore, TimerMode } from "@/store/timerStore";

const modeLabels: Record<TimerMode, string> = {
  work: "Focus",
  "short-break": "Pause courte",
  "long-break": "Pause longue",
};

const modeColors: Record<TimerMode, string> = {
  work: "text-rose-400",
  "short-break": "text-emerald-400",
  "long-break": "text-sky-400",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function ProgressRing({
  progress,
  mode,
}: {
  progress: number;
  mode: TimerMode;
}) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const strokeColor =
    mode === "work"
      ? "#fb7185"
      : mode === "short-break"
      ? "#34d399"
      : "#38bdf8";

  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke="#1f2937"
        strokeWidth="8"
      />
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

export default function PomodoroTimer() {
  const {
    mode,
    secondsLeft,
    isRunning,
    sessionsCompleted,
    settings,
    setMode,
    tick,
    start,
    pause,
    reset,
    nextSession,
  } = useTimerStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSecondsRef = useRef(secondsLeft);

  const handleSessionEnd = useCallback(() => {
    if (typeof window !== "undefined" && Notification.permission === "granted") {
      const label = mode === "work" ? "Session terminée !" : "Pause terminée !";
      new Notification("FocusFlow", { body: label, icon: "/favicon.ico" });
    }
    nextSession();
  }, [mode, nextSession]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, tick]);

  useEffect(() => {
    if (prevSecondsRef.current > 0 && secondsLeft === 0) {
      handleSessionEnd();
    }
    prevSecondsRef.current = secondsLeft;
  }, [secondsLeft, handleSessionEnd]);

  useEffect(() => {
    if (typeof window !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const totalSeconds =
    mode === "work"
      ? settings.workDuration * 60
      : mode === "short-break"
      ? settings.shortBreakDuration * 60
      : settings.longBreakDuration * 60;

  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Mode tabs */}
      <div className="flex gap-2 bg-gray-800/60 rounded-full p-1">
        {(["work", "short-break", "long-break"] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              mode === m
                ? "bg-gray-700 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>

      {/* Ring + time */}
      <div className="relative w-52 h-52 flex items-center justify-center">
        <ProgressRing progress={progress} mode={mode} />
        <div className="flex flex-col items-center z-10">
          <span className={`text-5xl font-bold tabular-nums ${modeColors[mode]}`}>
            {formatTime(secondsLeft)}
          </span>
          <span className="text-gray-400 text-sm mt-1">{modeLabels[mode]}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Réinitialiser"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          onClick={isRunning ? pause : start}
          className={`px-8 py-3 rounded-full font-semibold text-white transition-all shadow-lg ${
            isRunning
              ? "bg-gray-600 hover:bg-gray-500"
              : mode === "work"
              ? "bg-rose-500 hover:bg-rose-400"
              : mode === "short-break"
              ? "bg-emerald-500 hover:bg-emerald-400"
              : "bg-sky-500 hover:bg-sky-400"
          }`}
        >
          {isRunning ? "Pause" : "Démarrer"}
        </button>

        <button
          onClick={nextSession}
          className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Session suivante"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 4l15 8-15 8V4z" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="19" y1="4" x2="19" y2="20" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Sessions counter */}
      <div className="flex items-center gap-2">
        {Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < sessionsCompleted % settings.sessionsBeforeLongBreak
                ? "bg-rose-400"
                : "bg-gray-700"
            }`}
          />
        ))}
        <span className="text-gray-500 text-xs ml-1">
          {sessionsCompleted} session{sessionsCompleted > 1 ? "s" : ""} aujourd'hui
        </span>
      </div>
    </div>
  );
}
