"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  accent?: "amber" | "emerald" | "violet" | "sky";
  /** Sortie en cours : joue l'animation toastOut avant le retrait. */
  leaving?: boolean;
}

const LEAVE_MS = 160; // = durée de ff-toast-out (--d-ui)

interface ToastState {
  toasts: ToastData[];
  push: (t: Omit<ToastData, "id">) => void;
  dismiss: (id: string) => void;
}

const markLeaving = (toasts: ToastData[], id: string) =>
  toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x));

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: markLeaving(s.toasts, id) }));
    }, 5000 - LEAVE_MS);
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => {
    set((s) => ({ toasts: markLeaving(s.toasts, id) }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, LEAVE_MS);
  },
}));

/** Convenience helper usable from anywhere (callbacks, stores, …). */
export function toast(t: Omit<ToastData, "id">) {
  useToastStore.getState().push(t);
}

// Clepsydre : la nuance d'accent héritée (amber/emerald/violet/sky) ne colore
// plus rien ; elle ne fait que choisir le repère. Repère sodium = information,
// repère encre = neutre, repère rouge = problème (amber historique = alerte).
const MARK: Record<NonNullable<ToastData["accent"]>, string> = {
  amber: "bg-danger",
  emerald: "bg-sodium",
  violet: "bg-ink-2",
  sky: "bg-ink-2",
};

export default function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Bas d'écran (au-dessus de la barre mobile) : un toast ne doit pas couvrir
  // le minuteur, toujours en haut de la session.
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] md:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none w-[min(26rem,calc(100vw-2rem))]"
    >
      {toasts.map((t) => (
        <button
          type="button"
          key={t.id}
          onClick={() => dismiss(t.id)}
          aria-label={`${t.title}${t.description ? `. ${t.description}` : ""}. Fermer`}
          className={cn(
            "pointer-events-auto w-full text-left flex items-stretch gap-3 pl-3 pr-4 py-3 rounded-[var(--r-surface)]",
            "bg-ink text-on-ink shadow-[var(--shadow-float)]",
            t.leaving ? "ff-toast-out" : "ff-toast-in",
          )}
        >
          <span aria-hidden className={cn("shrink-0 w-[3px] rounded-full", MARK[t.accent ?? "emerald"])} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight">{t.title}</span>
            {t.description && <span className="block text-[13px] opacity-75 mt-0.5 leading-snug">{t.description}</span>}
          </span>
        </button>
      ))}
    </div>,
    document.body
  );
}
