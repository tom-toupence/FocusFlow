"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTimerStore } from "@/store/timerStore";
import { useDistractionStore } from "@/store/distractionStore";
import { cn } from "@/lib/utils";

// Document Picture-in-Picture API (Chrome/Edge 116+) — not yet in TS lib.
interface DocumentPictureInPicture {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/** Copies every stylesheet of the main document into the PiP window so Tailwind classes apply. */
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules ?? []).map((r) => r.cssText).join("\n");
      const style = target.document.createElement("style");
      style.textContent = rules;
      target.document.head.appendChild(style);
    } catch {
      // Cross-origin stylesheet: fall back to a <link> clone
      if (sheet.href) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

/**
 * Floating always-on-top mini timer (Document Picture-in-Picture).
 * Renders a toggle button for the session control cluster; when active,
 * portals a compact timer UI into the PiP window.
 */
export default function PipTimer({
  onDistraction,
  onFlowBreak,
}: {
  onDistraction: () => void;
  onFlowBreak: () => void;
}) {
  const {
    mode, secondsLeft, isRunning, settings, flowSeconds,
    start, pause,
  } = useTimerStore();
  const { sessionCount: distractionCount } = useDistractionStore();
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [supported, setSupported] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSupported(typeof window !== "undefined" && !!window.documentPictureInPicture), []);

  const close = useCallback(() => {
    setPipWindow((w) => {
      w?.close();
      return null;
    });
  }, []);

  const open = useCallback(async () => {
    if (!window.documentPictureInPicture) return;
    try {
      const win = await window.documentPictureInPicture.requestWindow({ width: 300, height: 140 });
      copyStyles(win);
      win.document.body.style.margin = "0";
      win.document.body.style.background = "#0a0a0c";
      win.addEventListener("pagehide", () => setPipWindow(null));
      setPipWindow(win);
    } catch {
      // user gesture required / denied — ignore
    }
  }, []);

  // Close the PiP window when leaving the session page
  useEffect(() => () => { pipWindow?.close(); }, [pipWindow]);

  const isFlowtime = settings.preset === "flowtime";
  const isBreak = mode !== "work";

  return (
    <>
      <button
        onClick={() => (pipWindow ? close() : open())}
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-xl transition-all",
          pipWindow ? "bg-white/20 text-white" : "text-white/75 hover:text-white hover:bg-white/10",
          !supported && "hidden"
        )}
        title={pipWindow ? "Fermer la fenêtre flottante" : "Timer flottant (toujours visible)"}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {pipWindow &&
        createPortal(
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#0a0a0c] select-none px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isBreak ? "bg-emerald-400" : isRunning ? "bg-red-400 animate-pulse" : "bg-amber-400"
                )}
              />
              <span className="text-[10px] uppercase tracking-widest text-white/40">
                {isBreak ? "Pause" : isFlowtime ? "Flow" : "Focus"}
              </span>
            </div>
            <span className="text-4xl font-light text-white tabular-nums tracking-tight leading-none">
              {formatTime(isFlowtime && !isBreak ? flowSeconds : secondsLeft)}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={isRunning ? pause : start}
                className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold transition-colors"
              >
                {isRunning ? "Pause" : "Reprendre"}
              </button>
              {!isBreak && (
                <button
                  onClick={onDistraction}
                  className="relative px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
                  title="Marquer une distraction"
                >
                  ⚠ {distractionCount > 0 ? distractionCount : ""}
                </button>
              )}
              {isFlowtime && !isBreak && (
                <button
                  onClick={onFlowBreak}
                  className="px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-colors"
                  title="Terminer le flow et prendre la pause méritée"
                >
                  ☕
                </button>
              )}
            </div>
          </div>,
          pipWindow.document.body
        )}
    </>
  );
}
