"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

// FOND du landing : la vue « study with me ». On est assis à un bureau, la nuit
// tombe sur la ville, et on regarde par la fenêtre.
//
// ── Pourquoi ce n'est PAS de la 3D ──────────────────────────────────────────
// Une pièce à contre-jour se lit à la SILHOUETTE, pas au volume : des primitives
// 3D en perspective donnent une bouillie de rectangles sombres (essai précédent),
// alors qu'un tracé 2D net se lit instantanément. Donc : une photo en fond, des
// silhouettes vectorielles au premier plan, et de la parallaxe entre les deux.
// Bénéfice collatéral : plus une ligne de three.js sur la landing.
//
// Perf : 1 image (servie en AVIF/WebP par l'optimiseur Next, mise en cache à
// l'edge Vercel), des dégradés CSS et deux SVG inline. Les seules animations sont
// des `transform`/`opacity` composés par le GPU.

const PHOTO = "/pexels-ethan-brooke-1123775-3142005.jpg";

// Noir de silhouette : jamais du #000 pur (ça « troue » l'écran), toujours une
// nuit très légèrement bleutée.
const INK = "#04050a";

export default function RoomBackdrop() {
  const reduce = useReducedMotion();

  // Parallaxe au pointeur : quelques pixels seulement, en sens inverse entre le
  // fond et le premier plan. C'est ce décalage qui donne la profondeur.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 45, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 45, damping: 18, mass: 0.6 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reduce]);

  // Parallaxe au scroll : la ville monte doucement, la pièce reste en place.
  const { scrollY } = useScroll();
  const cityY = useTransform(scrollY, [0, 1200], [0, 90]);
  const cityScale = useTransform(scrollY, [0, 1200], [1.04, 1.12]);

  const photoX = useTransform(sx, (v) => v * 22);
  const photoY = useTransform(sy, (v) => v * 14);
  const roomX = useTransform(sx, (v) => v * -8);
  const roomY = useTransform(sy, (v) => v * -5);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: INK }}>
      {/* ── La ville, vue par la fenêtre ─────────────────────────────────── */}
      <motion.div
        className="absolute inset-[-6%]"
        style={reduce ? undefined : { x: photoX, y: photoY, translateY: cityY, scale: cityScale }}
      >
        <Image
          src={PHOTO}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[52%_42%]"
        />
      </motion.div>

      {/* Traitement « vitre » : la nuit refroidit l'image, le bas garde la chaleur
          des lumières de la rue, et une brume légère éloigne le fond. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(6,9,26,0.72) 0%, rgba(8,11,28,0.34) 34%, rgba(10,8,20,0.18) 62%, rgba(26,14,8,0.30) 100%)",
        }}
      />
      {/* Reflet oblique sur le verre */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{ background: "linear-gradient(104deg, transparent 38%, #cfe0ff 47%, transparent 56%)" }}
      />

      {/* ── La pièce, en contre-jour ─────────────────────────────────────── */}
      <motion.div className="absolute inset-0" style={reduce ? undefined : { x: roomX, y: roomY }}>
        <WindowFrame />
        <Curtain />
        <Desk />
      </motion.div>

      {/* Halo chaud de la lampe de bureau (à droite, au-dessus du plan) */}
      <div
        className="absolute right-[6%] bottom-[16%] w-[42vw] max-w-[560px] aspect-square anim-lamp"
        style={{
          background: "radial-gradient(circle, rgba(255,164,72,0.28) 0%, rgba(255,140,60,0.10) 38%, transparent 70%)",
        }}
      />

      {/* Vignette + voile de lisibilité côté texte */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 90% 75% at 50% 45%, transparent 40%, rgba(3,4,9,0.72) 100%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(100deg, rgba(3,4,9,0.94) 0%, rgba(3,4,9,0.72) 32%, rgba(3,4,9,0.15) 62%, transparent 80%)" }}
      />
    </div>
  );
}

// ── Menuiserie de la fenêtre ────────────────────────────────────────────────
// Des barres CSS (et non un SVG étiré) : elles restent parfaitement nettes et
// d'épaisseur constante quelle que soit la taille d'écran. Le liseré clair sur
// l'arête intérieure est ce qui fait lire « bois sombre éclairé par la ville »
// plutôt que « rectangle noir ».
function WindowFrame() {
  const bar = "absolute bg-[#04050a]";
  const rim = "after:absolute after:bg-white/[0.07]";
  return (
    <div className="absolute inset-0">
      {/* linteau */}
      <div className={`${bar} inset-x-0 top-0 h-[6vh] ${rim} after:inset-x-0 after:bottom-0 after:h-px`} />
      {/* jambages */}
      <div className={`${bar} inset-y-0 left-0 w-[4.5vw] ${rim} after:inset-y-0 after:right-0 after:w-px`} />
      <div className={`${bar} inset-y-0 right-0 w-[4.5vw] ${rim} after:inset-y-0 after:left-0 after:w-px`} />
      {/* meneau vertical, volontairement décentré */}
      <div className={`${bar} inset-y-0 left-[57%] w-[0.9vw] min-w-[7px] ${rim} after:inset-y-0 after:left-0 after:w-px`} />
      {/* traverse haute */}
      <div className={`${bar} inset-x-0 top-[34%] h-[1vh] min-h-[7px] ${rim} after:inset-x-0 after:bottom-0 after:h-px`} />
      {/* allège : le mur sous la fenêtre, sur lequel repose le bureau */}
      <div className={`${bar} inset-x-0 bottom-0 h-[19vh] ${rim} after:inset-x-0 after:top-0 after:h-px`} />
    </div>
  );
}

