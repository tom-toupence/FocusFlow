"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  MotionConfig,
  type MotionValue,
} from "motion/react";
import { signInWithGoogle } from "@/lib/supabase";
import CityBackdrop from "@/components/CityBackdrop";
import { cn } from "@/lib/utils";

// LANDING (AuthGate, visiteur non connecté).
//
// Ambiance : la ville, la nuit. `CityBackdrop` occupe le fond en `fixed` et
// fait TOMBER LA NUIT au fil du scroll (la photo descend, le couchant s'efface,
// les fenêtres s'allument, un rail d'heure avance). Toute la page est
// chorégraphiée par-dessus.
//
// Choix technique : TOUT passe par `motion/react` (déjà une dépendance, et
// utilisé par CityBackdrop). Pas de GSAP en parallèle : deux moteurs de scroll
// sur la même page se disputeraient les frames.
//
// Règles de perf tenues partout :
//   - on n'anime que `transform` / `opacity` ;
//   - la position du pointeur vit dans des MotionValue, JAMAIS dans un state
//     (sinon re-render de tout l'arbre à chaque pixel parcouru) ;
//   - tout se neutralise sous `prefers-reduced-motion` (MotionConfig + gardes).

const EASE = [0.16, 1, 0.3, 1] as const;

/* ══════════════════════════════════════════════════════════════════════════
   Primitives
   ══════════════════════════════════════════════════════════════════════════ */

