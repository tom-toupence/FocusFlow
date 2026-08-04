"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

// SCÈNE du landing, en PLEIN ÉCRAN : une pièce sombre, une baie vitrée sur la
// ville, un bureau, et un laptop qui fait tourner la vraie interface de session.
//
// ── Ce qui fait qu'une pièce se lit ────────────────────────────────────────
// Pas des contours dessinés (les essais précédents en silhouettes vectorielles
// donnaient un rendu bricolé), mais de la LUMIÈRE et des ÉPAISSEURS :
//   • une EMBRASURE (l'épaisseur du mur autour de la vitre), dont la joue
//     intérieure est éclairée — c'est elle qui dit « fenêtre percée dans un mur »
//     plutôt que « image collée » ;
//   • un APPUI de fenêtre avec son arête éclairée ;
//   • la TACHE DE LUMIÈRE que la fenêtre projette en biais sur le bureau —
//     le détail qui ancre tout le décor dans une pièce réelle ;
//   • un mur qui reçoit ce même halo, en dégradé.
// La photo garde son format exact (4:5) : elle est affichée ENTIÈRE, jamais
// recadrée, et la baie monte du plafond au bureau comme une vraie fenêtre.
//
// ── Chorégraphie ───────────────────────────────────────────────────────────
// Le scroll fait tomber la nuit : le couchant s'efface, les lumières de la ville
// s'embrasent (copie floutée en fusion `screen` → seuls les points déjà clairs
// montent), la tache de lumière s'éteint et l'écran du laptop devient la
// principale source lumineuse de la pièce.
//
// Perf : une image (optimisée par `next/image` → AVIF/WebP, cache edge Vercel),
// des dégradés CSS, zéro WebGL. Uniquement `transform`/`opacity`.

const PHOTO = "/pexels-ethan-brooke-1123775-3142005.jpg";

