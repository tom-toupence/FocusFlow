"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithGoogle } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Landing (AuthGate, non connecté) — direction « minimalisme utilitaire » :
// canvas chaud clair, titrage en serif éditorial, tout le reste en 1px de
// bordure. Aucune ombre lourde, aucun dégradé, aucun emoji. Le mouvement se
// limite à des révélations au scroll (IntersectionObserver) et à une seule
// nappe lumineuse fixe qui dérive très lentement.
//
// ⚠️ La page est volontairement en palette claire FIXE (indépendante du thème
// de l'app) : les couleurs sont écrites en dur, jamais via les tokens
// foreground/background, qui sont sombres ici (<html class="dark">).

const INK = "#1B1B19";
const MUTED = "#787774";
const LINE = "#E6E4DF";
const CANVAS = "#F7F6F3";

/* ── Révélation au scroll ──────────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className,
  style,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "section" | "li" | "header";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const Comp = Tag as React.ElementType;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "-60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Comp
      ref={ref}
      data-shown={shown}
      className={cn("reveal", className)}
      style={{ ...style, "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Comp>
  );
}

/* ── Primitives ────────────────────────────────────────────────────────── */

function GoogleButton({ label = "Continuer avec Google", size = "md" }: { label?: string; size?: "sm" | "md" }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        await signInWithGoogle();
      }}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2.5 rounded-md bg-[#1B1B19] text-white font-medium transition-colors hover:bg-[#333331] disabled:opacity-60 motion-safe:active:scale-[0.98]",
        size === "sm" ? "px-4 py-2 text-[13px]" : "px-5 py-3 text-sm"
      )}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/25 border-t-white/80 animate-spin" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      )}
      {loading ? "Redirection" : label}
    </button>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-md border flex items-center justify-center bg-white" style={{ borderColor: LINE }}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2.2" />
        </svg>
      </span>
      <span className="text-[15px] font-medium tracking-tight" style={{ color: INK }}>
        FocusFlow
      </span>
    </span>
  );
}

function Tag({ tone = "blue", children }: { tone?: "blue" | "green" | "yellow"; children: React.ReactNode }) {
  const tones = {
    blue: { bg: "#E1F3FE", fg: "#1F6C9F" },
    green: { bg: "#EDF3EC", fg: "#346538" },
    yellow: { bg: "#FBF3DB", fg: "#956400" },
  }[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.09em]"
      style={{ background: tones.bg, color: tones.fg }}
    >
      {children}
    </span>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded font-mono text-[11px] bg-white"
      style={{ border: `1px solid ${LINE}`, color: MUTED }}
    >
      {children}
    </kbd>
  );
}

/* ── Aperçu de session (chrome de fenêtre) ─────────────────────────────── */

const TRACKS = [
  "Lofi hip hop — beats to study",
  "Rainy Tokyo — night ambience",
  "Study with me — Kyoto 4K",
  "Deep focus — piano & strings",
];

