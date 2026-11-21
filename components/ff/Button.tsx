"use client";

// Boutons de la Clepsydre.
//  . ink    : action principale d'un écran (aplat d'encre). Un seul par vue.
//  . signal : SODIUM, réservé au geste qui met le temps en marche
//             (« Démarrer », « Reprendre »). Rare par construction.
//  . line   : action secondaire, filet d'encre.
//  . quiet  : action tertiaire, texte seul avec soulignement au survol.
//  . danger : destructif (rouge sémantique).
// Pression : léger enfoncement de 1 px (CSS, pas de ressort). Jamais de pilule.
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "ink" | "signal" | "line" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  ink: "bg-ink text-on-ink hover:bg-ink/88",
  signal: "bg-sodium text-on-sodium hover:brightness-105",
  line: "border border-line-strong/70 text-ink hover:border-ink hover:bg-surface-2/60",
  quiet: "text-ink-2 hover:text-ink underline-offset-4 hover:underline decoration-line-strong",
  danger: "border border-danger/50 text-danger hover:bg-danger/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2.5",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "line", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "ff-press inline-flex items-center justify-center rounded-[var(--r-control)] font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,color,filter,transform] duration-[var(--d-ui)] ease-[var(--ease-ui)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sodium",
        "disabled:opacity-45 disabled:pointer-events-none",
        variant === "quiet" ? "px-1 h-auto" : SIZES[size],
        variant === "quiet" && (size === "sm" ? "text-[13px]" : "text-sm"),
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Libellé accessible OBLIGATOIRE (sert aussi d'infobulle). */
  label: string;
  /** Raccourci clavier affiché dans l'infobulle native. */
  kbd?: string;
  active?: boolean;
  size?: "sm" | "md";
  tone?: "ink" | "on-media";
}

/** Bouton icône carré. `tone="on-media"` : posé sur une vidéo (aplat sombre opaque, pas de verre). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, kbd, active, size = "md", tone = "ink", className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={kbd ? `${label} (${kbd})` : label}
      className={cn(
        "ff-press relative inline-flex items-center justify-center shrink-0 rounded-[var(--r-control)]",
        "transition-[background-color,color,transform] duration-[var(--d-ui)] ease-[var(--ease-ui)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sodium",
        "disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" ? "w-8 h-8" : "w-10 h-10",
        tone === "ink" &&
          (active ? "bg-ink text-on-ink" : "text-ink-2 hover:text-ink hover:bg-surface-2"),
        tone === "on-media" &&
          (active ? "bg-[oklch(0.95_0.01_85)] text-[oklch(0.18_0.02_248)]" : "text-[oklch(0.92_0.01_85)] hover:bg-[oklch(1_0_0/0.12)]"),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