/** Bouton magnétique : il se penche vers le curseur. Uniquement en MotionValue. */
function Magnetic({
  children,
  className,
  onClick,
  strength = 14,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  strength?: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      style={reduce ? undefined : { x, y }}
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * strength * 2);
        y.set(((e.clientY - r.top) / r.height - 0.5) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

function GoogleCta({ label = "Commencer" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Magnetic
      onClick={async () => {
        setLoading(true);
        await signInWithGoogle();
      }}
      className="group inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-semibold tracking-tight text-[#08090f] transition-colors hover:bg-white/90"
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-black/20 border-t-black/70 animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      )}
      {loading ? "Redirection" : label}
      <svg
        className="h-3.5 w-3.5 transition-transform duration-500 ease-out group-hover:translate-x-1"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2.5 8h11M9 3.5L13.5 8 9 12.5" />
      </svg>
    </Magnetic>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-white/20">
        <span className="absolute inset-0 rounded-full bg-[#ffb570]/20 blur-[6px]" aria-hidden />
        <svg className="relative h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2.2" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">FocusFlow</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Aperçu de session : le produit lui-même, incliné vers le curseur
   ══════════════════════════════════════════════════════════════════════════ */

const TRACKS = [
  "Lofi hip hop, beats to study",
  "Rainy Tokyo, night ambience",
  "Study with me, Kyoto 4K",
  "Deep focus, piano et cordes",
];

function SessionCard({ px, py }: { px?: MotionValue<number>; py?: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const TOTAL = 180;
  const [remaining, setRemaining] = useState(TOTAL);
  const [track, setTrack] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setRemaining((r) => (r <= 1 ? TOTAL : r - 1)), 1000);
    const k = setInterval(() => setTrack((i) => (i + 1) % TRACKS.length), 5200);
    return () => {
      clearInterval(t);
      clearInterval(k);
    };
  }, [reduce]);

  // Inclinaison 3D pilotée par la position normalisée du pointeur (-0.5 → 0.5).
  const zero = useMotionValue(0);
  const rotY = useSpring(useTransform(px ?? zero, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 18 });
  const rotX = useSpring(useTransform(py ?? zero, [-0.5, 0.5], [-8, 8]), { stiffness: 120, damping: 18 });

  const progress = 1 - remaining / TOTAL;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const dash = 276;

  return (
    <motion.div
      style={reduce ? undefined : { rotateX: rotX, rotateY: rotY, transformPerspective: 1200 }}
      className="relative w-[24rem] max-w-full rounded-3xl border border-white/12 bg-[#0a0c14]/70 p-2 backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-3xl"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 30px 80px -30px rgba(0,0,0,0.9)" }}
      />
      <div className="relative overflow-hidden rounded-[1.25rem] bg-[#070810]">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="ml-2 font-mono text-[10px] tracking-wider text-white/30">focusflow / session</span>
        </div>

        <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-6">
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-[0.18] grayscale"
            style={{ backgroundImage: "url(https://picsum.photos/seed/focusflow-night-kyoto/900/700)" }}
          />
          <div className="relative h-32 w-32">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,180,110,0.20), transparent 70%)" }}
              animate={reduce ? undefined : { scale: [1, 1.14, 1], opacity: [0.55, 0.95, 0.55] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <svg className="relative h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="3" />
              <circle
                cx="50"
                cy="50"
                r="44"
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
              <span className="font-mono text-[28px] tabular-nums text-white">
                {mm}:{ss}
              </span>
              <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">Focus</span>
            </span>
          </div>

          <span className="relative flex max-w-[80%] items-center gap-2.5 rounded-full border border-white/10 bg-black/50 px-3.5 py-2 backdrop-blur">
            <span className="flex h-3 items-end gap-[2px]" aria-hidden>
              {[1.2, 1.5, 1.35].map((d, i) => (
                <span
                  key={i}
                  className="anim-eq w-[2px] rounded-full bg-[#ffc38a]"
                  style={{ height: "100%", animationDuration: `${d}s`, animationDelay: `${-i * 0.45}s` }}
                />
              ))}
            </span>
            <span key={track} className="anim-track-in truncate text-[11px] text-white/60">
              {TRACKS[track]}
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Manifeste : les mots s'allument un par un, au rythme du scroll
   ══════════════════════════════════════════════════════════════════════════ */

function ScrubbedText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(" ");

  return (
    <p
      ref={ref}
      className="mx-auto max-w-5xl text-balance text-center text-[clamp(1.5rem,3.4vw,2.9rem)] font-medium leading-[1.32] tracking-[-0.02em] text-white"
    >
      {words.map((w, i) => (
        <Word key={`${w}-${i}`} progress={scrollYProgress} index={i} total={words.length}>
          {w}
        </Word>
      ))}
    </p>
  );
}

function Word({
  progress,
  index,
  total,
  children,
}: {
  progress: MotionValue<number>;
  index: number;
  total: number;
  children: React.ReactNode;
}) {
  const start = index / total;
  const opacity = useTransform(progress, [start, start + 1 / total], [0.14, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block">
      {children}
      <span className="inline-block w-[0.28em]" />
    </motion.span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Pile d'étapes : chacune se colle en haut, la précédente recule
   ══════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    n: "01",
    title: "Choisis ton ambiance",
    body: "Un paysage du catalogue, ta playlist YouTube, un album Spotify ou un stream Twitch. La pluie sur Osaka, un train de nuit, une bibliothèque à Séoul.",
    seed: "focusflow-step-ambiance",
  },
  {
    n: "02",
    title: "Pose ton rythme",
    body: "Pomodoro classique, sessions longues, ou Flowtime qui te laisse aller au bout de ton élan puis calcule la pause que tu as méritée.",
    seed: "focusflow-step-rythme",
  },
  {
    n: "03",
    title: "Laisse la nuit passer",
    body: "Respiration guidée pendant les pauses, journal d'humeur, objectif du jour, récap de la semaine. Au matin, tu sais exactement ce que tu as fait.",
    seed: "focusflow-step-nuit",
  },
];

function StepStack() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <div ref={ref} className="relative">
      {STEPS.map((s, i) => (
        <StepCard key={s.n} step={s} index={i} total={STEPS.length} progress={scrollYProgress} />
      ))}
    </div>
  );
}

