"use client";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING · Clepsydre de nuit (docs/redesign/02-CONCEPTS.md, 05 dans REPORT)
//
// La page ne liste pas des fonctionnalités : elle MONTRE le produit sur une
// seule scène d'eau fixe (WebGL, lib/water), et chaque section du scroll
// déclenche une vraie mécanique de FocusFlow sur cette eau :
//   1. la ville choisie colore la rive           (getVideoColor → reflet)
//   2. 25 minutes = l'eau monte d'un trait        (scroll → niveau + minuteur)
//   3. une distraction = un caillou               (bouton / touche D → stone)
//   4. le trait atteint = débordement, pause      (overflow, respiration 4-4-4-4)
//   5. Flowtime = pas de trait                    (l'eau monte sans plafond)
//   6. la file se prolonge                        (goutte à chaque titre)
//   7. le lendemain, la trace                     (section PAPIER : le relevé)
//   8. les amis                                   (goutte lointaine)
//
// Moteur : motion/react (useScroll, useInView) + WebGL maison. Ni GSAP, ni
// Lenis, ni SplitText : le défilement reste natif (pas de scroll-jacking), le
// texte ne s'anime pas, seule l'eau bouge, et toujours pour une raison.
// « Commencer » apparaît deux fois : en haut et à la fin.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { signInWithGoogle } from "@/lib/supabase";
import { defaultVideos, getVideoColor, type Video } from "@/data/videos";
import { cleanTitle } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { WaterHandle } from "@/components/WaterScene";

const WaterScene = dynamic(() => import("@/components/WaterScene"), { ssr: false });

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const byId = (id: string) => defaultVideos.find((v) => v.id === id);
const CITIES = ["abao-01", "swj-01", "hatsu-01", "driv-05", "hk-02", "tw-02"]
  .map(byId)
  .filter((v): v is Video => !!v);
const FIRST = CITIES[0] ?? defaultVideos[0];

type Act = "hero" | "city" | "time" | "stone" | "pause" | "flow" | "queue" | "trace" | "friends" | "end";

// ── Petits éléments ────────────────────────────────────────────────────────

function Wordmark({ className }: { className?: string }) {
  return (
    // Le trait de niveau SOUS le mot, comme sur le splash (jamais à côté : il
    // se lirait comme un tiret long).
    <span className={cn("relative inline-block font-display font-light tracking-tight pb-1", className)}>
      FocusFlow
      <span aria-hidden className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#f2a65a]" />
    </span>
  );
}

