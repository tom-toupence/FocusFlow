"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

// SCÈNE du hero : une fenêtre ouverte sur la ville, et devant elle, sur un plan
// de bureau, un laptop qui fait tourner la VRAIE interface de session.
//
// ── Parti pris ──────────────────────────────────────────────────────────────
// Les tentatives précédentes mélangeaient une photo réaliste et des silhouettes
// vectorielles à plat : ça ne tient pas ensemble (échelles et perspectives
// incohérentes → effet bricolé). Ici, plus aucun dessin approximatif :
//   • la photo est affichée à son format EXACT (4:5) dans un châssis de fenêtre,
//     donc entière, jamais recadrée ;
//   • le laptop est construit en CSS 3D avec des MATIÈRES (dégradés, liserés,
//     reflet de dalle, ombre de contact), pas au trait ;
//   • son écran affiche le composant de session réel — c'est le produit qui fait
//     la démonstration, pas une illustration.
//
// ── Chorégraphie ────────────────────────────────────────────────────────────
// Le scroll fait TOMBER LA NUIT dans la fenêtre : le couchant s'efface, les
// lumières de la ville s'embrasent (copie floutée de l'image en fusion `screen`,
// donc seuls les points déjà lumineux montent), et l'écran du laptop devient la
// principale source de lumière de la scène.
//
// Perf : une seule image (optimisée par `next/image` → AVIF/WebP, cache edge
// Vercel), des dégradés CSS, aucune 3D WebGL. Tout est `transform`/`opacity`.

const PHOTO = "/pexels-ethan-brooke-1123775-3142005.jpg";