function StepCard({
  step,
  index,
  total,
  progress,
}: {
  step: (typeof STEPS)[number];
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const reduce = useReducedMotion();
  const isLast = index === total - 1;
  // La carte recule quand la SUIVANTE arrive : segment [i/total, (i+1)/total].
  const scale = useTransform(progress, [index / total, (index + 1) / total], [1, isLast ? 1 : 0.93]);
  const opacity = useTransform(progress, [index / total, (index + 1) / total], [1, isLast ? 1 : 0.35]);

  return (
    <div className="sticky top-[14vh] mb-6 last:mb-0">
      <motion.article
        style={reduce ? undefined : { scale, opacity, transformOrigin: "top center" }}
        className="group relative grid gap-10 overflow-hidden rounded-[2rem] border border-white/10 bg-[#080a12]/85 p-8 backdrop-blur-xl md:grid-cols-[1fr_minmax(0,20rem)] md:items-center md:p-12"
      >
        <div className="max-w-xl">
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#ffc38a]/70">{step.n}</span>
          <h3 className="mt-5 text-[clamp(1.7rem,3.2vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            {step.title}
          </h3>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/50">{step.body}</p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl md:aspect-[3/4]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://picsum.photos/seed/${step.seed}/900/1200`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-70 contrast-125 grayscale transition-all duration-700 ease-out group-hover:scale-105 group-hover:opacity-95 group-hover:grayscale-0"
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060c] via-transparent to-transparent" aria-hidden />
        </div>
      </motion.article>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Accordéon horizontal : les quatre façons de remplir le silence
   ══════════════════════════════════════════════════════════════════════════ */

const SOURCES = [
  {
    key: "catalogue",
    title: "Catalogue",
    line: "Une cinquantaine de paysages choisis à la main : Tokyo, Osaka, Kyoto, Jeju, Ha Long, Hong Kong.",
    seed: "focusflow-source-catalogue",
  },
  {
    key: "youtube",
    title: "YouTube",
    line: "Tes playlists et tes vidéos, jouées dans ton ordre grâce à la file d'attente FocusFlow.",
    seed: "focusflow-source-youtube",
  },
  {
    key: "spotify",
    title: "Spotify",
    line: "Ta bibliothèque Premium se lit dans la session, sans jamais changer d'onglet.",
    seed: "focusflow-source-spotify",
  },
  {
    key: "twitch",
    title: "Twitch",
    line: "Un live ou une rediffusion en fond, pour travailler à côté de quelqu'un.",
    seed: "focusflow-source-twitch",
  },
];

function SourceAccordion() {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex flex-col gap-2 md:h-[60vh] md:min-h-[26rem] md:flex-row">
      {SOURCES.map((s, i) => {
        const active = open === i;
        return (
          <button
            key={s.key}
            onMouseEnter={() => setOpen(i)}
            onFocus={() => setOpen(i)}
            onClick={() => setOpen(i)}
            aria-expanded={active}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-white/10 text-left transition-all duration-700 ease-out",
              active ? "h-[18rem] md:h-auto md:flex-[3.2]" : "h-[8.5rem] md:h-auto md:flex-[1]"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://picsum.photos/seed/${s.seed}/1200/1600`}
              alt=""
              loading="lazy"
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out",
                active ? "scale-105 opacity-60 grayscale-0" : "opacity-35 grayscale"
              )}
            />
            <span className="absolute inset-0 bg-gradient-to-t from-[#05060c] via-[#05060c]/55 to-transparent" aria-hidden />
            <span className="relative flex h-full flex-col justify-end p-6">
              <span className="text-xl font-semibold tracking-tight text-white md:text-2xl">{s.title}</span>
              <span
                className={cn(
                  "mt-2 max-w-sm text-sm leading-relaxed text-white/60 transition-all duration-500",
                  active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                )}
              >
                {s.line}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Bento (grid-flow-dense, 4 x 2 : 2x2 + quatre 1x1, zéro cellule vide)
   ══════════════════════════════════════════════════════════════════════════ */

const CELL =
  "group relative overflow-hidden rounded-3xl border border-white/10 bg-[#080a12]/80 p-7 backdrop-blur-xl transition-colors duration-500 hover:border-white/25";

function Bento() {
  return (
    <div className="grid grid-flow-dense grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
      <article className={cn(CELL, "flex flex-col justify-between gap-10 p-9 sm:col-span-2 lg:row-span-2")}>
        <div
          aria-hidden
          className="absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-70"
          style={{ background: "radial-gradient(90% 70% at 20% 0%, rgba(255,170,90,0.16), transparent 65%)" }}
        />
        <div className="relative">
          <h3 className="text-[clamp(1.4rem,2.3vw,1.95rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-white">
            La musique et le timer ne sont plus dans deux onglets.
          </h3>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/45">
            Le lecteur occupe l&apos;écran, le timer vit dessus, tes tâches restent à portée de main. Plus rien à
            surveiller ailleurs.
          </p>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://picsum.photos/seed/focusflow-bento-session/1200/760"
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-65 contrast-125 grayscale transition-all duration-700 ease-out group-hover:scale-105 group-hover:opacity-90 group-hover:grayscale-0"
          />
        </div>
      </article>

      <article className={CELL}>
        <h3 className="text-lg font-semibold tracking-tight text-white">Flowtime</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/45">
          Quand l&apos;élan est là, le chrono monte au lieu de descendre, et la pause se calcule sur ce que tu as
          vraiment donné.
        </p>
        <span className="mt-7 block font-mono text-[34px] leading-none tabular-nums text-white/25 transition-colors duration-500 group-hover:text-[#ffc38a]/75">
          52:14
        </span>
      </article>

      <article className={CELL}>
        <h3 className="text-lg font-semibold tracking-tight text-white">Ta file, ton ordre</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/45">
          Les titres que tu as choisis, joués dans la séquence que tu as posée. YouTube ne reprend pas la main.
        </p>
        <span className="mt-7 flex flex-col gap-2" aria-hidden>
          {[76, 54, 88].map((w, i) => (
            <span
              key={i}
              className="h-1 rounded-full bg-white/15 transition-colors duration-500 group-hover:bg-white/35"
              style={{ width: `${w}%`, transitionDelay: `${i * 70}ms` }}
            />
          ))}
        </span>
      </article>

      <article className={CELL}>
        <h3 className="text-lg font-semibold tracking-tight text-white">Ce que tu as fait</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/45">
          Séries, heatmap, score de concentration, récap de la semaine à partager.
        </p>
        <span className="mt-7 flex h-12 items-end gap-1.5" aria-hidden>
          {[30, 62, 44, 88, 52, 74, 96].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-white/15 transition-colors duration-500 group-hover:bg-[#ffc38a]/60"
              style={{ height: `${h}%`, transitionDelay: `${i * 45}ms` }}
            />
          ))}
        </span>
      </article>

      <article className={CELL}>
        <h3 className="text-lg font-semibold tracking-tight text-white">Personne ne travaille seul</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/45">
          Ajoute tes amis par code, vois qui est en focus, compare la semaine, écris-leur sans quitter la page.
        </p>
        <span className="mt-7 flex items-center gap-3" aria-hidden>
          <span className="flex -space-x-2">
            {["a", "b", "c"].map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s}
                src={`https://picsum.photos/seed/focusflow-friend-${s}/80/80`}
                alt=""
                loading="lazy"
                className="h-8 w-8 rounded-full border border-white/20 object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
              />
            ))}
          </span>
          <span className="flex h-8 items-center rounded-full border border-white/15 bg-white/[0.06] px-3 font-mono text-[10px] text-white/50">
            en focus
          </span>
        </span>
      </article>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════════════════════ */

const PLACES = ["Kyoto", "Osaka", "Hong Kong", "Jeju", "Ha Long", "Taipei", "Shanghai", "Bali", "Katmandou", "Guilin"];

export default function LandingPage() {
  const reduce = useReducedMotion();

  // Position du pointeur dans le hero, normalisée (-0.5 → 0.5), en MotionValue.
  const heroRef = useRef<HTMLElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spotX = useSpring(useTransform(px, (v) => (v + 0.5) * 100), { stiffness: 90, damping: 20 });
  const spotY = useSpring(useTransform(py, (v) => (v + 0.5) * 100), { stiffness: 90, damping: 20 });
  const spotlight = useMotionTemplate`radial-gradient(44rem circle at ${spotX}% ${spotY}%, rgba(255,183,110,0.13), transparent 62%)`;

  // Parallaxe du contenu du hero pendant qu'il quitte l'écran.
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(heroP, [0, 1], [0, 110]);
  const heroFade = useTransform(heroP, [0, 0.8], [1, 0]);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative w-full max-w-full overflow-x-hidden bg-[#05060c] text-white">
        {/* Fond : la ville, et la nuit qui tombe au fil du scroll */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <CityBackdrop />
        </div>

        <div className="relative z-10">
          {/* Navigation : pilule flottante */}
          <header className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
            <nav className="flex w-full max-w-3xl items-center justify-between gap-6 rounded-full border border-white/12 bg-[#080a12]/70 py-2 pl-5 pr-2 backdrop-blur-xl">
              <Wordmark />
              <div className="hidden items-center gap-7 text-[13px] text-white/45 md:flex">
                <a href="#produit" className="transition-colors hover:text-white">Produit</a>
                <a href="#sources" className="transition-colors hover:text-white">Sources</a>
                <a href="#deroule" className="transition-colors hover:text-white">Déroulé</a>
              </div>
              <Magnetic
                onClick={() => signInWithGoogle()}
                strength={8}
                className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#08090f] transition-colors hover:bg-white/90"
              >
                Se connecter
              </Magnetic>
            </nav>
          </header>

          {/* Attention : hero asymétrique, le curseur éclaire la ville */}
          <section
            ref={heroRef}
            onPointerMove={(e) => {
              if (reduce) return;
              const r = e.currentTarget.getBoundingClientRect();
              px.set((e.clientX - r.left) / r.width - 0.5);
              py.set((e.clientY - r.top) / r.height - 0.5);
            }}
            className="relative flex min-h-[100dvh] items-center px-5 pb-24 pt-32 sm:px-8"
          >
            <motion.span aria-hidden className="pointer-events-none absolute inset-0" style={reduce ? undefined : { background: spotlight }} />

            <motion.div
              style={reduce ? undefined : { y: heroY, opacity: heroFade }}
              className="relative mx-auto grid w-full max-w-7xl items-center gap-16 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="w-full max-w-5xl">
                <motion.h1
                  initial={reduce ? false : { opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, ease: EASE }}
                  className="text-[clamp(2.8rem,6.6vw,5.6rem)] font-semibold leading-[1] tracking-[-0.035em] [text-shadow:0_4px_40px_rgba(0,0,0,0.75)]"
                >
                  Le monde s&apos;éteint,
                  <br />
                  ta
                  <span
                    className="mx-3 inline-block h-[0.6em] w-[1.4em] -translate-y-[0.06em] rounded-full bg-cover bg-center align-middle grayscale-[0.35]"
                    style={{ backgroundImage: "url(https://picsum.photos/seed/focusflow-neon-street/400/240)" }}
                    aria-hidden
                  />
                  session commence.
                </motion.h1>

                <motion.p
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
                  className="mt-8 max-w-md text-[17px] leading-relaxed text-white/60 [text-shadow:0_1px_20px_rgba(0,0,0,0.9)]"
                >
                  Un timer Pomodoro et ta musique dans le même écran. Le reste du bruit attend dehors.
                </motion.p>

                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.26, ease: EASE }}
                  className="mt-11 flex flex-wrap items-center gap-4"
                >
                  <GoogleCta label="Commencer" />
                  <a
                    href="#produit"
                    className="rounded-full border border-white/25 px-7 py-4 text-sm font-semibold tracking-tight text-white transition-colors hover:border-white/60 hover:bg-white/[0.06]"
                  >
                    Découvrir
                  </a>
                </motion.div>
              </div>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 40, rotate: -2 }}
                animate={{ opacity: 1, y: 0, rotate: -1.2 }}
                transition={{ duration: 1.2, delay: 0.32, ease: EASE }}
                className="hidden justify-self-end lg:block"
              >
                <SessionCard px={px} py={py} />
              </motion.div>
            </motion.div>
          </section>

          {/* Les lieux du catalogue, en défilement continu */}
          <div className="relative overflow-hidden border-y border-white/[0.07] bg-[#05060c]/50 py-6 backdrop-blur-sm">
            <div className="anim-marquee flex w-max items-center gap-10 pr-10">
              {[...PLACES, ...PLACES].map((p, i) => (
                <span key={`${p}-${i}`} className="flex items-center gap-10 font-mono text-[12px] uppercase tracking-[0.22em] text-white/25">
                  {p}
                  <span className="h-1 w-1 rounded-full bg-white/15" aria-hidden />
                </span>
              ))}
            </div>
          </div>

          {/* Interest : bento */}
          <section id="produit" className="mx-auto w-full max-w-7xl px-5 py-32 sm:px-8 md:py-48">
            <motion.h2
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: EASE }}
              className="mb-16 max-w-4xl text-[clamp(2rem,4.2vw,3.3rem)] font-semibold leading-[1.05] tracking-[-0.03em]"
            >
              Tout ce qui sert à tenir une heure, réuni au même endroit.
            </motion.h2>
            <Bento />
          </section>

          {/* Desire : manifeste dont les mots s'allument */}
          <section className="mx-auto w-full max-w-7xl px-5 py-32 sm:px-8 md:py-48">
            <ScrubbedText text="Tu ouvres un onglet pour la musique, un autre pour le minuteur, un troisième pour la liste. Puis tu ouvres celui de trop. FocusFlow referme tout ça dans un seul écran, et te rend ta soirée." />
          </section>

          {/* Desire : sources en accordéon horizontal */}
          <section id="sources" className="mx-auto w-full max-w-7xl px-5 pb-32 sm:px-8 md:pb-48">
            <motion.h2
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: EASE }}
              className="mb-14 max-w-3xl text-[clamp(1.8rem,3.4vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
            >
              Quatre façons de remplir le silence.
            </motion.h2>
            <SourceAccordion />
          </section>

          {/* Desire : la pile d'étapes */}
          <section id="deroule" className="mx-auto w-full max-w-7xl px-5 pb-32 sm:px-8 md:pb-48">
            <motion.h2
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: EASE }}
              className="mb-16 max-w-3xl text-[clamp(1.8rem,3.4vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
            >
              Une soirée de travail, du début à la fin.
            </motion.h2>
            <StepStack />
          </section>

          {/* Action */}
          <section className="mx-auto w-full max-w-7xl px-5 py-32 text-center sm:px-8 md:py-48">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.9, ease: EASE }}
            >
              <h2 className="mx-auto max-w-5xl text-[clamp(2.5rem,6.4vw,5rem)] font-semibold leading-[1] tracking-[-0.035em]">
                Il fait nuit. Tu as une heure devant toi.
              </h2>
              <p className="mx-auto mt-8 max-w-md text-[15px] leading-relaxed text-white/50">
                Gratuit, sans publicité, utilisable même sans compte. Google sert seulement à retrouver ta progression
                d&apos;un appareil à l&apos;autre.
              </p>
              <div className="mt-12 flex justify-center">
                <GoogleCta label="Ouvrir une session" />
              </div>
            </motion.div>
          </section>

          <footer className="border-t border-white/[0.07] bg-[#05060c]/70 backdrop-blur-sm">
            <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 px-5 py-10 sm:flex-row sm:px-8">
              <Wordmark />
              <p className="font-mono text-[11px] tracking-wider text-white/25">
                Pomodoro · Lofi · Focus. © {new Date().getFullYear()}
              </p>
            </div>
          </footer>
        </div>
      </main>
    </MotionConfig>
  );
}
