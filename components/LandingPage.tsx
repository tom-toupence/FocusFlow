"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { defaultVideos } from "@/data/videos";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING — « Ethereal Glass » posée sur la ville la nuit, en cascade Z.
//
// PARTI PRIS SUR L'IMAGERIE : zéro photo générique. Toutes les images de cette
// page sont les VRAIES vignettes YouTube du catalogue (`data/videos.ts`) :
// Shibuya sous la pluie, la baie de Yokohama, le Bund la nuit. C'est le produit
// qui s'illustre lui-même, et chaque image est raccord avec son propos.
// Les trois sources externes (YouTube, Spotify, Twitch) ne sont PAS illustrées
// par des photos mais par leur marque et un morceau de leur interface.
//
// AMBIANCE : `CityBackdrop` tient le fond en `fixed` et fait tomber la nuit au
// fil du scroll (la photo descend, le couchant s'efface, les fenêtres
// s'allument, un rail d'heure avance).
//
// 3D : une vraie scène `preserve-3d` dans le hero. Les éléments flottent à des
// profondeurs différentes (`translateZ`) et la scène s'oriente vers le curseur,
// donc la parallaxe est réelle et non simulée.
//
// PERF : uniquement `transform` / `opacity`. La position du pointeur vit dans
// des MotionValue, jamais dans un state. `backdrop-blur` réservé aux éléments
// fixes et aux cartes de taille modeste. Tout se replie sous reduced-motion.
// ═══════════════════════════════════════════════════════════════════════════

const SPRING = { stiffness: 110, damping: 20, mass: 0.6 };
const EASE = [0.32, 0.72, 0, 1] as const;

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/* ══════════════════════════════════════════════════════════════════════════
   Primitives
   ══════════════════════════════════════════════════════════════════════════ */

/** Double-bezel : coque extérieure + noyau, rayons concentriques. */
function Bezel({
  children,
  className,
  inner,
  radius = 2,
}: {
  children: React.ReactNode;
  className?: string;
  inner?: string;
  radius?: number;
}) {
  return (
    <div
      className={cn("border border-white/10 bg-white/[0.04] p-1.5", className)}
      style={{ borderRadius: `${radius}rem` }}
    >
      <div
        className={cn("relative overflow-hidden bg-[#07080e] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]", inner)}
        style={{ borderRadius: `${radius - 0.375}rem` }}
      >
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/65">
      {children}
    </span>
  );
}

/** CTA « island » : pilule + icône nichée dans son propre cercle. */
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
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 250, damping: 17 });
  const y = useSpring(useMotionValue(0), { stiffness: 250, damping: 17 });

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      style={reduce ? undefined : { x, y }}
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * 22);
        y.set(((e.clientY - r.top) / r.height - 0.5) * 12);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className={cn(
        "group inline-flex items-center gap-4 rounded-full py-2 pl-7 pr-2 text-sm font-semibold tracking-tight transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
        tone === "light"
          ? "bg-white text-[#08090f] hover:bg-white/92"
          : "border border-white/15 bg-white/[0.05] text-white hover:border-white/35 hover:bg-white/[0.09]",
        className
      )}
    >
      {label}
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-[1px] group-hover:translate-x-1 group-hover:scale-105",
          tone === "light" ? "bg-black/[0.07]" : "bg-white/10"
        )}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
          <path d="M4.5 11.5L11.5 4.5M6 4.5h5.5V10" />
        </svg>
      </span>
    </motion.button>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-white/15">
        <span className="absolute inset-0 rounded-full bg-[#ffb570]/25 blur-[7px]" aria-hidden />
        <svg className="relative h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2.2" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">FocusFlow</span>
    </span>
  );
}

/** Entrée au scroll : montée lourde, flou qui se dissipe. */
function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 64, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.95, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'HORLOGE DE LA PAGE — la landing EST un pomodoro
   ══════════════════════════════════════════════════════════════════════════

   Idée directrice : sur un site de Pomodoro, le temps ne doit pas être un
   argument, il doit être l'expérience. Le compteur logé dans la nav part de
   25:00 en haut de page et atteint 00:00 en bas : parcourir la page, c'est
   dérouler une session. Et si le visiteur lance le vrai minuteur de la section
   démo, CELUI-CI PREND LE RELAIS — la page cesse de mimer le temps pour
   afficher le sien.

   Tout est piloté par MotionValue : le texte se met à jour sans jamais
   re-rendre l'arbre React, même à la seconde. */

const POMODORO_SECONDS = 25 * 60;
const CLOCK_R = 13;
const CLOCK_C = 2 * Math.PI * CLOCK_R;

