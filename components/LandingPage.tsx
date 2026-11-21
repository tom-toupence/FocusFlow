"use client";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING · la ville qui ne dort pas (docs/redesign/02-CONCEPTS.md, LAB.md)
//
// Une seule scène fixe pour toute la page : « la fenêtre », la ville la nuit vue
// d'en haut, derrière une vitre mouillée (capture TOKYO NIGHT, CC BY 4.0)
// (components/CityScene : une vraie photo en 2.5D, pluie et lumières en shader). Le scroll est une nuit qui
// avance (l'horloge du bandeau va de 22:00 au petit matin) et chaque section
// déclenche un vrai événement de FocusFlow sur la ville :
//   1. vingt-cinq minutes  → le panneau à LED décompte avec le scroll
//   2. distraction (D)     → un quartier grésille
//   3. fin de pomodoro     → la halte : la ville s'éteint du fond vers nous,
//                            la mise au point revient sur la vitre
//   4. Flowtime            → la ville se rallume, sans échéance au panneau
//   5. la file se prolonge → un pâté de maisons s'allume
//   6. la trace            → le petit matin (le thème clair de l'app)
//   7. les amis            → la ville veille, le texte dit qui est en focus
//   8. fin                 → objectif atteint, une vague de lumière part de la tour
//
// Moteur : motion/react (useScroll, useInView), défilement natif (pas de
// scroll-jacking). Le texte ne s'anime pas : seule la ville bouge, et
// toujours pour une raison. « Commencer » apparaît deux fois.
// Aucun nom de ville ni de pays : la ville est une ville.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { signInWithGoogle } from "@/lib/supabase";
import { defaultVideos, type Video } from "@/data/videos";
import { cleanTitle } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { CityHandle } from "@/components/CityScene";
import { CITY_CREDIT, type CityPhase } from "@/lib/city/types";

const CityScene = dynamic(() => import("@/components/CityScene"), { ssr: false });

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const byId = (id: string) => defaultVideos.find((v) => v.id === id);
const PICKS = ["abao-01", "swj-01", "hatsu-01", "driv-05", "hk-02", "tw-02"]
  .map(byId)
  .filter((v): v is Video => !!v);

type Act = "hero" | "time" | "flicker" | "halt" | "flow" | "queue" | "trace" | "friends" | "end";

// Couleurs de la nuit, en dur : la landing ne suit pas le thème de l'app.
const C = {
  asphalt: "#0b1016",
  neon: "#e9f2ff",
  sodium: "#ff9a3c",
  konbini: "#53e0a1",
  taxi: "#ffc21a",
  dawnBg: "#e7e6e1",
  dawnInk: "#1d232b",
  dawnSodium: "#b5550f",
  dawnKonbini: "#11734a",
};

// ── Petits éléments ────────────────────────────────────────────────────────

/** Le nom, comme une enseigne allumée : tube blanc froid, halo court. */
function Wordmark({ className, lit = true }: { className?: string; lit?: boolean }) {
  return (
    <span
      className={cn("font-display font-extrabold uppercase tracking-[0.04em] leading-none", className)}
      style={lit ? { textShadow: "0 0 14px rgba(190,215,255,0.55)" } : undefined}
    >
      FocusFlow
    </span>
  );
}

function Cta({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ff-press inline-flex items-center gap-2.5 h-12 px-6 rounded-[4px] bg-[#ff9a3c] text-[#1c0e02] text-[15px] font-semibold",
        "hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff9a3c] transition-[filter,transform]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Une section qui annonce son acte quand elle occupe le milieu de l'écran. */
function Scene({
  act, onAct, children, className, tall,
}: {
  act: Act;
  onAct: (a: Act) => void;
  children: React.ReactNode;
  className?: string;
  tall?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => { if (inView) onAct(act); }, [inView, act, onAct]);
  return (
    <section
      ref={ref}
      className={cn("relative px-5 sm:px-10 lg:px-16", tall ? "min-h-[210svh]" : "min-h-[100svh] flex items-end md:items-center", className)}
    >
      {children}
    </section>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("relative z-10 max-w-xl pb-16 md:pb-0 pt-24", className)}>{children}</div>;
}

const H2 = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h2 className={cn("font-display font-extrabold uppercase text-[clamp(2.2rem,5.2vw,4rem)] leading-[0.92] tracking-[0.005em] text-[#e9f2ff]", className)}>
    {children}
  </h2>
);
const P = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("mt-6 text-[17px] leading-relaxed text-[#e9f2ff]/80 max-w-[34rem]", className)}>{children}</p>
);

