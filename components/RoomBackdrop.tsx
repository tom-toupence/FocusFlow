"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

// FOND du landing : la vue « study with me » — on est assis à un bureau devant
// une baie vitrée, et **la nuit tombe pendant qu'on descend la page**.
//
// ── L'idée ──────────────────────────────────────────────────────────────────
// La photo est prise à l'heure bleue. Le scroll fait passer la scène du coucher
// de soleil à la nuit noire : le ciel se refroidit, les lumières de la ville
// s'embrasent, la lampe du bureau s'allume. Un pomodoro, c'est du temps qui
// passe — c'est le scroll qui le fait passer.
//
// ── Pourquoi ce n'est PAS de la 3D ─────────────────────────────────────────
// Une pièce à contre-jour se lit à la SILHOUETTE, pas au volume : des primitives
// 3D en perspective donnent une bouillie de rectangles sombres (essais
// précédents). Donc photo + tracés 2D nets, et zéro three.js sur la landing.
//
// Perf : une image (servie en AVIF/WebP par l'optimiseur Next, cache edge
// Vercel), sa copie floutée pour le bloom, des dégradés CSS et un SVG. Toutes
// les animations sont des `opacity`/`transform` composés par le GPU.

const PHOTO = "/pexels-ethan-brooke-1123775-3142005.jpg";

// Noir de silhouette : jamais du #000 pur (ça « troue » l'écran), toujours une
// nuit très légèrement bleutée.
const INK = "#05060c";

export default function RoomBackdrop() {
  const reduce = useReducedMotion();

  // Parallaxe au pointeur : quelques pixels, en sens inverse entre le fond et le
  // premier plan. C'est ce décalage qui donne la profondeur.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 40, damping: 18, mass: 0.7 });
  const sy = useSpring(py, { stiffness: 40, damping: 18, mass: 0.7 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reduce]);

  // « Il se fait tard » : 0 = coucher de soleil, 1 = nuit noire. Étalé sur le
  // premier écran et demi, pour que la bascule soit sensible dès le hero.
  const { scrollY } = useScroll();
  const night = useTransform(scrollY, [0, 1100], [0, 1], { clamp: true });

  // Cadrage : léger panoramique vers le bas (on suit la ville qui s'allume).
  const panY = useTransform(night, [0, 1], ["-2.5%", "3.5%"]);
  const zoom = useTransform(night, [0, 1], [1.03, 1.12]);
  const photoX = useTransform(sx, (v) => v * 20);
  const photoY = useTransform(sy, (v) => v * 12);
  const roomX = useTransform(sx, (v) => v * -7);
  const roomY = useTransform(sy, (v) => v * -4);

  // Les trois couches qui font la nuit.
  const dusk = useTransform(night, [0, 0.85], [1, 0]); // chaleur du couchant
  const dark = useTransform(night, [0, 1], [0.12, 0.72]); // bleu nuit
  const bloom = useTransform(night, [0.1, 1], [0, 0.62]); // embrasement des fenêtres
  const lamp = useTransform(night, [0.25, 0.9], [0, 1]); // la lampe s'allume

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: INK }}>
      {/* ── La ville ─────────────────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-[-8%]"
        style={reduce ? undefined : { x: photoX, y: photoY, translateY: panY, scale: zoom }}
      >
        <Image src={PHOTO} alt="" fill priority sizes="100vw" className="object-cover object-[52%_38%]" />
      </motion.div>

      {/* Embrasement : la MÊME image, floutée et sur-exposée, en fusion `screen`.
          Seuls les points déjà lumineux ressortent → les fenêtres et les phares
          s'allument sans qu'on ait à les placer un par un. */}
      <motion.div
        className="absolute inset-[-8%] mix-blend-screen"
        style={reduce ? { opacity: 0.4 } : { opacity: bloom, x: photoX, y: photoY, translateY: panY, scale: zoom }}
      >
        <Image
          src={PHOTO}
          alt=""
          fill
          sizes="30vw"
          className="object-cover object-[52%_38%]"
          style={{ filter: "blur(22px) brightness(1.5) saturate(1.35)" }}
        />
      </motion.div>

      {/* Étalonnage : le couchant s'efface, le bleu nuit monte. */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: reduce ? 0.25 : dusk,
          background:
            "linear-gradient(to bottom, rgba(255,150,60,0.16) 0%, rgba(255,120,50,0.10) 34%, rgba(80,60,120,0.06) 62%, transparent 100%)",
        }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: reduce ? 0.55 : dark,
          background:
            "linear-gradient(to bottom, rgba(4,7,24,0.95) 0%, rgba(5,8,26,0.55) 40%, rgba(6,9,26,0.35) 70%, rgba(10,7,18,0.55) 100%)",
        }}
      />

      {/* Reflet oblique sur le verre */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{ background: "linear-gradient(104deg, transparent 40%, #cfe0ff 48%, transparent 56%)" }}
      />

      {/* ── La pièce, en contre-jour ─────────────────────────────────────── */}
      <motion.div className="absolute inset-0" style={reduce ? undefined : { x: roomX, y: roomY }}>
        <WindowFrame />
        <Desk lamp={reduce ? undefined : lamp} />
      </motion.div>

      {/* Vignette + voile de lisibilité côté texte (le titre est à gauche). */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 92% 78% at 55% 42%, transparent 42%, rgba(3,4,9,0.66) 100%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(100deg, rgba(3,4,9,0.92) 0%, rgba(3,4,9,0.62) 30%, rgba(3,4,9,0.12) 58%, transparent 76%)" }}
      />
    </div>
  );
}

