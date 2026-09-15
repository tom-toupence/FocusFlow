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
   LA NUIT — l'idée directrice de la page
   ══════════════════════════════════════════════════════════════════════════

   La page EST une nuit à Séoul, de 21:00 à 01:00, et le scroll fait avancer
   l'heure. Elle est découpée au rythme du pomodoro : des cycles de travail
   séparés par de vraies pauses, où la page respire au lieu d'enchaîner.

   Ce n'est pas une métaphore posée après coup : c'est la structure du document.
   Les sections SONT les cycles, l'horloge du bandeau SUIT le scroll, et les
   quatre marques de pomodoro se remplissent à mesure qu'on descend. Un
   visiteur qui parcourt la page a vécu une nuit de travail. */

/** Bornes de la nuit, en minutes depuis minuit. 21:00 → 01:00. */
const NIGHT_FROM = 21 * 60;
const NIGHT_TO = 25 * 60;

/** Les quatre cycles, et la part du scroll à laquelle chacun est acquis. */
const CYCLES = [0.2, 0.44, 0.68, 0.9];

const hhmm = (minutes: number) => {
  const m = Math.round(minutes) % (24 * 60);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** L'horloge de la nuit : l'heure avance avec le scroll, et les quatre
 *  pomodoros se remplissent au passage.
 *
 *  Un unique `gsap.ticker` lit l'état partagé et écrit directement dans le
 *  DOM, avec une garde par valeur pour ne toucher au DOM que si l'affichage
 *  change réellement. Aucun re-render React, même à la minute. */
function NightClock({ clock, onDoneChange }: { clock: React.RefObject<Clock>; onDoneChange: (done: boolean) => void }) {
  const root = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const marks = gsap.utils.toArray<HTMLElement>("[data-pomo]", root.current);
      let lastText = "";
      let lastLabel = "";
      let lastFilled = -1;
      let wasDone: boolean | null = null;

      const tick = () => {
        const c = clock.current;
        if (!c) return;
        const p = gsap.utils.clamp(0, 1, c.scroll);

        // Quand le visiteur lance le minuteur de la démonstration, l'horloge
        // cesse de suivre la page pour suivre SA session : c'est le seul
        // moment où la nuit fictive cède la place au temps réel.
        const text = c.live
          ? `${pad(Math.max(0, c.left) / 60)}:${pad(Math.max(0, c.left) % 60)}`
          : hhmm(NIGHT_FROM + (NIGHT_TO - NIGHT_FROM) * p);
        if (text !== lastText && timeRef.current) {
          lastText = text;
          timeRef.current.textContent = text;
        }

        const done = c.live ? c.left <= 0 : p > 0.985;
        const label = done ? "pause méritée" : c.live ? "ta session" : "cette nuit";
        if (label !== lastLabel && labelRef.current) {
          lastLabel = label;
          labelRef.current.textContent = label;
        }

        const filled = c.live ? lastFilled : CYCLES.filter((c2) => p >= c2).length;
        if (filled !== lastFilled) {
          lastFilled = filled;
          marks.forEach((m, i) => {
            gsap.to(m, {
              backgroundColor: i < filled ? "#ffc38a" : "rgba(255,255,255,0.14)",
              duration: 0.45,
              ease: "power2.out",
            });
          });
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
    <span ref={root} className="flex items-center gap-4" title="La page est une nuit de 21:00 à 01:00, en quatre pomodoros.">
      <span className="flex flex-col leading-none">
        <span ref={timeRef} className="font-mono text-[13px] tabular-nums tracking-wider text-white">
          21:00
        </span>
        <span ref={labelRef} className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
          cette nuit
        </span>
      </span>
      {/* Les quatre pomodoros de la nuit */}
      <span className="hidden items-center gap-1.5 sm:flex" aria-hidden>
        {CYCLES.map((c) => (
          <span key={c} data-pomo className="block h-[3px] w-5 bg-white/[0.14]" />
        ))}
      </span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'ENSEIGNE — le titre s'allume comme un néon
   ══════════════════════════════════════════════════════════════════════════

   La signature visuelle de la page, et elle vient du sujet : une rue de Séoul
   la nuit, c'est d'abord des enseignes qui s'allument. Le texte ne monte pas
   et ne se fond pas, il S'AMORCE : quelques ratés, puis la lueur s'installe.

   Le halo passe par une VARIABLE CSS animée (`--glow`) et non par une
   interpolation de `text-shadow` : GSAP ne sait interpoler une ombre que si
   les deux états ont exactement la même structure, ce qui est fragile. Une
   variable est un simple nombre, et le `calc()` fait le reste. */

function Neon({
  children,
  className,
  delay = 0,
  glow = 22,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  glow?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(el, { autoAlpha: 1, "--glow": glow });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(el, { autoAlpha: 0, "--glow": 0 });
        const tl = gsap.timeline({ delay });
        // Les ratés d'amorçage. Les durées sont volontairement irrégulières :
        // un clignotement régulier se lit comme une animation, pas comme un
        // tube qui peine à s'allumer.
        tl.to(el, { autoAlpha: 1, duration: 0.06 })
          .to(el, { autoAlpha: 0.15, duration: 0.09 })
          .to(el, { autoAlpha: 1, duration: 0.05 })
          .to(el, { autoAlpha: 0.35, duration: 0.13 })
          .to(el, { autoAlpha: 1, duration: 0.07 })
          .to(el, { autoAlpha: 0.6, duration: 0.05 })
          // ...puis la lueur s'installe, elle.
          .to(el, { autoAlpha: 1, "--glow": glow, duration: 1.6, ease: "power2.out" });
        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <span
      ref={ref}
      className={cn("inline-block", className)}
      style={{
        textShadow:
          "0 0 calc(var(--glow, 0) * 1px) rgba(255,198,140,0.55), 0 0 calc(var(--glow, 0) * 2.6px) rgba(255,140,60,0.28)",
      }}
    >
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LA PAUSE — la page respire
   ══════════════════════════════════════════════════════════════════════════

   Le moment le plus inhabituel de la page, et le plus fidèle au sujet. Entre
   deux cycles, on ne enchaîne pas : la section INSPIRE puis EXPIRE. La photo
   s'ouvre lentement, le texte s'écarte, puis tout se resserre.

   Une pause de pomodoro n'est pas un vide, c'est un temps qui a une forme.
   Une page qui enchaîne ses sections ne peut pas parler de pauses de façon
   crédible ; celle-ci en impose une au lecteur, dans son corps même.

   Techniquement : une timeline scrubée en deux temps (0 → 1 → 0) sur la
   traversée de la section. Tout est en `scale` et `opacity`, plus un
   `letter-spacing` sur une seule ligne courte, dont le coût de mise en page
   est négligeable et qui rend l'expansion lisible. */

function Breath({ time, line, img, minutes }: { time: string; line: string; img: string; minutes: string }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const photo = root.current?.querySelector("[data-breath-photo]");
      const copy = root.current?.querySelector("[data-breath-copy]");
      if (!photo || !copy) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "sine.inOut" },
          scrollTrigger: {
            trigger: root.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
            refreshPriority: PRIO.below,
          },
        });
        // Inspiration
        tl.to(photo, { scale: 1.16, duration: 1 }, 0).to(copy, { letterSpacing: "0.34em", opacity: 1, duration: 1 }, 0);
        // Expiration
        tl.to(photo, { scale: 1, duration: 1 }, 1).to(copy, { letterSpacing: "0.18em", opacity: 0.55, duration: 1 }, 1);
        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} className="relative flex h-[85vh] items-center justify-center overflow-hidden">
      <span data-breath-photo aria-hidden className="absolute inset-0">
        <Image src={img} alt="" fill sizes="100vw" className="object-cover opacity-30" />
      </span>
      <span aria-hidden className="absolute inset-0 bg-black/55" />
      <div className="relative text-center">
        <Label>
          {time} · pause de {minutes}
        </Label>
        <p
          data-breath-copy
          className="mt-8 font-mono text-[11px] uppercase text-white/55"
          style={{ letterSpacing: "0.18em" }}
        >
          {line}
        </p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'EN-TÊTE DE CYCLE — l'heure, le numéro, le titre
   ══════════════════════════════════════════════════════════════════════════ */

function CycleHead({
  n,
  time,
  title,
  body,
  className,
}: {
  n: string;
  time: string;
  title: string;
  body?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <Label>
        Pomodoro {n} <span className="text-white/25">· {time}</span>
      </Label>
      <Lines as="h2" className="mt-7 tracking-[-0.035em] text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[1.03]">
        {title}
      </Lines>
      {body && (
        <Lines as="p" delay={0.1} className="mt-7 max-w-md text-[14.5px] leading-relaxed text-white/60">
          {body}
        </Lines>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MOMENT 1 — L'EFFONDREMENT : toute la ville se referme sur une fenêtre
   ══════════════════════════════════════════════════════════════════════════

   La pièce maîtresse de la page, et son idée directrice.

   On ouvre sur Séoul en plein écran. Au scroll, la photographie ne défile pas
   et ne s'efface pas : elle SE REFERME, par les quatre côtés, jusqu'à ne plus
   être qu'une fenêtre éclairée au milieu du noir. La promesse du titre
   (« Allume ta fenêtre ») est donc démontrée avant d'être lue, et le sujet du
   produit est littéralement ce qui reste quand tout le reste s'éteint.

   Comment c'est fait, et pourquoi comme ça :
     . un `clip-path: inset()` animé, PAS une animation de largeur ou de
       position. Le découpage est composé par le GPU, là où `width`/`top`
       déclencheraient une mise en page à chaque frame ;
     . le filet de la fenêtre est un élément SÉPARÉ, positionné aux MÊMES
       pourcentages que le découpage final. Un `border` posé sur la photo
       serait coupé par le `clip-path` en même temps qu'elle ;
     . la section est épinglée sur deux hauteurs d'écran et scrubée : c'est le
       scroll qui referme la fenêtre, à la vitesse du lecteur.

   Repli mouvement réduit : la fenêtre est déjà fermée, sans épinglage. */

/** Les pourcentages de la fenêtre finale. Partagés entre le découpage de la
 *  photo et le filet, sans quoi les deux ne coïncideraient pas. */
const WIN = { top: 44, right: 30, bottom: 9, left: 30 };
const WIN_INSET = `inset(${WIN.top}% ${WIN.right}% ${WIN.bottom}% ${WIN.left}%)`;

const HERO_TRACK = byId("driv-05") ?? defaultVideos[0];

function Collapse({ signIn }: { signIn: () => void }) {
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotionPref();

  useGSAP(
    () => {
      if (reduced) return;
      const root = section.current;
      const photo = root?.querySelector("[data-collapse-photo]");
      const frame = root?.querySelector("[data-collapse-frame]");
      const caption = root?.querySelector("[data-collapse-caption]");
      const veil = root?.querySelector("[data-collapse-veil]");
      if (!photo || !frame || !caption || !veil) return;

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "+=200%",
          pin: true,
          scrub: 0.65,
          anticipatePin: 1,
          refreshPriority: PRIO.top,
        },
      });

      // La ville se referme.
      tl.fromTo(
        photo,
        { clipPath: "inset(0% 0% 0% 0%)", scale: 1.12 },
        { clipPath: WIN_INSET, scale: 1, duration: 1 },
        0
      )
        // ⚠️ Le voile s'efface, il ne s'épaissit PAS. Premier réflexe erroné :
        // le faire monter vers le noir « puisque la nuit tombe ». Mais il
        // couvre TOUT, fenêtre comprise, et éteignait donc exactement ce qui
        // devait rester allumé. Son seul rôle est d'asseoir le titre sur la
        // photo plein écran du départ ; une fois la fenêtre refermée, le noir
        // vient du découpage lui-même et le voile n'a plus rien à faire là.
        .fromTo(veil, { opacity: 0.62 }, { opacity: 0, duration: 1 }, 0)
        // Le filet n'arrive qu'à la toute fin : une fenêtre n'a de cadre que
        // lorsqu'elle est une fenêtre.
        .fromTo(frame, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 }, 0.78)
        .fromTo(caption, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.85);

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
    { scope: section, dependencies: [reduced], revertOnUpdate: true }
  );

  return (
    <section
      ref={section}
      data-hero-section
      className="relative isolate flex h-[100dvh] flex-col items-center overflow-hidden px-5 pt-28 sm:px-10"
    >
      {/* La photographie, qui se referme */}
      <span
        data-collapse-photo
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{ clipPath: reduced ? WIN_INSET : undefined }}
      >
        <Image src={SEOUL.aerien} alt="" fill priority sizes="100vw" className="object-cover" />
      </span>
      <span
        data-collapse-veil
        aria-hidden
        className="absolute inset-0 -z-10 bg-[#050505]"
        style={{ opacity: reduced ? 0 : 0.62 }}
      />

      {/* Le filet de la fenêtre, aux mêmes pourcentages que le découpage */}
      <span
        data-collapse-frame
        aria-hidden
        className="absolute border border-white/25"
        style={{
          top: `${WIN.top}%`,
          right: `${WIN.right}%`,
          bottom: `${WIN.bottom}%`,
          left: `${WIN.left}%`,
          opacity: reduced ? 1 : 0,
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center text-center">
        <span data-hero="eyebrow" className="block">
          <Label>21:00 · Séoul · gratuit, sans compte</Label>
        </span>

        {/* Le titre ne monte pas, il S'ALLUME : c'est une enseigne dans une rue
            de Séoul. La seconde ligne s'amorce après la première, comme deux
            tubes qui ne partent jamais ensemble. */}
        <h1 className="mt-8 max-w-4xl tracking-[-0.035em] text-[clamp(2.6rem,7vw,5.6rem)] font-light leading-[0.98]">
          <Neon delay={0.35} glow={20}>
            La ville ne dort pas.
          </Neon>
          <br />
          <Neon delay={1.25} glow={26}>
            Travaille avec elle.
          </Neon>
        </h1>

        <p data-hero="sub" className="mt-8 max-w-md text-[14.5px] leading-relaxed text-white/60">
          Quatre pomodoros, une nuit. Un minuteur et ta musique dans le même écran, sur un paysage qui tourne
          en boucle. La supérette en bas ne ferme pas non plus.
        </p>

        <div data-hero="cta" className="mt-9">
          <Cta label="Commencer" onClick={signIn} tone="solid" />
        </div>
      </div>

      {/* La légende de la fenêtre, une fois qu'elle en est une */}
      <span
        data-collapse-caption
        className="absolute inset-x-0 z-10 text-center"
        style={{ top: `calc(${100 - WIN.bottom}% + 1.25rem)`, opacity: reduced ? 1 : 0 }}
      >
        <Label>{HERO_TRACK.country} · en lecture · pomodoro 01</Label>
      </span>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MOMENT 2 — LE CATALOGUE : travelling horizontal, le pays en très grand
   ══════════════════════════════════════════════════════════════════════════

   Le scroll vertical devient un déplacement latéral le long des paysages. Ce
   qui en fait un MOMENT et non une simple bande : derrière les cartes, le nom
   du pays s'écrit en très grand et CHANGE quand la carte suivante passe au
   centre. On ne fait pas défiler des vignettes, on traverse des lieux.

   `ease: "none"` est obligatoire sur le travelling, c'est ce qui garde le
   rapport 1:1 entre scroll et position horizontale. Et les déclencheurs par
   carte passent par `containerAnimation` : ils réagissent à la progression
   HORIZONTALE, pas au scroll vertical. Leurs bornes sont en MOTS-CLÉS
   (`"left center"`), les pourcentages y étant mesurés dans l'espace de la
   piste et non du viewport. */

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
      const label = w?.querySelector<HTMLElement>("[data-belt-label]");
      if (!t || !w) return;

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        const distance = () => Math.max(1, t.scrollWidth - window.innerWidth + 80);
        const pan = gsap.to(t, {
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

        // Deux listes distinctes plutôt qu'une liste mixte : `instanceof` ne
        // restreint pas correctement le type d'une union `ScrollTrigger | Tween`
        // (ScrollTrigger est une interface, pas une classe, côté typage).
        const triggers: ScrollTrigger[] = [];
        const tweens: gsap.core.Tween[] = [];

        const cards = gsap.utils.toArray<HTMLElement>("[data-belt-card]", t);
        cards.forEach((card) => {
          const country = card.dataset.country ?? "";
          // Le pays derrière : il change quand la carte prend le centre.
          const swap = ScrollTrigger.create({
            trigger: card,
            containerAnimation: pan,
            start: "left center",
            end: "right center",
            onToggle: (self) => {
              if (!self.isActive || !label) return;
              gsap.fromTo(
                label,
                { autoAlpha: 0, y: 26 },
                { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE, onStart: () => (label.textContent = country) }
              );
            },
          });
          // La carte se lève et s'agrandit en prenant le centre du cadre.
          const lift = gsap.fromTo(
            card,
            { yPercent: 7, scale: 0.9, autoAlpha: 0.45 },
            {
              yPercent: 0,
              scale: 1,
              autoAlpha: 1,
              ease: "none",
              scrollTrigger: { trigger: card, containerAnimation: pan, start: "left right", end: "left center", scrub: true },
            }
          );
          triggers.push(swap);
          tweens.push(lift);
        });

        return () => {
          triggers.forEach((s) => s.kill());
          tweens.forEach((t2) => {
            t2.scrollTrigger?.kill();
            t2.kill();
          });
          pan.scrollTrigger?.kill();
          pan.kill();
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
      className={cn("relative bg-[#050505]", reduced ? "overflow-x-auto" : "overflow-x-auto md:overflow-x-clip")}
    >
      {/* Le pays, en très grand, derrière tout */}
      <span
        data-belt-label
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 hidden -translate-y-1/2 select-none text-center tracking-[-0.05em] text-[clamp(5rem,17vw,15rem)] font-light leading-none text-white/[0.06] md:block"
      >
        {BELT[0]?.country}
      </span>

      <div ref={track} className="relative z-10 flex h-[70vh] w-max items-center gap-10 px-5 sm:px-10 md:h-[100dvh] md:gap-16">
        <div className="w-[min(80vw,28rem)] shrink-0">
          <Label>Pomodoro 01 <span className="text-white/25">· 21:00</span></Label>
          <Lines
            as="h2"
            start="top bottom"
            className="mt-7 tracking-[-0.035em] text-[clamp(2.2rem,5vw,3.8rem)] font-light leading-[1.02]"
          >
            Cinquante-six endroits où poser ta nuit.
          </Lines>
          <Lines
            as="p"
            start="top bottom"
            delay={0.12}
            className="mt-7 max-w-sm text-[14.5px] leading-relaxed text-white/60"
          >
            Study with me à Osaka, la pluie sur Shinjuku, le Bund à minuit. Choisis ta fenêtre, le minuteur
            part tout seul.
          </Lines>
        </div>

        {BELT.map((v) => (
          <article key={v.id} data-belt-card data-country={v.country} className="w-[19rem] shrink-0 md:w-[24rem]">
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
        <NightClock clock={clock} onDoneChange={onDoneChange} />
        <Wordmark className="absolute left-1/2 hidden -translate-x-1/2 sm:flex" />
        <Cta label="Commencer" onClick={signIn} className="px-6 py-3 text-[10px]" />
      </header>

      {/* ══ 21:00 ─ La ville s'allume, et se referme sur une fenêtre ══════ */}
      <Collapse signIn={signIn} />

      {/* ══ POMODORO 01 ─ 21:00 ══════════════════════════════════════════ */}
      <Catalogue />

      {/* ══ PAUSE ─ 21:25 ════════════════════════════════════════════════ */}
      <Breath
        time="21:25"
        minutes="cinq minutes"
        line="Lève les yeux. La rue est toujours là."
        img={SEOUL.rue}
      />

      {/* ══ POMODORO 02 ─ 21:30 ══════════════════════════════════════════ */}
      <section id="sources" className="mx-auto w-full max-w-[86rem] px-5 py-32 sm:px-10">
        <CycleHead
          n="02"
          time="21:30"
          title="Mets le son, pas la playlist des autres."
          body="Quatre sources, un seul écran. Le minuteur ne s'arrête jamais pour aller chercher la musique."
          className="mb-16"
        />
        <Sources />
      </section>

      {/* ══ PAUSE ─ 22:00 ════════════════════════════════════════════════ */}
      <Breath
        time="22:00"
        minutes="cinq minutes"
        line="La supérette en bas est ouverte. Elle le sera encore à trois heures."
        img={SEOUL.pontLarge}
      />

      {/* ══ POMODORO 03 ─ 22:05 ══════════════════════════════════════════ */}
      <section id="minuteur" className="mx-auto w-full max-w-[86rem] px-5 py-32 sm:px-10">
        <CycleHead n="03" time="22:05" title="Le vrai minuteur, ici même." className="mb-16" />
        <TryPomodoro publish={publish} />
      </section>

      {/* ══ PAUSE LONGUE ─ 23:00 ═════════════════════════════════════════ */}
      <Breath
        time="23:00"
        minutes="quinze minutes"
        line="Quatre cycles. La longue pause se mérite."
        img={SEOUL.lotte}
      />

      {/* ══ 01:00 ─ Ce que la nuit a laissé ══════════════════════════════ */}
      <section className="mx-auto w-full max-w-[86rem] px-5 pb-32 sm:px-10">
        <CycleHead
          n="04"
          time="01:00"
          title="Au matin, la nuit a laissé quelque chose."
          body="Série, score de concentration, récap du dimanche. Construits tout seuls pendant que tu travaillais."
          className="mb-16"
        />
        <Trace />
      </section>

      {/* ══ FIN DE NUIT ══════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-5 text-center">
        <span data-parallax aria-hidden className="absolute inset-0">
          <Image src={SEOUL.pont} alt="" fill sizes="100vw" className="object-cover opacity-35" />
        </span>
        <span aria-hidden className="absolute inset-0 bg-black/65" />
        <div data-recede className="relative">
          <h2 className="mx-auto max-w-4xl tracking-[-0.035em] text-[clamp(2.4rem,7vw,5.6rem)] font-light leading-[1.02]">
            <Neon delay={0.15}>Il est 21:00 quelque part.</Neon>
          </h2>
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
