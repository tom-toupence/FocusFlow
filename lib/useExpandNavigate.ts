"use client";

import { useRouter } from "next/navigation";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Transition réglages vers session : la vignette du média s'agrandit jusqu'à
 * devenir la plaque sombre de l'afficheur, et la rangée de 25 points du
 * minuteur s'allume en sodium pendant que la session se charge (c'est elle
 * qu'on retrouve sous le minuteur). Transform et opacité uniquement.
 * Reduced-motion (ou élément absent) : navigation directe.
 */
// Durées synchronisées avec la transition CSS de l'overlay ci-dessous.
const EXPAND_MS = 350;      // transition transform
const PUSH_AT_MS = 320;     // navigation juste avant la fin de l'expansion
const FADE_AT_MS = 900;     // fondu une fois la session (fond noir) affichée
const DOTS = 25;            // comme la jauge du panneau de session
const DOT_STEP_MS = 14;     // les points s'allument de gauche à droite
const REMOVE_AT_MS = 1300;  // nettoyage

// Garde anti double-clic : un seul overlay à la fois.
let expandInFlight = false;

export function useExpandNavigate() {
  const router = useRouter();
  const reduced = useReducedMotion();

  return (sourceEl: HTMLElement | null, href: string) => {
    if (reduced || !sourceEl) {
      router.push(href);
      return;
    }
    if (expandInFlight) return;
    const rect = sourceEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.width === 0 || rect.height === 0 || vw === 0 || vh === 0) {
      router.push(href);
      return;
    }
    const sx = rect.width / vw;
    const sy = rect.height / vh;
    const tx = rect.left + rect.width / 2 - vw / 2;
    const ty = rect.top + rect.height / 2 - vh / 2;

    expandInFlight = true;
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    // Overlay autoporté hors de l'arbre React (comme un portail tiers) : il
    // survit à la navigation et se nettoie tout seul — pas de cleanup React.
    overlay.style.cssText =
      "position:fixed;inset:0;background:#05070a;z-index:9999;pointer-events:none;" +
      // Desktop : la rangée se pose où sera la jauge du minuteur (haut, centre).
      `display:flex;justify-content:center;${vw >= 768 ? "align-items:flex-start;padding-top:66px;" : "align-items:center;"}` +
      "transform-origin:center;will-change:transform;" +
      `transform:translate(${tx}px,${ty}px) scale(${sx},${sy});` +
      `transition:transform ${EXPAND_MS}ms cubic-bezier(0.4,0,0.2,1),opacity 0.3s ease;`;
    // La rangée de points reste invisible pendant l'agrandissement (elle serait
    // écrasée par l'échelle) et n'apparaît qu'une fois la plaque plein écran.
    const row = document.createElement("div");
    row.style.cssText = `display:flex;gap:6px;opacity:0;transition:opacity 120ms linear ${EXPAND_MS - 80}ms;`;
    const dots: HTMLElement[] = [];
    for (let i = 0; i < DOTS; i++) {
      const d = document.createElement("span");
      d.style.cssText = "width:6px;height:6px;border-radius:1px;background:rgba(255,255,255,0.15);" +
        `transition:background-color 90ms linear ${EXPAND_MS + i * DOT_STEP_MS}ms,box-shadow 90ms linear ${EXPAND_MS + i * DOT_STEP_MS}ms;`;
      dots.push(d);
      row.appendChild(d);
    }
    overlay.appendChild(row);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.transform = "none";
        row.style.opacity = "1";
        for (const d of dots) {
          d.style.background = "#ff9a3c";
          d.style.boxShadow = "0 0 8px rgba(255,154,60,0.5)";
        }
      });
    });
    window.setTimeout(() => router.push(href), PUSH_AT_MS);
    window.setTimeout(() => { overlay.style.opacity = "0"; }, FADE_AT_MS);
    window.setTimeout(() => {
      overlay.remove();
      expandInFlight = false;
    }, REMOVE_AT_MS);
  };
}
