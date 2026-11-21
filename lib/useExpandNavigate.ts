"use client";

import { useRouter } from "next/navigation";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Transition continue settings → session : un overlay noir « s'étend » depuis
 * le rect d'un élément source (la vignette du média) vers le plein écran,
 * puis on navigue — la session démarrant sur fond noir, la continuité est
 * naturelle. Transform/opacity uniquement (compositor-friendly).
 * Reduced-motion (ou élément absent) : navigation directe.
 */
// Durées synchronisées avec la transition CSS de l'overlay ci-dessous.
const EXPAND_MS = 350;      // transition transform
const PUSH_AT_MS = 320;     // navigation juste avant la fin de l'expansion
const FADE_AT_MS = 900;     // fondu une fois la session (fond noir) affichée
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
      "position:fixed;inset:0;background:#000;z-index:9999;pointer-events:none;" +
      "transform-origin:center;will-change:transform;" +
      `transform:translate(${tx}px,${ty}px) scale(${sx},${sy});` +
      `transition:transform ${EXPAND_MS}ms cubic-bezier(0.4,0,0.2,1),opacity 0.3s ease;`;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.transform = "none";
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
