"use client";

// La COLONNE de la Clepsydre : primitive centrale de l'identité.
// Une colonne graduée où l'eau monte avec le temps réel. Elle sert partout où
// FocusFlow mesure une durée : temps de pomodoro, niveau du jour face à
// l'objectif, pause qui se vide, Flowtime qui déborde (vases pleins = `laps`).
//
// Réactions (événements RÉELS uniquement, jamais le son) :
//   pulse.kind = "drop"  → une goutte tombe (changement de piste, minute pleine)
//   pulse.kind = "stone" → un caillou trouble la surface (distraction)
// Le `key` de pulse change pour rejouer l'effet. Tout est en SVG/CSS : aucune
// cible WebGL, la colonne peut vivre par-dessus une vidéo sans la concurrencer.
import { useId } from "react";
import { cn } from "@/lib/utils";

export interface GaugePulse { kind: "drop" | "stone"; key: number }

interface GaugeProps {
  /** Remplissage 0..1 (au-delà, la colonne reste pleine). */
  value: number;
  /** Repère gravé (0..1), ex. l'objectif du jour. */
  mark?: number;
  markLabel?: string;
  /** Nombre de graduations (mineures). */
  ticks?: number;
  /** Une graduation majeure toutes les N. */
  majorEvery?: number;
  orientation?: "vertical" | "horizontal";
  /** Taille principale en px (hauteur si verticale, largeur si horizontale). */
  length?: number;
  /** Épaisseur du tube en px. */
  thickness?: number;
  /** Vases déjà pleins (Flowtime / pomodoros terminés). */
  laps?: number;
  pulse?: GaugePulse | null;
  /** Teinte l'eau du reflet de la vidéo (var --reflet). */
  reflet?: boolean;
  /** Sur une vidéo : graduations claires quel que soit le thème. */
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
  reflet,
  onMedia,
  label,
  valueText,
  className,
}: GaugeProps) {
  const id = useId().replace(/:/g, "");
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const vertical = orientation === "vertical";
  const pad = 6; // place pour les graduations
  const W = vertical ? thickness + pad * 2 + 8 : length;
  const H = vertical ? length : thickness + pad * 2 + 8;
  const tubeX = vertical ? pad : 0;
  const tubeY = vertical ? 0 : pad;
  const tubeW = vertical ? thickness : length;
  const tubeH = vertical ? length : thickness;
  const level = vertical ? tubeH * v : tubeW * v;
  const waterColor = reflet
    ? "color-mix(in oklab, var(--water) 55%, var(--ambient-raw))"
    : "var(--water)";
  const tickColor = onMedia ? "oklch(0.95 0.01 85 / 0.55)" : "var(--line-strong)";
  const reached = mark !== undefined && v >= mark;

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
        <defs>
          <clipPath id={`tube-${id}`}>
            <rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={2} />
          </clipPath>
        </defs>
        {/* Tube */}
        <rect
          x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={2}
          fill={onMedia ? "oklch(0.12 0.02 248 / 0.55)" : "var(--surface-2)"}
        />
        {/* Eau : transform seul (compositeur), la montée suit le temps réel */}
        <g clipPath={`url(#tube-${id})`}>
          <rect
            x={tubeX} y={tubeY} width={tubeW} height={tubeH}
            fill={waterColor}
            style={{
              transformBox: "fill-box",
              transformOrigin: vertical ? "50% 100%" : "0% 50%",
              transform: vertical ? `scaleY(${v})` : `scaleX(${v})`,
              transition: "transform 1s linear",
            }}
          />
          {/* Surface : trait sodium = « maintenant » */}
          <rect
            x={vertical ? tubeX : tubeX + level - 1.5}
            y={vertical ? tubeY + tubeH - level - 1 : tubeY}
            width={vertical ? tubeW : 1.5}
            height={vertical ? 1.5 : tubeH}
            fill="var(--sodium)"
            style={{ transition: "x 1s linear, y 1s linear" }}
          />
          {pulse && (
            <g key={pulse.key} className={pulse.kind === "drop" ? "ff-drop" : "ff-stone"}>
              <ellipse
                cx={vertical ? tubeX + tubeW / 2 : tubeX + level}
                cy={vertical ? tubeY + tubeH - level : tubeY + tubeH / 2}
                rx={vertical ? tubeW * 0.9 : tubeH * 0.9}
                ry={vertical ? 2.2 : tubeH * 0.9}
                fill="none"
                stroke={pulse.kind === "stone" ? "var(--danger)" : "var(--sodium)"}
                strokeWidth={1}
              />
            </g>
          )}
        </g>
        {/* Graduations : l'échelle ne bouge jamais */}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const major = i % majorEvery === 0;
          const t = i / ticks;
          if (vertical) {
            const y = tubeY + tubeH - tubeH * t;
            return (
              <line key={i} x1={tubeX + tubeW + 2} x2={tubeX + tubeW + (major ? 8 : 5)} y1={y} y2={y}
                stroke={tickColor} strokeWidth={major ? 1 : 0.75} />
            );
          }
          const x = tubeX + tubeW * t;
          return (
            <line key={i} y1={tubeY + tubeH + 2} y2={tubeY + tubeH + (major ? 8 : 5)} x1={x} x2={x}
              stroke={tickColor} strokeWidth={major ? 1 : 0.75} />
          );
        })}
        {/* Repère gravé (objectif) */}
        {mark !== undefined && (
          vertical ? (
            <line x1={0} x2={tubeX + tubeW + 10} y1={tubeY + tubeH - tubeH * mark} y2={tubeY + tubeH - tubeH * mark}
              stroke={reached ? "var(--sodium)" : onMedia ? "oklch(0.95 0.01 85 / 0.8)" : "var(--text-2)"} strokeWidth={1.25} />
          ) : (
            <line y1={0} y2={tubeY + tubeH + 10} x1={tubeW * mark} x2={tubeW * mark}
              stroke={reached ? "var(--sodium)" : onMedia ? "oklch(0.95 0.01 85 / 0.8)" : "var(--text-2)"} strokeWidth={1.25} />
          )
        )}
      </svg>
      {(markLabel || laps > 0) && (
        <div className={cn("flex items-center gap-2 font-mono text-[11px] tabular-nums", onMedia ? "text-[oklch(0.95_0.01_85/0.7)]" : "text-ink-3")}>
          {laps > 0 && (
            <span className="flex gap-[3px]" aria-label={`${laps} vase${laps > 1 ? "s" : ""} plein${laps > 1 ? "s" : ""}`}>
              {Array.from({ length: Math.min(laps, 8) }, (_, i) => (
                <span key={i} className="w-[5px] h-[9px] rounded-[1px]" style={{ background: waterColor }} />
              ))}
              {laps > 8 && <span>+{laps - 8}</span>}
            </span>
          )}
          {markLabel && <span className={cn(reached && "text-sodium-text")}>{markLabel}</span>}
        </div>
      )}
    </div>
  );
}