// ── Menuiserie ──────────────────────────────────────────────────────────────
// Des barres CSS (et non un SVG étiré) : épaisseur constante et arêtes nettes à
// toute taille d'écran. Volontairement FINE — la photo doit respirer, c'est elle
// le spectacle ; le châssis ne fait que dire « tu es à l'intérieur ».
function WindowFrame() {
  const bar = "absolute";
  const rim = "after:absolute after:bg-white/[0.06]";
  const style = { background: INK };
  return (
    <div className="absolute inset-0">
      <div className={`${bar} inset-x-0 top-0 h-[3vh] ${rim} after:inset-x-0 after:bottom-0 after:h-px`} style={style} />
      <div className={`${bar} inset-y-0 left-0 w-[2.6vw] ${rim} after:inset-y-0 after:right-0 after:w-px`} style={style} />
      <div className={`${bar} inset-y-0 right-0 w-[2.6vw] ${rim} after:inset-y-0 after:left-0 after:w-px`} style={style} />
      {/* meneau vertical, décentré côté droit pour ne pas couper le titre */}
      <div className={`${bar} inset-y-0 left-[62%] w-[0.5vw] min-w-[5px] ${rim} after:inset-y-0 after:left-0 after:w-px`} style={style} />
      {/* traverse haute */}
      <div className={`${bar} inset-x-0 top-[30%] h-[0.6vh] min-h-[5px] ${rim} after:inset-x-0 after:bottom-0 after:h-px`} style={style} />
    </div>
  );
}

// ── Le bureau ───────────────────────────────────────────────────────────────
// Ancré en bas à droite (le texte occupe la gauche). Trois objets seulement —
// laptop, tasse, lampe — car une silhouette lisible vaut mieux qu'un décor
// encombré. Les liserés chauds sur les arêtes hautes, c'est la lampe hors champ.
function Desk({ lamp }: { lamp?: ReturnType<typeof useTransform<number, number>> }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[34vh]">
      {/* Halo de la lampe : il apparaît quand la nuit tombe. */}
      <motion.div
        className="absolute right-[4%] bottom-[6%] w-[46vw] max-w-[620px] aspect-square anim-lamp"
        style={{
          opacity: lamp ?? 0.55,
          background: "radial-gradient(circle, rgba(255,168,80,0.34) 0%, rgba(255,142,60,0.12) 40%, transparent 72%)",
        }}
      />

      {/* Objets posés sur le plan (aspect préservé) */}
      <svg
        className="absolute bottom-[10vh] right-[3vw] h-[19vh] w-auto"
        viewBox="0 0 760 220"
        preserveAspectRatio="xMaxYMax meet"
        aria-hidden
      >
        <defs>
          <linearGradient id="screenSpill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9dbcff" stopOpacity="0.42" />
            <stop offset="1" stopColor="#9dbcff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Débord lumineux de l'écran, derrière le capot */}
        <ellipse cx="196" cy="196" rx="168" ry="40" fill="url(#screenSpill)" />

        {/* Laptop vu de dos, ouvert vers la fenêtre */}
        <path d="M96 200l20-118a10 10 0 0 1 10-8h140a10 10 0 0 1 10 8l20 118z" fill={INK} />
        <path d="M126 74a10 10 0 0 1 10-8h140a10 10 0 0 1 10 8" stroke="rgba(190,215,255,0.34)" strokeWidth="2.5" fill="none" />
        <path d="M74 200h260l14 14H60z" fill={INK} />
        <path d="M74 200h260" stroke="rgba(255,215,170,0.16)" strokeWidth="1.5" />

        {/* Tasse fumante */}
        <path d="M436 206v-44h56v44z" fill={INK} />
        <ellipse cx="464" cy="162" rx="28" ry="7" fill={INK} stroke="rgba(255,200,150,0.26)" strokeWidth="1.5" />
        <path d="M492 172c15 0 15 22 0 22" stroke={INK} strokeWidth="9" fill="none" />
        <path d="M456 152c-6-14 10-18 4-32" stroke="rgba(255,224,186,0.20)" strokeWidth="2.5" fill="none" className="anim-steam" />

        {/* Lampe d'architecte, source du halo */}
        <path d="M636 206v-92h18v92z" fill={INK} />
        <path d="M598 206h94" stroke={INK} strokeWidth="15" strokeLinecap="round" />
        <path d="M646 114c0-30 26-52 58-52l-16 60z" fill={INK} />
        <path d="M646 114c0-30 26-52 58-52" stroke="rgba(255,190,120,0.5)" strokeWidth="2.5" fill="none" />
      </svg>

      {/* Plan de travail : une bande nette, avec l'arête qui capte la lumière. */}
      <div className="absolute inset-x-0 bottom-0 h-[10vh]" style={{ background: INK }}>
        <div className="absolute inset-x-0 top-0 h-px bg-[rgba(255,200,150,0.18)]" />
      </div>
    </div>
  );
}