/** L'heure de la nuit : 22:00 en haut de page, 06:30 tout en bas. */
function nightClock(p: number) {
  const m = Math.round(22 * 60 + Math.min(1, Math.max(0, p)) * 8.5 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ── Landing ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const reduce = useReducedMotion();
  const city = useRef<CityHandle>(null);
  const [act, setAct] = useState<Act>("hero");
  const [phase, setPhase] = useState<CityPhase>("work");
  const [board, setBoard] = useState("25 MIN");
  const [minutes, setMinutes] = useState(25);
  const [friends, setFriends] = useState(0);
  const [dawn, setDawn] = useState(false);
  // Écran étroit : le texte passe en bas, la caméra garde son cadrage d'origine.
  // Lu une fois (la scène ne lit son cadrage qu'au montage) ; n'affecte que la
  // scène, rendue côté client uniquement : pas d'écart d'hydratation.
  const [narrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [flickers, setFlickers] = useState(0);
  const [breath, setBreath] = useState<string | null>(null);
  const [clock, setClock] = useState("22:00");
  const signIn = useCallback(() => { signInWithGoogle(); }, []);

  // Chaque acte règle la ville à son entrée (geste ponctuel, pas un effet).
  const actRef = useRef<Act>("hero");
  const onAct = useCallback((a: Act) => {
    if (actRef.current === a) return;
    actRef.current = a;
    setAct(a);
    setDawn(a === "trace");
    setPhase(a === "halt" ? "break" : "work");
    if (a !== "friends") setFriends(0);
    switch (a) {
      case "hero": setBoard("25 MIN"); break;
      case "flicker": setBoard("13 MIN"); break;
      case "halt": setBoard("HALTE"); break;
      case "flow": setBoard("FLOW"); break;
      case "queue": setBoard("NEXT"); setTimeout(() => city.current?.extend(), 500); break;
      case "friends": setBoard("7 EN FOCUS"); setFriends(7); break;
      case "end": setBoard("OBJECTIF"); setTimeout(() => city.current?.goal(), 400); break;
    }
  }, []);

  // L'horloge du bandeau suit la page entière : la nuit avance.
  const { scrollYProgress: page } = useScroll();
  useMotionValueEvent(page, "change", (p) => setClock(nightClock(p)));

  // Acte « 25 minutes » : le scroll fait décompter le panneau à LED.
  const timeRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: timeRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (actRef.current !== "time") return;
    const m = 25 - Math.round(Math.min(1, Math.max(0, p)) * 24);
    setMinutes(m);
    setBoard(`${m} MIN`);
  });

  // Acte « halte » : la respiration guidée 4-4-4-4.
  useEffect(() => {
    if (act !== "halt" || reduce) return;
    const PHASES = ["Inspire", "Retiens", "Expire", "Retiens"];
    const t0 = performance.now();
    const tick = () => setBreath(PHASES[Math.floor((performance.now() - t0) / 4000) % 4]);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [act, reduce]);

  // Touche D pendant l'acte « distraction ».
  const flicker = useCallback(() => {
    city.current?.flicker();
    setFlickers((n) => n + 1);
  }, []);
  useEffect(() => {
    if (act !== "flicker") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "d" || e.key === "D") flicker(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, flicker]);

  const sceneLabel =
    act === "halt" ? "La ville pendant la halte : les lumières se sont éteintes au loin, la vue est floue derrière la vitre."
    : act === "trace" ? "La même ville au petit matin."
    : `La ville la nuit, vue d'en haut derrière une vitre mouillée. L'écran sur un toit affiche ${board.toLowerCase()}.`;

  return (
    <div className="relative bg-[#0b1016] text-[#e9f2ff] font-sans selection:bg-[#ff9a3c] selection:text-[#1c0e02]">
      {/* La scène : une seule vue sur la ville, fixe, pour toute la page. */}
      <div className="fixed inset-0 z-0">
        <CityScene ref={city} phase={phase} board={board} friends={friends} time={dawn ? "dawn" : "night"} label={sceneLabel} credit={false} yaw={narrow ? 0 : 0.36} className="absolute inset-0" />
        {/* Voile de lecture : fort à gauche (texte), nul à droite (la rue). */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-700",
            "bg-[linear-gradient(90deg,#0b1016_0%,rgba(11,16,22,0.84)_34%,rgba(11,16,22,0.2)_62%,transparent_80%)]",
            "max-md:bg-[linear-gradient(0deg,#0b1016_0%,rgba(11,16,22,0.92)_44%,rgba(11,16,22,0.45)_62%,rgba(11,16,22,0.1)_80%)]",
            dawn && "opacity-0",
          )}
        />
      </div>

      {/* Bandeau */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-30 flex items-center justify-between px-5 sm:px-10 lg:px-16 h-16 transition-colors duration-300",
          dawn ? "text-[#1d232b] bg-[#e7e6e1]/92 backdrop-blur-sm" : "text-[#e9f2ff] bg-[#0b1016]/82 backdrop-blur-sm border-b border-[#e9f2ff]/[0.06]",
        )}
      >
        <Wordmark className="text-2xl" lit={!dawn} />
        <div className="flex items-center gap-6">
          <span className="hidden sm:inline font-led text-[15px] opacity-80 tabular-nums" aria-hidden>{clock}</span>
          <button
            type="button"
            onClick={signIn}
            className="text-sm opacity-85 hover:opacity-100 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#ff9a3c] rounded-[2px]"
          >
            Se connecter
          </button>
        </div>
      </header>

      <main className="relative z-10">
        {/* 0 · Hero */}
        <Scene act="hero" onAct={onAct} className="min-h-[100svh]">
          <Panel>
            <h1 className="font-display font-extrabold uppercase text-[clamp(3rem,8vw,6.6rem)] leading-[0.88] tracking-[0.005em]">
              La ville ne dort pas.
              <span className="block text-[#ff9a3c]">Toi non plus, ce soir.</span>
            </h1>
            <P className="mt-8">
              FocusFlow met dans le même écran un minuteur Pomodoro et ce que tu veux entendre : une vidéo filmée la nuit, ta
              playlist, un live. Tu lances vingt-cinq minutes. Quand le panneau arrive à zéro, la ville s&apos;éteint : c&apos;est la pause.
            </P>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Cta onClick={signIn}>Commencer</Cta>
              <span className="text-sm text-[#e9f2ff]/65">Gratuit. Connexion Google pour retrouver tes sessions partout.</span>
            </div>
          </Panel>
        </Scene>

        {/* 1 · Vingt-cinq minutes au panneau */}
        <div ref={timeRef}>
          <Scene act="time" onAct={onAct} tall>
            <div className="sticky top-0 min-h-[100svh] flex items-end md:items-center">
              <Panel>
                <p className="font-led text-[clamp(4.5rem,13vw,10rem)] leading-none text-[#ffc21a] tabular-nums" aria-hidden>
                  {String(minutes).padStart(2, "0")}:00
                </p>
                <H2 className="mt-6">Vingt-cinq minutes au panneau.</H2>
                <P>
                  Le minuteur s&apos;affiche comme un panneau de quai : gros, net, lisible de loin, sans lever la tête. Classique,
                  Deep Work à cinquante minutes, ou tes propres durées.
                </P>
              </Panel>
            </div>
          </Scene>
        </div>

        {/* 2 · La distraction */}
        <Scene act="flicker" onAct={onAct}>
          <Panel>
            <H2>Tu as regardé ton téléphone. Appuie sur D.</H2>
            <P>
              Rien n&apos;est détecté à ta place. Tu marques, un quartier grésille, la session s&apos;en souvient. Moins
              d&apos;interruptions, meilleur score de focus en fin de session.
            </P>
            <div className="mt-8 flex items-center gap-5">
              <button
                type="button"
                onClick={flicker}
                className="ff-press inline-flex items-center gap-3 h-11 pl-2 pr-4 whitespace-nowrap rounded-[4px] border border-[#e9f2ff]/35 hover:border-[#e9f2ff]/70 text-sm focus-visible:outline-2 focus-visible:outline-[#ff9a3c]"
              >
                <kbd className="font-mono text-[13px] w-7 h-7 inline-flex items-center justify-center rounded-[3px] bg-[#e9f2ff] text-[#0b1016]">D</kbd>
                Marquer une distraction
              </button>
              <span className="font-mono text-sm text-[#e9f2ff]/70" aria-live="polite">
                {flickers === 0 ? "0 distraction" : `${flickers} distraction${flickers > 1 ? "s" : ""}`}
              </span>
            </div>
          </Panel>
        </Scene>

        {/* 3 · La halte */}
        <Scene act="halt" onAct={onAct}>
          <Panel>
            <H2>À zéro, la ville s&apos;éteint.</H2>
            <P>
              Les lumières s&apos;éteignent du fond vers toi et la vue se brouille derrière la vitre, comme quand on lève
              enfin les yeux de l&apos;écran. Cinq minutes de pause, une longue toutes les quatre sessions. Si tu veux, respire au rythme quatre, quatre,
              quatre, quatre.
            </P>
            <p className="mt-8 h-9 font-display font-bold uppercase text-3xl text-[#53e0a1]" aria-live="polite">
              {act === "halt" && !reduce ? breath ?? "" : ""}
            </p>
          </Panel>
        </Scene>

        {/* 4 · Flowtime */}
        <Scene act="flow" onAct={onAct}>
          <Panel>
            <H2>Certains soirs, vingt-cinq minutes ne suffisent pas.</H2>
            <P>
              Le mode Flowtime enlève l&apos;échéance du panneau. Tu travailles tant que tu tiens. Quand tu t&apos;arrêtes, ta
              pause vaut un cinquième du temps passé : une heure de travail, douze minutes de repos.
            </P>
          </Panel>
        </Scene>

        {/* 5 · La musique et la file qui se prolonge */}
        <Scene act="queue" onAct={onAct}>
          <Panel className="max-w-2xl">
            <H2>Ta musique, pas celle d&apos;un inconnu.</H2>
            <P>
              Quand ta playlist se termine avant la session, un pâté de maisons s&apos;allume : la file se prolonge avec des titres
              proches de toute ta playlist, pas seulement du dernier morceau.
            </P>
            <ul className="mt-8 grid grid-cols-3 gap-x-3 gap-y-5" aria-label="Quelques vidéos du catalogue">
              {PICKS.map((v) => (
                <li key={v.id} className="min-w-0">
                  <span className="block aspect-video overflow-hidden rounded-[3px] bg-[#05080d]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(v.youtubeId)} alt="" loading="lazy" className="w-full h-full object-cover brightness-[0.85]" />
                  </span>
                  <span className="block mt-2 text-[13px] leading-snug text-[#e9f2ff]/85 line-clamp-2">{cleanTitle(v.title)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[#e9f2ff]/65">
              Aussi : tes playlists YouTube dans l&apos;ordre, Spotify avec un compte Premium, un live Twitch en fond.
            </p>
          </Panel>
        </Scene>

        {/* 6 · Le petit matin : la trace */}
        <Scene act="trace" onAct={onAct} className="min-h-0 py-28 md:py-36 items-start">
          <Trace />
        </Scene>

        {/* 7 · Les amis */}
        <Scene act="friends" onAct={onAct}>
          <Panel>
            <H2>Tu n&apos;es pas seul à veiller.</H2>
            <P>
              Ajoute des amis avec un code. Tu vois qui est en focus en ce moment, ce qu&apos;il écoute, et le temps de chacun
              sur la semaine. Jamais ses tâches ni son journal.
            </P>
          </Panel>
        </Scene>

        {/* Fin */}
        <Scene act="end" onAct={onAct} className="min-h-[90svh]">
          <Panel>
            <p className="font-display font-extrabold uppercase text-[clamp(2.8rem,7vw,5.4rem)] leading-[0.9]">
              Objectif atteint,
              <span className="block text-[#ffc21a]">la ville s&apos;illumine.</span>
            </p>
            <P>Chaque grand moment de la session a son événement dans la ville. Le reste du temps, elle te laisse travailler.</P>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Cta onClick={signIn}>Commencer</Cta>
              <span className="text-sm text-[#e9f2ff]/65">Gratuit, sans publicité, code ouvert.</span>
            </div>
          </Panel>
        </Scene>
      </main>

      <footer className="relative z-10 bg-[#0b1016] border-t border-[#e9f2ff]/10 px-5 sm:px-10 lg:px-16 py-8 flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px] text-[#e9f2ff]/60">
        <Wordmark className="text-lg text-[#e9f2ff]/85" lit={false} />
        <span>Les vidéos appartiennent à leurs auteurs et se lisent sur YouTube.</span>
        <span>Polices Big Shoulders, Doto, Atkinson Hyperlegible Next (OFL).</span>
        <a href={CITY_CREDIT.href} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
          {CITY_CREDIT.text}. Lumière, pluie et caméra ajoutées.
        </a>
      </footer>
    </div>
  );
}

// ── Le petit matin : deux semaines de focus ─────────────────────────────────

const WEEK = [95, 140, 60, 175, 120, 30, 150, 110, 165, 80, 190, 125, 45, 160];
const DAYS = ["L", "M", "M", "J", "V", "S", "D", "L", "M", "M", "J", "V", "S", "D"];

function Trace() {
  const goal = 120, max = 200;
  const total = WEEK.slice(7).reduce((a, b) => a + b, 0);
  return (
    <div className="relative z-10 w-full max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center rounded-[6px] bg-[#e7e6e1]/92 text-[#1d232b] p-7 sm:p-12">
      <div>
        <h2 className="font-display font-extrabold uppercase text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.92]">
          Au petit matin, il reste une trace.
        </h2>
        <p className="mt-6 text-[17px] leading-relaxed text-[#1d232b]/85 max-w-[34rem]">
          Chaque nuit se relit au calme : tes minutes, ta série, ton heure la plus concentrée, ton objectif tenu ou pas. Le lundi,
          le récap de la semaine se partage en image. C&apos;est aussi le thème clair de l&apos;app : la même ville, à l&apos;aube.
        </p>
        <dl className="mt-8 grid grid-cols-3 gap-6 max-w-md">
          {[
            [`${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")}`, "cette semaine"],
            ["5 j", "de série"],
            ["22 h", "ton heure"],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="sr-only">{l}</dt>
              <dd className="font-display font-bold text-3xl sm:text-4xl whitespace-nowrap tabular-nums">{v}</dd>
              <dd className="text-[13px] text-[#1d232b]/70 mt-1">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figure className="min-w-0">
        {/* Des barres, comme des fenêtres empilées : une par soir, pleine en vert si l'objectif a tenu. */}
        <div className="flex items-end gap-1.5 sm:gap-2 h-48" role="img" aria-label="Minutes de focus sur deux semaines. Les barres vertes ont atteint l'objectif de deux heures.">
          {WEEK.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span
                className="w-full rounded-[2px]"
                style={{ height: `${(v / max) * 100}%`, background: v >= goal ? C.dawnKonbini : "rgba(29,35,43,0.28)" }}
              />
              <span className="font-mono text-[10px] text-[#1d232b]/65">{DAYS[i]}</span>
            </div>
          ))}
        </div>
        <figcaption className="mt-4 text-[13px] text-[#1d232b]/70">Deux semaines. En vert, les soirs où l&apos;objectif de deux heures a tenu.</figcaption>
      </figure>
    </div>
  );
}
