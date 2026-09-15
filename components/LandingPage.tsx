"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import type LenisInstance from "lenis";
import { signInWithGoogle } from "@/lib/supabase";
import { defaultVideos } from "@/data/videos";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING — atelier, pas tableau de bord
//
// ── La direction, et d'où elle vient ──────────────────────────────────────
// Direction validée par l'utilisateur sur une référence précise
// (forgeautomotive.co.uk) : « c'est exactement le type de design que je veux ».
// Le vocabulaire est donc repris, pas copié :
//   . un noir profond, texturé d'un grain fin, et RIEN d'autre comme fond ;
//   . un TITRAGE très grand et centré, en Geist léger à chasse resserrée ;
//   . le même titrage en MOT FANTÔME derrière les paragraphes, très basse
//     opacité, comme un filigrane de chapitre ;
//   . des boutons RECTANGULAIRES à filet, en capitales très espacées. Pas de
//     pilules : la pilule est un signe d'application, pas d'atelier ;
//   . de la photographie plein cadre, alternée avec des panneaux cadrés ;
//   . une barre de progression de lecture, fine, en bas de l'écran ;
//   . un chrome minuscule : logo au centre, et c'est à peu près tout.
//
// ── Ce qui BOUGE, et c'est l'essentiel ────────────────────────────────────
// Analyse du DOM de la référence, pas de son allure : elle tourne sur **Lenis**
// (pas ScrollSmoother), porte 22 noeuds `data-trail` (une traînée d'images au
// curseur), transforme ses trois véhicules en JS (parallaxe de pointeur) et
// découpe ses titres en mots. Les quatre sont repris ici :
//   1. `SmoothScroll` : Lenis, branché sur `gsap.ticker` et `ScrollTrigger` ;
//   2. `ImageTrail` : bouger la souris sur le premier écran laisse une traînée
//      de paysages DU CATALOGUE. Bouger, c'est feuilleter le produit ;
//   3. parallaxe de pointeur sur les trois cadres du hero (`HeroStage`) ;
//   4. boutons magnétiques (`Cta`), titres découpés en LIGNES par SplitText (`Lines`),
//      et parallaxe de scroll sur chaque photographie plein cadre.
//
// ── La police ─────────────────────────────────────────────────────────────
// **Geist**, partout, à la demande de l'utilisateur (une serif d'affichage
// avait été essayée puis écartée). La référence fait d'ailleurs pareil pour
// son corps de texte. Le titrage tient par la TAILLE, la graisse légère et la
// chasse resserrée, pas par un changement de famille.
//
// ── Ce qui a été retiré, et pourquoi ──────────────────────────────────────
// La ville 3D procédurale (`CityScene`, three.js) a été SUPPRIMÉE. Ce langage
// est photographique et typographique ; une ville de synthèse le contredisait,
// et elle a été rejetée deux fois. L'imagerie revient donc à ce que le produit
// possède réellement : les photos de Séoul et les vignettes du catalogue.
//
// ── Les appels à l'action ─────────────────────────────────────────────────
// « Commencer » n'apparaît qu'à TROIS endroits : le bandeau, le hero, l'action
// finale. Répéter la même action à chaque section la banalise et hache la
// lecture. Ne pas en rajouter.
//
// ── L'imagerie ────────────────────────────────────────────────────────────
// Zéro photo générique. Les cadres montrent les VRAIES vignettes YouTube du
// catalogue (`data/videos.ts`), et les plein-cadres la photo du projet. Les
// sources externes sont représentées par leur marque en SVG, jamais par une
// photo d'illustration.
//
// ── Le moteur ─────────────────────────────────────────────────────────────
// GSAP + ScrollTrigger, et rien d'autre sur cette page (le site connecté reste
// sur `motion/react`). Pas de `ScrollSmoother` : sur une page aussi chargée en
// images, il déporte le scroll sur le fil principal et produit exactement la
// saccade qu'il prétend corriger.
//
// ── Système de formes ─────────────────────────────────────────────────────
// TOUT est à angle droit. Aucun `rounded-*` sur cette page, hormis les points
// et les anneaux, qui sont ronds par nature. C'est le choix le plus lourd de
// conséquences de la direction, et il se tient de bout en bout.
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const byId = (id: string) => defaultVideos.find((v) => v.id === id);
const pick = (ids: string[]) => ids.map(byId).filter((v): v is NonNullable<typeof v> => Boolean(v));

/* ── La photographie ────────────────────────────────────────────────────────
   De vraies photos de Séoul la nuit, téléchargées depuis Pexels (licence
   libre, usage commercial, sans attribution obligatoire, donc conforme à la
   règle « tout reste gratuit » du projet). Elles sont servies par `next/image`,
   qui les convertit en AVIF/WebP et les met en cache sur l'edge Vercel.

   Deux registres, et ils ne se mélangent pas :
     . SÉOUL porte l'atmosphère (plein-cadres et volets du diaporama) ;
     . les VIGNETTES DU CATALOGUE portent le produit (bande du catalogue,
       panneaux de sources), parce que ce sont littéralement les paysages que
       l'application propose.
   `01-skyline-aerien` vient de la même série que la photo historique du projet
   (Ethan Brooke, Séoul), ce qui garde la continuité visuelle.              */
const SEOUL = {
  aerien: "/seoul/01-skyline-aerien.jpg",
  skyline: "/seoul/02-skyline-nuit.jpg",
  lotte: "/seoul/03-lotte-han.jpg",
  pont: "/seoul/04-pont-illumine.jpg",
  rue: "/seoul/05-rue-enseignes.jpg",
  pontLarge: "/seoul/06-pont-skyline.jpg",
} as const;

/** Grain argentique : bruit SVG en data-URI, zéro requête. Posé en couche fixe
 *  `pointer-events-none`, jamais sur un conteneur qui défile. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const POMODORO_SECONDS = 25 * 60;
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** État partagé de l'horloge de la page : lu à la frame, écrit par le scroll et
 *  par le minuteur de démonstration. Un ref, donc zéro re-render à la seconde. */
type Clock = { scroll: number; live: boolean; total: number; left: number };

/** `prefers-reduced-motion`, pour les cas où c'est la MISE EN PAGE qui change
 *  (et pas seulement l'animation, que `gsap.matchMedia()` gère très bien). */
function useReducedMotionPref() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(q.matches);
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, []);
  return reduced;
}

// ORDRE DE RAFRAÎCHISSEMENT. ⚠️ Dans GSAP, un `refreshPriority` PLUS ÉLEVÉ se
// rafraîchit EN PREMIER. Les sections épinglées allongent le document : elles
// doivent donc être mesurées AVANT tout ce qui se trouve plus bas, sinon chaque
// déclencheur en dessous démarre trop tôt, exactement de la distance
// d'épinglage. L'échelle est décroissante, du haut de la page vers le bas, et
// `below` vaut 0 (la valeur par défaut) parce que `ScrollTrigger.batch()`
// n'expose pas `refreshPriority`.
const PRIO = { top: 30, pan: 20, deck: 10, below: 0 } as const;