export default function HeroStage({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  // Parallaxe au pointeur : quelques pixels, la vue bouge plus que la pièce.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 40, damping: 20, mass: 0.7 });
  const sy = useSpring(py, { stiffness: 40, damping: 20, mass: 0.7 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reduce]);

  // « Il se fait tard » : 0 = couchant, 1 = nuit noire.
  const { scrollY } = useScroll();
  const night = useTransform(scrollY, [0, 900], [0, 1], { clamp: true });
  const dusk = useTransform(night, [0, 0.8], [1, 0]);
  const dark = useTransform(night, [0, 1], [0.08, 0.6]);
  const bloom = useTransform(night, [0.05, 1], [0.05, 0.72]);
  const daylight = useTransform(night, [0, 0.7], [1, 0]); // tache de lumière au sol
  const lampLight = useTransform(night, [0.2, 0.9], [0.25, 1]); // relais de l'écran
  // La scène s'efface quand on entre dans le contenu (mais ne disparaît jamais).
  const stage = useTransform(scrollY, [0, 700], [1, 0.5], { clamp: true });

  const viewX = useTransform(sx, (v) => v * -18);
  const viewY = useTransform(sy, (v) => v * -12);
  const roomX = useTransform(sx, (v) => v * 8);

  return (
    <motion.div className="absolute inset-0 overflow-hidden bg-[#07080e]" style={reduce ? undefined : { opacity: stage }}>
      {/* ── Le mur ────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#0b0c14_0%,#08090f_45%,#050609_100%)]" />
      {/* Halo de la fenêtre sur le mur : c'est la seule source de jour. */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: reduce ? 0.5 : daylight,
          background: "radial-gradient(62% 58% at 74% 42%, rgba(148,168,225,0.16) 0%, rgba(90,110,170,0.06) 45%, transparent 72%)",
        }}
      />

      {/* ── La baie vitrée ────────────────────────────────────────────────── */}
      {/* Hauteur du plafond au bureau, largeur déduite du format EXACT de la
          photo (4:5) : l'image est donc entière. */}
      <motion.div
        className="absolute top-[7vh] h-[64vh] w-[calc(64vh*0.8)] right-[6vw] lg:right-[9vw]"
        style={reduce ? undefined : { x: roomX }}
      >
        {/* Embrasement : l'épaisseur du mur. La joue de gauche prend la lumière,
            celle de droite reste dans l'ombre → le percement se lit. */}
        <div className="absolute -inset-[14px] rounded-[6px] bg-[linear-gradient(100deg,#1a1d27_0%,#101320_38%,#0a0c14_100%)] shadow-[0_50px_140px_-40px_rgba(0,0,0,0.95)]" />
        <div className="absolute -inset-[14px] rounded-[6px] ring-1 ring-white/[0.05]" />

        <motion.div className="relative h-full w-full overflow-hidden" style={reduce ? undefined : { x: viewX, y: viewY }}>
          <Image
            src={PHOTO}
            alt="Vue sur la ville depuis la fenêtre, à la tombée de la nuit"
            fill
            priority
            sizes="(max-width: 1024px) 60vw, 45vh"
            className="object-cover"
          />

          {/* Embrasement des lumières de la ville */}
          <motion.div className="absolute inset-0 mix-blend-screen" style={{ opacity: reduce ? 0.4 : bloom }}>
            <Image src={PHOTO} alt="" fill sizes="20vw" className="object-cover" style={{ filter: "blur(16px) brightness(1.45) saturate(1.3)" }} />
          </motion.div>

          {/* Étalonnage jour → nuit */}
          <motion.div
            className="absolute inset-0"
            style={{
              opacity: reduce ? 0.3 : dusk,
              background: "linear-gradient(to bottom, rgba(255,146,52,0.18) 0%, rgba(255,120,50,0.08) 38%, transparent 70%)",
            }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              opacity: reduce ? 0.45 : dark,
              background: "linear-gradient(to bottom, rgba(3,6,22,0.92) 0%, rgba(4,7,24,0.30) 45%, rgba(6,9,26,0.28) 100%)",
            }}
          />
          {/* Reflet de vitre */}
          <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(104deg,transparent_44%,#dce9ff_51%,transparent_58%)]" />
        </motion.div>

        {/* Croisillons : dans le plan de la vitre, avec l'arête éclairée */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[8px] -translate-x-1/2 bg-[#0a0c13] after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-white/[0.14]" />
        <div className="pointer-events-none absolute inset-x-0 top-[38%] h-[8px] bg-[#0a0c13] after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-white/[0.14]" />

        {/* Appui de fenêtre : une tablette, avec son arête qui capte le jour */}
        <div className="absolute inset-x-[-26px] top-full h-[18px] rounded-b-[3px] bg-[linear-gradient(to_bottom,#20242f,#0c0e15)]">
          <div className="absolute inset-x-0 top-0 h-px bg-white/[0.16]" />
        </div>
      </motion.div>

      {/* ── Le bureau ─────────────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-[26vh] bg-[linear-gradient(to_bottom,#0c0e15_0%,#070810_55%,#05060b_100%)]">
        <div className="absolute inset-x-0 top-0 h-px bg-white/[0.07]" />
        {/* Tache de lumière projetée par la fenêtre — en biais, comme le veut
            l'incidence. C'est elle qui ancre la scène dans une vraie pièce. */}
        <motion.div
          className="absolute right-[4vw] lg:right-[7vw] top-0 h-full w-[46vw] max-w-[720px] blur-2xl"
          style={{
            opacity: reduce ? 0.5 : daylight,
            transform: "skewX(-26deg)",
            background: "linear-gradient(to bottom, rgba(150,172,230,0.20), rgba(120,140,200,0.05) 60%, transparent 100%)",
          }}
        />
        {/* Nappe chaude de l'écran sur le plan de travail */}
        <motion.div
          className="absolute right-[10vw] top-0 h-full w-[34vw] max-w-[520px] blur-3xl"
          style={{
            opacity: reduce ? 0.5 : lampLight,
            background: "radial-gradient(ellipse at 50% 0%, rgba(140,170,255,0.22), transparent 70%)",
          }}
        />
      </div>

      {/* ── Le laptop, posé sur le bureau ─────────────────────────────────── */}
      {/* Aucun parent en transformation 3D : sinon le navigateur rasterise tout
          le sous-arbre en basse résolution et l'écran devient FLOU. */}
      <div className="absolute bottom-[7vh] right-[6vw] lg:right-[11vw] w-[min(52vw,330px)] lg:w-[min(24vw,360px)]">
        <Laptop>{children}</Laptop>
      </div>
    </motion.div>
  );
}

// ── Laptop ──────────────────────────────────────────────────────────────────
// La dalle reste dans le plan de l'écran (donc NETTE) ; seul le clavier part en
// perspective, et lui n'a aucun texte à rendre. Le volume vient des matières :
// dégradés d'aluminium, liserés, ombre de contact, reflet de dalle.
function Laptop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {/* Ombre de contact au sol */}
      <div className="absolute left-1/2 bottom-[-14px] h-10 w-[92%] -translate-x-1/2 rounded-[50%] bg-black/80 blur-2xl" />

      {/* Écran */}
      <div className="relative rounded-[14px] bg-[linear-gradient(150deg,#3a4150_0%,#22262f_35%,#12151b_100%)] p-[9px] pb-[16px] shadow-[0_26px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.10]">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[7px] bg-[#06070c] ring-1 ring-black/70">
          {children}
          {/* Reflet de dalle : léger, oblique, pour la matière « verre » */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(116deg,rgba(255,255,255,0.09)_0%,transparent_34%,transparent_66%,rgba(255,255,255,0.04)_100%)]" />
        </div>
        {/* Mention sous la dalle + caméra */}
        <div className="absolute left-1/2 top-[3.5px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white/25" />
        <div className="absolute inset-x-0 bottom-[4px] text-center text-[6px] tracking-[0.3em] text-white/20">FOCUSFLOW</div>
      </div>

      {/* Clavier en fuite : la perspective donne le volume, pas un contour */}
      <div className="relative" style={{ perspective: "900px" }}>
        <div
          className="relative -mt-[3px] h-[46px] rounded-b-[12px] bg-[linear-gradient(to_bottom,#333a47_0%,#1f242e_28%,#12151c_75%,#0a0c11_100%)] ring-1 ring-white/[0.06]"
          style={{ transform: "rotateX(72deg)", transformOrigin: "top center" }}
        >
          {/* charnière */}
          <div className="absolute inset-x-8 top-0 h-px bg-white/[0.14]" />
          {/* rangées de touches, suggérées par de fines nervures */}
          <div className="absolute inset-x-[9%] top-[6px] h-[16px] rounded-[2px] bg-[repeating-linear-gradient(to_right,rgba(255,255,255,0.05)_0_5px,transparent_5px_9px)] opacity-70" />
          {/* pavé tactile */}
          <div className="absolute left-1/2 top-[26px] h-[14px] w-[30%] -translate-x-1/2 rounded-[3px] bg-[#171b23] ring-1 ring-white/[0.05]" />
        </div>
        {/* Tranche avant : l'épaisseur du châssis, avec l'encoche d'ouverture */}
        <div className="mx-[3%] h-[5px] rounded-b-[6px] bg-[linear-gradient(to_bottom,#22262f,#0b0d12)] ring-1 ring-white/[0.05]">
          <div className="absolute left-1/2 h-[3px] w-[12%] -translate-x-1/2 rounded-b-full bg-black/60" />
        </div>
      </div>
    </div>
  );
}
