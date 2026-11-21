"use client";

// Champs de saisie : une ligne d'encre sous un fond papier/eau légèrement
// creusé. Le libellé est TOUJOURS visible (jamais seulement un placeholder).
import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Masque visuellement le libellé (reste lu par les lecteurs d'écran). */
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  /** Unité affichée à droite, en mono (« min », « pomodoros »). */
  unit?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hideLabel, hint, error, unit, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint || error ? `${fid}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fid} className={cn("text-[13px] text-ink-2", hideLabel && "sr-only")}>
        {label}
      </label>
      <div
        className={cn(
          "flex items-center rounded-[var(--r-control)] bg-surface-2/70 border border-transparent",
          "border-b-line-strong/70 focus-within:border-b-sodium focus-within:bg-surface-2",
          "transition-colors duration-[var(--d-ui)]",
          error && "border-b-danger",
        )}
      >
        <input
          ref={ref}
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          className="min-w-0 flex-1 bg-transparent h-10 px-3 text-sm text-ink placeholder:text-ink-3 outline-none"
          {...rest}
        />
        {unit && <span className="pr-3 font-mono text-xs text-ink-3">{unit}</span>}
      </div>
      {(hint || error) && (
        <p id={hintId} className={cn("text-xs", error ? "text-danger" : "text-ink-3")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