/* ══════════════════════════════════════════════════════════════════════════
   LE SYSTÈME DE MOUVEMENT
   ══════════════════════════════════════════════════════════════════════════

   Le défaut de la version précédente : de l'animation POSÉE SUR une page, au
   lieu d'une page CONSTRUITE par son animation. Concrètement, des fondus vers
   le haut de 0,95 s sur 36 pixels. Ça se lit comme « une page correcte », pas
   comme une pièce animée.

   Trois principes, tenus partout :

   1. RIEN N'APPARAÎT, TOUT ARRIVE. Chaque texte est découpé en LIGNES par
      SplitText et chaque ligne se lève derrière un masque. C'est la signature
      visuelle du GSAP soigné, et c'est ce qui manquait le plus.
   2. DU POIDS. Des durées longues (1,2 s), une courbe très décélérée
      (`power4.out`) et de grandes distances. Une ligne qui monte de 118 % de
      sa hauteur a une masse ; une opacité qui passe de 0 à 1 n'en a aucune.
   3. LES SECTIONS SE PASSENT LE RELAIS. Les plein-cadres ne défilent pas : ils
      RECULENT et s'effacent pendant que la suivante arrive par-dessus. On
      traverse des plans, on ne fait pas défiler une liste.                  */

const EASE = "power4.out";
const DUR = 1.2;
const STAGGER = 0.085;

/** Un bloc de texte qui arrive LIGNE PAR LIGNE, chacune derrière son masque.
 *
 *  `autoSplit` re-découpe au chargement des polices et aux changements de
 *  largeur : sans lui, les lignes seraient calculées sur la police de repli et
 *  les masques tomberaient au mauvais endroit. L'animation est créée DANS
 *  `onSplit` et retournée, ce qui laisse SplitText la nettoyer et la
 *  resynchroniser à chaque redécoupage. */
function Lines({
  children,
  as = "p",
  className,
  delay = 0,
  start = "top 85%",
}: {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
  start?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(el, { autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 118,
              duration: DUR,
              ease: EASE,
              stagger: STAGGER,
              delay,
              scrollTrigger: { trigger: el, start, once: true, refreshPriority: PRIO.below },
            });
          },
        });
        return () => split.revert();
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  // ⚠️ Pas de `createElement(as, { ref })` : passer un ref à une fonction est
  // considéré comme une lecture de ref PENDANT LE RENDU. On garde donc du JSX,
  // avec un ref de RAPPEL, qui n'est appelé qu'après le montage.
  const set = (el: HTMLElement | null) => {
    ref.current = el;
  };
  if (as === "h1") return <h1 ref={set} className={className}>{children}</h1>;
  if (as === "h2") return <h2 ref={set} className={className}>{children}</h2>;
  if (as === "h3") return <h3 ref={set} className={className}>{children}</h3>;
  return <p ref={set} className={className}>{children}</p>;
}

/* ══════════════════════════════════════════════════════════════════════════
   LE DÉFILEMENT AMORTI
   ══════════════════════════════════════════════════════════════════════════

   **Lenis**, et non `ScrollSmoother`. C'est ce que fait la référence, et pour
   une bonne raison : Lenis n'enveloppe pas la page dans un conteneur
   transformé, il interpole la position de scroll native. Rien ne casse
   (`position: fixed`, épinglages, mesures), et le coût est de l'ordre de deux
   kilo-octets.
   `ScrollSmoother`, lui, translate en continu un conteneur de douze mille
   pixels de haut : sur une page aussi chargée en photographies, il déporte tout
   sur le fil principal et produit exactement la saccade qu'il prétend corriger.
   C'était l'une des deux causes des ralentissements signalés.

   Intégration : Lenis pousse ses mises à jour dans `ScrollTrigger.update`, et
   c'est `gsap.ticker` qui bat la mesure pour les deux. Un seul cœur, donc
   aucune désynchronisation entre le scroll et les animations.
   `lagSmoothing(0)` est nécessaire : sans lui, GSAP « rattrape » les frames
   perdues et l'amortissement fait un bond après chaque hoquet. */

function SmoothScroll() {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      let lenis: LenisInstance | null = null;
      let raf: ((t: number) => void) | null = null;
      let cancelled = false;

      // Chargé à la demande : deux kilo-octets, mais inutiles tant que la page
      // n'est pas montée, et totalement inutiles sous mouvement réduit.
      void import("lenis").then(({ default: Lenis }) => {
        if (cancelled) return;
        const instance = new Lenis({ duration: 1.05, smoothWheel: true });
        instance.on("scroll", ScrollTrigger.update);
        lenis = instance;
        raf = (time: number) => instance.raf(time * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
      });

      return () => {
        cancelled = true;
        if (raf) gsap.ticker.remove(raf);
        gsap.ticker.lagSmoothing(500, 33);
        lenis?.destroy();
      };
    });
    return () => mm.revert();
  });
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   LA TRAÎNÉE D'IMAGES — l'effet qu'on déclenche en bougeant
   ══════════════════════════════════════════════════════════════════════════

   Le geste signature de la référence : en déplaçant la souris sur le premier
   écran, on laisse derrière soi une traînée de vignettes qui apparaissent puis
   s'effacent. Ici ce sont les VRAIS paysages du catalogue : bouger la souris,
   c'est feuilleter le produit.

   Trois points de méthode :
     . les vignettes sont recyclées dans un anneau fixe (douze éléments montés
       une fois), jamais créées à la volée. Aucune allocation pendant le
       mouvement ;
     . l'émission est cadencée par la DISTANCE parcourue, pas par le temps :
       un mouvement lent ne crache pas cinquante images au même endroit ;
     . tout passe par `transform` et `opacity`, et l'effet ne s'arme que sur un
       pointeur fin (au doigt, il n'existe pas de survol) et hors mouvement
       réduit. */

const TRAIL = pick(["hk-02", "driv-05", "cn-01", "tw-02", "vn-01", "abao-11", "no-01", "id-02", "th-01", "uk-01", "np-01", "noma-07"]);
/** Distance en pixels entre deux vignettes. Plus elle est courte, plus la
 *  traînée est DENSE : à 145 px on obtenait trois images éparses, c'est-à-dire
 *  rien du tout. À 78 px le geste laisse un vrai ruban derrière le curseur. */
const TRAIL_STEP = 78;

function ImageTrail() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-trail-item]", root.current);
      if (items.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        gsap.set(items, { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.7 });

        let next = 0;
        let lastX = 0;
        let lastY = 0;
        let primed = false;

        const onMove = (e: PointerEvent) => {
          const box = root.current?.getBoundingClientRect();
          if (!box) return;
          // On reste dans le premier écran : la traînée est un geste d'accueil,
          // pas un curseur personnalisé qui suivrait toute la page.
          if (e.clientY > box.bottom || e.clientY < box.top) return;

          if (!primed) {
            lastX = e.clientX;
            lastY = e.clientY;
            primed = true;
            return;
          }
          if (Math.hypot(e.clientX - lastX, e.clientY - lastY) < TRAIL_STEP) return;
          lastX = e.clientX;
          lastY = e.clientY;

          const el = items[next % items.length];
          next += 1;
          gsap.killTweensOf(el);
          gsap.set(el, {
            x: e.clientX - box.left,
            y: e.clientY - box.top,
            zIndex: next,
            rotate: gsap.utils.random(-8, 8),
          });
          // Entrée nette, sortie longue : c'est l'écart entre les deux qui
          // crée le ruban. Une entrée et une sortie de même durée donnent un
          // clignotement, pas une traînée.
          gsap
            .timeline()
            .fromTo(
              el,
              { autoAlpha: 0, scale: 0.6, filter: "blur(6px)" },
              { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power4.out" }
            )
            .to(el, { autoAlpha: 0, scale: 1.14, duration: 1.1, ease: "power2.in" }, 0.75);
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        return () => window.removeEventListener("pointermove", onMove);
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 z-[-5] overflow-hidden">
      {TRAIL.map((v) => (
        <span key={v.id} data-trail-item className="absolute left-0 top-0 block w-[17rem] border border-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb(v.youtubeId)} alt="" loading="lazy" className="block aspect-[16/10] w-full object-cover" />
        </span>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PRIMITIVES
   ══════════════════════════════════════════════════════════════════════════ */

/** Micro-label : capitales minuscules, très espacées. */
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("block font-mono text-[10px] uppercase tracking-[0.3em] text-white/40", className)}>
      {children}
    </span>
  );
}

/** Bouton rectangulaire à filet. Le remplissage arrive par la GAUCHE au survol,
 *  en `scaleX` depuis l'origine gauche : c'est du transform, donc composé par
 *  le GPU, là où une transition de `background` repeindrait la surface. */
function Cta({
  label,
  onClick,
  className,
  tone = "line",
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  tone?: "line" | "solid";
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const move = useRef<{ x: (v: number) => void; y: (v: number) => void } | null>(null);

  // Magnétisme : le bouton vient à la rencontre du curseur. `gsap.quickTo`
  // réutilise un seul tween au lieu d'en créer un par mouvement de souris,
  // c'est la seule façon correcte d'animer une valeur mise à jour en continu.
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      // Au doigt, le magnétisme déplacerait la cible au moment du tap.
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        move.current = {
          x: gsap.quickTo(el, "x", { duration: 0.55, ease: "power3" }),
          y: gsap.quickTo(el, "y", { duration: 0.55, ease: "power3" }),
        };
        return () => {
          move.current = null;
          gsap.set(el, { x: 0, y: 0 });
        };
      });
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <button
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!move.current || !el) return;
        const r = el.getBoundingClientRect();
        move.current.x(((e.clientX - r.left) / r.width - 0.5) * 26);
        move.current.y(((e.clientY - r.top) / r.height - 0.5) * 14);
      }}
      onPointerLeave={() => {
        move.current?.x(0);
        move.current?.y(0);
      }}
      onClick={onClick}
      className={cn(
        "group relative isolate inline-flex items-center justify-center overflow-hidden px-9 py-4",
        "font-mono text-[11px] uppercase tracking-[0.24em] transition-colors duration-500",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        tone === "solid"
          ? "bg-white text-black hover:bg-white/90"
          : "border border-white/25 text-white hover:border-white/60 hover:text-black",
        className
      )}
    >
      {tone === "line" && (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 origin-left scale-x-0 bg-white transition-transform duration-[650ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-x-100"
        />
      )}
      {label}
    </button>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.2 2.3" strokeLinecap="round" />
      </svg>
      <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-white">FocusFlow</span>
    </span>
  );
}

