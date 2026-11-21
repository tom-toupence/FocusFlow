"use client";

// Sous-navigation de la Clepsydre : des libellés posés sur une ligne d'échelle,
// et un TRAIT DE NIVEAU (sodium, 2 px) qui glisse sous le libellé actif.
// Pas de capsule, pas de pastille : on lit un repère sur une règle.
// Clavier : flèches gauche/droite, Début/Fin (motif « tabs » de l'ARIA APG).
import { useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { T, tr } from "@/lib/motion";

export interface SegmentedItem<K extends string> {
  id: K;
  label: string;
  /** Compteur facultatif, en mono (« 12 »). */
  count?: number | string;
  /** Pastille de marque (Spotify, Twitch) : couleur sémantique, jamais décorative. */
  brand?: string;
}

export function Segmented<K extends string>({
  items,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  items: SegmentedItem<K>[];
  value: K;
  onChange: (k: K) => void;
  /** Nom accessible du groupe. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const group = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = items.length - 1;
    if (j < 0) return;
    e.preventDefault();
    onChange(items[j].id);
    refs.current[j]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "relative flex max-w-full gap-5 overflow-x-auto border-b border-line [scrollbar-width:none]",
        size === "sm" ? "gap-4" : "gap-6",
        className,
      )}
    >
      {items.map((it, i) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            type="button"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative shrink-0 flex items-center gap-2 pb-2.5 pt-1 whitespace-nowrap",
              "transition-colors duration-[var(--d-ui)] ease-[var(--ease-ui)]",
              "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sodium rounded-[2px]",
              size === "sm" ? "text-[13px]" : "text-sm",
              on ? "text-ink font-semibold" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {it.brand && (
              <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: it.brand }} />
            )}
            {it.label}
            {it.count !== undefined && it.count !== 0 && (
              <span className="font-mono text-[11px] text-ink-3 tabular-nums">{it.count}</span>
            )}
            {on && (
              <motion.span
                layoutId={`seg-${group}`}
                aria-hidden
                className="absolute -bottom-px left-0 right-0 h-[2px] bg-sodium"
                transition={tr(T.spring, reduce)}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
