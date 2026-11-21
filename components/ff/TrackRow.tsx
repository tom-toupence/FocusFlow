"use client";

// Rangée de piste : une ligne de relevé. Numéro en mono à gauche (position dans
// la file), titre, source, durée. États :
//   playing    → un trait sodium vertical à gauche (« maintenant »)
//   played     → encre atténuée (déjà passée dans la session)
//   suggestion → ajoutée par la prolongation de fin de file : marquée « proche »,
//                retirable. C'est l'état prévu par la partie B.
import { cn } from "@/lib/utils";
import { cleanTitle } from "@/lib/text";

export type TrackState = "idle" | "playing" | "played";

export interface TrackRowProps {
  index?: number;
  title: string;
  subtitle?: string;
  duration?: string;
  thumb?: string | null;
  state?: TrackState;
  suggestion?: boolean;
  onPlay?: () => void;
  actions?: React.ReactNode;
  /** Sur fond vidéo (panneau de file en session). */
  onMedia?: boolean;
  className?: string;
}

export function TrackRow({
  index, title, subtitle, duration, thumb, state = "idle", suggestion, onPlay, actions, onMedia, className,
}: TrackRowProps) {
  const t = cleanTitle(title);
  const playing = state === "playing";
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 min-h-12 pl-3 pr-1.5 py-1.5 rounded-[var(--r-control)]",
        onMedia ? "hover:bg-[oklch(1_0_0/0.06)]" : "hover:bg-surface-2/70",
        state === "played" && "opacity-55",
        className,
      )}
      aria-current={playing ? "true" : undefined}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-colors",
          playing ? "bg-sodium" : "bg-transparent",
        )}
      />
      {index !== undefined && (
        <span className={cn("w-6 shrink-0 text-right font-mono text-[11px] tabular-nums", playing ? "text-sodium-text" : onMedia ? "text-[oklch(0.92_0.01_85/0.55)]" : "text-ink-3")}>
          {String(index).padStart(2, "0")}
        </span>
      )}
      {thumb !== undefined && (
        <span className="w-12 h-7 shrink-0 overflow-hidden rounded-[2px] bg-water-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumb && <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />}
        </span>
      )}
      <button
        type="button"
        onClick={onPlay}
        disabled={!onPlay}
        className="min-w-0 flex-1 text-left disabled:cursor-default focus-visible:outline-2 focus-visible:outline-sodium rounded-[2px]"
        aria-label={onPlay ? `Lire ${t}` : undefined}
      >
        <span className={cn("block truncate text-[14px]", onMedia ? "text-[oklch(0.95_0.01_85)]" : "text-ink", playing && "font-semibold")}>
          {t}
        </span>
        {(subtitle || suggestion) && (
          <span className={cn("flex items-center gap-2 truncate text-[12px]", onMedia ? "text-[oklch(0.92_0.01_85/0.6)]" : "text-ink-3")}>
            {suggestion && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-sodium-text">proche</span>
            )}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </span>
        )}
      </button>
      {duration && (
        <span className={cn("shrink-0 font-mono text-[11px] tabular-nums", onMedia ? "text-[oklch(0.92_0.01_85/0.55)]" : "text-ink-3")}>
          {duration}
        </span>
      )}
      {actions && <div className="shrink-0 flex items-center">{actions}</div>}
    </div>
  );
}
