"use client";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING : « Une rue de plus »
//
// La page se lit comme une marche de nuit. Une seule rue en projection caméra
// (components/RueScene, WebGL2) reste FIXE derrière tout le document :
//   . le défilement pousse la caméra dans la rue (vraie perspective : le
//     proche grossit et glisse plus que le loin) ;
//   . chaque chapitre allume une autre rue (coupure puis rallumage) ;
//   . la section « Le rythme » fait passer la rue en pause quand le curseur
//     du cycle traverse une pause (pluie plus dense, lumière baissée).
// Par-dessus, le contenu défile avec ses propres couches de photos à des
// vitesses différentes : deux parallaxes superposées, l'une vraie (3D),
// l'autre de plans (2D).
//
// Moteur : GSAP + ScrollTrigger + SplitText, Lenis pour l'amorti. Jamais
// motion/react sur cette page (règle « un moteur par surface »).
// Formes : angles droits, boutons rectangulaires à filet. Police : Geist.
// Repli : téléphone, économie de données ou sans WebGL matériel, la rue
// devient la photo fixe de la scène (RueScene s'en charge) ; sous
// `prefers-reduced-motion`, rien n'est épinglé ni scrubé.
// « Commencer » n'apparaît qu'à TROIS endroits : bandeau, hero, fin.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import type LenisInstance from "lenis";
import { signInWithGoogle } from "@/lib/supabase";
import RueScene, { type RueHandle } from "@/components/RueScene";
import { RUE_SCENES, rueStill, type RueSceneInfo } from "@/lib/rue/scenes";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const EASE = "power4.out";
const DUR = 1.2;

/** Ordre des rues : la première est la plus lumineuse (premier écran). */
const STREET = ["kabukicho", "pont", "avenue", "pavillon", "ruelle", "boulevard", "fleuve", "carrefour", "ecrans", "viaduc", "tours"];

const sceneById = (id: string) => RUE_SCENES.find((s) => s.id === id) ?? RUE_SCENES[0];

// ─── Primitives ─────────────────────────────────────────────────────────────

/** Texte qui arrive ligne par ligne, chaque ligne derrière son masque. */
function Lines({
  children,
  as = "p",
  className,
  delay = 0,
  start = "top 85%",
  immediate = false,
}: {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  delay?: number;
  start?: string;
  /** Joue au montage (premier écran) au lieu d'attendre le défilement. */
  immediate?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
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
            stagger: 0.085,
            delay,
            scrollTrigger: immediate ? undefined : { trigger: el, start, once: true },
          });
        },
      });
      return () => split.revert();
    });
    return () => mm.revert();
  }, { scope: ref });
  const set = (el: HTMLElement | null) => { ref.current = el; };
  if (as === "h1") return <h1 ref={set} className={className}>{children}</h1>;
  if (as === "h2") return <h2 ref={set} className={className}>{children}</h2>;
  if (as === "h3") return <h3 ref={set} className={className}>{children}</h3>;
  if (as === "span") return <span ref={set} className={className}>{children}</span>;
  return <p ref={set} className={className}>{children}</p>;
}

/** Défilement amorti : Lenis, cadencé par gsap.ticker (un seul cœur). */
function SmoothScroll() {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      let lenis: LenisInstance | null = null;
      let raf: ((t: number) => void) | null = null;
      let cancelled = false;
      void import("lenis").then(({ default: Lenis }) => {
        if (cancelled) return;
        const instance = new Lenis({ duration: 1.1, smoothWheel: true });
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

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("block font-mono text-[10px] uppercase tracking-[0.3em] text-white/45", className)}>{children}</span>;
}

/** Bouton rectangulaire à filet ; le remplissage arrive par la gauche. */
function Cta({ label, onClick, tone = "line", className }: { label: string; onClick?: () => void; tone?: "line" | "solid"; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative isolate inline-flex items-center justify-center overflow-hidden px-8 py-4",
        "font-mono text-[11px] uppercase tracking-[0.24em] transition-colors duration-500",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        tone === "solid" ? "bg-white text-black hover:bg-white/90" : "border border-white/30 text-white hover:border-white/70 hover:text-black",
        className,
      )}
    >
      {tone === "line" && (
        <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-white transition-transform duration-[650ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-x-100" />
      )}
      {label}
    </button>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.2 2.3" strokeLinecap="round" />
      </svg>
      <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-white">FocusFlow</span>
    </span>
  );
}