// ── Rideau ──────────────────────────────────────────────────────────────────
// Un pan de tissu à gauche : il cadre l'image et masque la coupure du montant.
function Curtain() {
  return (
    <svg
      className="absolute inset-y-0 left-0 h-full w-[22vw] max-w-[320px]"
      viewBox="0 0 200 800"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="curtain" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#04050a" />
          <stop offset="0.62" stopColor="#04050a" />
          <stop offset="1" stopColor="#04050a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 0h150c-6 120 10 190-4 300 12 130-8 240 2 360 4 60-2 100-8 140H0z" fill="url(#curtain)" />
      {/* plis : de fins liserés qui attrapent la lumière de la ville */}
      <path d="M52 0c8 200-10 380 2 560 6 90 0 160-6 240" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
      <path d="M104 0c-6 210 12 400-2 580-4 70 2 150 6 220" stroke="rgba(255,255,255,0.035)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// ── Le bureau ───────────────────────────────────────────────────────────────
// Ancré en bas à droite (le texte du hero occupe la gauche). Tout est en
// silhouette, avec un liseré chaud sur les arêtes hautes : c'est la lampe qui
// vient de la droite, hors champ. Le laptop est vu DE DOS, ouvert vers la
// fenêtre — la position de quelqu'un qui travaille face à la vue.
function Desk() {
  return (
    <svg
      className="absolute bottom-0 right-0 w-[74vw] max-w-[1150px]"
      viewBox="0 0 1150 420"
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fb6ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#8fb6ff" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id="mugSteam" cx="0.5" cy="1" r="0.9">
          <stop offset="0" stopColor="#ffd9a8" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffd9a8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Lueur diffuse de l'écran, qui déborde derrière le capot */}
      <ellipse cx="596" cy="214" rx="190" ry="54" fill="url(#screenGlow)" opacity="0.5" />

      {/* Plan de travail */}
      <path d="M0 260h1150v160H0z" fill={INK} />
      <path d="M0 260h1150" stroke="rgba(255,200,150,0.16)" strokeWidth="2" />

      {/* Laptop vu de dos, capot légèrement incliné vers la fenêtre */}
      <path d="M470 262l22-118a10 10 0 0 1 10-8h190a10 10 0 0 1 10 8l22 118z" fill={INK} />
      <path d="M492 144a10 10 0 0 1 10-8h190a10 10 0 0 1 10 8" stroke="rgba(190,215,255,0.30)" strokeWidth="2.5" fill="none" />
      <path d="M446 262h258l14 16H432z" fill={INK} />
      <path d="M446 262h258" stroke="rgba(255,215,170,0.14)" strokeWidth="1.5" />

      {/* Tasse fumante */}
      <path d="M846 268v-46h58v46z" fill={INK} />
      <ellipse cx="875" cy="222" rx="29" ry="7" fill={INK} />
      <ellipse cx="875" cy="222" rx="29" ry="7" fill="none" stroke="rgba(255,200,150,0.22)" strokeWidth="1.5" />
      <path d="M904 232c16 0 16 22 0 22" stroke={INK} strokeWidth="9" fill="none" />
      <path d="M866 214c-6-14 10-18 4-32" stroke="rgba(255,220,180,0.16)" strokeWidth="2.5" fill="none" className="anim-steam" />
      <ellipse cx="875" cy="196" rx="42" ry="34" fill="url(#mugSteam)" />

      {/* Casque posé à plat */}
      <path d="M232 268c0-34 26-58 60-58s60 24 60 58" stroke={INK} strokeWidth="13" fill="none" />
      <path d="M232 268c0-34 26-58 60-58s60 24 60 58" stroke="rgba(255,210,170,0.13)" strokeWidth="2" fill="none" />
      <rect x="216" y="252" width="30" height="24" rx="10" fill={INK} />
      <rect x="338" y="252" width="30" height="24" rx="10" fill={INK} />

      {/* Petite plante */}
      <path d="M104 268v-40h52v40z" fill={INK} />
      <path d="M130 228c-30-6-40-40-22-62 22 4 34 34 22 62z" fill={INK} />
      <path d="M130 228c26-12 30-48 10-66-20 10-24 42-10 66z" fill={INK} />
      <path d="M130 228c-30-6-40-40-22-62" stroke="rgba(180,230,200,0.14)" strokeWidth="2" fill="none" />

      {/* Pied de lampe, à l'extrême droite : le halo chaud vient de là */}
      <path d="M1044 268v-96h20v96z" fill={INK} />
      <path d="M1002 268h104" stroke={INK} strokeWidth="16" strokeLinecap="round" />
      <path d="M1054 172c0-30 26-52 58-52l-16 62z" fill={INK} />
      <path d="M1054 172c0-30 26-52 58-52" stroke="rgba(255,190,120,0.45)" strokeWidth="2.5" fill="none" />
    </svg>
  );
}