function SessionClock({
  scrollProgress,
  liveLeft,
  liveTotal,
  live,
  done,
}: {
  scrollProgress: MotionValue<number>;
  liveLeft: MotionValue<number>;
  liveTotal: number;
  live: boolean;
  done: boolean;
}) {
  // UNE seule valeur affichée, alimentée par l'une ou l'autre source. On ne
  // fait pas commuter `useTransform` d'une MotionValue à l'autre entre deux
  // rendus : on s'abonne explicitement à la bonne source.
  const seconds = useMotionValue(POMODORO_SECONDS);
  const ratio = useMotionValue(0); // part écoulée, 0 → 1

  useEffect(() => {
    if (live) {
      const apply = (v: number) => {
        seconds.set(v);
        ratio.set(liveTotal > 0 ? 1 - v / liveTotal : 0);
      };
      apply(liveLeft.get());
      return liveLeft.on("change", apply);
    }
    const apply = (p: number) => {
      const clamped = Math.max(0, Math.min(1, p));
      seconds.set(POMODORO_SECONDS * (1 - clamped));
      ratio.set(clamped);
    };
    apply(scrollProgress.get());
    return scrollProgress.on("change", apply);
  }, [live, liveTotal, liveLeft, scrollProgress, seconds, ratio]);

  const mm = useTransform(seconds, (v) => String(Math.floor(Math.max(v, 0) / 60)).padStart(2, "0"));
  const ss = useTransform(seconds, (v) => String(Math.floor(Math.max(v, 0) % 60)).padStart(2, "0"));
  const label = useMotionTemplate`${mm}:${ss}`;
  const dashOffset = useTransform(ratio, (v) => CLOCK_C * (1 - v));

  return (
    <span
      className="flex items-center gap-2.5"
      title={live ? "Ta session est en cours" : "La page se déroule comme une session de 25 minutes"}
    >
      <span className="relative flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="16" cy="16" r={CLOCK_R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <motion.circle
            cx="16"
            cy="16"
            r={CLOCK_R}
            fill="none"
            stroke={done ? "#7fd4c1" : "#ffc38a"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={CLOCK_C}
            style={{ strokeDashoffset: dashOffset }}
          />
        </svg>
        {/* Micro-boucle perpétuelle : le point ne bat QUE quand une vraie
            session tourne. Le mouvement dit un état, il ne décore pas. */}
        {live && (
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-[#ffc38a]"
            animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </span>
      <span className="flex flex-col leading-none">
        <motion.span className="font-mono text-[13px] tabular-nums text-white">{done ? "00:00" : label}</motion.span>
        <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/45">
          {done ? "pause méritée" : live ? "ta session" : "cette page"}
        </span>
      </span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO — scène 3D : la session au centre, ses satellites en profondeur
   ══════════════════════════════════════════════════════════════════════════ */

// Un pays différent à chaque rotation : le catalogue ne se résume pas au Japon.
const HERO_TRACKS = defaultVideos.filter((v) => ["hk-02", "driv-05", "cn-01", "np-01", "abao-11"].includes(v.id));

/** Élément flottant à une profondeur donnée : il dérive en boucle et suit la scène. */
function Floating({
  z,
  drift = 14,
  duration = 9,
  className,
  children,
}: {
  z: number;
  drift?: number;
  duration?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("absolute", className)}
      style={{ z, transformStyle: "preserve-3d" }}
      animate={reduce ? undefined : { y: [0, -drift, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

function HeroScene({ px, py }: { px: MotionValue<number>; py: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const rotY = useSpring(useTransform(px, [-0.5, 0.5], [14, -14]), SPRING);
  const rotX = useSpring(useTransform(py, [-0.5, 0.5], [-11, 11]), SPRING);

  const TOTAL = 1500; // 25 min
  const [remaining, setRemaining] = useState(TOTAL);
  const [track, setTrack] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setRemaining((r) => (r <= 1 ? TOTAL : r - 1)), 1000);
    const k = setInterval(() => setTrack((i) => (i + 1) % HERO_TRACKS.length), 5600);
    return () => {
      clearInterval(t);
      clearInterval(k);
    };
  }, [reduce]);

  const current = HERO_TRACKS[track] ?? defaultVideos[0];
  const progress = 1 - remaining / TOTAL;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const dash = 2 * Math.PI * 44;

  return (
    <motion.div
      style={reduce ? undefined : { rotateX: rotX, rotateY: rotY, transformPerspective: 1400, transformStyle: "preserve-3d" }}
      className="relative h-[28rem] w-[22rem] sm:h-[30rem] sm:w-[26rem]"
    >
      {/* Noyau : l'écran de session. Reculé d'un plan (z négatif) pour que les
          satellites vivent DEVANT lui et restent lisibles. */}
      <Floating z={-90} drift={10} duration={11} className="inset-x-0 top-10">
        <Bezel radius={2}>
          <div className="relative aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.youtubeId}
              src={thumb(current.youtubeId)}
              alt=""
              className="anim-ambient-in absolute inset-0 h-full w-full object-cover opacity-45"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-[#05060c] via-[#05060c]/55 to-[#05060c]/25" aria-hidden />

            <div className="relative flex h-full flex-col items-center justify-center gap-5">
              <div className="relative h-28 w-28">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#ffc38a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    strokeDashoffset={dash * (1 - progress)}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-[26px] tabular-nums text-white">
                    {mm}:{ss}
                  </span>
                  <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Focus</span>
                </span>
              </div>
            </div>
          </div>
        </Bezel>
      </Floating>

      {/* Satellite avant-plan : le titre en cours */}
      <Floating z={130} drift={16} duration={8} className="-left-10 bottom-6 w-[17rem] sm:-left-20">
        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0a0c14]/92 p-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb(current.youtubeId)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-medium text-white">{current.title}</span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <span className="flex h-2.5 items-end gap-[2px]" aria-hidden>
                {[1.2, 1.5, 1.35].map((d, i) => (
                  <span
                    key={i}
                    className="anim-eq w-[2px] rounded-full bg-[#ffc38a]"
                    style={{ height: "100%", animationDuration: `${d}s`, animationDelay: `${-i * 0.4}s` }}
                  />
                ))}
              </span>
              <span className="truncate font-mono text-[10px] text-white/65">{current.channel}</span>
            </span>
          </span>
        </div>
      </Floating>

      {/* Satellite arrière-plan : la tâche en cours */}
      <Floating z={95} drift={12} duration={13} className="-right-8 top-4 w-[13rem] sm:-right-16">
        <div className="rounded-2xl border border-white/15 bg-[#0a0c14]/90 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/65">En cours</span>
          <p className="mt-2 text-[13px] leading-snug text-white">Relire le chapitre 4</p>
          <span className="mt-3 flex gap-1" aria-hidden>
            {[1, 1, 1, 0].map((full, i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full", full ? "bg-[#ffc38a]/70" : "bg-white/12")} />
            ))}
          </span>
        </div>
      </Floating>

      {/* Satellite lointain : la présence d'un ami */}
      <Floating z={60} drift={9} duration={15} className="-left-6 -top-4 w-[11rem] sm:-left-14">
        <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-[#0a0c14]/90 py-2 pl-2 pr-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12 text-[11px] font-semibold text-white" aria-hidden>
            C
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] text-white">Camille</span>
            <span className="block font-mono text-[9px] text-[#7fd4c1]">en focus</span>
          </span>
        </div>
      </Floating>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CATALOGUE — bande sans fin, en perspective, qu'on fait défiler à la main
   ══════════════════════════════════════════════════════════════════════════ */

// Dix cartes, dix pays : Hong Kong, Corée, Chine, Taïwan, Vietnam, Japon,
// Norvège, Suisse, Royaume-Uni, Indonésie.
const CAROUSEL_IDS = ["hk-02", "driv-05", "cn-01", "tw-02", "vn-01", "abao-11", "no-01", "noma-07", "uk-01", "id-02"];
const CAROUSEL = CAROUSEL_IDS.map((id) => defaultVideos.find((v) => v.id === id)!).filter(Boolean);

// L'anneau fermé laissait forcément un trou : dès qu'on masquait les dos de
// cartes, la moitié arrière disparaissait et le cadre se vidait. On passe donc
// à une BANDE INFINIE : les cartes défilent en boucle sur un axe horizontal et
// s'inclinent d'autant plus qu'elles s'éloignent du centre. Le cadre est
// toujours plein, quel que soit l'angle.
const CARD_W = 272; // px
const GAP = 52;
const SLOT = CARD_W + GAP; // pas entre deux cartes, garantit l'absence de chevauchement
const SPAN = CAROUSEL.length * SLOT;
const FADE = 820; // distance au centre où la carte s'efface (avant le raccord)

/** Une carte de la bande : elle calcule sa propre place à partir du défilement. */
function BeltCard({ video, index, offset }: { video: (typeof CAROUSEL)[number]; index: number; offset: MotionValue<number> }) {
  // Position signée par rapport au centre, repliée sur la longueur de la bande :
  // la carte qui sort à droite réapparaît à gauche, sans couture.
  const dx = useTransform(offset, (o) => {
    const raw = (((index * SLOT - o) % SPAN) + SPAN) % SPAN;
    return raw - SPAN / 2;
  });
  const rotateY = useTransform(dx, (v) => Math.max(-46, Math.min(46, -v * 0.045)));
  const z = useTransform(dx, (v) => -Math.abs(v) * 0.5);
  const opacity = useTransform(dx, (v) => {
    const a = Math.abs(v);
    return a > FADE ? 0 : a > FADE - 220 ? (FADE - a) / 220 : 1;
  });

  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{
        width: CARD_W,
        height: 152,
        marginLeft: -CARD_W / 2,
        marginTop: -76,
        x: dx,
        rotateY,
        z,
        opacity,
        transformStyle: "preserve-3d",
      }}
    >
      <div className="group relative h-full w-full overflow-hidden rounded-2xl border border-white/15 bg-[#07080e] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb(video.youtubeId)}
          alt=""
          loading="lazy"
          draggable={false}
          className="h-full w-full object-cover opacity-80 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105 group-hover:opacity-100"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-3 pt-12">
          <span className="block truncate text-[13px] font-medium text-white">{video.title}</span>
          <span className="mt-1 block truncate font-mono text-[10px] text-white/60">{video.country}</span>
        </span>
      </div>
    </motion.div>
  );
}

function CatalogueBelt() {
  const reduce = useReducedMotion();
  const offset = useMotionValue(0);
  const dragging = useRef(false);
  const lastX = useRef(0);

  // Dérive continue, suspendue tant qu'on tient la bande.
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      const dt = now - prev;
      prev = now;
      if (!dragging.current) offset.set(offset.get() + dt * 0.028);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [offset, reduce]);

  const onDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);
  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      offset.set(offset.get() - (e.clientX - lastX.current));
      lastX.current = e.clientX;
    },
    [offset]
  );
  const onUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className="relative h-[15rem] cursor-grab select-none touch-pan-y active:cursor-grabbing sm:h-[17rem]"
      style={{ perspective: "1200px" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    >
      <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        {CAROUSEL.map((v, i) => (
          <BeltCard key={v.id} video={v} index={i} offset={offset} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SOURCES — marques réelles + un morceau de leur interface (aucune photo)
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

const SOURCE_TABS = [
  {
    key: "catalogue",
    name: "Catalogue",
    line: "Une cinquantaine de paysages tenus à la main, classés par ambiance. Rien à chercher, tu cliques et ça tourne.",
  },
  { key: "youtube", name: "YouTube", line: "Tes playlists et ta file d'attente, jouées dans TON ordre. YouTube ne reprend jamais la main." },
  { key: "spotify", name: "Spotify", line: "Ta bibliothèque Premium se lit dans la session, sans changer d'onglet ni couper le timer." },
  { key: "twitch", name: "Twitch", line: "Un live ou une rediffusion en fond, pour travailler à côté de quelqu'un." },
] as const;

function SourceShowcase() {
  const [tab, setTab] = useState<(typeof SOURCE_TABS)[number]["key"]>("catalogue");

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col gap-2">
        {SOURCE_TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              onMouseEnter={() => setTab(t.key)}
              onFocus={() => setTab(t.key)}
              onClick={() => setTab(t.key)}
              className={cn(
                "group relative overflow-hidden rounded-2xl px-5 py-4 text-left transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                on ? "border border-white/12 bg-white/[0.05]" : "border border-transparent hover:bg-white/[0.03]"
              )}
              aria-pressed={on}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40">
                  {t.key === "youtube" ? <YoutubeMark /> : t.key === "spotify" ? <SpotifyMark /> : t.key === "twitch" ? <TwitchMark /> : (
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="#ffc38a" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 17.5V7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
                    </svg>
                  )}
                </span>
                <span className="text-[15px] font-medium text-white">{t.name}</span>
              </span>
              <span
                className={cn(
                  "mt-2 block text-[13px] leading-relaxed text-white/60 transition-all duration-500",
                  on ? "max-h-24 opacity-100" : "max-h-0 overflow-hidden opacity-0"
                )}
              >
                {t.line}
              </span>
            </button>
          );
        })}
      </div>

      <Bezel radius={2.25} className="self-start">
        <div className="relative aspect-[16/10] w-full">
          {tab === "catalogue" && <CataloguePane />}
          {tab === "youtube" && <QueuePane />}
          {tab === "spotify" && <SpotifyPane />}
          {tab === "twitch" && <TwitchPane />}
        </div>
      </Bezel>
    </div>
  );
}

const PANE_IN = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: EASE } };

const PANE_IDS = ["hk-01", "vn-01", "no-01", "tw-01", "th-01", "abao-03"];

function CataloguePane() {
  const items = PANE_IDS.map((id) => defaultVideos.find((v) => v.id === id)!).filter(Boolean);
  return (
    <motion.div {...PANE_IN} className="grid h-full grid-cols-3 gap-2 p-3">
      {items.map((v) => (
        <div key={v.id} className="group relative overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb(v.youtubeId)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-65 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105 group-hover:opacity-100"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6 text-[10px] text-white/80">
            {v.country}
          </span>
        </div>
      ))}
    </motion.div>
  );
}

const QUEUE_IDS = ["driv-05", "cn-03", "id-02", "np-01", "uk-01"];

function QueuePane() {
  const items = QUEUE_IDS.map((id) => defaultVideos.find((v) => v.id === id)!).filter(Boolean);
  return (
    <motion.div {...PANE_IN} className="flex h-full flex-col gap-1.5 p-4">
      <span className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
        <YoutubeMark /> File d&apos;attente
      </span>
      {items.map((v, i) => (
        <div
          key={v.id}
          className={cn(
            "flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
            i === 0 ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
          )}
        >
          <span className="w-4 shrink-0 text-center font-mono text-[10px] text-white/50">{i + 1}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb(v.youtubeId)} alt="" loading="lazy" className="h-8 w-12 shrink-0 rounded-md object-cover" />
          <span className="min-w-0 flex-1 truncate text-[12px] text-white/75">{v.title}</span>
          {i === 0 && (
            <span className="flex h-3 items-end gap-[2px]" aria-hidden>
              {[1.2, 1.45, 1.3].map((d, k) => (
                <span key={k} className="anim-eq w-[2px] rounded-full bg-[#ffc38a]" style={{ height: "100%", animationDuration: `${d}s`, animationDelay: `${-k * 0.4}s` }} />
              ))}
            </span>
          )}
        </div>
      ))}
    </motion.div>
  );
}

function SpotifyPane() {
  const rows = [
    { t: "Weightless", a: "Marconi Union", d: "8:08" },
    { t: "Nuvole Bianche", a: "Ludovico Einaudi", d: "5:57" },
    { t: "Intro", a: "The xx", d: "2:07" },
    { t: "An Ending (Ascent)", a: "Brian Eno", d: "4:24" },
  ];
  return (
    <motion.div {...PANE_IN} className="flex h-full flex-col p-5">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
        <SpotifyMark /> Connecté en Premium
      </span>
      <div className="mt-4 flex flex-1 flex-col justify-center gap-1">
        {rows.map((r, i) => (
          <div key={r.t} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", i === 1 && "bg-white/[0.06]")}>
            <span className="w-3 font-mono text-[10px] text-white/45">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-[13px]", i === 1 ? "text-[#1db954]" : "text-white/80")}>{r.t}</span>
              <span className="block truncate text-[11px] text-white/50">{r.a}</span>
            </span>
            <span className="font-mono text-[10px] tabular-nums text-white/50">{r.d}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
        <span className="block h-full w-[38%] rounded-full bg-[#1db954]" />
      </div>
    </motion.div>
  );
}

function TwitchPane() {
  const chat = [
    { u: "lenaCodes", m: "quelqu'un révise la bio ce soir ?" },
    { u: "marco_dev", m: "3e pomodoro, ça pique" },
    { u: "sora", m: "la pluie sur le stream est parfaite" },
    { u: "juliette", m: "on repart pour 25 min" },
  ];
  return (
    <motion.div {...PANE_IN} className="grid h-full grid-cols-[1fr_minmax(0,11rem)] gap-3 p-4">
      <div className="relative overflow-hidden rounded-xl bg-black/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb(defaultVideos.find((v) => v.id === "uk-01")?.youtubeId ?? defaultVideos[0].youtubeId)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover opacity-45"
        />
        <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-[#9146ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
          Live
        </span>
        <span className="absolute bottom-3 left-3 flex items-center gap-2">
          <TwitchMark />
          <span className="font-mono text-[11px] text-white/70">studywithme_fr</span>
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-hidden rounded-xl bg-white/[0.03] p-3">
        {chat.map((c) => (
          <p key={c.u} className="text-[11px] leading-snug text-white/65">
            <span className="text-[#9146ff]">{c.u}</span> {c.m}
          </p>
        ))}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   POMODORO JOUABLE — la démo la plus honnête possible : le vrai geste
   ══════════════════════════════════════════════════════════════════════════ */

function TryPomodoro({
  liveLeft,
  onLiveChange,
}: {
  liveLeft: MotionValue<number>;
  onLiveChange: (live: boolean, total: number) => void;
}) {
  const PRESETS = [
    { label: "Classique", work: 25 },
    { label: "Profond", work: 50 },
    { label: "Court", work: 15 },
  ];
  const [preset, setPreset] = useState(0);
  const [running, setRunning] = useState(false);
  const total = PRESETS[preset].work * 60;
  const [left, setLeft] = useState(total);

  useEffect(() => {
    setLeft(PRESETS[preset].work * 60);
    setRunning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((l) => (l <= 1 ? 0 : l - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Le minuteur alimente l'horloge de la nav SANS re-rendre la page : la valeur
  // transite par une MotionValue, pas par un state remonté.
  useEffect(() => {
    liveLeft.set(left);
  }, [left, liveLeft]);

  useEffect(() => {
    onLiveChange(running, total);
  }, [running, total, onLiveChange]);

  const progress = 1 - left / total;
  const dash = 2 * Math.PI * 52;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
      <div className="max-w-lg">
        <Eyebrow>Essaye tout de suite</Eyebrow>
        <h2 className="mt-7 text-[clamp(2rem,4vw,3.1rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
          Le minuteur, pour de vrai.
        </h2>
        <p className="mt-6 text-[16px] leading-relaxed text-white/65">
          Celui-ci fonctionne, ici, sans compte. C&apos;est exactement le moteur de la session : trois rythmes, un
          bouton, et le temps qui descend.
        </p>
        <p className="mt-4 text-[13px] leading-relaxed text-white/50">
          {running
            ? "Regarde la barre en haut : ta session a pris le relais du compteur de la page."
            : "Lance-le, et le compteur en haut de page passera sur ton temps à toi."}
        </p>
        <div className="mt-9 flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              className={cn(
                "rounded-full px-5 py-2.5 text-[13px] font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                i === preset
                  ? "border border-white/25 bg-white/[0.08] text-white"
                  : "border border-white/10 text-white/60 hover:border-white/25 hover:text-white/80"
              )}
            >
              {p.label}
              <span className="ml-2 font-mono text-[11px] text-white/50">{p.work}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="justify-self-center">
        <Bezel radius={3} className="w-[19rem]">
          <div className="flex flex-col items-center gap-7 px-8 py-10">
            <div className="relative h-[13.5rem] w-[13.5rem]">
              <motion.span
                aria-hidden
                className="absolute inset-4 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,180,110,0.18), transparent 70%)" }}
                animate={running ? { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] } : { opacity: 0.4 }}
                transition={{ duration: 4, repeat: running ? Infinity : 0, ease: "easeInOut" }}
              />
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
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
                  {mm}:{ss}
                </span>
                <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">
                  {left === 0 ? "Terminé" : running ? "En cours" : "En attente"}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => (left === 0 ? (setLeft(total), setRunning(true)) : setRunning((r) => !r))}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#08090f] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 active:scale-95"
                aria-label={running ? "Mettre en pause" : "Démarrer"}
              >
                {running ? (
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
                  setLeft(total);
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 text-white/65 transition-colors hover:border-white/30 hover:text-white"
                aria-label="Réinitialiser"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4.5V10h5.5" />
                </svg>
              </button>
            </div>
          </div>
        </Bezel>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TRACE — ce que l'app garde de tes soirées
   ══════════════════════════════════════════════════════════════════════════ */

// Trame déterministe (pas de Math.random au rendu : le SSR et le client
// doivent produire exactement la même grille).
const HEAT = Array.from({ length: 91 }, (_, i) => (i * 37) % 11);

const HEAT_STEPS = [
  "bg-white/[0.09]",
  "bg-[#ffc38a]/30",
  "bg-[#ffc38a]/55",
  "bg-[#ffc38a]/80",
  "bg-[#ffc38a]",
];
const heatStep = (v: number) => (v > 8 ? 4 : v > 6 ? 3 : v > 4 ? 2 : v > 2 ? 1 : 0);

const HEAT_DAYS = ["L", "", "M", "", "V", "", "D"];

function TracePanel() {
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-[2rem] border border-white/10 bg-[#080a12]/70 p-8 md:col-span-2">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/65">Treize semaines</span>
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
          {/* Jours de la semaine, pour que la grille se lise comme un calendrier */}
          <div className="grid grid-rows-7 gap-[6px] pr-1">
            {HEAT_DAYS.map((d, i) => (
              <span key={i} className="flex h-[14px] items-center font-mono text-[9px] leading-none text-white/40">
                {d}
              </span>
            ))}
          </div>
          <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[6px]">
            {HEAT.map((v, i) => (
              <motion.span
                key={i}
                initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: (i % 30) * 0.012, ease: EASE }}
                className={cn("h-[14px] rounded-[3px]", HEAT_STEPS[heatStep(v)])}
              />
            ))}
          </div>
        </div>

        <p className="mt-7 max-w-md text-[14px] leading-relaxed text-white/72">
          Chaque case est une soirée. La série, le score de concentration et le récap du dimanche se construisent tout
          seuls pendant que tu travailles.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {[
          { k: "Série en cours", v: "17 j" },
          { k: "Cette semaine", v: "9h 20m" },
          { k: "Score de concentration", v: "84" },
        ].map((s) => (
          <div key={s.k} className="flex-1 rounded-[1.75rem] border border-white/10 bg-[#080a12]/70 p-7">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/65">{s.k}</span>
            <p className="mt-4 font-mono text-[34px] leading-none tabular-nums text-white">{s.v}</p>
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
  const reduce = useReducedMotion();

  const heroRef = useRef<HTMLElement>(null);

  // Position du pointeur DANS LE VIEWPORT (0-1) : le halo est une couche fixe,
  // il ne s'éteint donc plus brutalement quand on quitte le hero.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spotX = useSpring(useTransform(px, (v) => (v + 0.5) * 100), { stiffness: 80, damping: 20 });
  const spotY = useSpring(useTransform(py, (v) => (v + 0.5) * 100), { stiffness: 80, damping: 20 });
  const spotlight = useMotionTemplate`radial-gradient(40rem circle at ${spotX}% ${spotY}%, rgba(255,183,110,0.13), transparent 62%)`;

  // Voile de lecture : transparent sur le hero (on veut voir la ville), il
  // monte ensuite pour que TOUT le texte de la page repose sur un fond stable.
  const { scrollYProgress } = useScroll();
  const veil = useTransform(scrollYProgress, [0, 0.12], [0, 0.86]);

  // L'horloge de la page. `liveLeft` est une MotionValue : le minuteur de la
  // section démo l'alimente à la seconde sans provoquer un seul re-render ici.
  const liveLeft = useMotionValue(POMODORO_SECONDS);
  const [live, setLive] = useState(false);
  const [liveTotal, setLiveTotal] = useState(POMODORO_SECONDS);
  const onLiveChange = useCallback((on: boolean, total: number) => {
    setLive(on);
    setLiveTotal(total);
  }, []);

  // Fin de la « session de la page » : atteinte du bas, ou minuteur à zéro.
  const [done, setDone] = useState(false);
  useEffect(() => {
    const unScroll = scrollYProgress.on("change", (v) => {
      if (!live) setDone(v > 0.985);
    });
    const unLive = liveLeft.on("change", (v) => {
      if (live) setDone(v <= 0);
    });
    return () => {
      unScroll();
      unLive();
    };
  }, [scrollYProgress, liveLeft, live]);

  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(heroP, [0, 1], [0, 120]);
  const heroFade = useTransform(heroP, [0, 0.75], [1, 0]);

  return (
    <MotionConfig reducedMotion="user">
      <main
        className="relative w-full max-w-full overflow-x-hidden bg-[#05060c] text-white"
        onPointerMove={(e) => {
          if (reduce) return;
          px.set(e.clientX / window.innerWidth - 0.5);
          py.set(e.clientY / window.innerHeight - 0.5);
        }}
      >
        {/* La ville, et la nuit qui tombe au fil du scroll */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <CityBackdrop />
        </div>
        {/* Voile de lisibilité, au-dessus de la ville et sous le contenu */}
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[1] bg-[#05060c]"
          style={reduce ? { opacity: 0.86 } : { opacity: veil }}
        />
        {/* Halo du curseur, sur toute la page */}
        {!reduce && (
          <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[2]" style={{ background: spotlight }} />
        )}

        <div className="relative z-10">
          {/* Nav : île de verre détachée du bord */}
          <header className="fixed inset-x-0 top-6 z-40 flex justify-center px-4">
            <nav className="flex w-max items-center gap-8 rounded-full border border-white/12 bg-[#080a12]/70 py-2 pl-5 pr-2 backdrop-blur-2xl">
              <Wordmark />
              <div className="hidden items-center gap-6 text-[13px] text-white/60 md:flex">
                <a href="#catalogue" className="transition-colors duration-500 hover:text-white">Catalogue</a>
                <a href="#sources" className="transition-colors duration-500 hover:text-white">Sources</a>
                <a href="#minuteur" className="transition-colors duration-500 hover:text-white">Minuteur</a>
              </div>
              <span className="hidden h-8 w-px bg-white/10 sm:block" aria-hidden />
              <div className="hidden sm:block">
                <SessionClock
                  scrollProgress={scrollYProgress}
                  liveLeft={liveLeft}
                  liveTotal={liveTotal}
                  live={live}
                  done={done}
                />
              </div>
              <Cta label="Se connecter" onClick={() => signInWithGoogle()} className="py-1.5 pl-5 pr-1.5 text-[13px]" />
            </nav>
          </header>

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <section ref={heroRef} className="relative flex min-h-[100dvh] items-center px-4 pb-24 pt-36 sm:px-8">
            <motion.div
              style={reduce ? undefined : { y: heroY, opacity: heroFade }}
              className="relative mx-auto grid w-full max-w-[86rem] items-center gap-20 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="max-w-4xl">
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: EASE }}
                >
                  <Eyebrow>Gratuit, sans publicité</Eyebrow>
                </motion.div>

                <motion.h1
                  initial={reduce ? false : { opacity: 0, y: 40, filter: "blur(12px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 1.1, delay: 0.08, ease: EASE }}
                  className="mt-8 text-[clamp(2.9rem,6.8vw,5.9rem)] font-semibold leading-[0.98] tracking-[-0.04em] [text-shadow:0_4px_44px_rgba(0,0,0,0.8)]"
                >
                  La ville s&apos;allume,
                  <br />
                  toi tu te poses.
                </motion.h1>

                <motion.p
                  initial={reduce ? false : { opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
                  className="mt-9 max-w-lg text-[17px] leading-relaxed text-white/72 [text-shadow:0_1px_20px_rgba(0,0,0,0.9)]"
                >
                  Un minuteur Pomodoro et ta musique dans le même écran, sur un paysage qui tourne en boucle. Le reste
                  du bruit attend dehors.
                </motion.p>

                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
                  className="mt-12 flex flex-wrap items-center gap-4"
                >
                  <Cta label="Commencer" onClick={() => signInWithGoogle()} />
                  <Cta label="Voir le catalogue" tone="glass" onClick={() => document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" })} />
                </motion.div>
              </div>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 60, filter: "blur(14px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.3, delay: 0.34, ease: EASE }}
                className="hidden justify-self-end lg:block"
              >
                <HeroScene px={px} py={py} />
              </motion.div>
            </motion.div>
          </section>

          {/* ── Catalogue en carrousel 3D ────────────────────────────────── */}
          <section id="catalogue" className="mx-auto w-full max-w-[86rem] px-4 py-28 sm:px-8 md:py-40">
            <Rise className="mb-16 max-w-3xl">
              <Eyebrow>Le catalogue</Eyebrow>
              <h2 className="mt-7 text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
                Cinquante-six endroits où poser ta soirée.
              </h2>
              <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-white/65">
                Study with me à Osaka, la pluie sur Shinjuku, le Bund à minuit, un train le long de la rivière au Gifu.
                Attrape le carrousel et fais-le tourner.
              </p>
            </Rise>
            <Rise delay={0.1}>
              <CatalogueBelt />
            </Rise>
          </section>

          {/* ── Sources ──────────────────────────────────────────────────── */}
          <section id="sources" className="mx-auto w-full max-w-[86rem] px-4 pb-28 sm:px-8 md:pb-40">
            <Rise className="mb-16 max-w-3xl">
              <h2 className="text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
                Quatre façons de remplir le silence.
              </h2>
            </Rise>
            <Rise delay={0.08}>
              <SourceShowcase />
            </Rise>
          </section>

          {/* ── Minuteur jouable ─────────────────────────────────────────── */}
          <section id="minuteur" className="mx-auto w-full max-w-[86rem] px-4 pb-28 sm:px-8 md:pb-40">
            <Rise>
              <TryPomodoro liveLeft={liveLeft} onLiveChange={onLiveChange} />
            </Rise>
          </section>

          {/* ── Trace ────────────────────────────────────────────────────── */}
          <section className="mx-auto w-full max-w-[86rem] px-4 pb-28 sm:px-8 md:pb-40">
            <Rise className="mb-16 max-w-3xl">
              <h2 className="text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
                Le lendemain, tu sais ce que tu as fait.
              </h2>
            </Rise>
            <Rise delay={0.08}>
              <TracePanel />
            </Rise>
          </section>

          {/* ── Action ───────────────────────────────────────────────────── */}
          <section className="mx-auto w-full max-w-[86rem] px-4 pb-32 text-center sm:px-8 md:pb-48">
            <Rise>
              <h2 className="mx-auto max-w-5xl text-[clamp(2.6rem,6.6vw,5.2rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                Il fait nuit. Tu as une heure devant toi.
              </h2>
              <p className="mx-auto mt-9 max-w-md text-[15px] leading-relaxed text-white/65">
                Utilisable sans compte. Google sert seulement à retrouver ta progression d&apos;un appareil à
                l&apos;autre.
              </p>
              <div className="relative mt-12 flex justify-center">
                {/* La sonnerie : deux ondes qui partent du bouton quand les
                    25 minutes de la page sont écoulées. Elle ne tourne pas en
                    boucle décorative, elle marque un instant précis. */}
                {done && !reduce && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                    {[0, 0.9].map((d) => (
                      <motion.span
                        key={d}
                        className="absolute h-16 w-56 rounded-full border border-[#ffc38a]/40"
                        initial={{ scale: 0.85, opacity: 0.65 }}
                        animate={{ scale: 1.9, opacity: 0 }}
                        transition={{ duration: 2.6, repeat: Infinity, delay: d, ease: "easeOut" }}
                      />
                    ))}
                  </span>
                )}
                <Cta label="Ouvrir une session" onClick={() => signInWithGoogle()} />
              </div>
            </Rise>
          </section>

          <footer className="border-t border-white/[0.07]">
            <div className="mx-auto flex w-full max-w-[86rem] flex-col items-center justify-between gap-5 px-4 py-10 sm:flex-row sm:px-8">
              <Wordmark />
              <p className="font-mono text-[11px] tracking-wider text-white/45">
                Pomodoro · Lofi · Focus. © {new Date().getFullYear()}
              </p>
            </div>
          </footer>
        </div>
      </main>
    </MotionConfig>
  );
}