function Cta({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ff-press inline-flex items-center gap-2.5 h-12 px-6 rounded-[6px] bg-[#f2a65a] text-[#1c1408] text-[15px] font-semibold",
        "hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#f2a65a] transition-[filter,transform]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Mesure en mono, toujours tabulaire. */
function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>{children}</span>;
}

/** Une section qui annonce son acte quand elle occupe le milieu de l'écran. */
function Scene({
  act, onAct, children, className, id, tall,
}: {
  act: Act;
  onAct: (a: Act) => void;
  children: React.ReactNode;
  className?: string;
  id?: string;
  tall?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => { if (inView) onAct(act); }, [inView, act, onAct]);
  return (
    <section
      ref={ref}
      id={id}
      className={cn("relative px-5 sm:px-10 lg:px-16", tall ? "min-h-[210svh]" : "min-h-[100svh] flex items-end md:items-center", className)}
    >
      {children}
    </section>
  );
}

/** Colonne de texte lisible sur l'eau : le voile n'est là que pour le contraste. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative z-10 max-w-xl pb-16 md:pb-0 pt-24", className)}>
      {children}
    </div>
  );
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-display font-light text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.04] tracking-[-0.015em] text-[#efe9df]">{children}</h2>
);
const P = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("mt-5 text-[17px] leading-relaxed text-[#efe9df]/78 max-w-[34rem]", className)}>{children}</p>
);

// ── Landing ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const reduce = useReducedMotion();
  const water = useRef<WaterHandle>(null);
  const [act, setAct] = useState<Act>("hero");
  const [level, setLevel] = useState(0.12);
  const [swell, setSwell] = useState(1);
  const [city, setCity] = useState<Video>(FIRST);
  const [minutes, setMinutes] = useState(0);
  const [stones, setStones] = useState(0);
  const [breath, setBreath] = useState<string | null>(null);
  const signIn = useCallback(() => { signInWithGoogle(); }, []);
  // Sur écran étroit l'échelle se rapproche du centre (sinon hors cadre).
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Chaque acte règle l'eau à son entrée (geste ponctuel, pas un effet).
  const actRef = useRef<Act>("hero");
  const onAct = useCallback((a: Act) => {
    if (actRef.current === a) return;
    actRef.current = a;
    setAct(a);
    switch (a) {
      case "hero": setSwell(1); setLevel(0.12); break;
      case "city": setSwell(1); setLevel(0.14); break;
      case "time": setSwell(1); break; // le niveau suit le scroll (voir plus bas)
      case "stone": setSwell(1); setLevel(0.6); break;
      case "pause": setSwell(0); water.current?.overflow(0.3); setLevel(0.3); break;
      case "flow": setSwell(1); setLevel(0.9); break; // au-dessus du trait des 25 min
      case "queue": setSwell(1); setLevel(0.45); water.current?.drop(); break;
      case "trace": setSwell(0); break;
      case "friends": setSwell(0.6); setLevel(0.4); water.current?.drop(); setTimeout(() => water.current?.drop(), 900); break;
      case "end": setSwell(1); setLevel(0.12); break;
    }
  }, []);

  // Acte « 25 minutes » : le scroll fait avancer le minuteur et monter l'eau.
  const timeRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: timeRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (act !== "time") return;
    const m = Math.round(Math.min(1, Math.max(0, p)) * 25);
    setMinutes(m);
    setLevel(0.12 + (m / 25) * 0.8);
  });

  // Acte « pause » : la respiration guidée 4-4-4-4 pilote le niveau.
  useEffect(() => {
    if (act !== "pause" || reduce) return;
    const PHASES = [["Inspire", 0.62], ["Retiens", 0.62], ["Expire", 0.3], ["Retiens", 0.3]] as const;
    const t0 = performance.now();
    const tick = () => {
      const i = Math.floor((performance.now() - t0) / 4000) % 4;
      setBreath(PHASES[i][0]);
      setLevel(PHASES[i][1]);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [act, reduce]);

  // Touche D pendant l'acte « distraction ».
  const throwStone = useCallback(() => {
    water.current?.stone();
    setStones((n) => n + 1);
  }, []);
  useEffect(() => {
    if (act !== "stone") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "d" || e.key === "D") throwStone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, throwStone]);

  const pickCity = (v: Video) => { setCity(v); water.current?.drop(undefined, undefined, 0.8); };

  return (
    <div className="relative bg-[#0b0f18] text-[#efe9df] font-sans selection:bg-[#f2a65a] selection:text-[#1c1408]">
      {/* La scène : une seule eau, fixe, pour toute la page. Cliquer l'eau y fait tomber une goutte. */}
      <div
        className="fixed inset-0 z-0"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          water.current?.drop(e.clientX - r.left, e.clientY - r.top);
        }}
      >
        <WaterScene ref={water} level={level} swell={swell} reflet={getVideoColor(city)} poleX={narrow ? 0.22 : 0.62} className="absolute inset-0" />
        {/* Voile de lecture : fort à gauche (texte), nul à droite (l'eau). */}
        <div aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,#0b0f18_0%,rgba(11,15,24,0.82)_34%,rgba(11,15,24,0.15)_62%,transparent_80%)] max-md:bg-[linear-gradient(0deg,#0b0f18_0%,rgba(11,15,24,0.88)_34%,rgba(11,15,24,0.25)_55%,transparent_70%)]" />
      </div>

      {/* Bandeau */}
      {/* Sur la section papier, le bandeau passe à l'encre (sinon illisible). */}
      <header className={cn(
        "fixed top-0 inset-x-0 z-30 flex items-center justify-between px-5 sm:px-10 lg:px-16 h-16 transition-colors duration-200",
        act === "trace" ? "text-[#1d2433] bg-[#f3eee4]/92" : "text-[#efe9df] bg-[linear-gradient(180deg,#0b0f18_10%,rgba(11,15,24,0.7)_60%,transparent)]",
      )}>
        <Wordmark className="text-xl" />
        <div className="flex items-center gap-5">
          <Mono className="hidden sm:inline text-[12px] opacity-60" aria-live="off">
            {act === "time" ? `${String(minutes).padStart(2, "0")}:00` : act === "pause" ? "pause" : ""}
          </Mono>
          <button type="button" onClick={signIn} className="text-sm opacity-85 hover:opacity-100 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#f2a65a] rounded-[2px]">
            Se connecter
          </button>
        </div>
      </header>

      <main className="relative z-10">
        {/* 0 · Hero */}
        <Scene act="hero" onAct={onAct} className="min-h-[100svh]">
          <Panel>
            <h1 className="font-display font-light text-[clamp(2.6rem,6.4vw,5.2rem)] leading-[0.98] tracking-[-0.02em]">
              Travaille pendant que la ville veille.
            </h1>
            <P className="mt-8">
              FocusFlow met dans le même écran un minuteur Pomodoro et une vidéo filmée la nuit, à Tokyo, Séoul ou Osaka.
              Tu lances vingt-cinq minutes. Quand l&apos;eau atteint le trait, c&apos;est la pause.
            </P>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Cta onClick={signIn}>Commencer</Cta>
              <span className="text-sm text-[#efe9df]/60">Gratuit. Connexion Google pour retrouver tes sessions partout.</span>
            </div>
          </Panel>
          <p className="absolute bottom-6 right-5 sm:right-10 z-10 hidden md:block text-[13px] text-[#efe9df]/55">
            Clique l&apos;eau.
          </p>
        </Scene>

        {/* 1 · La ville colore la rive */}
        <Scene act="city" onAct={onAct}>
          <Panel className="max-w-2xl">
            <H2>Choisis la ville qui travaille avec toi.</H2>
            <P>
              Une cinquantaine de vidéos tournées la nuit ou à l&apos;aube : Shibuya sous la pluie, Osaka à minuit, un train vers le
              Fuji. La lumière de la vidéo devient celle de la rive.
            </P>
            <ul className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5" aria-label="Quelques vidéos du catalogue">
              {CITIES.map((v) => {
                const on = v.id === city.id;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => pickCity(v)}
                      onPointerEnter={() => setCity(v)}
                      aria-pressed={on}
                      className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#f2a65a] rounded-[4px]"
                    >
                      <span className="block aspect-video overflow-hidden rounded-[4px] bg-[#05080d]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb(v.youtubeId)} alt="" loading="lazy" className="w-full h-full object-cover brightness-[0.85] group-hover:brightness-100 transition-[filter]" />
                      </span>
                      <span className="block h-[2px] mt-0" style={{ background: on ? "#f2a65a" : getVideoColor(v) }} />
                      <span className="block mt-2 text-[13px] leading-snug text-[#efe9df]/85 line-clamp-2">{cleanTitle(v.title)}</span>
                      <span className="block font-mono text-[11px] text-[#efe9df]/50 mt-0.5">{v.country}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </Scene>

        {/* 2 · Vingt-cinq minutes */}
        <div ref={timeRef}>
          <Scene act="time" onAct={onAct} tall>
            <div className="sticky top-0 min-h-[100svh] flex items-end md:items-center">
              <Panel>
                <Mono className="block text-[clamp(4rem,12vw,9rem)] font-light leading-none tracking-tight text-[#efe9df]">
                  {String(minutes).padStart(2, "0")}:00
                </Mono>
                <H2>Vingt-cinq minutes, une graduation par minute.</H2>
                <P>
                  Le minuteur se lit en chiffres. L&apos;eau se lit du coin de l&apos;œil : quand elle approche du trait, tu sais
                  où tu en es sans lever la tête. Classique, Deep Work à cinquante minutes, ou tes propres durées.
                </P>
              </Panel>
            </div>
          </Scene>
        </div>

        {/* 3 · La distraction */}
        <Scene act="stone" onAct={onAct}>
          <Panel>
            <H2>Tu as regardé ton téléphone. Appuie sur D.</H2>
            <P>
              Rien n&apos;est détecté à ta place. Tu marques, l&apos;eau se trouble un instant, la session s&apos;en souvient.
              Moins de cailloux, meilleur score de focus en fin de session.
            </P>
            <div className="mt-8 flex items-center gap-5">
              <button
                type="button"
                onClick={throwStone}
                className="ff-press inline-flex items-center gap-3 h-11 pl-2 pr-4 whitespace-nowrap rounded-[6px] border border-[#efe9df]/35 hover:border-[#efe9df]/70 text-sm focus-visible:outline-2 focus-visible:outline-[#f2a65a]"
              >
                <kbd className="font-mono text-[13px] w-7 h-7 inline-flex items-center justify-center rounded-[4px] bg-[#efe9df] text-[#0b0f18]">D</kbd>
                Marquer une distraction
              </button>
              <Mono className="text-sm text-[#efe9df]/70" aria-live="polite">
                {stones === 0 ? "0 distraction" : `${stones} distraction${stones > 1 ? "s" : ""}`}
              </Mono>
            </div>
          </Panel>
        </Scene>

        {/* 4 · Le trait atteint : pause */}
        <Scene act="pause" onAct={onAct}>
          <Panel>
            <H2>Le trait est atteint. La vidéo s&apos;arrête.</H2>
            <P>
              Cinq minutes de pause, une longue toutes les quatre sessions. Si tu veux, l&apos;eau respire avec toi : elle monte
              quatre secondes, tient, redescend, tient.
            </P>
            <p className="mt-8 h-8 font-display text-2xl text-[#f2a65a]" aria-live="polite">{act === "pause" && !reduce ? breath ?? "" : ""}</p>
          </Panel>
        </Scene>

        {/* 5 · Flowtime */}
        <Scene act="flow" onAct={onAct}>
          <Panel>
            <H2>Certains soirs, vingt-cinq minutes ne suffisent pas.</H2>
            <P>
              Le mode Flowtime enlève le trait. L&apos;eau monte tant que tu tiens. Quand tu t&apos;arrêtes, ta pause vaut un
              cinquième du temps passé : une heure de travail, douze minutes de repos.
            </P>
          </Panel>
        </Scene>

        {/* 6 · La file qui se prolonge */}
        <Scene act="queue" onAct={onAct}>
          <Panel className="max-w-2xl">
            <H2>Ta musique, pas la playlist d&apos;un inconnu.</H2>
            <ul className="mt-8 flex flex-col border-t border-[#efe9df]/15">
              {[
                ["#ff4e45", "Playlists et mix YouTube", "Colle un lien, la playlist se joue dans l'ordre, titre exact affiché."],
                ["#efe9df", "File d'attente", "Tes titres, dans ton ordre. Quand elle se termine avant la session, elle se prolonge avec des titres proches de toute la file."],
                ["#1db954", "Spotify", "Tes playlists, avec un compte Premium, dans le même lecteur."],
                ["#9146ff", "Twitch", "Un live ou une rediffusion en fond, le minuteur par-dessus."],
              ].map(([c, t, d]) => (
                <li key={t} className="flex gap-4 py-4 border-b border-[#efe9df]/15" onPointerEnter={() => water.current?.drop(undefined, undefined, 0.6)}>
                  <span aria-hidden className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                  <span>
                    <span className="block text-[16px] text-[#efe9df]">{t}</span>
                    <span className="block text-sm text-[#efe9df]/65 mt-1 leading-relaxed">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Scene>

        {/* 7 · Le relevé (papier) */}
        <Scene act="trace" onAct={onAct} className="bg-[#f3eee4] text-[#1d2433] min-h-0 py-28 md:py-36 items-start">
          <Trace />
        </Scene>

        {/* 8 · Les amis */}
        <Scene act="friends" onAct={onAct}>
          <Panel>
            <H2>Quand un ami lance une session, une goutte tombe au loin.</H2>
            <P>
              Ajoute des amis avec un code. Tu vois qui est en focus en ce moment et le temps de chacun sur la semaine.
              Jamais tes tâches ni ton journal.
            </P>
          </Panel>
        </Scene>

        {/* Fin */}
        <Scene act="end" onAct={onAct} className="min-h-[90svh]">
          <Panel>
            <p className="font-display font-light text-[clamp(2.4rem,6vw,4.6rem)] leading-[1] tracking-[-0.02em]">
              La ville est déjà allumée.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Cta onClick={signIn}>Commencer</Cta>
              <span className="text-sm text-[#efe9df]/60">Gratuit, sans publicité, code ouvert.</span>
            </div>
          </Panel>
        </Scene>
      </main>

      <footer className="relative z-10 bg-[#0b0f18] border-t border-[#efe9df]/10 px-5 sm:px-10 lg:px-16 py-8 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-[#efe9df]/55">
        <Wordmark className="text-base text-[#efe9df]/80" />
        <span>Les vidéos appartiennent à leurs auteurs et se lisent sur YouTube.</span>
        <span>Polices Hahmlet, Azeret Mono, Atkinson Hyperlegible Next (OFL).</span>
      </footer>
    </div>
  );
}

// ── Le relevé : une semaine de focus tracée comme une marée ────────────────

const WEEK = [95, 140, 60, 175, 120, 30, 150, 110, 165, 80, 190, 125, 45, 160];
const DAYS = ["L", "M", "M", "J", "V", "S", "D", "L", "M", "M", "J", "V", "S", "D"];

function Trace() {
  const W = 560, H = 180, goal = 120, max = 200;
  const x = (i: number) => (i / (WEEK.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const d = WEEK.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const total = WEEK.slice(7).reduce((a, b) => a + b, 0);
  return (
    <div className="relative z-10 w-full max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
      <div>
        <h2 className="font-display font-light text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.04] tracking-[-0.015em]">
          Le lendemain, il reste une trace.
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed text-[#1d2433]/80 max-w-[34rem]">
          Chaque pomodoro laisse sa hauteur d&apos;eau. Le jour se relit comme un relevé de marée : ta série, ton heure la plus
          concentrée, ton objectif tenu ou pas. Le lundi, le récap de la semaine se partage en image.
        </p>
        <dl className="mt-8 grid grid-cols-3 gap-6 max-w-md">
          {[
            [`${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")}`, "cette semaine"],
            ["5 j", "de série"],
            ["22 h", "ton heure"],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="sr-only">{l}</dt>
              <dd className="font-mono text-xl sm:text-2xl tabular-nums whitespace-nowrap">{v}</dd>
              <dd className="text-[13px] text-[#1d2433]/65 mt-1">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figure className="min-w-0">
        <svg viewBox={`-28 -10 ${W + 40} ${H + 40}`} className="w-full h-auto" role="img" aria-label="Minutes de focus sur deux semaines, avec la ligne d'objectif à deux heures">
          {[0, 60, 120, 180].map((v) => (
            <g key={v}>
              <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="#1d2433" strokeOpacity={0.12} />
              <text x={-8} y={y(v) + 4} textAnchor="end" className="font-mono" fontSize={10} fill="#1d2433" fillOpacity={0.6}>{v / 60} h</text>
            </g>
          ))}
          <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="#b4561c" strokeWidth={1.25} strokeDasharray="4 4" />
          <path d={`${d} L${W},${H} L0,${H} Z`} fill="#2d4a66" fillOpacity={0.14} />
          <path d={d} fill="none" stroke="#1d2433" strokeWidth={1.6} strokeLinejoin="round" />
          {WEEK.map((v, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r={v >= goal ? 3.2 : 2.2} fill={v >= goal ? "#b4561c" : "#1d2433"} />
              <text x={x(i)} y={H + 18} textAnchor="middle" className="font-mono" fontSize={10} fill="#1d2433" fillOpacity={0.6}>{DAYS[i]}</text>
            </g>
          ))}
        </svg>
        <figcaption className="mt-3 text-[13px] text-[#1d2433]/65">Deux semaines de relevé. Les points orange ont tenu l&apos;objectif de deux heures.</figcaption>
      </figure>
    </div>
  );
}
