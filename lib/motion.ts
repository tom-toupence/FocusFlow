// Tokens de mouvement de la Clepsydre (miroir des variables CSS de globals.css).
// Deux familles de temps, jamais mélangées dans un même geste :
//  . l'INTERFACE répond vite (90 à 240 ms) et ne rebondit pas ;
//  . l'EAU prend son temps (600 à 1 400 ms) : chute accélérée, arrivée amortie.
// Règles de chorégraphie : voir docs/redesign/03-SYSTEM.md § Mouvement.
import type { Transition } from "motion/react";

export const EASE = {
  /** Réponse d'interface : départ franc, arrivée douce, sans dépassement. */
  ui: [0.25, 0.8, 0.3, 1] as const,
  /** Chute d'une goutte : accélération (gravité). */
  fall: [0.55, 0, 0.9, 0.4] as const,
  /** L'eau qui se pose : léger dépassement, une seule fois. */
  settle: [0.18, 0.9, 0.22, 1.04] as const,
  /** Marée / respiration : symétrique, sinusoïdale. */
  tide: [0.45, 0, 0.55, 1] as const,
};

export const DUR = {
  instant: 0.09,
  ui: 0.16,
  panel: 0.24,
  water: 0.9,
  overflow: 1.4,
} as const;

/** Décalage entre éléments d'une SÉQUENCE temporelle (liste de pistes). */
export const STAGGER = 0.03;
/** Au-delà, une liste apparaît d'un bloc : on ne fait pas attendre. */
export const STAGGER_MAX_ITEMS = 6;

export const T = {
  ui: { duration: DUR.ui, ease: EASE.ui } satisfies Transition,
  panel: { duration: DUR.panel, ease: EASE.ui } satisfies Transition,
  water: { duration: DUR.water, ease: EASE.settle } satisfies Transition,
  /** Ressort d'eau : un dépassement, puis immobile (indicateurs qui glissent). */
  spring: { type: "spring", stiffness: 380, damping: 36, mass: 0.9 } satisfies Transition,
  none: { duration: 0 } satisfies Transition,
};

/** Retourne la transition, ou une transition nulle si reduced-motion. */
export function tr(t: Transition, reduce: boolean | null): Transition {
  return reduce ? T.none : t;
}
