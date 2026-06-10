"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  accent?: "amber" | "emerald" | "violet" | "sky";
}

interface ToastState {
  toasts: ToastData[];
  push: (t: Omit<ToastData, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Convenience helper usable from anywhere (callbacks, stores, …). */
export function toast(t: Omit<ToastData, "id">) {
  useToastStore.getState().push(t);
}

const ACCENTS = {
  amber: "border-amber-500/30 from-amber-500/15",
  emerald: "border-emerald-500/30 from-emerald-500/15",
  violet: "border-violet-500/30 from-violet-500/15",
  sky: "border-sky-500/30 from-sky-500/15",
};

export default function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            "pointer-events-auto cursor-pointer flex items-center gap-3 pl-3 pr-5 py-3 rounded-2xl border bg-gradient-to-r to-black/85 bg-black/85 backdrop-blur-xl shadow-2xl shadow-black/60 min-w-[260px] max-w-sm animate-[toastIn_0.25s_ease-out]",
            ACCENTS[t.accent ?? "amber"]
          )}
        >
          {t.emoji && (
            <span className="text-2xl flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/5">
              {t.emoji}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{t.title}</p>
            {t.description && <p className="text-xs text-white/55 mt-0.5 leading-snug">{t.description}</p>}
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