/** Le titre s'allume comme un néon : quelques ratés, puis la lueur. Le halo
 *  passe par une variable CSS (`--glow`), jamais par un `text-shadow` interpolé. */
function Neon({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: reduce)", () => { gsap.set(el, { autoAlpha: 1, "--glow": 18 }); });
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.set(el, { autoAlpha: 0, "--glow": 0 });
      const tl = gsap.timeline({ delay });
      tl.to(el, { autoAlpha: 1, duration: 0.06 })
        .to(el, { autoAlpha: 0.15, duration: 0.09 })
        .to(el, { autoAlpha: 1, duration: 0.05 })
        .to(el, { autoAlpha: 0.35, duration: 0.14 })
        .to(el, { autoAlpha: 1, duration: 0.07 })
        .to(el, { autoAlpha: 0.6, duration: 0.05 })
        .to(el, { autoAlpha: 1, "--glow": 18, duration: 1.6, ease: "power2.out" });
      return () => tl.kill();
    });
    return () => mm.revert();
  }, { scope: ref });
  return (
    <span
      ref={ref}
      className={cn("inline-block", className)}
      style={{ textShadow: "0 0 calc(var(--glow, 0) * 1px) color-mix(in oklab, var(--neon) 70%, transparent), 0 0 calc(var(--glow, 0) * 2.8px) color-mix(in oklab, var(--neon) 35%, transparent)" }}
    >
      {children}
    </span>
  );
}

/** Photo de rue (image fixe de la scène) en couche de parallaxe : `data-speed`
 *  règle sa vitesse relative (négatif = plus lent que la page). */
function Plate({ id, className, speed = -12, sizes = "40vw" }: { id: string; className?: string; speed?: number; sizes?: string }) {
  const s = sceneById(id);
  return (
    <div data-speed={speed} className={cn("relative overflow-hidden bg-night", className)}>
      <Image src={rueStill(s.id)} alt={s.label} fill sizes={sizes} className="object-cover scale-[1.15]" data-inner />
    </div>
  );
}

// ─── La session, en vrai ────────────────────────────────────────────────────

/** Réplique fidèle de l'écran de session (minuteur qui tourne, titre en cours,
 *  file « À venir » avec une suggestion). Rien d'inventé : ce sont les
 *  éléments réels de /session. */