export default function HeroStage({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Parallaxe au pointeur, à l'échelle de la scène : la fenêtre et le laptop ne
  // bougent pas de la même quantité, c'est ce qui crée la profondeur.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 45, damping: 20, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 45, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width - 0.5);
      py.set((e.clientY - r.top) / r.height - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reduce]);

  // « Il se fait tard » : 0 = couchant, 1 = nuit noire.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const night = useTransform(scrollYProgress, [0, 0.75], [0, 1]);
  const dusk = useTransform(night, [0, 0.8], [1, 0]);
  const dark = useTransform(night, [0, 1], [0.1, 0.62]);
  const bloom = useTransform(night, [0.05, 1], [0.05, 0.7]);
  const spill = useTransform(night, [0, 1], [0.4, 0.75]);

  const winX = useTransform(sx, (v) => v * -16);
  const winY = useTransform(sy, (v) => v * -10);
  const tilt = useTransform(sx, (v) => v * 4);
  const deskX = useTransform(sx, (v) => v * 26);

  return (
    <div ref={ref} className="relative w-full flex justify-center lg:justify-end">
      {/* Débord de lumière : la même image, très floutée et agrandie derrière le
          châssis — c'est elle qui teinte le fond de page comme le ferait une
          vraie fenêtre allumée dans une pièce sombre. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-x-24 -inset-y-16 -z-10 overflow-hidden"
        style={{ opacity: reduce ? 0.5 : spill }}
      >
        <Image
          src={PHOTO}
          alt=""
          fill
          sizes="20vw"
          className="object-cover scale-125"
          style={{ filter: "blur(72px) saturate(1.5)" }}
        />
      </motion.div>

      <motion.div
        className="relative"
        style={reduce ? undefined : { x: winX, y: winY, rotateY: tilt, transformPerspective: 1600 }}
      >
        {/* ── La fenêtre ─────────────────────────────────────────────────── */}
        {/* Le châssis épouse le format EXACT de la photo (4:5) : l'image est
            donc affichée en entier, jamais rognée. */}
        <div className="relative w-[min(78vw,420px)] lg:w-[min(38vw,460px)] aspect-[4/5] rounded-[20px] p-[10px] bg-gradient-to-b from-[#1b1f28] to-[#0c0e14] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.07]">
          {/* liseré intérieur : le bois du châssis attrape la lumière de la ville */}
          <div className="relative h-full w-full overflow-hidden rounded-[12px] ring-1 ring-white/[0.10]">
            <Image src={PHOTO} alt="Vue sur la ville depuis la fenêtre, à la tombée de la nuit" fill priority sizes="(max-width: 1024px) 78vw, 460px" className="object-cover" />

            {/* Embrasement des lumières (fusion `screen` : seuls les points déjà
                clairs montent, donc les fenêtres s'allument d'elles-mêmes) */}
            <motion.div className="absolute inset-0 mix-blend-screen" style={{ opacity: reduce ? 0.4 : bloom }}>
              <Image src={PHOTO} alt="" fill sizes="20vw" className="object-cover" style={{ filter: "blur(18px) brightness(1.45) saturate(1.3)" }} />
            </motion.div>

            {/* Étalonnage : le couchant s'efface, le bleu nuit monte */}
            <motion.div
              className="absolute inset-0"
              style={{
                opacity: reduce ? 0.3 : dusk,
                background: "linear-gradient(to bottom, rgba(255,146,52,0.20) 0%, rgba(255,120,50,0.10) 38%, transparent 70%)",
              }}
            />
            <motion.div
              className="absolute inset-0"
              style={{
                opacity: reduce ? 0.45 : dark,
                background: "linear-gradient(to bottom, rgba(3,6,22,0.92) 0%, rgba(4,7,24,0.35) 45%, rgba(6,9,26,0.30) 100%)",
              }}
            />

            {/* Croisillons : ils sont DANS la fenêtre, donc ils ont un sens —
                et ils portent un liseré clair sur leur arête éclairée. */}
            <div className="absolute inset-y-0 left-1/2 w-[7px] -translate-x-1/2 bg-[#0a0c12] after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-white/[0.13]" />
            <div className="absolute inset-x-0 top-[38%] h-[7px] bg-[#0a0c12] after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-white/[0.13]" />

            {/* Reflet de vitre */}
            <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(104deg,transparent_42%,#dce9ff_50%,transparent_58%)]" />
            {/* La vitre s'assombrit vers le bas, là où le bureau entre en scène */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#05070d] to-transparent" />
          </div>
        </div>

        {/* ── Le bureau et le laptop ─────────────────────────────────────── */}
        <motion.div
          className="absolute inset-x-0 -bottom-2 flex justify-center"
          style={reduce ? undefined : { x: deskX }}
        >
          <Laptop>{children}</Laptop>
        </motion.div>

        {/* Plan de travail : une surface, pas un trait — dégradé + arête qui
            capte la lumière de l'écran. */}
        <div className="pointer-events-none absolute inset-x-[-14%] -bottom-3 h-24 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,166,92,0.10),transparent_70%)]" />
      </motion.div>
    </div>
  );
}

// ── Laptop en CSS 3D ────────────────────────────────────────────────────────
// Un vrai volume : dalle inclinée, charnière, clavier en fuite, châssis
// métallique et ombre de contact. L'écran reçoit le composant passé en enfant
// (l'interface de session réelle), pas une illustration.
function Laptop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[min(72vw,380px)] lg:w-[min(34vw,400px)]" style={{ perspective: "1200px" }}>
      {/* Ombre de contact au sol */}
      <div className="absolute left-1/2 bottom-0 h-8 w-[85%] -translate-x-1/2 translate-y-4 rounded-[50%] bg-black/70 blur-2xl" />

      <div style={{ transformStyle: "preserve-3d" }}>
        {/* Dalle : châssis + bordure + écran + reflet */}
        <div
          className="relative rounded-t-[12px] rounded-b-[4px] bg-gradient-to-b from-[#2c313c] to-[#171a21] p-[7px] pb-[9px] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.09]"
          style={{ transform: "rotateX(-6deg)", transformOrigin: "bottom center" }}
        >
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[6px] bg-[#07080d] ring-1 ring-black/60">
            {children}
            {/* Reflet oblique de la dalle */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.10)_0%,transparent_38%,transparent_62%,rgba(255,255,255,0.05)_100%)]" />
          </div>
          {/* Encoche caméra */}
          <div className="absolute left-1/2 top-[3px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white/25" />
        </div>

        {/* Clavier en fuite : la perspective fait le volume, le dégradé la matière */}
        <div
          className="relative -mt-[2px] h-[54px] rounded-b-[10px] bg-gradient-to-b from-[#2a2f3a] via-[#1d212a] to-[#0f1218] ring-1 ring-white/[0.07]"
          style={{ transform: "rotateX(74deg)", transformOrigin: "top center" }}
        >
          {/* charnière */}
          <div className="absolute inset-x-6 top-0 h-px bg-white/10" />
          {/* pavé tactile */}
          <div className="absolute left-1/2 top-[18px] h-[22px] w-[34%] -translate-x-1/2 rounded-[4px] bg-[#151922] ring-1 ring-white/[0.05]" />
          {/* encoche d'ouverture */}
          <div className="absolute left-1/2 bottom-[3px] h-[3px] w-[14%] -translate-x-1/2 rounded-full bg-black/50" />
        </div>
      </div>

      {/* Lueur de l'écran qui déborde sur le bureau */}
      <div className="pointer-events-none absolute inset-x-[-20%] -bottom-6 h-16 bg-[radial-gradient(ellipse_at_center,rgba(150,180,255,0.16),transparent_70%)]" />
    </div>
  );
}
