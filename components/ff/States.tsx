"use client";

// États de chargement et états vides.
// Squelette : aplat immobile légèrement creusé. Il ne « respire » que si le
// chargement dure (> 600 ms, classe ff-wait), parce qu'un chargement long est un
// processus réel ; en reduced-motion il reste fixe.
// État vide : une colonne SÈCHE (graduations sans eau), une phrase qui dit ce
// qui manque, et le geste qui remplit. Pas d'illustration de personnage.
import { cn } from "@/lib/utils";

export function Skeleton({ className, lines }: { className?: string; lines?: number }) {
  if (lines) {
    return (
      <div className={cn("flex flex-col gap-2", className)} aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="ff-wait block h-3 rounded-[2px] bg-surface-2" style={{ width: `${88 - i * 14}%` }} />
        ))}
      </div>
    );
  }
  return <span aria-hidden className={cn("ff-wait block rounded-[var(--r-media)] bg-surface-2", className)} />;
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-5 py-6", className)}>
      <svg width="22" height="64" viewBox="0 0 22 64" aria-hidden className="shrink-0 mt-1">
        <rect x="1" y="0" width="9" height="64" rx="2" fill="var(--surface-2)" />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1="12" x2={i % 4 === 0 ? 20 : 16} y1={64 - i * 8} y2={64 - i * 8} stroke="var(--line-strong)" strokeWidth={i % 4 === 0 ? 1 : 0.75} />
        ))}
      </svg>
      <div className="min-w-0">
        <p className="font-display text-lg text-ink leading-snug">{title}</p>
        {children && <div className="mt-1.5 text-sm text-ink-2 max-w-prose leading-relaxed">{children}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

/** Titre de section : display + mesure mono facultative à droite. */
export function SectionTitle({
  children, measure, action, as: Tag = "h2", className,
}: {
  children: React.ReactNode;
  measure?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3 min-w-0", className)}>
      <Tag className={cn("font-display text-ink leading-tight", Tag === "h1" ? "text-[clamp(1.9rem,4vw,2.6rem)] font-light" : Tag === "h2" ? "text-xl" : "text-base")}>
        {children}
      </Tag>
      {measure && <span className="font-mono text-xs text-ink-3 tabular-nums">{measure}</span>}
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </div>
  );
}
