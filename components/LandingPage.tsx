"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { useGSAP } from "@gsap/react";
import { signInWithGoogle } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { defaultVideos } from "@/data/videos";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING — « LE MUR DE FENÊTRES »
//
// L'IDÉE, tirée de la photo du fond (Séoul, heure bleue, vue de Namsan) :
// une tour à la tombée de la nuit, c'est une grille stricte de petits
// rectangles qui s'allument un par un. Or une grille de rectangles qui
// s'allument, c'est AUSSI la heatmap de ta concentration, ta grille de
// pomodoros, et ton catalogue en vignettes. La page adopte donc ce module
// unique, la fenêtre, et GSAP l'allume au scroll exactement comme la nuit
// allume la ville. Une session = une fenêtre allumée.
// L'avenue rectiligne du bas de la photo, elle, devient le travelling
// horizontal du catalogue.
//
// MOTEUR : GSAP + ScrollTrigger, et rien d'autre. Cette page n'importe PAS
// `motion/react` : deux moteurs de scroll sur la même page se disputent les
// frames. Le site connecté, lui, reste intégralement sur `motion/react`.
//
// IMAGERIE : zéro photo générique. Toutes les images sont les VRAIES vignettes
// YouTube du catalogue (`data/videos.ts`). Les sources externes (YouTube,
// Spotify, Twitch) ne sont pas illustrées par des photos mais par leur marque
// et un fragment de leur interface.
//
// SYSTÈME DE FORMES, une seule échelle tenue partout :
//   fenêtre (module de base, tuiles) ....... rounded-[3px]
//   panneau / carte ........................ rounded-2xl
//   contrôle (bouton, pilule) .............. rounded-full
//
// ACCENT UNIQUE : #ffc38a, la couleur exacte des fenêtres allumées sur la
// photo. Les seules autres couleurs de la page sont les marques (YouTube,
// Spotify, Twitch), qui sont sémantiques.
//
// PERF : uniquement `transform` et `opacity`. La position du pointeur passe par
// `gsap.quickTo`, jamais par un state React. Tout se replie sous
// `prefers-reduced-motion`, via `gsap.matchMedia()` pour l'animation et via
// `useReducedMotionPref()` quand c'est la MISE EN PAGE qui doit changer.
// ═══════════════════════════════════════════════════════════════════════════

// ORDRE DE RAFRAÎCHISSEMENT (`refreshPriority`) : les effets React s'exécutent
// ENFANT D'ABORD, les ScrollTriggers ne naissent donc PAS dans l'ordre de la
// page. Or deux sections sont épinglées, et un épinglage ALLONGE le document :
// tout déclencheur situé plus bas doit être mesuré APRÈS elles, sinon ses
// bornes sont calculées sur une page trop courte. D'où cette échelle, qui
// rejoue l'ordre de lecture.
//
// ⚠️ LE SENS EST CONTRE-INTUITIF, et me l'être trompé a coûté cher : dans
// GSAP, un `refreshPriority` PLUS ÉLEVÉ se rafraîchit EN PREMIER. Avec une
// échelle croissante (les épinglages au-dessus de 0), ils étaient mesurés en
// DERNIER, donc après tout ce qui se trouve plus bas dans la page : chaque
// déclencheur situé sous le catalogue démarrait exactement 2128 px trop tôt,
// soit très précisément la distance d'épinglage. D'où l'échelle DÉCROISSANTE
// ci-dessous, du haut de la page vers le bas.
//
// `below` vaut 0, qui est aussi la valeur par défaut : c'est indispensable,
// parce que `ScrollTrigger.batch()` n'expose pas `refreshPriority` et que ses
// révélations doivent donc se rafraîchir en dernier, après les épinglages.
const PRIO = {
  backdrop: 40, // le fond, qui couvre toute la page
  hero: 30, // voile de lecture, sortie du hero, manifeste, progression
  walk: 20, // 1re section épinglée : la balade dans la rue
  boulevard: 10, // 2e section épinglée : le travelling du catalogue
  below: 0, // tout ce qui vient après les épinglages (révélations, trace)
} as const;

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger, ScrambleTextPlugin);

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const byId = (id: string) => defaultVideos.find((v) => v.id === id);
const pick = (ids: string[]) => ids.map(byId).filter((v): v is NonNullable<typeof v> => Boolean(v));

const POMODORO_SECONDS = 25 * 60;
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** État partagé de « l'horloge de la page ». Lu à la frame par `SessionClock`,
 *  écrit par le scroll et par le minuteur jouable. Un ref, donc zéro re-render
 *  de l'arbre React à la seconde. */
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

/* ══════════════════════════════════════════════════════════════════════════
   Primitives
   ══════════════════════════════════════════════════════════════════════════ */

/** Panneau : coque extérieure + noyau, rayons concentriques. */
function Panel({ children, className, inner }: { children: React.ReactNode; className?: string; inner?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-1.5", className)}>
      <div className={cn("relative overflow-hidden rounded-xl bg-[#07080e] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]", inner)}>
        {children}
      </div>
    </div>
  );
}

/** CTA magnétique. La position du curseur passe par `gsap.quickTo` : la valeur
 *  est interpolée hors du cycle de rendu React, aucune frame n'est perdue. */
function Cta({
  label,
  onClick,
  tone = "light",
  className,
}: {
  label: string;
  onClick?: () => void;
  tone?: "light" | "glass";
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const move = useRef<{ x: (v: number) => void; y: (v: number) => void } | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      // Le magnétisme n'a de sens qu'avec un vrai pointeur : au doigt, il
      // déplacerait la cible sous l'utilisateur au moment du tap.
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        move.current = {
          x: gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" }),
          y: gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" }),
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
      onClick={onClick}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!move.current || !el) return;
        const r = el.getBoundingClientRect();
        move.current.x(((e.clientX - r.left) / r.width - 0.5) * 22);
        move.current.y(((e.clientY - r.top) / r.height - 0.5) * 12);
      }}
      onPointerLeave={() => {
        move.current?.x(0);
        move.current?.y(0);
      }}
      className={cn(
        "group inline-flex items-center gap-4 rounded-full py-2 pl-7 pr-2 text-sm font-semibold tracking-tight",
        "transition-colors duration-500 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc38a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05060c]",
        tone === "light"
          ? "bg-white text-[#08090f] hover:bg-white/90"
          : "border border-white/20 bg-white/[0.06] text-white hover:border-white/40 hover:bg-white/[0.11]",
        className
      )}
    >
      {label}
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-1",
          tone === "light" ? "bg-black/[0.08]" : "bg-white/12"
        )}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
          <path d="M4.5 11.5L11.5 4.5M6 4.5h5.5V10" />
        </svg>
      </span>
    </button>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-white/15">
        <span className="absolute inset-0 rounded-full bg-[#ffc38a]/25 blur-[7px]" aria-hidden />
        <svg className="relative h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2.2" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">FocusFlow</span>
    </span>
  );
}

/** Titre découpé en mots, chacun dans son propre masque : à l'entrée, les mots
 *  montent derrière une ligne nette, comme un volet qui se lève. */