function SessionReplica() {
  const [left, setLeft] = useState(24 * 60 + 12);
  useEffect(() => {
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 25 * 60)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const progress = 1 - left / (25 * 60);
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border border-white/15 bg-night shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]" data-replica>
      <Image src={rueStill("pont")} alt="Session en cours devant une rue de nuit sous la pluie" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/60" />
      {/* Barre du haut : en cours + minuteur */}
      <div className="absolute top-0 inset-x-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-2 rounded-lg bg-black/55 px-2.5 py-1.5 backdrop-blur-sm border border-white/10 max-w-[60%]">
          <span className="h-1.5 w-1.5 rounded-full bg-focus shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-[10px] sm:text-[11px] text-white">Rain on a Tokyo bridge, lofi</p>
            <p className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.14em] text-white/45">File · 3 / 12</p>
          </div>
        </div>
        <div className="rounded-lg bg-night/80 border border-white/10 px-2.5 sm:px-3 py-1 text-center">
          <p className="font-mono tabular-nums text-[20px] sm:text-[28px] leading-none text-sodium [text-shadow:0_0_14px_color-mix(in_oklab,var(--sodium)_55%,transparent)]" aria-label={`Minuteur ${mm} minutes ${ss}`}>{mm}:{ss}</p>
          <div className="mt-1 h-[2px] w-full bg-white/10 overflow-hidden"><div className="h-full bg-sodium origin-left" style={{ transform: `scaleX(${progress})` }} /></div>
        </div>
      </div>
      {/* File à venir */}
      <div className="absolute right-3 sm:right-4 bottom-14 sm:bottom-16 w-[46%] max-w-[260px] rounded-xl border border-white/10 bg-night/85 backdrop-blur-sm p-2 sm:p-2.5 hidden min-[420px]:block">
        <p className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.16em] text-white/45 mb-1.5">À venir</p>
        {[
          { t: "Night walk in Gion, Kyoto", s: false },
          { t: "Osaka neon, slow beats", s: false },
          { t: "Midnight Shibuya, rain", s: true },
        ].map((r) => (
          <div key={r.t} className="flex items-center gap-2 py-1">
            <span className="h-4 w-6 sm:h-5 sm:w-8 shrink-0 rounded bg-white/10" />
            <p className="truncate text-[9px] sm:text-[10px] text-white/80">{r.s && <span className="text-focus">Suggestion · </span>}{r.t}</p>
          </div>
        ))}
      </div>
      {/* Contrôles */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1.5 p-3">
        {["Pause", "Distraction", "Suivant", "À venir", "Tâches"].map((l, i) => (
          <span key={l} className={cn("rounded-lg border px-2 sm:px-3 py-1 text-[9px] sm:text-[10px]", i === 0 ? "bg-white text-black border-white" : "border-white/15 bg-black/50 text-white/75")}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Le cycle ───────────────────────────────────────────────────────────────

const CYCLE: { kind: "work" | "break"; min: number }[] = [
  { kind: "work", min: 25 }, { kind: "break", min: 5 },
  { kind: "work", min: 25 }, { kind: "break", min: 5 },
  { kind: "work", min: 25 }, { kind: "break", min: 5 },
  { kind: "work", min: 25 }, { kind: "break", min: 15 },
];
const CYCLE_TOTAL = CYCLE.reduce((a, b) => a + b.min, 0);

function clockAt(minutes: number) {
  const t = 21 * 60 + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

// ─── Les sources (travelling) ───────────────────────────────────────────────

const SOURCES: { scene: string; kicker: string; title: string; body: string }[] = [
  { scene: "ruelle", kicker: "01 · Catalogue", title: "Des villes d'Asie, la nuit", body: "Une cinquantaine de vidéos choisies une à une : Study With Me devant Tokyo, lofi sur Kyoto, Séoul, Hong Kong, Osaka. Pas de café, pas de cheminée." },
  { scene: "carrefour", kicker: "02 · YouTube", title: "Ta playlist, dans l'ordre", body: "Colle un lien de playlist ou de mix. FocusFlow la lit titre après titre, en boucle ou au hasard, et tu vois ce qui vient ensuite." },
  { scene: "ecrans", kicker: "03 · Spotify", title: "Ta bibliothèque Spotify", body: "Avec un compte Premium, tes playlists passent dans le même lecteur, avec les mêmes contrôles et la même file." },
  { scene: "viaduc", kicker: "04 · Twitch", title: "Un direct en fond", body: "Une chaîne en direct ou une rediffusion derrière ton minuteur, quand tu préfères une présence à une playlist." },
  { scene: "boulevard", kicker: "05 · La file continue", title: "La musique ne s'arrête pas avant toi", body: "Ta playlist se termine alors que le minuteur tourne encore ? Des titres proches de toute la playlist, pas seulement du dernier morceau, prennent le relais. Tu peux les retirer ou les passer." },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const street = useRef<RueHandle>(null);
  const veil = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<RueSceneInfo>(sceneById(STREET[0]));
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [cycleLabel, setCycleLabel] = useState({ clock: "21:00", kind: "work" as "work" | "break", n: 1 });

  const signIn = useCallback(() => { void signInWithGoogle(); }, []);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // La caméra avance avec la lecture de la page entière.
      ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => street.current?.setScroll(self.progress),
      });

      // Barre de lecture.
      gsap.to("[data-progress]", { scaleX: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.3 } });

      // Chaque chapitre : une autre rue, et la densité du voile qui lui va.
      gsap.utils.toArray<HTMLElement>("[data-chapter]").forEach((el, i) => {
        const v = Number(el.dataset.veil ?? 0.55);
        ScrollTrigger.create({
          trigger: el,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => {
            if (!self.isActive) return;
            gsap.to(veil.current, { opacity: v, duration: 0.9, ease: "power2.out", overwrite: true });
            if (i > 0) street.current?.next();
          },
        });
      });

      // Premier écran : le titre s'éloigne plus vite que la rue (profondeur).
      gsap.to("[data-hero-copy]", {
        yPercent: -35,
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
      });

      // Couches de photos : chacune à sa vitesse, l'image glisse dans son cadre.
      gsap.utils.toArray<HTMLElement>("[data-speed]").forEach((el) => {
        const speed = Number(el.dataset.speed ?? -10);
        gsap.fromTo(el, { yPercent: -speed }, { yPercent: speed, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
        const inner = el.querySelector("[data-inner]");
        if (inner) gsap.fromTo(inner, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });

      // La réplique de session s'ouvre par les quatre côtés.
      gsap.fromTo("[data-replica]", { clipPath: "inset(14% 10% 14% 10%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: { trigger: "[data-replica]", start: "top 90%", end: "top 35%", scrub: true } });

      // Le cycle : épinglé, le curseur traverse une soirée de travail.
      const cyc = document.querySelector<HTMLElement>("[data-cycle]");
      if (cyc) {
        let last = "";
        ScrollTrigger.create({
          trigger: cyc,
          start: "top top",
          end: "+=180%",
          pin: true,
          scrub: true,
          onUpdate: (self) => {
            const m = self.progress * CYCLE_TOTAL;
            let acc = 0, idx = 0;
            for (let i = 0; i < CYCLE.length; i++) { if (m < acc + CYCLE[i].min) { idx = i; break; } acc += CYCLE[i].min; idx = i; }
            const kind = CYCLE[idx].kind;
            gsap.set("[data-cursor]", { left: `${self.progress * 100}%` });
            const key = `${kind}${idx}`;
            if (key !== last) {
              last = key;
              setPhase(kind);
              setCycleLabel({ clock: clockAt(m), kind, n: Math.floor(idx / 2) + 1 });
            } else {
              const el = document.querySelector("[data-cycle-clock]");
              if (el) el.textContent = clockAt(m);
            }
          },
          onLeave: () => setPhase("work"),
          onLeaveBack: () => setPhase("work"),
        });
      }

      // Le travelling des sources : la piste file vers la gauche.
      const track = document.querySelector<HTMLElement>("[data-track]");
      const pan = document.querySelector<HTMLElement>("[data-pan]");
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      if (track && pan && desktop) {
        const dist = () => track.scrollWidth - window.innerWidth + 64;
        const tween = gsap.to(track, {
          x: () => -dist(),
          ease: "none",
          scrollTrigger: { trigger: pan, start: "top top", end: () => `+=${dist()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
        });
        gsap.utils.toArray<HTMLElement>("[data-card-img]").forEach((img) => {
          gsap.fromTo(img, { xPercent: -8 }, { xPercent: 8, ease: "none", scrollTrigger: { trigger: img, containerAnimation: tween, start: "left right", end: "right left", scrub: true } });
        });
      }

      // Présence des amis : les rangées arrivent une à une.
      gsap.from("[data-friend]", { y: 24, autoAlpha: 0, duration: 0.9, ease: EASE, stagger: 0.12, scrollTrigger: { trigger: "[data-friends]", start: "top 70%", once: true } });
    });

    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} className="relative bg-night text-white selection:bg-neon/40">
      <SmoothScroll />

      {/* ── La rue, fixe derrière toute la page ─────────────────────────── */}
      <div className="fixed inset-0 z-0">
        <RueScene
          ref={street}
          scenes={STREET}
          mode={phase}
          interval={[18, 24]}
          onScene={setScene}
          className="absolute inset-0"
          label="Une rue de nuit en vraie perspective : la caméra avance quand on fait défiler la page."
        />
        <div ref={veil} aria-hidden className="absolute inset-0 bg-night opacity-[0.12]" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      {/* ── Bandeau ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 sm:px-8 py-4 bg-gradient-to-b from-black/60 to-transparent">
        <Wordmark />
        <nav className="hidden md:flex items-center gap-7 font-mono text-[10px] uppercase tracking-[0.24em] text-white/60" aria-label="Sections">
          <a href="#session" className="hover:text-white transition-colors">La session</a>
          <a href="#rythme" className="hover:text-white transition-colors">Le rythme</a>
          <a href="#sources" className="hover:text-white transition-colors">La musique</a>
          <a href="#amis" className="hover:text-white transition-colors">Les amis</a>
        </nav>
        <Cta label="Commencer" onClick={signIn} className="px-5 py-2.5 text-[10px]" />
      </header>
      <div aria-hidden className="fixed bottom-0 inset-x-0 z-40 h-[2px] bg-white/10">
        <div data-progress className="h-full origin-left scale-x-0 bg-neon" />
      </div>

      {/* Crédit de la rue affichée (licences CC BY). */}
      <p className="fixed bottom-3 left-4 sm:left-8 z-30 max-w-[70vw] truncate font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">
        {scene.label} ·{" "}
        {scene.href ? <a href={scene.href} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline hover:text-white/80">{scene.credit}</a> : scene.credit}
      </p>

      <main className="relative z-10">
        {/* ── 1. Premier écran ────────────────────────────────────────────── */}
        <section data-hero data-chapter data-veil="0.12" className="relative min-h-[150vh]">
          <div className="sticky top-0 h-[100svh] flex items-end">
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            <div data-hero-copy className="relative w-full px-4 sm:px-8 lg:px-14 pb-20 sm:pb-24">
              <Label className="text-white/60">Pomodoro · musique · gratuit</Label>
              <h1 className="mt-5 max-w-[15ch] text-[clamp(2.9rem,8.4vw,8rem)] font-light leading-[0.92] tracking-[-0.045em]">
                <Neon delay={0.3}>La ville ne dort pas.</Neon>
                <Lines as="span" immediate delay={1.2} className="block text-white/80">Toi, tu avances.</Lines>
              </h1>
              <div className="mt-8 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-10">
                <Lines immediate delay={1.5} className="max-w-md text-[15px] sm:text-base leading-relaxed text-white/75">
                  Un minuteur Pomodoro et ta musique dans le même écran plein cadre, devant une ville la nuit. YouTube, Spotify ou Twitch. Sans publicité, sans abonnement.
                </Lines>
                <div className="flex items-center gap-5">
                  <Cta label="Commencer" onClick={signIn} tone="solid" />
                  <a href="#session" className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60 hover:text-white transition-colors">Voir la session</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. La session ───────────────────────────────────────────────── */}
        <section id="session" data-chapter data-veil="0.74" className="relative px-4 sm:px-8 lg:px-14 py-28 sm:py-40">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-5">
              <Label>La session</Label>
              <Lines as="h2" className="mt-5 text-[clamp(2.2rem,4.6vw,4.2rem)] font-light leading-[0.98] tracking-[-0.035em]">
                Une vidéo, un minuteur, rien d&apos;autre.
              </Lines>
              <Lines className="mt-6 max-w-md text-[15px] leading-relaxed text-white/70">
                Tu choisis un paysage ou une playlist, tu lances. La vidéo prend tout l&apos;écran, le minuteur reste dans un coin. Espace met en pause, D note une distraction, et le reste se cache tant que tu ne bouges pas la souris.
              </Lines>
              <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 max-w-md">
                {[
                  ["25 / 5", "Classique, profond ou sur mesure"],
                  ["Flowtime", "Le chrono monte, la pause suit"],
                  ["À venir", "La file, avec retrait et ajout"],
                  ["Mini-minuteur", "Toujours au premier plan"],
                ].map(([k, v]) => (
                  <li key={k} className="border-t border-white/15 pt-3">
                    <p className="font-mono tabular-nums text-[13px] text-white">{k}</p>
                    <p className="mt-1 text-[13px] text-white/55">{v}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7" data-speed="-6">
              <SessionReplica />
            </div>
          </div>
        </section>

        {/* ── 3. Le rythme (épinglé) ──────────────────────────────────────── */}
        <section id="rythme" data-chapter data-veil="0.6" className="relative">
          <div data-cycle className="h-[100svh] flex flex-col justify-center px-4 sm:px-8 lg:px-14">
            <Label>Le rythme</Label>
            <h2 className="mt-5 max-w-[18ch] text-[clamp(2.2rem,5vw,4.6rem)] font-light leading-[0.98] tracking-[-0.035em]">
              25 minutes de travail, 5 de pause. La quatrième, on souffle vraiment.
            </h2>
            <div className="mt-12 sm:mt-16" aria-hidden>
              <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.2em]">
                <span className={cn("transition-colors duration-500", cycleLabel.kind === "break" ? "text-focus" : "text-sodium")}>
                  {cycleLabel.kind === "break" ? "Pause" : `Pomodoro ${cycleLabel.n}`}
                </span>
                <span data-cycle-clock className="tabular-nums text-white/70">{cycleLabel.clock}</span>
              </div>
              <div className="relative mt-4 flex h-14 sm:h-16 gap-[3px]">
                {CYCLE.map((c, i) => (
                  <div key={i} style={{ flexGrow: c.min }} className={cn("relative h-full", c.kind === "work" ? "bg-sodium/25 border-t-2 border-sodium" : "bg-focus/15 border-t-2 border-focus")}>
                    <span className="absolute bottom-1.5 left-2 font-mono text-[9px] tabular-nums text-white/55">{c.min}</span>
                  </div>
                ))}
                <div data-cursor className="absolute -top-2 -bottom-2 w-px bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" style={{ left: 0 }} />
              </div>
              <div className="mt-3 flex justify-between font-mono text-[10px] tabular-nums text-white/40">
                <span>21:00</span><span>{clockAt(CYCLE_TOTAL)}</span>
              </div>
            </div>
            <p className="mt-10 max-w-xl text-[15px] leading-relaxed text-white/70">
              Pendant la pause, la vidéo s&apos;efface et la rue prend l&apos;écran, avec un exercice de respiration si tu veux. Tu préfères ne pas couper ? Le mode Flowtime compte sans limite et te donne une pause égale au cinquième du temps passé.
            </p>
          </div>
        </section>

        {/* ── 4. Les sources (travelling horizontal) ──────────────────────── */}
        <section id="sources" data-chapter data-veil="0.82" className="relative">
          <div data-pan className="md:h-[100svh] md:overflow-hidden flex flex-col justify-center py-24 md:py-0">
            <div className="px-4 sm:px-8 lg:px-14 mb-10 md:mb-12 flex items-end justify-between gap-8">
              <div>
                <Label>La musique</Label>
                <h2 className="mt-5 text-[clamp(2.2rem,4.6vw,4.2rem)] font-light leading-[0.98] tracking-[-0.035em]">Ce qui joue derrière toi.</h2>
              </div>
              <p className="hidden lg:block max-w-xs text-[13px] leading-relaxed text-white/55">Quatre sources, un seul lecteur. Les mêmes boutons quelle que soit celle que tu choisis.</p>
            </div>
            <div data-track className="flex flex-col md:flex-row gap-5 md:gap-7 px-4 sm:px-8 lg:px-14 md:w-max">
              {SOURCES.map((s) => (
                <article key={s.kicker} className="relative md:w-[min(46vw,640px)] shrink-0 border border-white/12 bg-black/40">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <div data-card-img className="absolute inset-[-8%]">
                      <Image src={rueStill(s.scene)} alt={sceneById(s.scene).label} fill sizes="(min-width: 768px) 46vw, 100vw" className="object-cover" />
                    </div>
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                    <p className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/70">{s.kicker}</p>
                    <h3 className="absolute bottom-4 left-4 right-4 text-[clamp(1.5rem,2.6vw,2.3rem)] font-light leading-[1.02] tracking-[-0.03em]">{s.title}</h3>
                  </div>
                  <p className="p-4 sm:p-5 text-[14px] leading-relaxed text-white/65">{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. La journée ───────────────────────────────────────────────── */}
        <section id="journee" data-chapter data-veil="0.8" className="relative px-4 sm:px-8 lg:px-14 py-28 sm:py-40">
          <div className="grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-5 lg:order-2">
              <Label>Ta journée</Label>
              <Lines as="h2" className="mt-5 text-[clamp(2.2rem,4.6vw,4.2rem)] font-light leading-[0.98] tracking-[-0.035em]">
                Ce que tu as fait, sans tableur.
              </Lines>
              <ul className="mt-10 space-y-6 max-w-md">
                {[
                  ["Objectif du jour", "En minutes ou en pomodoros, avec un anneau qui se remplit."],
                  ["Planning de la semaine", "Des blocs de focus qui arrivent dans ton agenda, rappel dix minutes avant."],
                  ["Projets et échéances", "Un budget de pomodoros et le rythme à tenir pour finir à temps."],
                  ["Journal", "Une humeur et deux lignes après chaque session, pour voir ce qui marche."],
                  ["Le récap du lundi", "Ta semaine en une carte à partager."],
                ].map(([k, v]) => (
                  <li key={k} className="grid grid-cols-[auto_1fr] gap-4">
                    <span className="mt-[7px] h-1.5 w-1.5 bg-focus" />
                    <div>
                      <p className="text-[15px] text-white">{k}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-white/60">{v}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* Collage en couches : trois photos, trois vitesses, deux relevés. */}
            <div className="lg:col-span-7 lg:order-1 relative h-[480px] sm:h-[620px]">
              <Plate id="fleuve" speed={-14} className="absolute left-0 top-6 w-[62%] aspect-[4/3]" />
              <Plate id="pavillon" speed={10} className="absolute right-0 top-[34%] w-[48%] aspect-[3/4]" />
              <Plate id="tours" speed={-4} className="absolute left-[14%] bottom-0 w-[44%] aspect-[16/10]" />
              <div data-speed="18" className="absolute left-[52%] top-0 w-40 sm:w-48 border border-white/15 bg-night/90 p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Objectif</p>
                <svg viewBox="0 0 80 80" className="mt-2 w-20 h-20" aria-hidden>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--focus)" strokeWidth="6" strokeDasharray={`${2 * Math.PI * 32 * 0.75} ${2 * Math.PI * 32}`} transform="rotate(-90 40 40)" strokeLinecap="round" />
                  <text x="40" y="45" textAnchor="middle" className="fill-white font-mono" fontSize="14">3/4</text>
                </svg>
              </div>
              <div data-speed="-20" className="absolute right-[6%] bottom-[8%] w-52 sm:w-60 border border-white/15 bg-night/90 p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Cette semaine</p>
                <div className="mt-3 flex items-end gap-1.5 h-16">
                  {[40, 75, 55, 100, 30, 85, 60].map((h, i) => (
                    <div key={i} className={cn("flex-1", i === 3 ? "bg-focus" : "bg-white/25")} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="mt-2 flex justify-between font-mono text-[8px] text-white/40"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Les amis ─────────────────────────────────────────────────── */}
        <section id="amis" data-chapter data-veil="0.62" className="relative px-4 sm:px-8 lg:px-14 py-28 sm:py-40">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <Label>Les amis</Label>
              <Lines as="h2" className="mt-5 text-[clamp(2.2rem,4.6vw,4.2rem)] font-light leading-[0.98] tracking-[-0.035em]">
                Seul devant ton écran, pas seul dans la ville.
              </Lines>
              <Lines className="mt-6 max-w-md text-[15px] leading-relaxed text-white/70">
                Ajoute tes amis avec un code. Tu vois qui est en focus en ce moment et ce qui l&apos;accompagne, le classement de la semaine, et vous pouvez vous écrire ou vous encourager d&apos;un geste. Ils ne voient jamais tes tâches ni ton journal.
              </Lines>
            </div>
            <div data-friends className="lg:col-span-5 lg:col-start-8">
              <div className="border border-white/15 bg-night/85 backdrop-blur-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">Amis · 3 en ligne</p>
                  <span className="h-1.5 w-1.5 rounded-full bg-focus" />
                </div>
                {[
                  { n: "Léa", s: "En focus · Rain on a Tokyo bridge", c: "bg-focus", m: "2 h 05" },
                  { n: "Sam", s: "En pause", c: "bg-sodium", m: "1 h 40" },
                  { n: "Inès", s: "En ligne", c: "bg-white/60", m: "55 min" },
                  { n: "Yanis", s: "Hors ligne", c: "bg-white/20", m: "3 h 10" },
                ].map((f) => (
                  <div key={f.n} data-friend className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                    <span className="relative grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[12px]">
                      {f.n[0]}
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-night", f.c)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-white">{f.n}</p>
                      <p className="truncate text-[12px] text-white/50">{f.s}</p>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-white/55">{f.m}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Temps de focus de la semaine</p>
            </div>
          </div>
        </section>

        {/* ── 7. Fin de nuit ──────────────────────────────────────────────── */}
        <section data-chapter data-veil="0.3" className="relative min-h-[100svh] flex flex-col justify-end px-4 sm:px-8 lg:px-14 pb-24">
          <Label>Gratuit, sans publicité</Label>
          <Lines as="h2" className="mt-5 max-w-[14ch] text-[clamp(2.8rem,8vw,7.5rem)] font-light leading-[0.92] tracking-[-0.045em]">
            Ce soir, une rue de plus.
          </Lines>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Cta label="Commencer" onClick={signIn} tone="solid" />
            <p className="text-[13px] text-white/60">Connexion avec Google : tes réglages te suivent d&apos;un appareil à l&apos;autre.</p>
          </div>
          <footer className="mt-24 border-t border-white/10 pt-6 grid gap-2 sm:grid-cols-2 text-[11px] text-white/40">
            <p>Photos des rues : {RUE_SCENES.filter((s) => s.href).map((s, i, a) => (
              <span key={s.id}><a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-white/70 underline-offset-2 hover:underline">{s.credit.replace(/^Photo : /, "").replace(/ \(modifiée.*\)$/, "")}</a>{i < a.length - 1 ? ", " : ""}</span>
            ))}. Photos modifiées : profondeur, plans, effets.</p>
            <p className="sm:text-right">FocusFlow · minuteur Pomodoro et musique de concentration</p>
          </footer>
        </section>
      </main>
    </div>
  );
}