/* `MaskedLine` a été retiré : le découpage en mots fait maison est remplacé
   partout par `Lines`, qui découpe en LIGNES via SplitText et les fait monter
   derrière un masque. Une ligne qui se lève a du poids ; un mot qui apparaît
   n'en a pas. */

/** Mot fantôme : le titrage en très grand et très basse opacité, DERRIÈRE le
*  paragraphe. Il dérive doucement au scroll, ce qui creuse la profondeur sans
 *  rien ajouter à l'écran. */
function Ghost({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      data-ghost
      className={cn(
        "pointer-events-none absolute -z-10 select-none tracking-[-0.035em] text-[clamp(5rem,13vw,11rem)] font-light leading-[0.8] text-white/[0.07]",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Cadre photographique : filet blanc très fin, image en 16:10.
 *  Les vignettes YouTube `hqdefault` font 480x360 avec des bandes noires en
 *  haut et en bas ; un cadre en 16:10 les recadre exactement dans la zone
 *  utile, sans jamais laisser voir les bandes. */
function Frame({
  src,
  alt,
  className,
  ratio = "16/10",
  local = false,
}: {
  src: string;
  alt: string;
  className?: string;
  ratio?: string;
  /** Photo servie depuis `public/` : on passe par `next/image` pour l'AVIF. Les
   *  vignettes YouTube, elles, sont distantes et restent en `<img>`. */
  local?: boolean;
}) {
  return (
    <span className={cn("relative block overflow-hidden border border-white/12", className)} style={{ aspectRatio: ratio }}>
      {local ? (
        <Image src={src} alt={alt} fill sizes="(max-width: 768px) 92vw, 45vw" className="object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'HORLOGE DE LA PAGE — la landing EST un pomodoro
   ══════════════════════════════════════════════════════════════════════════

   Le compteur du bandeau part de 25:00 en haut de page et atteint 00:00 en
   bas : parcourir la page, c'est dérouler une session. Et si le visiteur lance
   le vrai minuteur de la section démo, CELUI-CI PREND LE RELAIS.

   Un unique `gsap.ticker` lit l'état partagé et écrit directement dans le DOM,
   avec une garde par valeur pour ne toucher au DOM que si l'affichage change.
   Aucun re-render React. */

const CLOCK_R = 11;
const CLOCK_C = 2 * Math.PI * CLOCK_R;

function SessionClock({ clock, onDoneChange }: { clock: React.RefObject<Clock>; onDoneChange: (done: boolean) => void }) {
  const root = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);

  useGSAP(
    () => {
      let lastText = "";
      let lastLabel = "";
      let lastRatio = -1;
      let wasDone: boolean | null = null;

      const tick = () => {
        const c = clock.current;
        if (!c) return;
        const scroll = gsap.utils.clamp(0, 1, c.scroll);
        const seconds = c.live ? Math.max(0, c.left) : POMODORO_SECONDS * (1 - scroll);
        const ratio = c.live ? (c.total > 0 ? 1 - Math.max(0, c.left) / c.total : 0) : scroll;
        const done = c.live ? c.left <= 0 : scroll > 0.985;

        const text = done ? "00:00" : `${pad(seconds / 60)}:${pad(seconds % 60)}`;
        if (text !== lastText && timeRef.current) {
          lastText = text;
          timeRef.current.textContent = text;
        }
        const label = done ? "pause méritée" : c.live ? "ta session" : "cette page";
        if (label !== lastLabel && labelRef.current) {
          lastLabel = label;
          labelRef.current.textContent = label;
        }
        const rounded = Math.round(ratio * 400) / 400;
        if (rounded !== lastRatio && ringRef.current) {
          lastRatio = rounded;
          ringRef.current.style.strokeDashoffset = String(CLOCK_C * (1 - rounded));
        }
        if (done !== wasDone) {
          wasDone = done;
          onDoneChange(done);
        }
      };

      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    },
    { scope: root }
  );

  return (
    <span ref={root} className="flex items-center gap-2.5" title="La page se déroule comme une session de 25 minutes.">
      <svg viewBox="0 0 26 26" className="h-[26px] w-[26px] -rotate-90">
        <circle cx="13" cy="13" r={CLOCK_R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        <circle
          ref={ringRef}
          cx="13"
          cy="13"
          r={CLOCK_R}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1"
          strokeDasharray={CLOCK_C}
          strokeDashoffset={CLOCK_C}
        />
      </svg>
      <span className="hidden flex-col leading-none sm:flex">
        <span ref={timeRef} className="font-mono text-[11px] tabular-nums tracking-wider text-white">
          25:00
        </span>
        <span ref={labelRef} className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
          cette page
        </span>
      </span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO — le produit au centre, encadré par deux paysages
   ══════════════════════════════════════════════════════════════════════════

   Composition reprise de la référence, où trois véhicules détourés cadrent le
   titre, celui du milieu étant le seul en couleur. Ici : deux paysages du
   catalogue en retrait, assombris, et AU CENTRE l'écran de session, seul
   élément à porter de la lumière. Le sujet du site est donc littéralement au
   centre du cadre. */

const HERO_TRACK = byId("driv-05") ?? defaultVideos[0];

function HeroStage() {
  const root = useRef<HTMLDivElement>(null);

  // Parallaxe de pointeur : les trois cadres répondent au curseur à des
  // amplitudes différentes, donc la composition a une ÉPAISSEUR. C'est ce que
  // fait la référence sur ses trois véhicules. La position du pointeur ne passe
  // évidemment pas par un state React : `quickTo` interpole hors du cycle de
  // rendu, sinon l'arbre entier se re-rendrait à chaque pixel parcouru.
  useGSAP(
    () => {
      const plates = gsap.utils.toArray<HTMLElement>("[data-stage]", root.current);
      if (plates.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        const DEPTH = [26, 10, 26];
        const setters = plates.map((el, i) => ({
          x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3" }),
          y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3" }),
          d: DEPTH[i] ?? 16,
        }));

        const onMove = (e: PointerEvent) => {
          const px = e.clientX / window.innerWidth - 0.5;
          const py = e.clientY / window.innerHeight - 0.5;
          setters.forEach((s) => {
            s.x(-px * s.d);
            s.y(-py * s.d * 0.55);
          });
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        return () => {
          window.removeEventListener("pointermove", onMove);
          gsap.set(plates, { x: 0, y: 0 });
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="relative mx-auto mt-12 grid w-full max-w-[78rem] grid-cols-1 items-end gap-5 md:mt-14 md:grid-cols-[1fr_1.35fr_1fr] md:gap-8">
      {/* Deux photographies de Séoul en portrait, hautes, qui cadrent le
          produit. Elles DÉBORDENT sous le bord de l'écran : c'est ce qui fait
          que le hero se lit comme une image et non comme un bloc de texte
          suivi de vignettes. */}
      <span data-stage className="hidden md:block">
        <Frame src={SEOUL.lotte} alt="" local ratio="3/4" className="opacity-80" />
      </span>

      {/* L'écran de session : le seul élément lumineux de la composition, et le
          seul à porter de la couleur. C'est le sujet du site, il est donc
          littéralement au centre du cadre. */}
      <div data-stage className="relative border border-white/20 bg-black shadow-[0_40px_120px_-40px_rgba(0,0,0,1)]">
        <div className="relative aspect-[4/3] w-full md:aspect-[5/4]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb(HERO_TRACK.youtubeId)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <span className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" aria-hidden />
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="relative h-24 w-24">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                <circle
                  data-hero-ring
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#ffc38a"
                  strokeWidth="1.5"
                  strokeDasharray={2 * Math.PI * 45}
                  strokeDashoffset={2 * Math.PI * 45}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[22px] tabular-nums text-white">
                16:02
              </span>
            </span>
            <span className="mt-6 max-w-[80%] truncate text-center text-[12px] text-white/70">{HERO_TRACK.title}</span>
            <Label className="mt-2">{HERO_TRACK.country}</Label>
          </span>
        </div>
      </div>

      <span data-stage className="hidden md:block">
        <Frame src={SEOUL.rue} alt="" local ratio="3/4" className="opacity-80" />
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LE MANIFESTE — plein cadre, la seconde ligne s'allume mot par mot
   ══════════════════════════════════════════════════════════════════════════ */

const CLAIM_1 = "On ne t'ajoute pas des outils.";
const CLAIM_2 = "On t'enlève le bruit.";

function Statement() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const words = gsap.utils.toArray<HTMLElement>("[data-claim-word]", root.current);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(words, { opacity: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tween = gsap.fromTo(
          words,
          { opacity: 0.12 },
          {
            opacity: 1,
            ease: "none",
            stagger: { amount: 0.9, from: "start" },
            scrollTrigger: {
              trigger: root.current,
              start: "top 72%",
              end: "bottom 72%",
              scrub: 0.5,
              refreshPriority: PRIO.top,
            },
          }
        );
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5">
      <span data-parallax aria-hidden className="absolute inset-0">
        <Image src={SEOUL.skyline} alt="" fill sizes="100vw" className="object-cover opacity-45" />
      </span>
      <span aria-hidden className="absolute inset-0 bg-black/60" />
      <p data-recede className="relative max-w-5xl text-center tracking-[-0.035em] text-[clamp(2.2rem,6.4vw,5.2rem)] font-light leading-[1.08]">
        <span className="block text-white">{CLAIM_1}</span>
        <span className="mt-2 block">
          {CLAIM_2.split(" ").map((w, i) => (
            <span key={i} data-claim-word className="text-white">
              {w}{" "}
            </span>
          ))}
        </span>
      </p>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LE CATALOGUE — panneau épinglé, travelling horizontal
   ══════════════════════════════════════════════════════════════════════════

   Le scroll vertical devient un déplacement latéral : un mot fantôme géant
   traverse le cadre, suivi des paysages, puis du propos et de l'action.
   `ease: "none"` est obligatoire, c'est ce qui garde le rapport 1:1 entre la
   position de scroll et la position horizontale.

   Sur mobile et sous mouvement réduit, aucun détournement du scroll : la
   rangée redevient un défilement horizontal natif, au doigt. */

const BELT = pick(["hk-02", "driv-05", "cn-01", "tw-02", "vn-01", "abao-11", "no-01", "noma-07", "uk-01", "id-02"]);

function Catalogue() {
  const wrap = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPref();

  useGSAP(
    () => {
      if (reduced) return;
      const t = track.current;
      const w = wrap.current;
      if (!t || !w) return;

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        const distance = () => Math.max(1, t.scrollWidth - window.innerWidth + 80);
        const tween = gsap.to(t, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: w,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.5,
            invalidateOnRefresh: true,
            refreshPriority: PRIO.pan,
          },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: wrap, dependencies: [reduced], revertOnUpdate: true }
  );

  return (
    <section
      id="catalogue"
      ref={wrap}
      className={cn("relative bg-black", reduced ? "overflow-x-auto" : "overflow-x-auto md:overflow-x-clip")}
    >
      <div ref={track} className="flex h-[70vh] w-max items-center gap-10 px-5 sm:px-10 md:h-[100dvh] md:gap-14">
        <div className="relative w-[min(80vw,30rem)] shrink-0">
          <Ghost className="-left-4 -top-16">Catalogue</Ghost>
          <Label>Le catalogue</Label>
          <Lines as="h2" start="top bottom" className="mt-7 tracking-[-0.035em] text-[clamp(2.2rem,5vw,4rem)] font-light leading-[1.02]">
            Cinquante-six endroits où poser ta soirée.
          </Lines>
          <Lines as="p" start="top bottom" delay={0.12} className="mt-7 max-w-sm text-[14.5px] leading-relaxed text-white/60">
            Study with me à Osaka, la pluie sur Shinjuku, le Bund à minuit, un drive lofi au pied du Fuji. Tenus à la
            main, un par un.
          </Lines>
        </div>

        {BELT.map((v) => (
          <article key={v.id} className="w-[19rem] shrink-0 md:w-[23rem]">
            <Frame src={thumb(v.youtubeId)} alt="" />
            <p className="mt-4 truncate text-[13px] text-white/80">{v.title}</p>
            <Label className="mt-2">{v.country}</Label>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LES TROIS PILIERS — diaporama épinglé, numéroté
   ══════════════════════════════════════════════════════════════════════════

   Une section épinglée, trois volets qui se succèdent au scroll. Chaque volet :
   l'image nette dans son cadre à gauche, LA MÊME IMAGE floutée en plein cadre
   derrière (c'est ce doublon flou qui donne le fond sans jamais jurer avec le
   sujet), le mot fantôme, le propos, et un compteur.

   Les volets sont empilés au même endroit : on ne fait varier que l'opacité et
   un léger décalage, jamais la mise en page. */

const DECK = [
  {
    ghost: "Minuteur",
    label: "01",
    title: "Le minuteur",
    body: "Vingt-cinq minutes, cinquante, ou un chrono libre qui s'arrête quand tu décroches. Les pauses se prennent toutes seules.",
    img: SEOUL.rue,
  },
  {
    ghost: "Musique",
    label: "02",
    title: "La musique",
    body: "Le catalogue, tes playlists YouTube dans TON ordre, Spotify Premium, un live Twitch. Dans le même écran que le minuteur.",
    img: SEOUL.skyline,
  },
  {
    ghost: "Trace",
    label: "03",
    title: "La trace",
    body: "Série, score de concentration, récap du dimanche. Construits tout seuls pendant que tu travaillais.",
    img: SEOUL.pont,
  },
];

function Deck() {
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotionPref();

  useGSAP(
    () => {
      if (reduced) return;
      const panels = gsap.utils.toArray<HTMLElement>("[data-panel]", section.current);
      const backs = gsap.utils.toArray<HTMLElement>("[data-panel-back]", section.current);
      if (panels.length === 0) return;

      gsap.set(panels.slice(1), { autoAlpha: 0, y: 40 });
      gsap.set(backs.slice(1), { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "+=" + panels.length * 100 + "%",
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          refreshPriority: PRIO.deck,
        },
      });

      panels.forEach((p, i) => {
        if (i === 0) return;
        const at = i - 1;
        tl.to(panels[i - 1], { autoAlpha: 0, y: -40, duration: 0.45 }, at)
          .to(backs[i - 1], { autoAlpha: 0, duration: 0.45 }, at)
          .to(p, { autoAlpha: 1, y: 0, duration: 0.45 }, at + 0.25)
          .to(backs[i], { autoAlpha: 1, duration: 0.45 }, at + 0.25);
      });

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
    { scope: section, dependencies: [reduced], revertOnUpdate: true }
  );

  // Sous mouvement réduit, l'empilement n'a pas de sens : les trois volets se
  // lisent à la suite, comme une liste.
  if (reduced) {
    return (
      <section className="mx-auto w-full max-w-[86rem] space-y-24 px-5 py-28 sm:px-10">
        {DECK.map((d) => {
          return (
            <div key={d.label} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <Frame src={d.img} alt="" local ratio="4/5" />
              <div>
                <Label>{d.label} / 03</Label>
                <h3 className="mt-6 tracking-[-0.035em] text-[clamp(2rem,4vw,3.2rem)] font-light leading-[1.05]">{d.title}</h3>
                <p className="mt-6 max-w-md text-[14.5px] leading-relaxed text-white/60">{d.body}</p>
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  return (
    <section ref={section} className="relative h-[100dvh] overflow-hidden bg-black">
      {/* Les fonds : LA MÊME IMAGE que le volet, floutée et assombrie. C'est ce
          doublon flou qui donne un fond à chaque volet sans jamais jurer avec
          son sujet, et c'est l'un des gestes les plus efficaces de la
          référence. */}
      {DECK.map((d) => (
        <span key={`b-${d.label}`} data-panel-back aria-hidden className="absolute inset-0">
          <Image src={d.img} alt="" fill sizes="100vw" className="scale-110 object-cover opacity-30 blur-2xl" />
          <span className="absolute inset-0 bg-black/60" />
        </span>
      ))}

      <div className="relative mx-auto flex h-full w-full max-w-[86rem] items-center px-5 sm:px-10">
        {DECK.map((d) => {
          return (
            <div
              key={d.label}
              data-panel
              className="absolute inset-x-5 grid items-center gap-10 sm:inset-x-10 md:grid-cols-2 md:gap-16"
            >
              <Frame src={d.img} alt="" local ratio="4/5" className="mx-auto w-full max-w-[26rem] bg-black" />
              <div className="relative">
                {/* Assez haut pour ne pas retomber sur le compteur : le mot
                    fantôme est un filigrane, il ne doit jamais gêner la
                    lecture de ce qu'il accompagne. */}
                <Ghost className="-top-28 left-0">{d.ghost}</Ghost>
                <Label>
                  {d.label} <span className="text-white/25">/ 03</span>
                </Label>
                <h3 className="mt-6 tracking-[-0.035em] text-[clamp(2rem,4.4vw,3.4rem)] font-light leading-[1.04]">
                  {d.title}
                </h3>
                {/* Pas de bouton ici : « Commencer » ne vit qu'à TROIS endroits
                    sur toute la page (le bandeau, le hero, l'action finale).
                    Répéter la même action à chaque volet la banalise et hache
                    la lecture. */}
                <p className="mt-6 max-w-md text-[14.5px] leading-relaxed text-white/60">{d.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LES SOURCES — quatre marques réelles, quatre panneaux cadrés
   ══════════════════════════════════════════════════════════════════════════ */

function YoutubeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#ff0033" aria-hidden>
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}
function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#1db954" aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.2a.75.75 0 1 1-.33-1.46c4.5-1 8.4-.55 11.5 1.35.35.22.46.68.25 1.06zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.2-2-8.07-2.54-11.85-1.39a.94.94 0 1 1-.54-1.8c4.32-1.31 9.69-.7 13.37 1.58.44.28.58.86.31 1.3zm.13-3.4C15.26 8.4 8.9 8.2 5.24 9.3a1.12 1.12 0 1 1-.65-2.15C8.79 5.88 15.81 6.12 20.24 8.75a1.12 1.12 0 1 1-1.14 1.93z" />
    </svg>
  );
}
function TwitchMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#9146ff" aria-hidden>
      <path d="M4.3 0 1 4.4v15.2h5.2V24h4.2l3.3-4.4h4.2L24 13V0H4.3zm17.2 12.2-3.3 3.3h-5.2l-3.3 3.3v-3.3H6.2V2.2h15.3v10z" />
      <path d="M13.6 5.4h2.2v6.5h-2.2zM8.7 5.4h2.2v6.5H8.7z" />
    </svg>
  );
}
function FolderMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#ffc38a" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17.5V7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

const SOURCES = [
  {
    mark: <FolderMark />,
    name: "Catalogue",
    body: "Une cinquantaine de paysages classés par ambiance. Rien à chercher, tu cliques et ça tourne.",
    id: "th-01",
  },
  {
    mark: <YoutubeMark />,
    name: "YouTube",
    body: "Tes playlists et ta file d'attente, jouées dans TON ordre. YouTube ne reprend jamais la main.",
    id: "id-02",
  },
  {
    mark: <SpotifyMark />,
    name: "Spotify",
    body: "Ta bibliothèque Premium se lit dans la session, sans changer d'onglet ni couper le minuteur.",
    id: "np-01",
  },
  {
    mark: <TwitchMark />,
    name: "Twitch",
    body: "Un live ou une rediffusion en fond, pour travailler à côté de quelqu'un.",
    id: "uk-01",
  },
];

function Sources() {
  return (
    <div className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-2">
      {SOURCES.map((s) => {
        const v = byId(s.id);
        return (
          <div key={s.name} data-reveal className="bg-black p-8 sm:p-10">
            <span className="flex items-center gap-3">
              {s.mark}
              <Label className="text-white/70">{s.name}</Label>
            </span>
            <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-white/60">{s.body}</p>
            {v && <Frame src={thumb(v.youtubeId)} alt="" className="mt-8 opacity-70" />}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LE MINUTEUR JOUABLE — la démonstration la plus honnête possible
   ══════════════════════════════════════════════════════════════════════════ */

const PRESETS = [
  { key: "classic", label: "Classique", work: "25 / 5", total: 25 * 60 },
  { key: "deep", label: "Longue", work: "50 / 10", total: 50 * 60 },
  { key: "court", label: "Court", work: "15 / 3", total: 15 * 60 },
] as const;

function TryPomodoro({ publish }: { publish: (live: boolean, total: number, left: number) => void }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("classic");
  const total = PRESETS.find((p) => p.key === preset)!.total;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  // « touched » = le visiteur a lancé SA session au moins une fois. C'est ce
  // qui fait basculer l'horloge du bandeau du temps de la page au sien.
  const [touched, setTouched] = useState(false);

  // « En cours » est DÉRIVÉ, jamais stocké : arrivé à zéro, `active` retombe
  // seul et l'effet nettoie son intervalle. Pas de `setState` dans un effet.
  const active = running && left > 0;

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    publish(touched, total, left);
  }, [publish, touched, total, left]);

  const progress = total > 0 ? 1 - left / total : 0;
  const dash = 2 * Math.PI * 54;

  return (
    <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
      <div data-reveal className="relative">
        <Ghost className="-top-12 left-0">Essaie</Ghost>
        <Label>La démonstration</Label>
        <Lines as="h2" className="mt-6 tracking-[-0.035em] text-[clamp(2rem,4.4vw,3.4rem)] font-light leading-[1.04]">
          Le vrai minuteur, ici même.
        </Lines>
        <p className="mt-6 max-w-md text-[14.5px] leading-relaxed text-white/60">
          Ce n&apos;est pas une capture. Lance-le, et le compteur en haut de page arrête de suivre ton scroll pour
          suivre ta session.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {PRESETS.map((p) => {
            const on = p.key === preset;
            return (
              <button
                key={p.key}
                onClick={() => {
                  setPreset(p.key);
                  setLeft(p.total);
                  setRunning(false);
                  setTouched(false);
                }}
                aria-pressed={on}
                className={cn(
                  "border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-500",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white",
                  on ? "border-white/60 text-white" : "border-white/15 text-white/45 hover:border-white/35 hover:text-white/80"
                )}
              >
                {p.label}
                <span className="ml-3 text-white/35">{p.work}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div data-reveal className="justify-self-center">
        <div className="border border-white/12 bg-black p-12">
          <div className="relative h-[15rem] w-[15rem]">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#ffc38a"
                strokeWidth="1.5"
                strokeDasharray={dash}
                strokeDashoffset={dash * (1 - progress)}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-[44px] leading-none tabular-nums text-white">
                {pad(left / 60)}:{pad(left % 60)}
              </span>
              <Label className="mt-3">{left === 0 ? "Terminé" : active ? "En cours" : "En attente"}</Label>
            </span>
          </div>

          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => {
                setTouched(true);
                if (left === 0) {
                  setLeft(total);
                  setRunning(true);
                } else setRunning((r) => !r);
              }}
              className="flex h-12 w-12 items-center justify-center border border-white/25 text-white transition-colors duration-500 hover:border-white hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              aria-label={active ? "Mettre en pause le minuteur" : "Démarrer le minuteur"}
            >
              {active ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" />
                  <rect x="14" y="5" width="4" height="14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => {
                setRunning(false);
                setTouched(false);
                setLeft(total);
              }}
              className="flex h-12 w-12 items-center justify-center border border-white/15 text-white/50 transition-colors duration-500 hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              aria-label="Réinitialiser le minuteur"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4.5V10h5.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LA TRACE — la grille se remplit, les chiffres se comptent
   ══════════════════════════════════════════════════════════════════════════

   Trame déterministe : aucun `Math.random` au rendu, le composant doit
   produire deux fois la même grille. */

const HEAT = Array.from({ length: 91 }, (_, i) => (i * 37) % 11);
const HEAT_STEPS = ["bg-white/[0.06]", "bg-[#ffc38a]/25", "bg-[#ffc38a]/50", "bg-[#ffc38a]/75", "bg-[#ffc38a]"];
const heatStep = (v: number) => (v > 8 ? 4 : v > 6 ? 3 : v > 4 ? 2 : v > 2 ? 1 : 0);

const TRACE_STATS = [
  { k: "Série en cours", to: 17, kind: "days" as const },
  { k: "Cette semaine", to: 560, kind: "hm" as const },
  { k: "Score de concentration", to: 84, kind: "plain" as const },
];

const fmtStat = (v: number, kind: "days" | "hm" | "plain") => {
  if (kind === "days") return `${Math.round(v)} j`;
  if (kind === "hm") return `${Math.floor(v / 60)}h ${pad(v % 60)}m`;
  return String(Math.round(v));
};

function Trace() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cells = gsap.utils.toArray<HTMLElement>("[data-heat]", root.current);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(cells, { autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const grid = gsap.fromTo(
          cells,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 0.5,
            ease: "power2.out",
            stagger: { amount: 0.9, grid: "auto", from: "start", axis: "x" },
            scrollTrigger: { trigger: root.current, start: "top 78%", once: true, refreshPriority: PRIO.below },
          }
        );

        // Les totaux montent jusqu'à leur valeur. On anime un objet, pas le
        // DOM : une seule écriture de texte par frame.
        const counters = gsap.utils.toArray<HTMLElement>("[data-count]", root.current).map((el) => {
          const target = Number(el.dataset.count);
          const kind = (el.dataset.kind ?? "plain") as "days" | "hm" | "plain";
          const box = { v: 0 };
          el.textContent = fmtStat(0, kind);
          return gsap.to(box, {
            v: target,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = fmtStat(box.v, kind);
            },
            scrollTrigger: { trigger: el, start: "top 90%", once: true, refreshPriority: PRIO.below },
          });
        });

        return () => {
          [grid, ...counters].forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root}>
      <div data-reveal className="border border-white/10 p-8 sm:p-12">
        <Label>Treize semaines, une case par soirée</Label>
        <div className="mt-8 grid grid-flow-col grid-rows-7 gap-[5px]">
          {HEAT.map((v, i) => (
            <span key={i} data-heat className={cn("h-[13px]", HEAT_STEPS[heatStep(v)])} />
          ))}
        </div>
      </div>

      {/* Les chiffres, nus, sous un filet. Pas de cartes : ils n'ont pas besoin
          d'élévation, ils ont besoin d'espace. */}
      <div data-reveal className="mt-12 grid gap-10 border-t border-white/10 pt-12 sm:grid-cols-3">
        {TRACE_STATS.map((s) => (
          <div key={s.k}>
            <p data-count={s.to} data-kind={s.kind} className="font-mono text-[38px] leading-none tabular-nums text-white">
              {fmtStat(s.to, s.kind)}
            </p>
            <Label className="mt-4">{s.k}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  const clock = useRef<Clock>({ scroll: 0, live: false, total: POMODORO_SECONDS, left: POMODORO_SECONDS });
  const [, setDone] = useState(false);
  const onDoneChange = useCallback((d: boolean) => setDone(d), []);

  const publish = useCallback((live: boolean, total: number, left: number) => {
    clock.current.live = live;
    clock.current.total = total;
    clock.current.left = left;
  }, []);

  const signIn = useCallback(() => {
    void signInWithGoogle();
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      /* ── Progression de la page ───────────────────────────────────────── */
      // Sans élément déclencheur : `start: 0` / `end: "max"` couvre le document
      // entier en positions de scroll absolues.
      const progress = ScrollTrigger.create({
        start: 0,
        end: "max",
        refreshPriority: PRIO.top,
        onUpdate: (self) => {
          if (clock.current) clock.current.scroll = self.progress;
          if (bar.current) bar.current.style.transform = `scaleX(${self.progress})`;
        },
      });

      /* ── Entrée du hero ───────────────────────────────────────────────── */
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-hero]", { autoAlpha: 1, y: 0 });
        gsap.set("[data-word]", { yPercent: 0 });
        gsap.set("[data-hero-ring]", { strokeDashoffset: 2 * Math.PI * 45 * 0.36 });
      });

      /* ── L'ARRIVÉE ────────────────────────────────────────────────────
         Le premier écran ne doit pas se poser, il doit ARRIVER. La photo se
         détend depuis un léger sur-cadrage (une caméra qui se cale), les mots
         du titre montent derrière leur masque, puis la composition se lève.
         C'est la seule séquence de la page qui joue au temps et non au
         scroll : elle accueille, elle ne raconte pas. */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from("[data-hero-img]", { scale: 1.16, duration: 2.6, ease: "power2.out" }, 0)
          .from("[data-hero='eyebrow']", { autoAlpha: 0, y: 14, duration: 0.7 }, 0.15)
          .from("[data-word]", { yPercent: 110, duration: 1.05, stagger: 0.05 }, 0.25)
          .from("[data-hero='sub']", { autoAlpha: 0, y: 18, duration: 0.8 }, 0.75)
          .from("[data-hero='cta']", { autoAlpha: 0, y: 16, duration: 0.8 }, 0.85)
          .from("[data-stage]", { autoAlpha: 0, y: 90, duration: 1.4, stagger: 0.12 }, 0.6)
          .fromTo(
            "[data-hero-ring]",
            { strokeDashoffset: 2 * Math.PI * 45 },
            { strokeDashoffset: 2 * Math.PI * 45 * 0.36, duration: 2.2, ease: "power2.inOut" },
            1.2
          );
        return () => tl.kill();
      });

      /* ── LA BALADE ────────────────────────────────────────────────────
         Chaque photographie plein cadre dérive plus lentement que la page qui
         la traverse. C'est ce décalage, et lui seul, qui donne la sensation
         d'avancer DANS quelque chose plutôt que de faire défiler une liste de
         sections. Le sur-cadrage (`scale`) est indispensable : sans lui, la
         dérive découvrirait le bord de l'image. */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const layers = gsap.utils.toArray<HTMLElement>("[data-parallax]", root.current);
        gsap.set(layers, { scale: 1.18 });
        const tweens = layers.map((el) =>
          gsap.fromTo(
            el,
            { yPercent: -9 },
            {
              yPercent: 9,
              ease: "none",
              scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6, refreshPriority: PRIO.below },
            }
          )
        );
        return () => {
          tweens.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
        };
      });

      /* ── Sortie du hero ───────────────────────────────────────────────── */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tween = gsap.to("[data-hero-img]", {
          yPercent: 12,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero-section]", start: "top top", end: "bottom top", scrub: 0.6, refreshPriority: PRIO.top },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      /* ── Dérive des mots fantômes ─────────────────────────────────────── */
      // Ils montent un peu moins vite que la page : la profondeur se lit sans
      // qu'on ajoute quoi que ce soit à l'écran.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const ghosts = gsap.utils.toArray<HTMLElement>("[data-ghost]", root.current);
        const tweens = ghosts.map((g) =>
          gsap.fromTo(
            g,
            { y: 60 },
            {
              y: -60,
              ease: "none",
              scrollTrigger: { trigger: g, start: "top bottom", end: "bottom top", scrub: 0.6, refreshPriority: PRIO.below },
            }
          )
        );
        return () => {
          tweens.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
        };
      });

      /* ── Révélations au scroll ────────────────────────────────────────── */
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", root.current);
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(items, { autoAlpha: 1, y: 0 });
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Les BLOCS (panneaux, cadres, grilles) arrivent autrement que le
        // texte : ils se dévoilent par le bas en `clip-path` tout en montant.
        // Un bloc qui se découvre a une matière ; un bloc qui passe de 0 à 1
        // d'opacité n'en a aucune.
        gsap.set(items, { y: 96, clipPath: "inset(0% 0% 100% 0%)" });
        const batched = ScrollTrigger.batch(items, {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              clipPath: "inset(0% 0% 0% 0%)",
              duration: 1.35,
              stagger: 0.12,
              ease: EASE,
              overwrite: true,
              // Le découpage est figé une fois joué : plus aucun coût de
              // composition résiduel sur la page.
              onComplete: () => gsap.set(batch, { clipPath: "none" }),
            }),
        });
        return () => batched.forEach((t) => t.kill());
      });

      /* ── LE RELAIS ENTRE SECTIONS ─────────────────────────────────────
         Les plein-cadres ne défilent pas : ils RECULENT et s'effacent pendant
         que la suivante arrive par-dessus. C'est ce qui donne l'impression de
         traverser des plans successifs plutôt que de faire défiler une liste
         de sections empilées. */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const layers = gsap.utils.toArray<HTMLElement>("[data-recede]", root.current);
        const tweens = layers.map((el) =>
          gsap.to(el, {
            scale: 0.92,
            autoAlpha: 0,
            ease: "none",
            scrollTrigger: {
              trigger: el.closest("section") ?? el,
              start: "center center",
              end: "bottom top",
              scrub: 0.5,
              refreshPriority: PRIO.below,
            },
          })
        );
        return () => {
          tweens.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
        };
      });

      /* ── Recalcul obligatoire ─────────────────────────────────────────── */
      // Les effets React s'exécutent ENFANT D'ABORD : quand ce composant monte
      // ses propres déclencheurs, les sections épinglées ont déjà inséré leur
      // `pin-spacer` et allongé le document. Sans ce recalcul, les déclencheurs
      // créés avant gardent des bornes calculées sur une page trop courte.
      const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
      let cancelled = false;
      void document.fonts?.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh();
      });

      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        progress.kill();
        mm.revert();
      };
    },
    { scope: root }
  );

  return (
    <main ref={root} className="relative w-full max-w-full overflow-x-clip bg-[#050505] text-white">
      {/* Le défilement amorti, monté en premier. */}
      <SmoothScroll />

      {/* Grain : couche fixe, jamais attachée à un conteneur qui défile. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      {/* Barre de progression de lecture, en bas de l'écran. Un `scaleX` sur un
          filet d'un pixel : composé par le GPU, aucun repaint. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-px bg-white/10">
        <span ref={bar} className="block h-full origin-left scale-x-0 bg-white/70" />
      </div>

      {/* Chrome minuscule : l'horloge à gauche, le nom au centre, l'action à
          droite. Aucun lien de section : sur une page qui se lit d'un trait,
          ils n'indiquent rien. */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 sm:px-10">
        <SessionClock clock={clock} onDoneChange={onDoneChange} />
        <Wordmark className="absolute left-1/2 hidden -translate-x-1/2 sm:flex" />
        <Cta label="Commencer" onClick={signIn} className="px-6 py-3 text-[10px]" />
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* Le hero est UNE IMAGE, pas un bloc de texte suivi de vignettes : une
          photographie de Séoul occupe tout le cadre, le titre se pose dessus,
          et la composition déborde sous le bord de l'écran. */}
      {/* `isolate` est OBLIGATOIRE : sans contexte d'empilement propre, la
          couche photographique en `-z-10` passe DERRIÈRE le fond de `main` et
          disparaît complètement. */}
      <section
        data-hero-section
        className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-5 pb-0 pt-28 text-center sm:px-10"
      >
        {/* La traînée : elle vit DANS le premier écran, derrière le texte. */}
        <ImageTrail />

        <span data-hero-img aria-hidden className="absolute inset-0 -z-10">
          <Image src={SEOUL.aerien} alt="" fill priority sizes="100vw" className="object-cover opacity-70" />
          {/* Les voiles doivent ASSEOIR le texte, pas effacer la photo : un
              `from-black ... to-black` plein, doublé d'un vignettage à 0,9,
              recouvrait l'image en entier. On garde du noir franc derrière le
              bandeau et sous le pied de page, et on laisse le milieu respirer. */}
          <span className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/35 to-black/85" />
          <span
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 65% at 50% 45%, transparent 40%, rgba(5,5,5,0.7) 100%)" }}
          />
        </span>

        <span data-hero="eyebrow" className="block">
          <Label>Gratuit, sans compte obligatoire</Label>
        </span>

        {/* L'arrivée du titre est pilotée par la timeline du hero, pas par le
            scroll : `start` est calé très haut pour que le ScrollTrigger soit
            déjà franchi au chargement. */}
        <Lines
          as="h1"
          start="top bottom"
          delay={0.25}
          className="mt-8 max-w-5xl tracking-[-0.035em] text-[clamp(2.6rem,7.2vw,6rem)] font-light leading-[0.98]"
        >
          Il fait presque nuit.
          <br />
          Allume ta fenêtre.
        </Lines>

        <p data-hero="sub" className="mt-7 max-w-md text-[14.5px] leading-relaxed text-white/55">
          Un minuteur Pomodoro et ta musique dans le même écran, posés sur un paysage qui tourne en boucle.
        </p>

        <div data-hero="cta" className="mt-9">
          <Cta label="Commencer" onClick={signIn} tone="solid" />
        </div>

        <HeroStage />
      </section>

      {/* ── Le manifeste ─────────────────────────────────────────────────── */}
      <Statement />

      {/* ── Le catalogue ─────────────────────────────────────────────────── */}
      <Catalogue />

      {/* ── Les trois piliers ────────────────────────────────────────────── */}
      <Deck />

      {/* ── Les sources ──────────────────────────────────────────────────── */}
      <section id="sources" className="mx-auto w-full max-w-[86rem] px-5 py-32 sm:px-10">
        <Lines as="h2" className="mb-16 max-w-3xl tracking-[-0.035em] text-[clamp(2rem,4.4vw,3.4rem)] font-light leading-[1.04]">
          Quatre façons de remplir le silence.
        </Lines>
        <Sources />
      </section>

      {/* ── Le minuteur jouable ──────────────────────────────────────────── */}
      <section id="minuteur" className="mx-auto w-full max-w-[86rem] px-5 pb-32 sm:px-10">
        <TryPomodoro publish={publish} />
      </section>

      {/* ── La trace ─────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[86rem] px-5 pb-32 sm:px-10">
        <Lines as="h2" className="mb-16 max-w-3xl tracking-[-0.035em] text-[clamp(2rem,4.4vw,3.4rem)] font-light leading-[1.04]">
          Le lendemain, tu sais ce que tu as fait.
        </Lines>
        <Trace />
      </section>

      {/* ── Action ───────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-5 text-center">
        <span data-parallax aria-hidden className="absolute inset-0">
          <Image src={SEOUL.pontLarge} alt="" fill sizes="100vw" className="object-cover opacity-35" />
        </span>
        <span aria-hidden className="absolute inset-0 bg-black/65" />
        <div data-recede className="relative">
          <Lines as="h2" className="mx-auto max-w-4xl tracking-[-0.035em] text-[clamp(2.4rem,7vw,5.6rem)] font-light leading-[1.02]">
            Il fait nuit. Tu as une heure devant toi.
          </Lines>
          <Lines as="p" className="mx-auto mt-10 max-w-md text-[14.5px] leading-relaxed text-white/55">
            Utilisable sans compte. Google sert seulement à retrouver ta progression d&apos;un appareil à l&apos;autre.
          </Lines>
          <div data-reveal className="mt-12">
            <Cta label="Commencer" onClick={signIn} tone="solid" />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[86rem] flex-col items-center justify-between gap-6 px-5 py-12 sm:flex-row sm:px-10">
          <Wordmark />
          <Label>Pomodoro, lofi, focus. {new Date().getFullYear()}</Label>
        </div>
      </footer>
    </main>
  );
}