function SessionPreview({ phase = "Focus" }: { phase?: "Focus" | "Pause" }) {
  const TOTAL = 180;
  const [remaining, setRemaining] = useState(TOTAL);
  const [track, setTrack] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setRemaining((r) => (r <= 1 ? TOTAL : r - 1)), 1000);
    const k = setInterval(() => setTrack((i) => (i + 1) % TRACKS.length), 5000);
    return () => {
      clearInterval(t);
      clearInterval(k);
    };
  }, []);

  const progress = 1 - remaining / TOTAL;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const dash = 276;
  const isBreak = phase === "Pause";

  return (
    <div className="rounded-xl overflow-hidden bg-white" style={{ border: `1px solid ${LINE}` }}>
      {/* Chrome de fenêtre */}
      <div className="flex items-center gap-1.5 px-3.5 h-9" style={{ borderBottom: `1px solid ${LINE}` }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#E0DEDA" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#E0DEDA" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#E0DEDA" }} />
        <span className="ml-3 font-mono text-[10px]" style={{ color: MUTED }}>
          focusflow / session
        </span>
      </div>

      <div className="relative flex items-center justify-center aspect-[4/3] sm:aspect-video" style={{ background: CANVAS }}>
        {/* image d'ambiance très effacée : la session tourne toujours sur un paysage */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.14] bg-cover bg-center grayscale"
          style={{ backgroundImage: "url(https://picsum.photos/seed/focusflow-kyoto/1200/800)" }}
        />
        <div className="relative flex flex-col items-center gap-5 px-6">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#E6E4DF" strokeWidth="3" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={isBreak ? "#346538" : INK}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={dash}
                strokeDashoffset={dash * (1 - progress)}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl sm:text-[28px] tabular-nums" style={{ color: INK }}>
                {mm}:{ss}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] mt-1" style={{ color: MUTED }}>
                {phase}
              </span>
            </span>
          </div>

          <span
            className="flex items-center gap-2.5 rounded-md bg-white px-3 py-1.5 max-w-[85%]"
            style={{ border: `1px solid ${LINE}` }}
          >
            <span className="flex items-end gap-[2px] h-3 shrink-0" aria-hidden>
              {[1.2, 1.5, 1.35].map((d, i) => (
                <span
                  key={i}
                  className="anim-eq w-[2px] h-full rounded-full"
                  style={{
                    background: INK,
                    animationDuration: `${d}s`,
                    animationDelay: `${-i * 0.45}s`,
                    animationPlayState: isBreak ? "paused" : "running",
                  }}
                />
              ))}
            </span>
            <span key={track} className="anim-track-in text-[11px] truncate" style={{ color: MUTED }}>
              {isBreak ? "Respiration guidée — 4·4·4·4" : TRACKS[track]}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Contenu ───────────────────────────────────────────────────────────── */

interface Feature {
  title: string;
  desc: string;
  icon: React.ReactNode;
  span?: boolean;
}

const FEATURES: Feature[] = [
  {
    title: "Timer et musique dans la même fenêtre",
    desc: "Pomodoro classic, deep, custom — ou Flowtime, un chrono libre dont la pause se calcule sur le temps réellement travaillé. Le lecteur reste plein écran derrière : catalogue lofi, playlists YouTube, Spotify Premium, streams Twitch.",
    span: true,
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2.2" />
      </>
    ),
  },
  {
    title: "File d'attente et playlists",
    desc: "Tes titres exacts, dans ton ordre, sans que YouTube reprenne la main.",
    icon: <path d="M4 6h11M4 11h11M4 16h7M19 8v9.2M19 17.2a2 2 0 1 1-2 2" />,
  },
  {
    title: "Tâches, projets, planning",
    desc: "Kanban, budgets de pomodoros, blocs hebdo synchronisables au calendrier.",
    icon: (
      <>
        <path d="M9.5 12.5l2 2 4.5-5" />
        <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      </>
    ),
  },
  {
    title: "Statistiques et Focus Score",
    desc: "Heatmap, séries, distractions marquées, récap hebdomadaire, export CSV.",
    icon: <path d="M4 20V4M4 20h16M8 16l3.5-4.5 3 2.5L20 8" />,
  },
  {
    title: "Amis en direct",
    desc: "Ajout par code, classement de la semaine, présence « en focus » et chat.",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19.5v-1.2a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1.2M16 5.4a3.2 3.2 0 0 1 0 6.2M17.5 14.4a4 4 0 0 1 3 3.9v1.2" />
      </>
    ),
  },
];

const STEPS = [
  {
    n: "01",
    title: "Choisis ton ambiance",
    desc: "Un paysage du catalogue, ta playlist YouTube, Spotify ou un stream Twitch.",
    phase: "Focus" as const,
  },
  {
    n: "02",
    title: "Lance la session",
    desc: "Ton rythme Pomodoro, tes tâches du jour, et l'écran ne montre plus que ça.",
    phase: "Focus" as const,
  },
  {
    n: "03",
    title: "Respire, puis recommence",
    desc: "Pause guidée, objectif quotidien, journal d'humeur et récap de la semaine.",
    phase: "Pause" as const,
  },
];

