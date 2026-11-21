"use client";

// La FAÇADE : jauge de l'identité « la ville qui ne dort pas ».
// Une tour dont les étages s'allument un à un à mesure que le temps passe :
//   . étages faits      → fenêtres vert supérette (« fait ») ;
//   . étage en cours    → fenêtre sodium (« maintenant ») ;
//   . étages à venir    → fenêtres éteintes.
// Horizontale, c'est une rangée de fenêtres, comme la jauge du panneau de
// session. `mark` est le toit visé (l'objectif du jour), `laps` le nombre de
// tours déjà allumées (Flowtime, pomodoros terminés).
//
// Réactions (événements RÉELS uniquement) :
//   pulse.kind = "blink"  → la fenêtre en cours clignote (piste suivante, minute pleine)
//   pulse.kind = "buzz" → l'étage en cours grésille en rouge (distraction)
// Le `key` de pulse change pour rejouer l'effet. SVG/CSS uniquement.
import { cn } from "@/lib/utils";

export interface GaugePulse { kind: "blink" | "buzz"; key: number }

interface GaugeProps {
  /** Remplissage 0..1 (au-delà, la tour reste allumée). */
  value: number;
  /** Toit visé (0..1), ex. l'objectif du jour. */
  mark?: number;
  markLabel?: string;
  /** Nombre d'étages (ou de fenêtres en horizontal). */
  ticks?: number;
  /** Un étage marqué (plancher plus épais) toutes les N. */
  majorEvery?: number;
  orientation?: "vertical" | "horizontal";
  /** Taille principale en px (hauteur si verticale, largeur si horizontale). */
  length?: number;
  /** Largeur de la tour en px. */
  thickness?: number;
  /** Tours déjà allumées (Flowtime / pomodoros terminés). */
  laps?: number;
  pulse?: GaugePulse | null;
  /** L'étage en cours est-il « maintenant » (sodium) ? false pour un jour passé. */
  live?: boolean;
  /** Conservé pour compatibilité (ancienne teinte de la vidéo) : sans effet. */
  reflet?: boolean;
  /** Sur une vidéo : fenêtres éteintes plus claires quel que soit le thème. */
  onMedia?: boolean;
  /** Nom accessible + valeur lisible (« 12 min sur 25 »). */
  label: string;
  valueText: string;
  className?: string;
}

export function Gauge({
  value,
  mark,
  markLabel,
  ticks = 25,
  majorEvery = 5,
  orientation = "vertical",
  length = 160,
  thickness = 12,
  laps = 0,
  pulse,
  live = true,
  onMedia,
  label,
  valueText,
  className,
}: GaugeProps) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const vertical = orientation === "vertical";
  const n = Math.max(1, ticks);
  const filled = v * n;
  const done = Math.floor(filled);
  const current = live && done < n && v > 0 ? done : -1;
  const cols = vertical && thickness >= 10 ? 2 : 1;
  const gap = 2;
  const cell = ((vertical ? length : length) - gap * (n - 1)) / n;
  const off = onMedia ? "oklch(0.95 0.01 85 / 0.16)" : "var(--surface-2)";
  const offEdge = onMedia ? "transparent" : "var(--line)";
  const reached = mark !== undefined && v >= mark;
  const W = vertical ? thickness + 10 : length;
  const H = vertical ? length : thickness;

  const fillFor = (i: number) => (i < done ? "var(--konbini)" : i === current ? "var(--sodium)" : off);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={valueText}
      className={cn("inline-flex", vertical ? "flex-col items-center gap-2" : "flex-col gap-1.5", className)}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible">
        {Array.from({ length: n }, (_, i) => {
          const major = (i + 1) % majorEvery === 0;
          const flick = pulse && i === (current >= 0 ? current : Math.max(0, done - 1));
          if (vertical) {
            // L'étage i part du bas.
            const y = length - (i + 1) * cell - i * gap;
            const w = (thickness - (cols - 1) * gap) / cols;
            return (
              <g key={i} className={flick ? (pulse.kind === "blink" ? "ff-blink" : "ff-buzz") : undefined}>
                {Array.from({ length: cols }, (_, c) => (
                  <rect
                    key={c}
                    x={c * (w + gap)}
                    y={y}
                    width={w}
                    height={Math.max(1, cell)}
                    rx={0.75}
                    fill={flick && pulse.kind === "buzz" ? "var(--danger)" : fillFor(i)}
                    stroke={fillFor(i) === off ? offEdge : "none"}
                    strokeWidth={0.5}
                    style={{ transition: "fill 400ms var(--ease-ui)" }}
                  />
                ))}
                {major && <line x1={thickness + 2} x2={thickness + 6} y1={y + cell / 2} y2={y + cell / 2} stroke={onMedia ? "oklch(0.95 0.01 85 / 0.45)" : "var(--line-strong)"} strokeWidth={0.75} />}
              </g>
            );
          }
          const x = i * (cell + gap);
          return (
            <rect
              key={i}
              className={flick ? (pulse.kind === "blink" ? "ff-blink" : "ff-buzz") : undefined}
              x={x}
              y={0}
              width={Math.max(1, cell)}
              height={thickness}
              rx={0.75}
              fill={flick && pulse.kind === "buzz" ? "var(--danger)" : fillFor(i)}
              stroke={fillFor(i) === off ? offEdge : "none"}
              strokeWidth={0.5}
              style={{ transition: "fill 400ms var(--ease-ui)" }}
            />
          );
        })}
        {/* Le toit visé (objectif) : un trait au-dessus de l'étage cible. */}
        {mark !== undefined && (
          vertical ? (
            <line x1={-3} x2={thickness + 8} y1={length - length * mark} y2={length - length * mark}
              stroke={reached ? "var(--konbini)" : onMedia ? "oklch(0.95 0.01 85 / 0.8)" : "var(--text-2)"} strokeWidth={1.25} />
          ) : (
            <line y1={-3} y2={thickness + 3} x1={length * mark} x2={length * mark}
              stroke={reached ? "var(--konbini)" : onMedia ? "oklch(0.95 0.01 85 / 0.8)" : "var(--text-2)"} strokeWidth={1.25} />
          )
        )}
      </svg>
      {(markLabel || laps > 0) && (
        <div className={cn("flex items-center gap-2 font-mono text-[11px]", onMedia ? "text-[oklch(0.95_0.01_85/0.7)]" : "text-ink-3")}>
          {laps > 0 && (
            <span className="flex items-end gap-[3px]" aria-label={`${laps} tour${laps > 1 ? "s" : ""} allumée${laps > 1 ? "s" : ""}`}>
              {Array.from({ length: Math.min(laps, 8) }, (_, i) => (
                <span key={i} className="w-[5px] h-[10px] rounded-[1px] bg-konbini" />
              ))}
              {laps > 8 && <span>+{laps - 8}</span>}
            </span>
          )}
          {markLabel && <span className={cn(reached && "text-konbini")}>{markLabel}</span>}
        </div>
      )}
    </div>
  );
}
