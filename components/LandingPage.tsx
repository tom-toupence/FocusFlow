"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Landing page (affichée par AuthGate quand l'utilisateur n'est pas connecté) :
// présentation complète de FocusFlow — hero, fonctionnalités, déroulé, stack
// technique (les bibliothèques du projet), et connexion Google. Thème sombre
// fixe (look « produit »), 100% avec les libs du projet (React + Tailwind, SVG
// inline, aucune dépendance ni image externe).

function GoogleButton({ label = "Continuer avec Google", full = false }: { label?: string; full?: boolean }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => { setLoading(true); await signInWithGoogle(); }}
      disabled={loading}
      className={cn(
        "group inline-flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-[#0a0a0c] font-semibold text-sm hover:bg-white/90 transition-all shadow-lg shadow-black/40 disabled:opacity-60",
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

interface Feature { icon: React.ReactNode; title: string; desc: string; accent: string; }

const FEATURES: Feature[] = [
  {
    accent: "text-indigo-300",
    title: "Timer Pomodoro & Flowtime",
    desc: "Presets classic / deep / custom, ou le mode Flowtime (chrono libre, pause méritée). Timer flottant Picture-in-Picture toujours visible.",
    icon: <path d="M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    accent: "text-rose-300",
    title: "Lecteur multi-sources",
    desc: "Catalogue lofi/ambient curated par mood, playlists & vidéos YouTube, Spotify Premium et streams Twitch — dans la même vue plein écran que le timer.",
    icon: <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    accent: "text-emerald-300",
    title: "Tâches, projets & planning",
    desc: "Kanban de tâches, projets à deadline, planning hebdo (time-blocking) synchronisable à ton calendrier iPhone/Google, mode Sprint généré pour une échéance.",
    icon: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    accent: "text-sky-300",
    title: "Stats & Focus Score",
    desc: "Heatmap, séries, objectif quotidien, marquage des distractions et Focus Score, dashboard d'insights détaillé, export CSV/JSON, récap hebdo « Wrapped » partageable.",
    icon: <path d="M3 3v18h18M7 15l3-4 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    accent: "text-amber-300",
    title: "Amis & temps réel",
    desc: "Ajoute des amis par code, un classement hebdo, la présence « en ligne / en focus » en direct, ce que chacun écoute, et un chat intégré façon launcher.",
    icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    accent: "text-violet-300",
    title: "Bien-être & gamification",
    desc: "Respiration guidée pendant les pauses, journal d'humeur, coach de planification (local ou IA), XP & niveaux, jardin de focus, badges et défis hebdomadaires.",
    icon: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

const STEPS = [
  { n: "1", title: "Choisis ton ambiance", desc: "Un paysage lofi du catalogue, ta playlist YouTube, Spotify ou un stream Twitch." },
  { n: "2", title: "Lance ta session", desc: "Règle ton rythme Pomodoro, ajoute tes tâches, et travaille en plein écran, musique et timer réunis." },
  { n: "3", title: "Suis ta progression", desc: "Stats, objectif quotidien, badges, récap hebdo — et compare ta semaine avec tes amis." },
];

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="max-w-2xl mb-12">
      <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight">{title}</h2>
      {sub && <p className="text-white/45 mt-4 text-sm sm:text-base leading-relaxed">{sub}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white overflow-x-hidden">
      {/* Halos d'arrière-plan */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.14)_0%,_transparent_60%)]" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,_rgba(236,72,153,0.10)_0%,_transparent_60%)]" />
        <div className="absolute bottom-0 -left-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.08)_0%,_transparent_60%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#0a0a0c]/60 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-7 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#how" className="hover:text-white transition-colors">Comment ça marche</a>
          </nav>
          <GoogleButton label="Se connecter" />
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-20 sm:pt-28 pb-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[12px] text-white/55 mb-8">
            Gratuit, sans publicité — fonctionne même sans compte
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Ta bulle de concentration, musique et timer réunis.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-white/50 leading-relaxed">
            FocusFlow réunit un timer Pomodoro et un lecteur multi-sources — lofi YouTube, Spotify,
            Twitch — dans une seule vue plein écran. Avec des statistiques, un coach de planification,
            des amis et un catalogue d&apos;ambiances pour tenir la distance.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-start gap-3">
            <GoogleButton label="Commencer" />
            <a href="#features" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.08] transition-all">
              Voir les fonctionnalités
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          </div>
          <p className="mt-5 text-xs text-white/25">Ton compte Google sert uniquement à t&apos;identifier et synchroniser ta progression.</p>
        </div>

        {/* Aperçu / mockup abstrait de session */}
        <div className="mt-16 relative max-w-4xl">
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-3 shadow-2xl shadow-black/50">
            <div className="rounded-xl overflow-hidden bg-[#0c0c10] border border-white/[0.06]">
              {/* barre de fenêtre */}
              <div className="flex items-center gap-1.5 px-3.5 h-9 border-b border-white/[0.06]">
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="ml-3 text-[11px] text-white/30">focusflow · session</span>
              </div>
              {/* faux contenu de session */}
              <div className="relative aspect-video bg-[radial-gradient(ellipse_at_30%_20%,_rgba(99,102,241,0.18),_transparent_55%),radial-gradient(ellipse_at_80%_90%,_rgba(236,72,153,0.14),_transparent_55%)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-28 h-28 sm:w-36 sm:h-36">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                      <circle cx="50" cy="50" r="44" fill="none" stroke="url(#gr)" strokeWidth="5" strokeLinecap="round" strokeDasharray="276" strokeDashoffset="90" />
                      <defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a5b4fc" /><stop offset="1" stopColor="#f0abfc" /></linearGradient></defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl sm:text-4xl font-semibold tabular-nums">18:24</span>
                      <span className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Focus</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] text-white/60">Lofi hip hop — beats to study</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section id="features" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <SectionTitle
          title="Tout ce qu'il faut pour se concentrer, au même endroit"
          sub="Le timer, la musique, l'organisation, les statistiques et le social — réunis, sans friction, et gratuitement."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all">
              <div className={cn("w-11 h-11 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4", f.accent)}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>{f.icon}</svg>
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="how" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <SectionTitle title="En trois étapes" />
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-400/20 border border-white/10 flex items-center justify-center text-sm font-semibold mb-4">{s.n}</div>
              <h3 className="text-base font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{s.desc}</p>
              {i < STEPS.length - 1 && (
                <svg className="hidden md:block absolute top-10 -right-3.5 w-6 h-6 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-br from-indigo-500/[0.12] via-violet-500/[0.06] to-transparent p-10 sm:p-16 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.18),_transparent_60%)]" />
          <h2 className="relative text-3xl sm:text-5xl font-semibold tracking-tight">Entre dans le flow.</h2>
          <p className="relative max-w-md mx-auto mt-4 text-white/50 text-sm sm:text-base">
            Crée ton espace de concentration en un clic. Gratuit, pour toujours.
          </p>
          <div className="relative mt-8 flex justify-center">
            <GoogleButton label="Commencer gratuitement" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-white/30">Pomodoro · Lofi · Focus — fait pour rester concentré. © {new Date().getFullYear()} FocusFlow</p>
        </div>
      </footer>
    </div>
  );
}
