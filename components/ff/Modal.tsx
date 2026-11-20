"use client";

// Modal portalée sur document.body (règle : jamais ancrée dans une section
// animée, cf. CLAUDE.md). Voile d'encre opaque à 72 %, carte papier/eau.
// Accessibilité : role="dialog", aria-modal, titre relié, Échap ferme, focus
// déplacé dans la modal à l'ouverture et rendu à l'élément d'origine, Tab
// piégé dans la carte.
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ff/Button";
import { IconClose } from "@/components/ff/icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Mesure ou contexte en mono à côté du titre (« 12 titres »). */
  meta?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, meta, children, footer, size = "md", className }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = card.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? card.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !card.current) return;
      const els = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (els.length === 0) return;
      const a = els[0], z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-6">
      <div aria-hidden className="ff-fade absolute inset-0 bg-[oklch(0.12_0.02_248/0.72)]" onClick={onClose} />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "ff-rise relative w-full max-h-[88vh] flex flex-col bg-surface text-ink outline-none",
          "rounded-t-[var(--r-surface)] sm:rounded-[var(--r-surface)] shadow-[var(--shadow-modal)]",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-3xl",
          className,
        )}
      >
        <header className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-line">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl leading-tight text-ink">{title}</h2>
            {meta && <p className="mt-1 font-mono text-[11px] text-ink-3">{meta}</p>}
          </div>
          <IconButton label="Fermer" kbd="Échap" size="sm" onClick={onClose}>
            <IconClose size={16} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="px-5 py-3.5 border-t border-line flex items-center justify-end gap-2">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
