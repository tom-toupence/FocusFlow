"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { TodoStatus } from "@/store/sessionStore";
import { cn } from "@/lib/utils";

export const STATUS_CONFIG: Record<TodoStatus, {
  label: string;
  dot: string;
  bg: string;
  text: string;
}> = {
  todo:          { label: "À faire",  dot: "bg-white/30",    bg: "bg-white/5",        text: "text-white/50"   },
  "in-progress": { label: "En cours", dot: "bg-amber-400",   bg: "bg-amber-500/15",   text: "text-amber-300"  },
  done:          { label: "Terminé",  dot: "bg-emerald-400", bg: "bg-emerald-500/15", text: "text-emerald-300"},
};

// Light-mode overrides (settings page)
const STATUS_CONFIG_LIGHT: Record<TodoStatus, { bg: string; text: string }> = {
  todo:          { bg: "bg-foreground/[0.05]",   text: "text-foreground/40"  },
  "in-progress": { bg: "bg-amber-500/10",        text: "text-amber-600"      },
  done:          { bg: "bg-emerald-500/10",      text: "text-emerald-600"    },
};

const ORDER: TodoStatus[] = ["todo", "in-progress", "done"];

interface Props {
  status: TodoStatus;
  onChange: (s: TodoStatus) => void;
  dark?: boolean;
}

export default function TodoStatusDropdown({ status, onChange, dark = false }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const open = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect(r);
  }, []);

  const close = useCallback(() => setRect(null), []);

  useEffect(() => {
    if (!rect) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [rect, close]);

  const cfg = dark ? STATUS_CONFIG[status] : { ...STATUS_CONFIG[status], ...STATUS_CONFIG_LIGHT[status] };

  // Calculate dropdown position — open above if near bottom of screen
  const dropStyle = rect ? (() => {
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 140 ? rect.bottom + 4 : rect.top - 4 - 112;
    return { top, left: rect.left };
  })() : null;

  return (
    <>
      <button
        ref={triggerRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); rect ? close() : open(); }}
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all flex-shrink-0",
          cfg.bg, cfg.text
        )}
      >
        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_CONFIG[status].dot)} />
        {STATUS_CONFIG[status].label}
        <svg
          className={cn("w-2.5 h-2.5 opacity-50 transition-transform", rect && "rotate-180")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted && rect && dropStyle && createPortal(
        <div
          style={{ position: "fixed", top: dropStyle.top, left: dropStyle.left, zIndex: 9999 }}
          className={cn(
            "min-w-[120px] rounded-xl border shadow-xl overflow-hidden",
            dark
              ? "bg-[#18181c] border-white/10 shadow-black/70"
              : "bg-white border-foreground/10 shadow-black/15"
          )}
        >
          {ORDER.map((s) => {
            const c = STATUS_CONFIG[s];
            const lc = STATUS_CONFIG_LIGHT[s];
            const active = s === status;
            return (
              <button
                key={s}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onChange(s); close(); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-left transition-colors",
                  active
                    ? dark
                      ? cn(c.bg, c.text)
                      : cn(lc.bg, lc.text)
                    : dark
                    ? "text-white/40 hover:bg-white/5 hover:text-white/70"
                    : "text-foreground/40 hover:bg-foreground/5 hover:text-foreground/70"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", c.dot, !active && "opacity-50")} />
                {c.label}
                {active && (
                  <svg className="ml-auto w-3 h-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
