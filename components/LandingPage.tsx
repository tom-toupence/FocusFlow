"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion, MotionConfig, type Variants } from "motion/react";
import { signInWithGoogle } from "@/lib/supabase";
import HeroFlowShader from "@/components/HeroFlowShader";
import { cn } from "@/lib/utils";

// Landing (AuthGate, non connecté) : hero à fond génératif WebGL + choreography
// au scroll (motion / Framer Motion) — parallax, révélations en cascade, section
// « scrollytelling » collante, et un mockup de session VIVANT (timer qui tourne,
// equalizer, titre qui défile). Thème sombre, zéro emoji, SVG inline, aucune
// image/dépendance externe. Reduced-motion : MotionConfig "user" + repli statique
// du shader → tout se dégrade proprement (fondus sans mouvement).

const EASE = [0.22, 1, 0.36, 1] as const;

const reveal: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

function GoogleButton({ label = "Continuer avec Google", full = false }: { label?: string; full?: boolean }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => { setLoading(true); await signInWithGoogle(); }}
      disabled={loading}
      className={cn(
        "group inline-flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-[#0a0a0c] font-semibold text-sm hover:bg-white/90 transition-all shadow-lg shadow-black/40 disabled:opacity-60 motion-safe:active:scale-[0.98]",
        full && "w-full"
      )}
    >
      {loading ? (
        <div className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/70 animate-spin" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      )}
      {loading ? "Redirection…" : label}
    </button>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
        <svg className="w-[18px] h-[18px] text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-[15px] font-semibold text-white tracking-tight">FocusFlow</span>
    </div>
  );
}

const TRACKS = [
  "Lofi hip hop — beats to study",
  "Rainy Tokyo — night ambience",
  "Study with me — Kyoto 4K",
  "Deep focus — piano & strings",
];