function MaskedLine({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("block", className)}>
      {text.split(" ").map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <span data-word className="inline-block">
            {w}
            {i < text.split(" ").length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'HORLOGE DE LA PAGE — la landing EST un pomodoro
   ══════════════════════════════════════════════════════════════════════════

   Sur un site de Pomodoro, le temps ne doit pas être un argument, il doit être
   l'expérience. Le compteur logé dans la nav part de 25:00 en haut de page et
   atteint 00:00 en bas : parcourir la page, c'est dérouler une session. Et si
   le visiteur lance le vrai minuteur de la section démo, CELUI-CI PREND LE
   RELAIS : la page cesse de mimer le temps pour afficher le sien.

   Implémentation : un unique `gsap.ticker`, qui lit l'état partagé et écrit
   directement dans le DOM, avec une garde par valeur pour ne toucher au DOM
   que lorsque l'affichage change réellement. Aucun re-render React. */

const CLOCK_R = 13;
const CLOCK_C = 2 * Math.PI * CLOCK_R;

function SessionClock({ clock, onDoneChange }: { clock: React.RefObject<Clock>; onDoneChange: (done: boolean) => void }) {
  const root = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      // Micro-boucle perpétuelle : le point ne bat QUE quand une vraie session
      // tourne. Le mouvement dit un état, il ne décore pas.
      const pulse = gsap
        .to(dotRef.current, { scale: 1.45, opacity: 1, duration: 1, repeat: -1, yoyo: true, ease: "sine.inOut" })
        .pause();

      let lastText = "";
      let lastLabel = "";
      let lastRatio = -1;
      let wasLive: boolean | null = null;
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

        if (c.live !== wasLive) {
          wasLive = c.live;
          if (c.live) pulse.play();
          else {
            pulse.pause();
            gsap.set(dotRef.current, { scale: 1, opacity: 0 });
          }
        }

        if (done !== wasDone) {
          wasDone = done;
          onDoneChange(done);
          gsap.to(ringRef.current, { stroke: done ? "#ffffff" : "#ffc38a", duration: 0.4 });
        }
      };

      gsap.ticker.add(tick);
      return () => {
        gsap.ticker.remove(tick);
        pulse.kill();
      };
    },
    { scope: root }
  );

  return (
    <span
      ref={root}
      className="flex items-center gap-2.5"
      title="La page se déroule comme une session de 25 minutes. Lance le minuteur plus bas et il prend le relais."
    >
      <span className="relative flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="16" cy="16" r={CLOCK_R} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
          <circle
            ref={ringRef}
            cx="16"
            cy="16"
            r={CLOCK_R}
            fill="none"
            stroke="#ffc38a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={CLOCK_C}
            strokeDashoffset={CLOCK_C}
          />
        </svg>
        <span ref={dotRef} className="h-1.5 w-1.5 rounded-full bg-[#ffc38a] opacity-0" aria-hidden />
      </span>
      <span className="flex flex-col leading-none">
        <span ref={timeRef} className="font-mono text-[13px] tabular-nums text-white">
          25:00
        </span>
        <span ref={labelRef} className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/50">
          cette page
        </span>
      </span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO — une fenêtre allumée, posée sur la ville
   ══════════════════════════════════════════════════════════════════════════ */

// Un pays différent à chaque rotation : le catalogue ne se résume pas au Japon.
const HERO_TRACKS = pick(["hk-02", "driv-05", "cn-01", "np-01", "abao-11"]);

/** La fenêtre du hero. Les vignettes s'enchaînent par une timeline GSAP qui
 *  fait un fondu entre des couches empilées : aucun state React, donc aucun
 *  re-render toutes les cinq secondes. */
function HeroWindow() {
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const dash = 2 * Math.PI * 44;

  useGSAP(
    () => {
      const slides = gsap.utils.toArray<HTMLElement>("[data-slide]", root.current);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(slides, { autoAlpha: 0 });
        gsap.set(slides[0], { autoAlpha: 1 });
        gsap.set(ring.current, { strokeDashoffset: dash * 0.36 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(slides, { autoAlpha: 0 });
        gsap.set(slides[0], { autoAlpha: 1 });

        // L'anneau se dessine une fois à l'arrivée : il dit « une session est
        // en cours », puis se tait.
        const draw = gsap.fromTo(
          ring.current,
          { strokeDashoffset: dash },
          { strokeDashoffset: dash * 0.36, duration: 2.2, delay: 0.5, ease: "power2.inOut" }
        );

        const tl = gsap.timeline({ repeat: -1 });
        slides.forEach((slide, i) => {
          const next = slides[(i + 1) % slides.length];
          tl.to(slide, { autoAlpha: 0, duration: 1.1, ease: "power2.inOut" }, "+=4.4").to(
            next,
            { autoAlpha: 1, duration: 1.1, ease: "power2.inOut" },
            "<"
          );
        });

        return () => {
          tl.kill();
          draw.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="w-[20rem] sm:w-[24rem]">
      <Panel>
        <div className="relative aspect-[4/3]">
          {HERO_TRACKS.map((v) => (
            <div key={v.id} data-slide className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(v.youtubeId)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
              <span className="absolute inset-0 bg-gradient-to-t from-[#05060c] via-[#05060c]/60 to-[#05060c]/25" aria-hidden />
              <span className="absolute inset-x-4 bottom-4 flex items-center gap-2.5 rounded-full border border-white/12 bg-[#0a0c14]/85 py-2 pl-2.5 pr-4">
                <span className="flex h-3 items-end gap-[2px]" aria-hidden>
                  {[1.2, 1.5, 1.35].map((d, k) => (
                    <span
                      key={k}
                      className="anim-eq w-[2px] rounded-full bg-[#ffc38a]"
                      style={{ height: "100%", animationDuration: `${d}s`, animationDelay: `${-k * 0.4}s` }}
                    />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] text-white">{v.title}</span>
                  <span className="block truncate font-mono text-[9.5px] text-white/55">{v.country}</span>
                </span>
              </span>
            </div>
          ))}

          <span className="absolute inset-0 flex items-start justify-center pt-12">
            <span className="relative h-28 w-28">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
                <circle
                  ref={ring}
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#ffc38a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  strokeDashoffset={dash}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-[26px] tabular-nums text-white">16:02</span>
                <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">Focus</span>
              </span>
            </span>
          </span>
        </div>
      </Panel>
    </div>
  );
}
/* ══════════════════════════════════════════════════════════════════════════
   LE MONDE — la ville derrière toute la page
   ══════════════════════════════════════════════════════════════════════════

   La scène 3D (`CityScene`) n'est plus une SECTION, c'est le DÉCOR DE LA PAGE.
   Le scroll fait marcher la caméra du haut du document jusqu'en bas, et tout
   le contenu se lit par-dessus.

   Trois tentatives ont précédé celle-ci, et les deux premières ont échoué pour
   la même raison de fond :
     1. une grille de blocs qui se refermait en volet. Correcte techniquement,
        mais une grille de carrés colorés se lit comme un calendrier.
     2. une photo qui grossissait pendant que des vignettes passaient en CSS
        3D : une image plate qui grossit donne un ZOOM, jamais un DÉPLACEMENT.
     3. la même scène 3D, mais enfermée dans une section épinglée au milieu
        d'une page photographique : un bloc noir rapporté, impossible à
        raccorder puisque le décor changeait de nature en cours de route.

   D'où ce parti : une seule et même ville, du premier au dernier pixel de la
   page. Il n'y a plus de raccord à faire, donc plus de raccord à rater.

   La photo de Séoul et son composant `CityBackdrop` ont été retirés : ils
   faisaient doublon avec la scène, et leur couche `mix-blend-screen` en plein
   écran obligeait le navigateur à recomposer tout le viewport à chaque frame
   de scroll, ce qui était l'une des deux causes des saccades. (Le fichier
   reste récupérable dans l'historique Git.) */

const WORLD_SCREENS = pick(["cn-01", "tw-02", "hk-02", "no-01", "vn-01", "abao-11", "id-02", "uk-01", "th-01", "np-01"]);
const WORLD_THUMBS = WORLD_SCREENS.map((v) => thumb(v.youtubeId));

// `three` est chargé à part : il ne doit pas retarder l'affichage du hero.
const CityScene = dynamic(() => import("@/components/CityScene"), { ssr: false });

/** Sonde de capacité. La disponibilité de WebGL est un état du navigateur, pas
 *  de React : elle se lit dans un effet, jamais pendant le rendu, qui doit
 *  rester pur. `null` tant qu'on ne sait pas. */
function useWebGL() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const probe = () => {
      try {
        const c = document.createElement("canvas");
        setOk(Boolean(c.getContext("webgl2") || c.getContext("webgl")));
      } catch {
        setOk(false);
      }
    };
    probe();
  }, []);
  return ok;
}

function World() {
  const reduced = useReducedMotionPref();
  const webgl = useWebGL();
  const live = webgl === true && !reduced;

  // L'avancée de la marche, écrite par le scroll et lue à la frame par la
  // scène : la position de la caméra ne passe jamais par un state React.
  const walk = useRef({ v: 0 });

  useGSAP(() => {
    if (!live) return;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      refreshPriority: PRIO.backdrop,
      onUpdate: (self) => {
        walk.current.v = self.progress;
      },
    });
    return () => st.kill();
  }, { dependencies: [live], revertOnUpdate: true });

  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-[#05060c]">
      {live && <CityScene progress={walk} thumbnails={WORLD_THUMBS} />}
      {/* Sans WebGL, ou en mouvement réduit : un ciel de nuit fixe. Le contenu
          de la page reste entièrement lisible, c'est tout ce qui compte. */}
      {!live && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, #060a1c 0%, #0a1026 42%, #171432 72%, #2a1a20 100%)",
          }}
        />
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   LE MANIFESTE — les mots s'allument un par un, comme les fenêtres
   ══════════════════════════════════════════════════════════════════════════

   Le geste de la page appliqué à la typographie : au fil du scroll, chaque
   mot passe de l'ombre à la pleine lumière. Ce n'est pas un effet de style,
   c'est le propos du produit rendu littéral, et c'est ce qui donne à ce
   paragraphe le droit d'occuper un écran entier. */

const MANIFESTO = "Les fenêtres s'allument une par une. Derrière chacune, quelqu'un vient de s'y mettre. Tu en allumes une par session de vingt-cinq minutes.";

function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const words = gsap.utils.toArray<HTMLElement>("[data-lw]", root.current);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(words, { opacity: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tween = gsap.fromTo(
          words,
          { opacity: 0.13 },
          {
            opacity: 1,
            ease: "none",
            stagger: { amount: 1, from: "start" },
            scrollTrigger: {
              trigger: root.current,
              start: "top 80%",
              end: "bottom 65%",
              scrub: 0.45,
              refreshPriority: PRIO.hero,
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
    <section ref={root} className="mx-auto w-full max-w-[86rem] px-4 py-32 sm:px-8 md:py-48">
      <p className="max-w-4xl text-[clamp(1.7rem,4.4vw,3.5rem)] font-semibold leading-[1.14] tracking-[-0.035em]">
        {MANIFESTO.split(" ").map((w, i) => (
          <span key={i} data-lw>
            {w}{" "}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'INDEX DE CHAPITRES — où tu en es dans la page
   ══════════════════════════════════════════════════════════════════════════

   Rail fixe en bas à gauche : la liste des chapitres, et un repère qui se
   remplit sur celui qu'on est en train de lire. Il remplace les liens de la
   barre du haut (qui n'indiquaient rien) et donne à la page une structure
   lisible d'un coup d'oeil, sans jamais masquer le contenu.

   L'état actif est écrit directement par GSAP sur le DOM (`onToggle`) : aucun
   state React, donc aucun rendu de l'arbre pendant le scroll. */

const CHAPTERS = [
  { id: "catalogue", label: "Catalogue" },
  { id: "sources", label: "Sources" },
  { id: "parcours", label: "Parcours" },
  { id: "minuteur", label: "Minuteur" },
  { id: "trace", label: "Trace" },
] as const;

function ChapterRail() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionPref();

  useGSAP(
    () => {
      // ── Pourquoi PAS un ScrollTrigger par chapitre ────────────────────
      // Un index de chapitres doit être juste, toujours, y compris pendant les
      // deux épinglages de la page. Or un épinglage allonge le document, et
      // tout déclencheur mesuré avant lui démarre trop tôt (c'est le piège de
      // `refreshPriority`, documenté en tête de fichier). Plutôt que de faire
      // dépendre le repère de l'ordre de rafraîchissement, on lit la position
      // RÉELLE des ancres dans le document : c'est vrai par construction.
      //
      // Les positions sont mises en cache et recalculées seulement au
      // `refresh` de ScrollTrigger (redimensionnement, polices, images), jamais
      // pendant le scroll : la boucle ne fait que cinq comparaisons de nombres
      // par mise à jour, et aucune lecture de mise en page.
      const anchor = (id: string) => document.querySelector<HTMLElement>(`[data-anchor="${id}"]`);

      // Position dans le document par la chaîne des `offsetTop`, et NON par
      // `getBoundingClientRect`, qui est une position À L'ÉCRAN : pendant un
      // épinglage elle ne bouge plus, et toute transformation d'un ancêtre la
      // fausse. `offsetTop` ignore les transformations, tout en tenant compte
      // de l'espace réservé par les épinglages, qui lui est bien du layout.
      const docTop = (el: HTMLElement) => {
        let y = 0;
        let n: HTMLElement | null = el;
        while (n) {
          y += n.offsetTop;
          n = n.offsetParent as HTMLElement | null;
        }
        return y;
      };

      const rows = CHAPTERS.map((c) => {
        const row = root.current?.querySelector<HTMLElement>(`[data-chapter="${c.id}"]`);
        return {
          id: c.id,
          label: c.label,
          mark: row?.querySelector<HTMLElement>("[data-mark]") ?? null,
          text: row?.querySelector<HTMLElement>("[data-text]") ?? null,
        };
      });

      rows.forEach((r) => r.mark && gsap.set(r.mark, { scaleX: 0, transformOrigin: "left center" }));

      let tops: number[] = [];
      let endTop = Infinity;
      const measure = () => {
        tops = CHAPTERS.map((c) => {
          const el = anchor(c.id);
          return el ? docTop(el) : Infinity;
        });
        const fin = anchor("fin");
        endTop = fin ? docTop(fin) : Infinity;
      };
      measure();
      ScrollTrigger.addEventListener("refresh", measure);

      const light = (i: number, on: boolean) => {
        const r = rows[i];
        if (!r || !r.mark || !r.text) return;
        gsap.to(r.mark, { scaleX: on ? 1 : 0, duration: 0.45, ease: "power3.out" });
        gsap.to(r.text, { color: on ? "rgb(255,255,255)" : "rgba(255,255,255,0.45)", duration: 0.35 });
        // Le libellé se recompose lettre par lettre en devenant actif. C'est
        // un accusé de réception, pas un décor : il ne se joue qu'au
        // changement d'état, jamais en boucle.
        if (on && !reduce) {
          gsap.to(r.text, { duration: 0.55, scrambleText: { text: r.label, chars: "upperCase", speed: 0.7 } });
        }
      };

      let current = -1;
      const st = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: () => {
          const probe = window.scrollY + window.innerHeight * 0.55;
          let next = -1;
          if (probe < endTop) for (let i = 0; i < tops.length; i++) if (probe >= tops[i]) next = i;
          if (next === current) return;
          light(current, false);
          light(next, true);
          current = next;
        },
      });

      return () => {
        ScrollTrigger.removeEventListener("refresh", measure);
        st.kill();
      };
    },
    { scope: root, dependencies: [reduce], revertOnUpdate: true }
  );

  return (
    <div className="pointer-events-none fixed bottom-8 left-8 z-40 hidden flex-col gap-2.5 lg:flex" ref={root}>
      {CHAPTERS.map((c) => (
        <a
          key={c.id}
          href={`#${c.id}`}
          data-chapter={c.id}
          className="pointer-events-auto flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc38a]"
        >
          <span className="relative block h-[2px] w-5 overflow-hidden bg-white/15">
            <span data-mark className="absolute inset-0 block bg-[#ffc38a]" />
          </span>
          <span data-text className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
            {c.label}
          </span>
        </a>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LE BOULEVARD — le catalogue en travelling horizontal
   ══════════════════════════════════════════════════════════════════════════

   L'avenue rectiligne de la photo, reprise comme geste : le scroll vertical
   devient un travelling latéral le long d'une rangée de paysages, décalés en
   hauteur comme une ligne d'immeubles.

   Sur mobile ET sous reduced-motion, aucun détournement du scroll : la rangée
   redevient un simple défilement horizontal natif, au doigt. */

const BOULEVARD = pick(["hk-02", "driv-05", "cn-01", "tw-02", "vn-01", "abao-11", "no-01", "noma-07", "uk-01", "id-02"]);

function Boulevard() {
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
        // `ease: "none"` est obligatoire : c'est ce qui garde le rapport 1:1
        // entre la position de scroll et la position horizontale.
        const distance = () => Math.max(1, t.scrollWidth - window.innerWidth + 64);
        const tween = gsap.to(t, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: w,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            refreshPriority: PRIO.boulevard,
          },
        });

        // Deuxième couche, propre au travelling : chaque carte se lève et se
        // révèle en ENTRANT DANS LE CADRE, pas en entrant dans le viewport.
        // C'est exactement ce que `containerAnimation` permet : déclencher sur
        // la progression HORIZONTALE plutôt que sur le scroll vertical. Sans
        // lui, toutes les cartes seraient déjà « entrées » dès l'épinglage.
        const cards = gsap.utils.toArray<HTMLElement>("[data-belt]", t);
        const inner: gsap.core.Tween[] = [];

        cards.forEach((card) => {
          const rest = Number(card.dataset.off || 0);

          // (a) l'arrivée : la carte monte à sa hauteur de repos
          inner.push(
            gsap.fromTo(
              card,
              { y: rest + 90, autoAlpha: 0.25 },
              {
                y: rest,
                autoAlpha: 1,
                ease: "power2.out",
                // Bornes en MOTS-CLÉS, pas en pourcentages : avec
                // `containerAnimation`, un « left 58% » se mesure dans
                // l'espace de la piste et non du viewport, et la carte
                // atteignait le centre de l'écran encore à demi effacée.
                scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "left center", scrub: true },
              }
            )
          );

          // (b) l'orientation : la carte pivote face à nous en passant au
          // centre, puis se referme. C'est ce qui fait qu'on longe une rangée
          // de façades au lieu de faire défiler une bande d'images plates.
          inner.push(
            gsap.fromTo(
              card,
              { rotateY: 26 },
              {
                rotateY: -26,
                ease: "none",
                scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "right left", scrub: true },
              }
            )
          );
        });

        return () => {
          inner.forEach((i) => {
            i.scrollTrigger?.kill();
            i.kill();
          });
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
      className={cn("relative", reduced ? "overflow-x-auto" : "overflow-x-auto md:overflow-x-clip")}
      style={{ perspective: "1600px" }}
    >
      {/* Le sol qui fuit. Une seule grille en dégradés répétés, basculée en
          perspective : l'avenue de la photo du fond, rendue en CSS pur. Aucun
          canvas, aucune 3D calculée, et rien à repeindre pendant le
          travelling puisque c'est le contenu qui bouge, pas elle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] opacity-45"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,195,138,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,195,138,0.16) 1px, transparent 1px)",
          backgroundSize: "90px 90px",
          transform: "perspective(680px) rotateX(71deg)",
          transformOrigin: "center top",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 34%, #000 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 34%, #000 100%)",
        }}
      />

      <div
        ref={track}
        className="relative flex h-[70vh] w-max items-center gap-7 px-4 sm:px-8 md:h-[100dvh] md:gap-10"
        // `perspective` est posée sur la SECTION (fixe, de la taille du
        // viewport) et non ici : le point de fuite doit rester au centre de
        // l'écran. Sur la piste, qui se translate sur plusieurs milliers de
        // pixels, il voyagerait avec elle et déformerait les cartes des
        // extrémités.
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Le titre voyage avec la rangée : la section n'a pas besoin d'un
            en-tête séparé. */}
        <div className="w-[min(78vw,30rem)] shrink-0">
          <h2 className="text-[clamp(1.9rem,4.2vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
            Cinquante-six endroits où poser ta soirée.
          </h2>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-white/70">
            Study with me à Osaka, la pluie sur Shinjuku, le Bund à minuit, un drive lofi au pied du Fuji. Tu choisis la
            fenêtre, le minuteur s&apos;occupe du reste.
          </p>
        </div>

        {BOULEVARD.map((v, i) => (
          <article
            key={v.id}
            data-belt
            // Décalage vertical de repos, en DONNÉE et non en classe : GSAP
            // réécrit `transform` en entier, une translation Tailwind sur la
            // même carte serait écrasée au premier tween.
            data-off={i % 3 === 0 ? -56 : i % 3 === 1 ? 40 : -8}
            className="w-[17rem] shrink-0 md:w-[19rem]"
          >
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#07080e] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb(v.youtubeId)}
                alt=""
                loading="lazy"
                draggable={false}
                className="aspect-[16/10] w-full object-cover opacity-85 transition-opacity duration-700 hover:opacity-100"
              />
            </div>
            <p className="mt-4 truncate text-[14px] font-medium text-white">{v.title}</p>
            <p className="mt-1 font-mono text-[11px] text-white/55">{v.country}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LES SOURCES — quatre marques réelles, un fragment de leur interface
   ══════════════════════════════════════════════════════════════════════════ */

function YoutubeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#ff0033" aria-hidden>
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}
function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1db954" aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.2a.75.75 0 1 1-.33-1.46c4.5-1 8.4-.55 11.5 1.35.35.22.46.68.25 1.06zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.2-2-8.07-2.54-11.85-1.39a.94.94 0 1 1-.54-1.8c4.32-1.31 9.69-.7 13.37 1.58.44.28.58.86.31 1.3zm.13-3.4C15.26 8.4 8.9 8.2 5.24 9.3a1.12 1.12 0 1 1-.65-2.15C8.79 5.88 15.81 6.12 20.24 8.75a1.12 1.12 0 1 1-1.14 1.93z" />
    </svg>
  );
}
function TwitchMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#9146ff" aria-hidden>
      <path d="M4.3 0 1 4.4v15.2h5.2V24h4.2l3.3-4.4h4.2L24 13V0H4.3zm17.2 12.2-3.3 3.3h-5.2l-3.3 3.3v-3.3H6.2V2.2h15.3v10z" />
      <path d="M13.6 5.4h2.2v6.5h-2.2zM8.7 5.4h2.2v6.5H8.7z" />
    </svg>
  );
}

function SourceCell({
  mark,
  name,
  line,
  className,
  children,
}: {
  mark: React.ReactNode;
  name: string;
  line: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-wipe
      className={cn("flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080a12]/75 p-7", className)}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40">{mark}</span>
        <span className="text-[15px] font-medium text-white">{name}</span>
      </span>
      <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-white/70">{line}</p>
      <div className="mt-7 flex-1">{children}</div>
    </div>
  );
}

const CATALOGUE_TILES = pick(["hk-01", "vn-01", "no-01", "tw-01", "th-01", "abao-03"]);
const QUEUE_ROWS = pick(["driv-05", "cn-03", "id-02", "np-01"]);

function Sources() {
  const root = useRef<HTMLDivElement>(null);

  // Révélation en VOLET DÉCOUPÉ, et non en fondu : la tuile se dévoile du haut
  // vers le bas comme un store qu'on lève. C'est le seul endroit de la page qui
  // utilise `clip-path`, et c'est ce qui distingue ce bloc des révélations
  // ordinaires du reste de la page. Le découpage est figé une fois joué, donc
  // aucun coût de composition résiduel.
  useGSAP(
    () => {
      const tiles = gsap.utils.toArray<HTMLElement>("[data-wipe]", root.current);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(tiles, { clipPath: "none", autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(tiles, { clipPath: "inset(0% 0% 100% 0%)" });
        const batched = ScrollTrigger.batch(tiles, {
          start: "top 86%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              clipPath: "inset(0% 0% 0% 0%)",
              duration: 1.05,
              stagger: 0.13,
              ease: "power3.inOut",
              overwrite: true,
              onComplete: () => gsap.set(batch, { clipPath: "none" }),
            }),
        });
        return () => batched.forEach((t) => t.kill());
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="grid gap-5 md:grid-cols-3">
      <SourceCell
        className="md:col-span-2"
        name="Catalogue"
        line="Une cinquantaine de paysages tenus à la main, classés par ambiance. Rien à chercher, tu cliques et ça tourne."
        mark={
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="#ffc38a" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 17.5V7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
          </svg>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {CATALOGUE_TILES.map((v) => (
            <span key={v.id} className="group relative overflow-hidden rounded-[3px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb(v.youtubeId)}
                alt=""
                loading="lazy"
                className="aspect-[16/10] w-full object-cover opacity-70 transition-opacity duration-500 group-hover:opacity-100"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6 text-[10px] text-white/80">
                {v.country}
              </span>
            </span>
          ))}
        </div>
      </SourceCell>

      <SourceCell
        name="YouTube"
        line="Tes playlists et ta file d'attente, jouées dans TON ordre. YouTube ne reprend jamais la main."
        mark={<YoutubeMark />}
      >
        <div className="flex flex-col gap-1.5">
          {QUEUE_ROWS.map((v, i) => (
            <span
              key={v.id}
              className={cn("flex items-center gap-3 rounded-full px-2.5 py-1.5", i === 0 && "bg-white/[0.07]")}
            >
              <span className="w-3 shrink-0 text-center font-mono text-[10px] text-white/50">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(v.youtubeId)} alt="" loading="lazy" className="h-7 w-11 shrink-0 rounded-[3px] object-cover" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-white/75">{v.title}</span>
            </span>
          ))}
        </div>
      </SourceCell>

      <SourceCell
        name="Spotify"
        line="Ta bibliothèque Premium se lit dans la session, sans changer d'onglet ni couper le minuteur."
        mark={<SpotifyMark />}
      >
        <div className="flex flex-col gap-1">
          {[
            { t: "Weightless", a: "Marconi Union", d: "8:08" },
            { t: "Nuvole Bianche", a: "Ludovico Einaudi", d: "5:57" },
            { t: "An Ending (Ascent)", a: "Brian Eno", d: "4:24" },
          ].map((r, i) => (
            <span key={r.t} className={cn("flex items-center gap-3 rounded-full px-3 py-2", i === 1 && "bg-white/[0.06]")}>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[12.5px]", i === 1 ? "text-[#1db954]" : "text-white/80")}>{r.t}</span>
                <span className="block truncate text-[11px] text-white/55">{r.a}</span>
              </span>
              <span className="font-mono text-[10px] tabular-nums text-white/55">{r.d}</span>
            </span>
          ))}
          <span className="mt-3 block h-[3px] w-full overflow-hidden rounded-full bg-white/10">
            <span className="block h-full w-[38%] rounded-full bg-[#1db954]" />
          </span>
        </div>
      </SourceCell>

      <SourceCell
        className="md:col-span-2"
        name="Twitch"
        line="Un live ou une rediffusion en fond, pour travailler à côté de quelqu'un."
        mark={<TwitchMark />}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,13rem)]">
          <span className="relative block overflow-hidden rounded-[3px] bg-black/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb(byId("uk-01")?.youtubeId ?? defaultVideos[0].youtubeId)}
              alt=""
              loading="lazy"
              className="aspect-[16/9] w-full object-cover opacity-50"
            />
            <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-[#9146ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
              Live
            </span>
            <span className="absolute bottom-3 left-3 font-mono text-[11px] text-white/75">studywithme_fr</span>
          </span>
          <span className="flex flex-col gap-2 rounded-[3px] bg-white/[0.03] p-3">
            {[
              { u: "lenaCodes", m: "quelqu'un révise la bio ce soir ?" },
              { u: "marco_dev", m: "3e pomodoro, ça pique" },
              { u: "sora", m: "la pluie sur le stream est parfaite" },
              { u: "juliette", m: "on repart pour 25 min" },
            ].map((c) => (
              <span key={c.u} className="block text-[11px] leading-snug text-white/70">
                <span className="text-[#9146ff]">{c.u}</span> {c.m}
              </span>
            ))}
          </span>
        </div>
      </SourceCell>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LE PARCOURS — un tracé qui se dessine, et dépose ses étapes au passage
   ══════════════════════════════════════════════════════════════════════════

   L'avenue rectiligne qui traverse la photo du fond, reprise en repère de
   lecture. Une seule timeline scrubée coordonne trois choses : le trait qui
   descend, le point qui s'allume quand le trait l'atteint, et le texte qui
   se pose juste après. Le mouvement RACONTE ici un ordre (on fait ça, puis
   ça), ce qui est la seule bonne raison d'animer une liste.

   Le trait est un `div` en `scaleY`, pas un tracé SVG : sur une ligne droite
   le rendu est identique et c'est composé par le GPU, sans recalcul de
   `getTotalLength` à chaque redimensionnement. */

const STEPS = [
  { t: "Choisis une fenêtre", d: "Un paysage du catalogue, ta playlist, un live. La musique démarre avec la session." },
  { t: "Règle ton rythme", d: "Vingt-cinq minutes, cinquante, ou un chrono libre qui s'arrête quand tu décroches." },
  { t: "Travaille", d: "Minuteur, tâches et lecteur dans le même écran. Rien d'autre à l'image." },
  { t: "Relis ta semaine", d: "Série, score de concentration, récap du dimanche. Construits pendant que tu bossais." },
];

function Parcours() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const line = root.current?.querySelector<HTMLElement>("[data-line]");
      const dots = gsap.utils.toArray<HTMLElement>("[data-dot]", root.current);
      const bodies = gsap.utils.toArray<HTMLElement>("[data-step]", root.current);
      if (!line || dots.length === 0) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(line, { scaleY: 1 });
        gsap.set(dots, { scale: 1, backgroundColor: "#ffc38a" });
        gsap.set(bodies, { autoAlpha: 1, x: 0 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(line, { scaleY: 0, transformOrigin: "center top" });
        gsap.set(dots, { scale: 0.4, backgroundColor: "rgba(255,195,138,0)" });
        gsap.set(bodies, { autoAlpha: 0.22, x: -20 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top 76%",
            end: "bottom 82%",
            scrub: 0.5,
            refreshPriority: PRIO.below,
          },
        });

        tl.to(line, { scaleY: 1, duration: 1 }, 0);
        dots.forEach((dot, i) => {
          const at = (i / dots.length) * 0.9;
          tl.to(dot, { scale: 1, backgroundColor: "#ffc38a", duration: 0.05, ease: "power2.out" }, at);
          tl.to(bodies[i], { autoAlpha: 1, x: 0, duration: 0.13, ease: "power2.out" }, at);
        });

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
    <div ref={root} className="relative pl-10 sm:pl-14">
      {/* Le trait, et sa gaine éteinte */}
      <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-white/12 sm:left-[13px]" />
      <span
        data-line
        aria-hidden
        className="absolute left-[4px] top-2 bottom-2 w-[3px] rounded-full bg-[#ffc38a] sm:left-3"
      />

      <ol className="grid gap-12 sm:gap-16">
        {STEPS.map((s) => (
          <li key={s.t} className="relative">
            <span
              data-dot
              aria-hidden
              className="absolute left-[-2.15rem] top-[0.45rem] block h-[11px] w-[11px] rounded-full ring-2 ring-[#ffc38a]/45 sm:left-[-3rem]"
            />
            <div data-step>
              <h3 className="text-[clamp(1.25rem,2.2vw,1.7rem)] font-semibold tracking-[-0.025em] text-white">{s.t}</h3>
              <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-white/65">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LE MINUTEUR JOUABLE — la démo la plus honnête possible : le vrai geste
   ══════════════════════════════════════════════════════════════════════════ */

const PRESETS = [
  { key: "classic", label: "Classique", work: "25 / 5", total: 25 * 60 },
  { key: "deep", label: "Concentration longue", work: "50 / 10", total: 50 * 60 },
  { key: "court", label: "Court", work: "15 / 3", total: 15 * 60 },
] as const;

function TryPomodoro({ publish }: { publish: (live: boolean, total: number, left: number) => void }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("classic");
  const total = PRESETS.find((p) => p.key === preset)!.total;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  // « touched » = le visiteur a lancé SA session au moins une fois. C'est ce
  // qui fait basculer l'horloge de la nav du temps de la page au sien.
  const [touched, setTouched] = useState(false);

  // « En cours » est DÉRIVÉ, jamais stocké : arrivé à zéro, `active` retombe
  // seul et l'effet nettoie son intervalle. Pas de `setState` dans un effet,
  // donc pas de rendu en cascade.
  const active = running && left > 0;

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [active]);

  // Publication vers l'horloge de la nav. Le parent écrit dans SON ref (on ne
  // mute pas un ref reçu en prop), donc aucun re-render ne remonte l'arbre.
  useEffect(() => {
    publish(touched, total, left);
  }, [publish, touched, total, left]);

  const progress = total > 0 ? 1 - left / total : 0;
  const dash = 2 * Math.PI * 52;

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
      <div data-reveal>
        <h2 className="text-[clamp(1.9rem,4.2vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
          Essaie-le tout de suite.
        </h2>
        <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/70">
          C&apos;est le minuteur de l&apos;application, pas une capture. Lance-le et le compteur en haut de page arrête
          de suivre ton scroll pour suivre ta session.
        </p>

        <div className="mt-9 flex flex-wrap gap-2">
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
                  "rounded-full border px-5 py-2.5 text-[13px] transition-colors duration-500",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc38a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05060c]",
                  on ? "border-white/45 bg-white/10 text-white" : "border-white/12 text-white/60 hover:border-white/28 hover:text-white"
                )}
              >
                {p.label}
                <span className="ml-2 font-mono text-[11px] text-white/50">{p.work}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div data-reveal className="justify-self-center">
        <Panel className="w-[19rem]">
          <div className="flex flex-col items-center gap-7 px-8 py-10">
            <div className="relative h-[13.5rem] w-[13.5rem]">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="3" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#ffc38a"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  strokeDashoffset={dash * (1 - progress)}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-[42px] leading-none tabular-nums text-white">
                  {pad(left / 60)}:{pad(left % 60)}
                </span>
                <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">
                  {left === 0 ? "Terminé" : active ? "En cours" : "En attente"}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setTouched(true);
                  if (left === 0) {
                    setLeft(total);
                    setRunning(true);
                  } else setRunning((r) => !r);
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#08090f] transition-transform duration-500 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc38a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080e]"
                aria-label={active ? "Mettre en pause le minuteur" : "Démarrer le minuteur"}
              >
                {active ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden>
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
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc38a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080e]"
                aria-label="Réinitialiser le minuteur"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4.5V10h5.5" />
                </svg>
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LA TRACE — la même grille, mais devenue tes données
   ══════════════════════════════════════════════════════════════════════════

   Le paiement de la métaphore : la façade de la section « mur » revient ici
   sous forme de heatmap. Une case, une soirée, une fenêtre allumée.

   Trame déterministe (aucun Math.random au rendu : le composant doit produire
   deux fois la même grille). */

const HEAT = Array.from({ length: 91 }, (_, i) => (i * 37) % 11);
const HEAT_STEPS = ["bg-white/[0.07]", "bg-[#ffc38a]/30", "bg-[#ffc38a]/55", "bg-[#ffc38a]/80", "bg-[#ffc38a]"];
const heatStep = (v: number) => (v > 8 ? 4 : v > 6 ? 3 : v > 4 ? 2 : v > 2 ? 1 : 0);
const HEAT_DAYS = ["L", "", "M", "", "V", "", "D"];

// Les chiffres se COMPTENT à l'arrivée : un total qui monte dit « ça s'est
// accumulé pendant que tu travaillais », ce qu'un chiffre déjà posé ne dit pas.
// Le rendu initial contient déjà la valeur finale : sans JavaScript, la section
// reste juste.
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
        gsap.set(cells, { autoAlpha: 1, scale: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Même geste que la façade, en plus court : la grille se remplit
        // colonne par colonne, de la plus ancienne à aujourd'hui.
        const tween = gsap.fromTo(
          cells,
          { autoAlpha: 0, scale: 0.4 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.5,
            ease: "power2.out",
            stagger: { amount: 0.9, grid: "auto", from: "start", axis: "x" },
            scrollTrigger: { trigger: root.current, start: "top 78%", once: true, refreshPriority: PRIO.below },
          }
        );
        // Les totaux montent jusqu'à leur valeur. On anime un objet, pas le
        // DOM : une seule écriture de texte par frame, et le formatage reste
        // au même endroit que le rendu initial.
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
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          counters.forEach((c) => {
            c.scrollTrigger?.kill();
            c.kill();
          });
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root}>
      <div data-reveal className="rounded-2xl border border-white/10 bg-[#080a12]/70 p-7 sm:p-9">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-[15px] text-white/75">Treize semaines. Une case par soirée.</p>
          <span className="flex items-center gap-2 font-mono text-[10px] text-white/60">
            moins
            <span className="flex gap-1" aria-hidden>
              {HEAT_STEPS.map((c) => (
                <span key={c} className={cn("h-2.5 w-2.5 rounded-[3px]", c)} />
              ))}
            </span>
            plus
          </span>
        </div>

        <div className="mt-7 flex gap-2.5">
          <div className="grid grid-rows-7 gap-[6px] pr-1">
            {HEAT_DAYS.map((d, i) => (
              <span key={i} className="flex h-[14px] items-center font-mono text-[9px] leading-none text-white/45">
                {d}
              </span>
            ))}
          </div>
          <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[6px]">
            {HEAT.map((v, i) => (
              <span key={i} data-heat className={cn("h-[14px] rounded-[3px]", HEAT_STEPS[heatStep(v)])} />
            ))}
          </div>
        </div>
      </div>

      {/* Les chiffres, nus, sous un filet. Pas de cartes : ils n'ont pas besoin
          d'élévation, ils ont besoin d'espace. */}
      <div data-reveal className="mt-10 grid gap-8 border-t border-white/[0.09] pt-9 sm:grid-cols-3">
        {TRACE_STATS.map((s) => (
          <div key={s.k}>
            <p data-count={s.to} data-kind={s.kind} className="font-mono text-[34px] leading-none tabular-nums text-white">
              {fmtStat(s.to, s.kind)}
            </p>
            <p className="mt-3 text-[13px] text-white/60">{s.k}</p>
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
  const root = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLSpanElement>(null);

  const clock = useRef<Clock>({ scroll: 0, live: false, total: POMODORO_SECONDS, left: POMODORO_SECONDS });
  const [done, setDone] = useState(false);
  const onDoneChange = useCallback((d: boolean) => setDone(d), []);

  /** Le minuteur de la démo publie son état ici : c'est lui qui fait basculer
   *  l'horloge de la nav du temps de la page au temps de la session. */
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

      /* ── Progression de la page, source de l'horloge de la nav ─────────── */
      const progress = ScrollTrigger.create({
        start: 0,
        end: "max",
        refreshPriority: PRIO.hero,
        onUpdate: (self) => {
          if (clock.current) clock.current.scroll = self.progress;
        },
      });

      /* ── Halo du curseur ──────────────────────────────────────────────── */
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        const el = halo.current;
        if (!el) return;
        gsap.set(el, { xPercent: -50, yPercent: -50, x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const xTo = gsap.quickTo(el, "x", { duration: 0.85, ease: "power3" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.85, ease: "power3" });
        const onMove = (e: PointerEvent) => {
          xTo(e.clientX);
          yTo(e.clientY);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        return () => window.removeEventListener("pointermove", onMove);
      });

      /* ── Voile de lecture ─────────────────────────────────────────────── */
      // Transparent sur le hero (on veut voir la ville), il monte ensuite pour
      // que TOUT le texte de la page repose sur un fond stable.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-veil]", { opacity: 0.86 });
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tween = gsap.fromTo(
          "[data-veil]",
          { opacity: 0 },
          {
            opacity: 0.86,
            ease: "none",
            scrollTrigger: { start: 0, end: () => window.innerHeight * 1.15, scrub: 0.5, refreshPriority: PRIO.hero, invalidateOnRefresh: true },
          }
        );

        // Le voile SE RETIRE le temps de la rue seule, puis revient. Sans ça,
        // le seul moment où le décor passe au premier plan se jouerait derrière
        // un aplat à 86 % d'opacité. Les trois plages de scroll ne se
        // chevauchent pas, les tweens ne se disputent donc jamais la propriété.
        const sky = root.current?.querySelector("[data-open-sky]");
        const open = sky
          ? gsap.to("[data-veil]", {
              opacity: 0.1,
              ease: "none",
              scrollTrigger: { trigger: sky, start: "top 90%", end: "top 25%", scrub: 0.5, refreshPriority: PRIO.below },
            })
          : null;
        const close = sky
          ? gsap.to("[data-veil]", {
              opacity: 0.86,
              ease: "none",
              scrollTrigger: { trigger: sky, start: "bottom 85%", end: "bottom 25%", scrub: 0.5, refreshPriority: PRIO.below },
            })
          : null;

        return () => {
          [tween, open, close].forEach((t) => {
            t?.scrollTrigger?.kill();
            t?.kill();
          });
        };
      });

      /* ── Entrée du hero ───────────────────────────────────────────────── */
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-hero]", { autoAlpha: 1, y: 0 });
        gsap.set("[data-word]", { yPercent: 0 });
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from("[data-hero='eyebrow']", { autoAlpha: 0, y: 18, duration: 0.7 })
          .from("[data-word]", { yPercent: 115, duration: 0.95, stagger: 0.055 }, 0.12)
          .from("[data-hero='sub']", { autoAlpha: 0, y: 22, duration: 0.8 }, 0.55)
          .from("[data-hero='cta']", { autoAlpha: 0, y: 20, duration: 0.8 }, 0.68)
          .from("[data-hero='window']", { autoAlpha: 0, y: 56, duration: 1.2 }, 0.3);
        return () => tl.kill();
      });

      /* ── Parallaxe de sortie du hero ──────────────────────────────────── */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tween = gsap.to("[data-hero-inner]", {
          y: 110,
          autoAlpha: 0,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero-section]", start: "top top", end: "bottom 30%", scrub: 0.6, refreshPriority: PRIO.hero },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      /* ── Révélations au scroll, pour toutes les sections en flux ──────── */
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", root.current);
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(items, { autoAlpha: 1, y: 0 });
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(items, { autoAlpha: 0, y: 44 });
        const batched = ScrollTrigger.batch(items, {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.09, ease: "power3.out", overwrite: true }),
        });
        return () => batched.forEach((t) => t.kill());
      });

      /* ── Recalcul obligatoire ─────────────────────────────────────────── */
      // Les effets React s'exécutent ENFANT D'ABORD : quand ce composant monte
      // ses propres déclencheurs, les deux sections épinglées ont déjà inséré
      // leur `pin-spacer` et allongé le document. Mais les déclencheurs créés
      // AVANT ces insertions gardent des bornes calculées sur une page plus
      // courte. Sans ce recalcul, le catalogue s'épinglait plusieurs centaines
      // de pixels trop tôt et se superposait au mur de fenêtres.
      // Un `requestAnimationFrame` laisse le navigateur poser la mise en page
      // avant la mesure.
      const raf = requestAnimationFrame(() => ScrollTrigger.refresh());

      // Les polices modifient la hauteur des titres, donc les bornes.
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

  /* La sonnerie de fin : deux ondes qui partent du bouton quand les
     vingt-cinq minutes de la page (ou de ta session) sont écoulées. Elle ne
     tourne pas en boucle décorative, elle marque un instant précis. */
  useGSAP(
    () => {
      if (!done || !bell.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const rings = gsap.utils.toArray<HTMLElement>("[data-ring]", bell.current);
        const tween = gsap.fromTo(
          rings,
          { scale: 0.85, autoAlpha: 0.7 },
          { scale: 1.9, autoAlpha: 0, duration: 2.6, ease: "power2.out", repeat: -1, stagger: 0.9 }
        );
        return () => tween.kill();
      });
      return () => mm.revert();
    },
    { dependencies: [done], revertOnUpdate: true }
  );

  return (
    <main ref={root} className="relative w-full max-w-full overflow-x-clip bg-[#05060c] text-white">
      {/* ── LE DÉCOR ─────────────────────────────────────────────────────
          Une seule ville, derrière toute la page. Le scroll y fait marcher la
          caméra du premier au dernier écran. */}
      <World />

      {/* Voile de lisibilité, au-dessus de la ville et sous le contenu.
          Une simple opacité sur un aplat : surtout PAS de mode de fusion, qui
          obligerait le navigateur à recomposer tout le viewport à chaque
          frame de scroll (c'était l'une des deux causes des saccades). */}
      <div data-veil aria-hidden className="pointer-events-none fixed inset-0 z-[1] bg-[#05060c] opacity-0" />
      {/* Halo du curseur, sur toute la page */}
      <div
        ref={halo}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[2] h-[46rem] w-[46rem] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,183,110,0.11), transparent 62%)" }}
      />

      {/* Nav : île de verre détachée du bord. Hors du conteneur de contenu,
          pour passer au-dessus des sections épinglées par ScrollTrigger.
          Les liens de section ont été retirés : ils n'indiquaient pas où on se
          trouvait. C'est l'index de chapitres qui tient ce rôle, en le disant.
          Le flou d'arrière-plan est volontairement MODESTE : un
          `backdrop-blur-2xl` fixe re-floute sa zone à chaque frame de scroll,
          par-dessus une scène 3D qui change en permanence. */}
      <header className="fixed inset-x-0 top-6 z-40 flex justify-center px-4">
        <nav className="flex w-max items-center gap-5 rounded-full border border-white/12 bg-[#080a12]/88 py-2 pl-5 pr-2 backdrop-blur-sm">
          <Wordmark />
          <span className="hidden h-8 w-px bg-white/10 sm:block" aria-hidden />
          <div className="hidden sm:block">
            <SessionClock clock={clock} onDoneChange={onDoneChange} />
          </div>
          <Cta label="Commencer" onClick={signIn} className="py-1.5 pl-5 pr-1.5 text-[13px]" />
        </nav>
      </header>

      {/* L'index de chapitres. `fixed`, donc sa place dans le DOM ne change
          rien à sa position : il ne mesure rien au montage, il lit les ancres
          à chaque `refresh`. */}
      <ChapterRail />

      <div className="relative z-10">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section data-hero-section className="relative flex min-h-[100dvh] items-center px-4 pb-24 pt-24 sm:px-8">
          <div
            data-hero-inner
            className="relative mx-auto grid w-full max-w-[86rem] items-center gap-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20"
          >
            <div className="max-w-3xl">
              <span
                data-hero="eyebrow"
                className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70"
              >
                Gratuit, sans compte obligatoire
              </span>

              <h1 className="mt-8 text-[clamp(2.7rem,6.4vw,5.4rem)] font-semibold leading-[1.02] tracking-[-0.04em] [text-shadow:0_4px_44px_rgba(0,0,0,0.85)]">
                <MaskedLine text="Il fait presque nuit." />
                <MaskedLine text="Allume ta fenêtre." />
              </h1>

              <p
                data-hero="sub"
                className="mt-8 max-w-lg text-[17px] leading-relaxed text-white/75 [text-shadow:0_1px_20px_rgba(0,0,0,0.9)]"
              >
                Un minuteur Pomodoro et ta musique dans le même écran, posés sur un paysage qui tourne en boucle.
              </p>

              <div data-hero="cta" className="mt-11 flex flex-wrap items-center gap-4">
                <Cta label="Commencer" onClick={signIn} />
                <Cta
                  label="Voir le catalogue"
                  tone="glass"
                  onClick={() => document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" })}
                />
              </div>
            </div>

            <div data-hero="window" className="hidden justify-self-end lg:block">
              <HeroWindow />
            </div>
          </div>
        </section>

        {/* ── Le manifeste : les mots s'allument un par un ───────────────── */}
        <Manifesto />

        {/* ── La rue seule ───────────────────────────────────────────────
            Deux écrans sans aucun contenu : la ville a le cadre pour elle, on
            marche, on croise des enseignes, la nuit finit de tomber. C'est le
            seul endroit de la page où le décor passe au premier plan, et il
            n'a besoin de rien d'autre que d'espace. Le voile de lecture, lui,
            se retire le temps de la traversée. */}
        <section data-open-sky aria-hidden className="h-[190vh]" />
        <p className="sr-only">
          Descente d&apos;une avenue la nuit. Les paysages du catalogue sont affichés en grand sur les façades :{" "}
          {WORLD_SCREENS.map((v) => v.country).join(", ")}.
        </p>

        {/* ── Le boulevard (catalogue) ───────────────────────────────────── */}
        <span data-anchor="catalogue" aria-hidden className="block h-0" />
        <Boulevard />

        {/* ── Les sources ────────────────────────────────────────────────── */}
        <span data-anchor="sources" aria-hidden className="block h-0" />
        <section id="sources" className="mx-auto w-full max-w-[86rem] px-4 py-28 sm:px-8 md:py-36">
          <h2
            data-reveal
            className="mb-14 max-w-3xl text-[clamp(1.9rem,4.2vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.04em]"
          >
            Quatre façons de remplir le silence.
          </h2>
          <Sources />
        </section>

        {/* ── Le parcours ────────────────────────────────────────────────── */}
        <span data-anchor="parcours" aria-hidden className="block h-0" />
        <section id="parcours" className="mx-auto w-full max-w-[86rem] px-4 pb-28 sm:px-8 md:pb-36">
          <h2
            data-reveal
            className="mb-16 max-w-3xl text-[clamp(1.9rem,4.2vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.04em]"
          >
            Une soirée, du début à la fin.
          </h2>
          <Parcours />
        </section>

        {/* ── Le minuteur jouable ────────────────────────────────────────── */}
        <span data-anchor="minuteur" aria-hidden className="block h-0" />
        <section id="minuteur" className="mx-auto w-full max-w-[86rem] px-4 pb-28 sm:px-8 md:pb-36">
          <TryPomodoro publish={publish} />
        </section>

        {/* ── La trace ───────────────────────────────────────────────────── */}
        <span data-anchor="trace" aria-hidden className="block h-0" />
        <section id="trace" className="mx-auto w-full max-w-[86rem] px-4 pb-28 sm:px-8 md:pb-36">
          <h2
            data-reveal
            className="mb-14 max-w-3xl text-[clamp(1.9rem,4.2vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.04em]"
          >
            Le lendemain, tu sais ce que tu as fait.
          </h2>
          <Trace />
        </section>

        {/* ── Action ─────────────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[86rem] px-4 pb-32 text-center sm:px-8 md:pb-44">
          <h2
            data-reveal
            className="mx-auto max-w-4xl text-[clamp(2.4rem,6vw,4.8rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
          >
            Il fait nuit. Tu as une heure devant toi.
          </h2>
          <p data-reveal className="mx-auto mt-8 max-w-md text-[15px] leading-relaxed text-white/70">
            Utilisable sans compte. Google sert seulement à retrouver ta progression d&apos;un appareil à l&apos;autre.
          </p>
          <div data-reveal className="relative mt-12 flex justify-center">
            {done && (
              <span ref={bell} className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                <span data-ring className="absolute h-16 w-56 rounded-full border border-[#ffc38a]/45" />
                <span data-ring className="absolute h-16 w-56 rounded-full border border-[#ffc38a]/45" />
              </span>
            )}
            <Cta label="Commencer" onClick={signIn} />
          </div>
        </section>

        <span data-anchor="fin" aria-hidden className="block h-0" />
        <footer className="border-t border-white/[0.07]">
          <div className="mx-auto flex w-full max-w-[86rem] flex-col items-center justify-between gap-5 px-4 py-10 sm:flex-row sm:px-8">
            <Wordmark />
            <p className="font-mono text-[11px] tracking-wider text-white/50">
              Pomodoro, lofi, focus. {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
