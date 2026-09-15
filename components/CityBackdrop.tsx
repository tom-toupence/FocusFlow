"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// FOND du landing : Séoul à l'heure bleue, vue depuis Namsan, traversée par le
// scroll.
//
// ── L'idée ──────────────────────────────────────────────────────────────────
// La photo est en PORTRAIT (4:5) et le scroll est VERTICAL : au lieu de subir le
// recadrage, on s'en sert. Le conteneur est plus haut que l'écran et descend au
// fil de la page : on part de la crête et du couchant, on traverse les tours,
// on finit sur le boulevard. Pendant cette descente, LA NUIT TOMBE. Un pomodoro
// c'est du temps qui passe ; ici c'est le scroll qui le fait passer.
//
// ── Comment les fenêtres « s'allument » ────────────────────────────────────
// Sans retoucher un seul pixel à la main : une COPIE de l'image, floutée et
// sur-exposée, est superposée en fusion `screen`. Ce mode ne garde que ce qui
// est déjà clair, donc seules les fenêtres, les enseignes et les phares
// montent. Il suffit d'animer son opacité.
//
// ── Moteur ─────────────────────────────────────────────────────────────────
// GSAP + ScrollTrigger, en `scrub`. C'est le moteur unique de la landing : on
// n'y mélange JAMAIS `motion/react`, sinon deux systèmes se disputent les
// frames de scroll. Le reste de l'app (site connecté) reste sur `motion/react`.
//
// ── Perf ───────────────────────────────────────────────────────────────────
// Deux balises `next/image` (AVIF/WebP, cache edge Vercel) et des dégradés CSS.
// Aucune 3D, aucun canvas : uniquement des `opacity`/`transform` composés par
// le GPU. Tout se fige proprement sous `prefers-reduced-motion`.

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger);

// Une seule source de vérité pour la photo : la balade en réutilise le même
// fichier, donc le même cache navigateur (zéro téléchargement en plus).
export const CITY_PHOTO = "/pexels-ethan-brooke-1123775-3142005.jpg";

// Grain photographique : bruit SVG en data-URI, zéro requête.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export default function CityBackdrop() {
  const root = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const ignite = useRef<HTMLDivElement>(null);
  const dusk = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Sous reduced-motion : un seul état, celui du milieu de soirée. Rien ne
      // bouge, mais l'image reste étalonnée et lisible.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(dusk.current, { opacity: 0.28 });
        gsap.set(night.current, { opacity: 0.62 });
        gsap.set(ignite.current, { opacity: 0.38 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(dusk.current, { opacity: 1 });
        gsap.set(night.current, { opacity: 0.18 });
        gsap.set(ignite.current, { opacity: 0.06 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            // Pas d'élément déclencheur : `start: 0` / `end: "max"` couvre la
            // page entière en positions de scroll absolues. C'est indispensable
            // ici, parce que `ScrollSmoother` transforme le conteneur de
            // contenu : mesurer `document.body` donnerait une hauteur qui
            // dépend de l'amortissement en cours.
            start: 0,
            end: "max",
            scrub: 0.6,
            // Le fond couvre toute la page : il se rafraîchit AVANT tout le
            // reste. ⚠️ Dans GSAP, un `refreshPriority` PLUS ÉLEVÉ passe en
            // PREMIER. Voir l'échelle `PRIO` commentée dans `LandingPage.tsx`.
            refreshPriority: 40,
          },
        });

        // Descente dans l'image, sur TOUTE la page.
        // On n'anime QUE `yPercent`. Animer aussi `scale` obligeait le
        // navigateur à re-rastériser une image de 4,6 Mpx à chaque palier de
        // zoom : c'était l'une des causes des ralentissements.
        tl.to([photo.current, ignite.current], { yPercent: -27, duration: 1 }, 0);

        // La tombée de la nuit, elle, est calée sur le premier tiers de page,
        // là où le regard est encore sur le fond.
        tl.to(dusk.current, { opacity: 0, duration: 0.42 }, 0)
          .to(night.current, { opacity: 0.74, duration: 0.42 }, 0)
          .to(ignite.current, { opacity: 0.7, duration: 0.42 }, 0);
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden bg-[#05060c]">
      {/* La photo, dans un cadre plus haut que l'écran */}
      <div ref={photo} className="absolute inset-x-0 top-0 h-[138%] will-change-transform">
        <Image src={CITY_PHOTO} alt="" fill priority sizes="100vw" className="object-cover object-center" />
      </div>

      {/* Embrasement : la même image floutée, en fusion `screen`.
          Le flou est calculé sur une couche au QUART de la taille, puis
          agrandie x4 par transform (gratuit). Un `blur(26px)` en plein écran
          coûtait une fortune ; ici `blur(7px)` sur un quart de surface donne le
          même rendu pour ~1/16e du travail. */}
      <div ref={ignite} className="absolute inset-x-0 top-0 h-[138%] mix-blend-screen will-change-transform">
        <div className="absolute left-0 top-0 h-1/4 w-1/4 origin-top-left scale-[4]">
          <Image
            src={CITY_PHOTO}
            alt=""
            fill
            sizes="25vw"
            className="object-cover object-center"
            style={{ filter: "blur(7px) brightness(1.55) saturate(1.4)" }}
          />
        </div>
      </div>

      {/* Étalonnage : le couchant s'efface... */}
      <div
        ref={dusk}
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,150,58,0.22) 0%, rgba(255,116,48,0.10) 32%, rgba(90,70,140,0.06) 64%, transparent 100%)",
        }}
      />
      {/* ...et le bleu nuit monte */}
      <div
        ref={night}
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(3,6,24,0.94) 0%, rgba(4,8,28,0.42) 38%, rgba(5,9,30,0.34) 72%, rgba(12,8,22,0.58) 100%)",
        }}
      />

      {/* Étalonnage cinéma : ombres froides, hautes lumières chaudes.
          En alpha simple et NON en `soft-light` : un mode de fusion plein écran
          force une recomposition de toute la surface à chaque frame de scroll.
          Le rendu est à peine moins subtil, pour un coût nul. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(70% 60% at 18% 88%, rgba(255,150,70,0.30), transparent 62%), radial-gradient(70% 60% at 84% 10%, rgba(60,120,230,0.26), transparent 62%)",
        }}
      />

      {/* Grain + vignette : la finition photographique. Vignettage OUVERT : à
          0,8 d'opacité il noircissait tout le bord gauche, bien plus que le
          voile de texte lui-même. */}
      <div className="absolute inset-0 opacity-[0.10]" style={{ backgroundImage: GRAIN }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 120% 105% at 50% 46%, transparent 64%, rgba(2,3,8,0.34) 100%)" }}
      />

      {/* Lisibilité, SANS bandeau. Un dégradé gauche vers droite se lit comme un
          voile noir posé sur la photo, parce que l'oeil repère la transition. On
          combine donc un assombrissement UNIFORME et léger (aucun bord) et un
          halo très large derrière le bloc de texte. */}
      <div className="absolute inset-0 bg-[rgba(3,4,10,0.22)]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(80% 92% at 18% 52%, rgba(3,4,10,0.30), transparent 80%)" }}
      />
    </div>
  );
}