// Mockup de session « vivant » : timer qui décompte (boucle ~3 min pour une
// progression visible), equalizer pseudo-réactif, titre qui défile. Pur
// transform/opacity. `phase` (Focus/Pause) piloté par la section scrollytelling.
function LivingMockup({ phase = "Focus" }: { phase?: "Focus" | "Pause" }) {
  const TOTAL = 180;
  const [remaining, setRemaining] = useState(TOTAL);
  const [track, setTrack] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setRemaining((r) => (r <= 1 ? TOTAL : r - 1)), 1000);
    const k = setInterval(() => setTrack((i) => (i + 1) % TRACKS.length), 4500);
    return () => { clearInterval(t); clearInterval(k); };
  }, [reduce]);

  const progress = 1 - remaining / TOTAL;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const dash = 276;
  const isBreak = phase === "Pause";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-3 shadow-2xl shadow-black/50">
      <div className="rounded-xl overflow-hidden bg-[#0c0c10] border border-white/[0.06]">
        <div className="flex items-center gap-1.5 px-3.5 h-9 border-b border-white/[0.06]">
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="ml-3 text-[11px] text-white/30">focusflow · session</span>
        </div>
        <div className="relative aspect-video flex items-center justify-center overflow-hidden">
          {/* fond ambiant qui dérive lentement */}
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.20), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(236,72,153,0.15), transparent 55%)" }}
            animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative flex flex-col items-center gap-4">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36">
              {/* halo pulsé derrière l'anneau */}
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ background: `radial-gradient(circle, ${isBreak ? "rgba(52,211,153,0.25)" : "rgba(139,92,246,0.28)"}, transparent 70%)` }}
                animate={reduce ? undefined : { scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <svg className="relative w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                <circle
                  cx="50" cy="50" r="44" fill="none" stroke="url(#hgr)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={dash} strokeDashoffset={dash * (1 - progress)}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
                <defs>
                  <linearGradient id="hgr" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={isBreak ? "#6ee7b7" : "#a5b4fc"} />
                    <stop offset="1" stopColor={isBreak ? "#34d399" : "#f0abfc"} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl sm:text-4xl font-semibold tabular-nums text-white">{mm}:{ss}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{phase}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur min-w-0 max-w-[80%]">
              <MiniEq playing={!reduce && !isBreak} />
              <motion.span
                key={track}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-[11px] text-white/60 truncate"
              >
                {isBreak ? "Respiration guidée — 4·4·4·4" : TRACKS[track]}
              </motion.span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniEq({ playing }: { playing: boolean }) {
  const bars = [1.2, 1.5, 1.35];
  return (
    <span className="flex items-end gap-[2px] h-3 flex-shrink-0" aria-hidden>
      {bars.map((d, i) => (
        <span
          key={i}
          className="anim-eq w-[3px] h-full rounded-full bg-emerald-400"
          style={{ animationDuration: `${d}s`, animationDelay: `${-i * 0.45}s`, animationPlayState: playing ? "running" : "paused" }}
        />
      ))}
    </span>
  );
}

interface Feature { icon: React.ReactNode; title: string; desc: string; accent: string; }

const FEATURES: Feature[] = [
  { accent: "text-indigo-300", title: "Timer Pomodoro & Flowtime", desc: "Presets classic / deep / custom, ou le mode Flowtime (chrono libre, pause méritée). Timer flottant Picture-in-Picture toujours visible.", icon: <path d="M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" strokeLinecap="round" strokeLinejoin="round" /> },
  { accent: "text-rose-300", title: "Lecteur multi-sources", desc: "Catalogue lofi/ambient curated par mood, playlists & vidéos YouTube, Spotify Premium et streams Twitch — dans la même vue plein écran que le timer.", icon: <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" strokeLinecap="round" strokeLinejoin="round" /> },
  { accent: "text-emerald-300", title: "Tâches, projets & planning", desc: "Kanban de tâches, projets à deadline, planning hebdo (time-blocking) synchronisable à ton calendrier iPhone/Google, mode Sprint généré pour une échéance.", icon: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" /> },
  { accent: "text-sky-300", title: "Stats & Focus Score", desc: "Heatmap, séries, objectif quotidien, marquage des distractions et Focus Score, dashboard d'insights détaillé, export CSV/JSON, récap hebdo « Wrapped » partageable.", icon: <path d="M3 3v18h18M7 15l3-4 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" /> },
  { accent: "text-amber-300", title: "Amis & temps réel", desc: "Ajoute des amis par code, un classement hebdo, la présence « en ligne / en focus » en direct, ce que chacun écoute, et un chat intégré façon launcher.", icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" /> },
  { accent: "text-violet-300", title: "Bien-être & gamification", desc: "Respiration guidée pendant les pauses, journal d'humeur, coach de planification (local ou IA), XP & niveaux, jardin de focus, badges et défis hebdomadaires.", icon: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" /> },
];

const STEPS = [
  { n: "1", title: "Choisis ton ambiance", desc: "Un paysage lofi du catalogue, ta playlist YouTube, Spotify ou un stream Twitch — l'app devient ta bulle sonore.", phase: "Focus" as const },
  { n: "2", title: "Lance ta session", desc: "Règle ton rythme Pomodoro, ajoute tes tâches, et travaille en plein écran, musique et timer réunis.", phase: "Focus" as const },
  { n: "3", title: "Respire, puis recommence", desc: "Pauses guidées, objectif quotidien, badges et récap hebdo — et compare ta semaine avec tes amis.", phase: "Pause" as const },
];

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <motion.div
      variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}
      className="max-w-2xl mb-12"
    >
      <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight">{title}</h2>
      {sub && <p className="text-white/45 mt-4 text-sm sm:text-base leading-relaxed">{sub}</p>}
    </motion.div>
  );
}

export default function LandingPage() {
  const reduce = useReducedMotion();

  // Parallax du hero (progression de scroll de la section hero).
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const contentY = useTransform(heroP, [0, 1], [0, 90]);
  const contentOpacity = useTransform(heroP, [0, 0.85], [1, 0]);
  const mockY = useTransform(heroP, [0, 1], [0, 40]);
  const cueOpacity = useTransform(heroP, [0, 0.15], [1, 0]);

  // Section scrollytelling : phase active du mockup selon la progression.
  const scrollyRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: storyP } = useScroll({ target: scrollyRef, offset: ["start center", "end center"] });
  const [phase, setPhase] = useState<"Focus" | "Pause">("Focus");
  useEffect(() => {
    return storyP.on("change", (v) => setPhase(v > 0.66 ? "Pause" : "Focus"));
  }, [storyP]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#0a0a0c] text-white overflow-x-hidden">
        {/* Halos statiques (repli du shader + profondeur) */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.12)_0%,_transparent_60%)]" />
          <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,_rgba(236,72,153,0.09)_0%,_transparent_60%)]" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0c]/60 border-b border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
            <Logo />
            <nav className="hidden md:flex items-center gap-7 text-sm text-white/50">
              <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
              <a href="#how" className="hover:text-white transition-colors">Comment ça marche</a>
            </nav>
            <GoogleButton label="Se connecter" />
          </div>
        </header>

        {/* Hero — plein écran, fond génératif WebGL */}
        <section ref={heroRef} className="relative overflow-hidden">
          <div className="absolute inset-0 -z-[1]">
            <HeroFlowShader />
            {/* fondu vers le fond de page en bas du hero */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0a0c]" />
            <div className="absolute inset-0 bg-[#0a0a0c]/20" />
          </div>

          <motion.div
            style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
            className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-24 sm:pt-32 pb-24"
          >
            <div className="max-w-2xl">
              <motion.div variants={reveal} initial="hidden" animate="show" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[12px] text-white/60 mb-8 backdrop-blur">
                Gratuit, sans publicité — fonctionne même sans compte
              </motion.div>
              <motion.h1 variants={reveal} initial="hidden" animate="show" transition={{ delay: 0.05 }} className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
                Ta bulle de concentration, musique et timer réunis.
              </motion.h1>
              <motion.p variants={reveal} initial="hidden" animate="show" transition={{ delay: 0.12 }} className="mt-6 text-base sm:text-lg text-white/55 leading-relaxed">
                FocusFlow réunit un timer Pomodoro et un lecteur multi-sources — lofi YouTube, Spotify,
                Twitch — dans une seule vue plein écran. Avec des statistiques, un coach de planification,
                des amis et un catalogue d&apos;ambiances pour tenir la distance.
              </motion.p>
              <motion.div variants={reveal} initial="hidden" animate="show" transition={{ delay: 0.19 }} className="mt-9 flex flex-col sm:flex-row items-start gap-3">
                <GoogleButton label="Commencer" />
                <a href="#features" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.08] transition-all backdrop-blur">
                  Voir les fonctionnalités
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              </motion.div>
              <p className="mt-5 text-xs text-white/30">Ton compte Google sert uniquement à t&apos;identifier et synchroniser ta progression.</p>
            </div>

            {/* Mockup vivant */}
            <motion.div
              style={reduce ? undefined : { y: mockY }}
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: reduce ? 0 : undefined }}
              transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
              className="mt-16 relative max-w-4xl"
            >
              <LivingMockup />
            </motion.div>
          </motion.div>

          {/* Indice de scroll */}
          <motion.div style={reduce ? undefined : { opacity: cueOpacity }} className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-white/30">
            <motion.svg animate={reduce ? undefined : { y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></motion.svg>
          </motion.div>
        </section>

        {/* Fonctionnalités */}
        <section id="features" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <SectionTitle
            title="Tout ce qu'il faut pour se concentrer, au même endroit"
            sub="Le timer, la musique, l'organisation, les statistiques et le social — réunis, sans friction, et gratuitement."
          />
          <motion.div
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title} variants={reveal}
                whileHover={reduce ? undefined : { y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/[0.12]"
              >
                <div className={cn("w-11 h-11 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4", f.accent)}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>{f.icon}</svg>
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Comment ça marche — scrollytelling collant */}
        <section id="how" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <SectionTitle title="En trois étapes" />
          <div ref={scrollyRef} className="grid md:grid-cols-2 gap-10 md:gap-16">
            {/* Mockup collant (desktop) */}
            <div className="md:sticky md:top-24 md:self-start">
              <LivingMockup phase={phase} />
            </div>
            {/* Étapes */}
            <div className="flex flex-col gap-6 md:gap-24 md:py-10">
              {STEPS.map((s, i) => (
                <motion.div
                  key={s.n}
                  variants={reveal} initial="hidden" whileInView="show" viewport={{ once: false, margin: "-45% 0px -45% 0px" }}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-400/20 border border-white/10 flex items-center justify-center text-sm font-semibold">{s.n}</span>
                    <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed">{s.desc}</p>
                  {i === STEPS.length - 1 && <p className="mt-3 text-[11px] text-emerald-300/70">La pause change l&apos;ambiance du timer — regarde le mockup.</p>}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-24">
          <motion.div
            variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}
            className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-br from-indigo-500/[0.12] via-violet-500/[0.06] to-transparent p-10 sm:p-16 text-center"
          >
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.18),_transparent_60%)]" />
            <h2 className="relative text-3xl sm:text-5xl font-semibold tracking-tight">Entre dans le flow.</h2>
            <p className="relative max-w-md mx-auto mt-4 text-white/50 text-sm sm:text-base">
              Crée ton espace de concentration en un clic. Gratuit, pour toujours.
            </p>
            <div className="relative mt-8 flex justify-center">
              <GoogleButton label="Commencer gratuitement" />
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo />
            <p className="text-xs text-white/30">Pomodoro · Lofi · Focus — fait pour rester concentré. © {new Date().getFullYear()} FocusFlow</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
