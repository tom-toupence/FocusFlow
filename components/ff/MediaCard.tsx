"use client";

// Carte média : une FENÊTRE sur une ville (vignette 16:9, angle presque vif),
// posée sur sa LIGNE D'EAU : un trait de 2 px à la couleur dominante de la
// vidéo (getVideoColor). La couleur est une information (« quelle lumière »),
// pas un décor. Sélection = la ligne passe au sodium et s'épaissit.
// Le survol éclaircit très légèrement la vignette ; aucun zoom, aucun halo.
import { cn } from "@/lib/utils";
import { cleanTitle } from "@/lib/text";

export interface MediaCardProps {
  thumb?: string | null;
  title: string;
  subtitle?: string;
  /** Méta en mono à droite (pays, durée, nombre de titres). */
  meta?: string;
  /** Couleur dominante de la vidéo (reflet). */
  color?: string;
  selected?: boolean;
  onSelect?: () => void;
  /** Libellé accessible de l'action principale (« Choisir Rainy Shibuya »). */
  actionLabel?: string;
  /** Petit marqueur de type (« Playlist », « Mix »), en mono. */
  kind?: string;
  /** Actions secondaires (menu « + », retirer…), toujours visibles. */
  actions?: React.ReactNode;
  className?: string;
}

export function MediaCard({
  thumb, title, subtitle, meta, color, selected, onSelect, actionLabel, kind, actions, className,
}: MediaCardProps) {
  const t = cleanTitle(title);
  return (
    <article className={cn("group relative flex flex-col min-w-0", className)}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={actionLabel ?? t}
        className={cn(
          "relative block w-full aspect-video overflow-hidden rounded-[var(--r-media)] bg-water-deep",
          "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sodium",
        )}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover brightness-[0.92] group-hover:brightness-100 transition-[filter] duration-[var(--d-panel)]"
          />
        ) : (
          <span aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent, ${color ?? "var(--water)"})` }} />
        )}
        {kind && (
          <span className="absolute top-2 left-2 font-mono text-[10px] tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-[2px] bg-[oklch(0.14_0.02_248/0.82)] text-[oklch(0.93_0.01_85)]">
            {kind}
          </span>
        )}
      </button>
      {/* Ligne d'eau */}
      <span
        aria-hidden
        className={cn("block w-full transition-[height,background-color] duration-[var(--d-panel)]", selected ? "h-[3px]" : "h-[2px]")}
        style={{ background: selected ? "var(--sodium)" : color ?? "var(--line)" }}
      />
      <div className="flex items-start gap-2 pt-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] leading-snug text-ink line-clamp-2">{t}</h3>
          {(subtitle || meta) && (
            <p className="mt-1 flex items-baseline gap-2 text-[12px] text-ink-3 min-w-0">
              {subtitle && <span className="truncate">{subtitle}</span>}
              {meta && <span className="font-mono text-[11px] shrink-0">{meta}</span>}
            </p>
          )}
          {selected && <p className="mt-1 font-mono text-[11px] text-sodium-text">Choisie</p>}
        </div>
        {actions && <div className="shrink-0 -mr-1.5 -mt-1 flex items-center">{actions}</div>}
      </div>
    </article>
  );
}