const FAQ = [
  {
    q: "Faut-il un compte pour s'en servir ?",
    a: "Non. Tout fonctionne en local dans le navigateur : timer, catalogue, tâches, statistiques. Le compte Google sert uniquement à synchroniser ta progression entre plusieurs appareils et à retrouver tes amis.",
  },
  {
    q: "C'est gratuit jusqu'où ?",
    a: "Entièrement. Pas d'abonnement, pas de publicité, pas de fonctionnalité réservée. Le coach de planification tourne en local par défaut, et l'application n'a besoin d'aucune clé API pour lire de la musique.",
  },
  {
    q: "Que faut-il pour Spotify et Twitch ?",
    a: "Spotify demande un compte Premium (contrainte du Web Playback SDK). Twitch fonctionne avec un compte gratuit, en direct comme en rediffusion. YouTube ne demande rien.",
  },
  {
    q: "Qu'est-ce que mes amis voient de moi ?",
    a: "Des agrégats seulement : minutes de la semaine, pomodoros, série, et si tu es en focus. Jamais tes tâches, ton journal, tes projets ni le contenu de tes sessions.",
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: `1px solid ${LINE}` }}>
      <button onClick={onToggle} className="w-full flex items-start gap-6 py-6 text-left group" aria-expanded={open}>
        <span className="flex-1 text-[17px] tracking-tight transition-colors" style={{ color: open ? INK : "#3B3B38" }}>
          {q}
        </span>
        <span className="shrink-0 mt-1" aria-hidden>
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke={MUTED} strokeWidth={1.6} strokeLinecap="round">
            <path d="M2.5 8h11" />
            {!open && <path d="M8 2.5v11" />}
          </svg>
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="pb-6 pr-10 text-[15px] leading-[1.65] max-w-2xl" style={{ color: MUTED }}>
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="relative min-h-screen font-sans overflow-x-hidden" style={{ background: CANVAS, color: INK }}>
      {/* Nappe lumineuse fixe, très lente, très faible — juste de quoi éviter
          un aplat parfaitement mort derrière le hero. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="anim-drift absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(150,120,80,0.06), transparent 65%)" }}
        />
      </div>

      <div className="relative">
        {/* Header */}
        <header
          className="sticky top-0 z-30 backdrop-blur-md"
          style={{ background: "rgba(247,246,243,0.85)", borderBottom: `1px solid ${LINE}` }}
        >
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Wordmark />
            <nav className="hidden md:flex items-center gap-8 text-[13px]" style={{ color: MUTED }}>
              <a href="#produit" className="hover:text-[#1B1B19] transition-colors">Produit</a>
              <a href="#methode" className="hover:text-[#1B1B19] transition-colors">Méthode</a>
              <a href="#questions" className="hover:text-[#1B1B19] transition-colors">Questions</a>
            </nav>
            <GoogleButton label="Se connecter" size="sm" />
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 sm:pt-32 sm:pb-24">
          <Reveal>
            <Tag tone="green">Gratuit · sans compte requis</Tag>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="font-serif mt-7 text-[44px] sm:text-[68px] leading-[1.04] tracking-[-0.03em] max-w-3xl">
              La musique et le timer,
              <br />
              dans la même fenêtre.
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-7 max-w-xl text-[16px] sm:text-[17px] leading-[1.6]" style={{ color: MUTED }}>
              FocusFlow réunit un Pomodoro et un lecteur multi-sources — lofi YouTube, Spotify, Twitch — sur un
              seul écran. Autour, ce qu&apos;il faut pour tenir la distance : tâches, planning, statistiques, et
              des amis qui travaillent en même temps que toi.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <GoogleButton label="Commencer" />
              <a
                href="#produit"
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium transition-colors hover:bg-[#F0EFEB]"
                style={{ border: `1px solid ${LINE}`, color: INK }}
              >
                Voir ce qu&apos;il y a dedans
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2.5v11M3.5 9.5L8 14l4.5-4.5" />
                </svg>
              </a>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: MUTED }}>
              <Key>⌘</Key>
              <Key>K</Key>
              <span className="ml-1">pour atteindre n&apos;importe quelle section au clavier.</span>
            </p>
          </Reveal>

          <Reveal delay={300} className="mt-16 sm:mt-20">
            <SessionPreview />
          </Reveal>
        </section>

        {/* Bandeau de faits */}
        <Reveal as="section" className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
            {[
              ["5", "sources audio"],
              ["4", "modes de timer"],
              ["0 €", "pour tout, toujours"],
              ["100 %", "utilisable hors compte"],
            ].map(([v, l], i) => (
              <div
                key={l}
                className="py-8 px-5"
                style={{ borderLeft: i === 0 ? undefined : `1px solid ${LINE}` }}
              >
                <p className="font-serif text-[30px] leading-none tracking-tight">{v}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.09em]" style={{ color: MUTED }}>
                  {l}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Bento produit */}
        <section id="produit" className="max-w-5xl mx-auto px-6 py-24 sm:py-32">
          <Reveal>
            <Tag tone="blue">Produit</Tag>
            <h2 className="font-serif mt-6 text-[34px] sm:text-[46px] leading-[1.08] tracking-[-0.03em] max-w-2xl">
              Tout ce qui sert à se concentrer, et rien d&apos;autre.
            </h2>
          </Reveal>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={i * 80}
                className={cn(
                  "group rounded-xl bg-white p-7 sm:p-9 transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
                  f.span && "sm:col-span-2"
                )}
              >
                <span className="flex w-9 h-9 items-center justify-center rounded-md" style={{ background: CANVAS }}>
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <h3 className="mt-6 text-[17px] tracking-tight" style={{ color: INK }}>
                  {f.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-[1.65]" style={{ color: MUTED }}>
                  {f.desc}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Méthode */}
        <section id="methode" className="max-w-5xl mx-auto px-6 pb-24 sm:pb-32">
          <Reveal>
            <Tag tone="yellow">Méthode</Tag>
            <h2 className="font-serif mt-6 text-[34px] sm:text-[46px] leading-[1.08] tracking-[-0.03em]">
              Trois gestes, puis on ne pense plus à l&apos;outil.
            </h2>
          </Reveal>

          <div className="mt-14 grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <Reveal>
              <SessionPreview phase={STEPS[activeStep].phase} />
            </Reveal>
            <ul className="flex flex-col">
              {STEPS.map((s, i) => (
                <Reveal
                  as="li"
                  key={s.n}
                  delay={i * 90}
                  className="cursor-default"
                >
                  <div
                    onMouseEnter={() => setActiveStep(i)}
                    className="flex gap-6 py-7 transition-opacity"
                    style={{
                      borderTop: i === 0 ? undefined : `1px solid ${LINE}`,
                      opacity: i === activeStep ? 1 : 0.55,
                    }}
                  >
                    <span className="font-mono text-[11px] pt-1 tabular-nums" style={{ color: MUTED }}>
                      {s.n}
                    </span>
                    <div>
                      <h3 className="text-[17px] tracking-tight">{s.title}</h3>
                      <p className="mt-2 text-[14px] leading-[1.65]" style={{ color: MUTED }}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Questions */}
        <section id="questions" className="max-w-3xl mx-auto px-6 pb-24 sm:pb-32">
          <Reveal>
            <h2 className="font-serif text-[34px] sm:text-[46px] leading-[1.08] tracking-[-0.03em]">Questions</h2>
          </Reveal>
          <Reveal delay={80} className="mt-10" style={{ borderTop: `1px solid ${LINE}` }}>
            {FAQ.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
            ))}
          </Reveal>
        </section>

        {/* Dernière invitation */}
        <section className="max-w-5xl mx-auto px-6 pb-24 sm:pb-32">
          <Reveal className="rounded-xl bg-white px-8 py-16 sm:px-16 sm:py-20 text-center" style={{ border: `1px solid ${LINE}` }}>
            <h2 className="font-serif text-[36px] sm:text-[52px] leading-[1.06] tracking-[-0.03em]">
              Une heure de vrai calme,
              <br />
              à partir de maintenant.
            </h2>
            <p className="mt-5 mx-auto max-w-md text-[15px] leading-[1.6]" style={{ color: MUTED }}>
              Ouvre une session, choisis un paysage, laisse tourner. Ton compte Google sert seulement à retrouver
              ta progression ailleurs.
            </p>
            <div className="mt-9 flex justify-center">
              <GoogleButton label="Commencer" />
            </div>
          </Reveal>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${LINE}` }}>
          <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
            <Wordmark />
            <p className="font-mono text-[11px]" style={{ color: MUTED }}>
              Pomodoro · Lofi · Focus — © {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
