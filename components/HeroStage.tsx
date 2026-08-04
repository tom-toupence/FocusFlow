"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

// SCÈNE du landing, en PLEIN ÉCRAN : une chambre sombre, une baie vitrée sur la
// ville, un bureau avec sa lampe et son encens, et un laptop qui fait tourner la
// vraie interface de session.
//
// ── Ce qui fait qu'une pièce se lit ────────────────────────────────────────
// Pas des contours dessinés (les essais en silhouettes vectorielles donnaient un
// rendu bricolé), mais de la LUMIÈRE, des ÉPAISSEURS et de la PROFONDEUR :
//   • une EMBRASURE autour de la vitre (l'épaisseur du mur), joue gauche
//     éclairée / joue droite dans l'ombre → « fenêtre percée dans un mur » ;
//   • un APPUI de fenêtre dont l'arête capte le jour ;
//   • la TACHE DE LUMIÈRE projetée en biais sur le bureau ;
//   • une LAMPE avec son cône de lumière visible et sa flaque chaude sur le
//     plateau — une lampe qui n'éclaire rien ne convainc personne ;
//   • des VOLUTES D'ENCENS qui montent lentement ;
//   • un PREMIER PLAN FLOU (le dossier du fauteuil) : le flou d'avant-plan est
//     ce qui donne instantanément la profondeur d'une vraie photo.
// La lumière vient de la droite (fenêtre + lampe) : toutes les ombres tombent
// donc à gauche. Cette cohérence est ce qui fait « vrai ».
//
// La photo garde son format exact (4:5) : elle est affichée ENTIÈRE, jamais
// recadrée. La baie ne bouge PAS (aucune parallaxe au pointeur) — dans une pièce
// calme, rien ne suit la souris.
//
// ── Chorégraphie au scroll ─────────────────────────────────────────────────
// La nuit tombe : le couchant s'efface, les lumières de la ville s'embrasent
// (copie floutée en fusion `screen` → seuls les points déjà clairs montent), la
// tache de jour s'éteint, et la lampe + l'écran prennent le relais comme seules
// sources de la pièce.
//
// Perf : une image (optimisée par `next/image` → AVIF/WebP, cache edge Vercel),
// des dégradés CSS, zéro WebGL. Uniquement `transform`/`opacity`.

const PHOTO = "/pexels-ethan-brooke-1123775-3142005.jpg";

export default function HeroStage({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  // « Il se fait tard » : 0 = couchant, 1 = nuit noire.
  const { scrollY } = useScroll();
  const night = useTransform(scrollY, [0, 900], [0, 1], { clamp: true });
  const dusk = useTransform(night, [0, 0.8], [1, 0]);
  const dark = useTransform(night, [0, 1], [0.08, 0.6]);
  const bloom = useTransform(night, [0.05, 1], [0.05, 0.72]);
  const daylight = useTransform(night, [0, 0.7], [1, 0]); // jour entrant
  const lampOn = useTransform(night, [0.1, 0.75], [0.35, 1]); // la lampe prend le relais
  // La scène s'estompe quand on entre dans le contenu, sans jamais disparaître.
  const stage = useTransform(scrollY, [0, 700], [1, 0.5], { clamp: true });

  const still = reduce ? {} : undefined; // la baie reste fixe, par choix

  return (
    <motion.div className="absolute inset-0 overflow-hidden bg-[#07080e]" style={reduce ? undefined : { opacity: stage }}>
      {/* ── Le mur ────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#0b0c14_0%,#08090f_45%,#050609_100%)]" />
      {/* Jour entrant par la fenêtre, qui lave le mur */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: reduce ? 0.5 : daylight,
          background: "radial-gradient(62% 58% at 74% 42%, rgba(148,168,225,0.16) 0%, rgba(90,110,170,0.06) 45%, transparent 72%)",
        }}
      />
      {/* Chaleur de la lampe sur le mur, qui monte quand la nuit tombe */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: reduce ? 0.5 : lampOn,
          background: "radial-gradient(46% 42% at 56% 78%, rgba(255,168,84,0.14) 0%, rgba(255,140,60,0.05) 45%, transparent 72%)",
        }}
      />

      {/* ── La baie vitrée (immobile) ─────────────────────────────────────── */}
      <div className="absolute top-[7vh] h-[64vh] w-[calc(64vh*0.8)] right-[6vw] lg:right-[9vw]" style={still}>
        {/* Embrasure : l'épaisseur du mur autour de la vitre */}
        <div className="absolute -inset-[14px] rounded-[6px] bg-[linear-gradient(100deg,#1a1d27_0%,#101320_38%,#0a0c14_100%)] shadow-[0_50px_140px_-40px_rgba(0,0,0,0.95)]" />
        <div className="absolute -inset-[14px] rounded-[6px] ring-1 ring-white/[0.05]" />

        <div className="relative h-full w-full overflow-hidden">
          <Image
            src={PHOTO}
            alt="Vue sur la ville depuis la fenêtre, à la tombée de la nuit"
            fill
            priority
            sizes="(max-width: 1024px) 60vw, 52vh"
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
          <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(104deg,transparent_44%,#dce9ff_51%,transparent_58%)]" />
        </div>

        {/* Croisillons, dans le plan de la vitre */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[8px] -translate-x-1/2 bg-[#0a0c13] after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-white/[0.14]" />
        <div className="pointer-events-none absolute inset-x-0 top-[38%] h-[8px] bg-[#0a0c13] after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-white/[0.14]" />

        {/* Appui de fenêtre */}
        <div className="absolute inset-x-[-26px] top-full h-[18px] rounded-b-[3px] bg-[linear-gradient(to_bottom,#20242f,#0c0e15)]">
          <div className="absolute inset-x-0 top-0 h-px bg-white/[0.16]" />
        </div>
      </div>

      {/* ── Le bureau ─────────────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-[26vh] bg-[linear-gradient(to_bottom,#0c0e15_0%,#070810_55%,#05060b_100%)]">
        <div className="absolute inset-x-0 top-0 h-px bg-white/[0.07]" />
        {/* Tache de jour projetée par la fenêtre, en biais */}
        <motion.div
          className="absolute right-[4vw] lg:right-[7vw] top-0 h-full w-[46vw] max-w-[720px] blur-2xl"
          style={{
            opacity: reduce ? 0.5 : daylight,
            transform: "skewX(-26deg)",
            background: "linear-gradient(to bottom, rgba(150,172,230,0.20), rgba(120,140,200,0.05) 60%, transparent 100%)",
          }}
        />
        {/* Nappe bleutée de l'écran du laptop */}
        <motion.div
          className="absolute right-[10vw] top-0 h-full w-[34vw] max-w-[520px] blur-3xl"
          style={{
            opacity: reduce ? 0.5 : lampOn,
            background: "radial-gradient(ellipse at 50% 0%, rgba(140,170,255,0.20), transparent 70%)",
          }}
        />
      </div>

      <DeskLamp on={reduce ? undefined : lampOn} />
      <Incense />

      {/* ── Le laptop, posé sur le bureau ─────────────────────────────────── */}
      {/* Aucun parent en transformation 3D : sinon le navigateur rasterise tout
          le sous-arbre en basse résolution et l'écran devient FLOU. */}
      <div className="absolute bottom-[7vh] right-[6vw] lg:right-[11vw] w-[min(52vw,330px)] lg:w-[min(24vw,360px)]">
        <Laptop>{children}</Laptop>
      </div>

      {/* ── Premier plan : le dossier du fauteuil, hors focus ──────────────── */}
      {/* Une masse floue tout près de l'objectif : c'est ce qui donne la
          profondeur d'une vraie prise de vue, sans rien dessiner. */}
      <div
        className="pointer-events-none absolute -bottom-[6vh] left-[6vw] h-[30vh] w-[26vw] max-w-[420px] rounded-t-[60px] bg-[#04050a] opacity-95"
        style={{ filter: "blur(18px)" }}
      />
    </motion.div>
  );
}

// ── Lampe de bureau ─────────────────────────────────────────────────────────
// Bras articulé, abat-jour conique, et surtout un CÔNE DE LUMIÈRE visible qui
// tombe sur le plateau : c'est l'éclairage, pas le contour, qui rend l'objet
// crédible. Elle monte en puissance à mesure que la nuit tombe.
function DeskLamp({ on }: { on?: ReturnType<typeof useTransform<number, number>> }) {
  return (
    <div className="pointer-events-none absolute bottom-[19vh] right-[36vw] hidden md:block w-[190px]">
      {/* Cône de lumière, ouvert vers le bas-gauche */}
      <motion.div
        className="absolute left-[-58px] top-[54px] h-[230px] w-[210px] blur-xl anim-lamp"
        style={{
          opacity: on ?? 0.7,
          clipPath: "polygon(46% 0%, 74% 0%, 100% 100%, 0% 100%)",
          background: "linear-gradient(to bottom, rgba(255,186,110,0.34), rgba(255,150,70,0.10) 55%, transparent 100%)",
        }}
      />
      {/* Flaque chaude sur le plateau */}
      <motion.div
        className="absolute left-[-92px] top-[236px] h-[54px] w-[300px] rounded-[50%] blur-2xl"
        style={{ opacity: on ?? 0.7, background: "radial-gradient(ellipse, rgba(255,178,96,0.42), transparent 70%)" }}
      />

      {/* Bras */}
      <div className="absolute bottom-[6px] left-[92px] h-[188px] w-[6px] rotate-[7deg] rounded-full bg-[linear-gradient(to_right,#0a0d13,#333a47_45%,#0c0f16)]" />
      {/* Articulation */}
      <div className="absolute bottom-[186px] left-[86px] h-[16px] w-[16px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#4a5262,#12151c)]" />
      {/* Abat-jour conique */}
      <div
        className="absolute top-[8px] left-[36px] h-[52px] w-[96px]"
        style={{
          clipPath: "polygon(30% 0%, 100% 0%, 78% 100%, 0% 100%)",
          background: "linear-gradient(118deg,#454d5d 0%,#262c37 46%,#12151c 100%)",
        }}
      />
      {/* Bouche lumineuse de l'abat-jour */}
      <motion.div
        className="absolute top-[56px] left-[38px] h-[10px] w-[74px] rounded-[50%] blur-[2px] anim-lamp"
        style={{ opacity: on ?? 0.8, background: "radial-gradient(ellipse, rgba(255,214,150,0.95), rgba(255,160,70,0.25))" }}
      />
      {/* Socle lesté */}
      <div className="absolute bottom-0 left-[62px] h-[12px] w-[70px] rounded-[50%] bg-[linear-gradient(to_bottom,#39404e,#0a0c11)]" />
      <div className="absolute bottom-[9px] left-[68px] h-[8px] w-[58px] rounded-[50%] bg-[#151a22]" />
    </div>
  );
}

// ── Encens ──────────────────────────────────────────────────────────────────
// Trois volutes décalées, très floues et très lentes : de la fumée, ce n'est
// qu'un dégradé qui monte en s'élargissant et en s'effaçant.
function Incense() {
  return (
    <div className="pointer-events-none absolute bottom-[21vh] right-[52vw] hidden md:block">
      {/* Porte-encens + braise */}
      <div className="absolute bottom-0 left-0 h-[6px] w-[42px] rounded-[50%] bg-[linear-gradient(to_bottom,#2c323d,#0b0d12)]" />
      <div className="absolute bottom-[4px] left-[19px] h-[46px] w-[2px] rounded bg-[linear-gradient(to_top,#2a2118,#3c2f22)]" />
      <div className="absolute bottom-[48px] left-[18px] h-[4px] w-[4px] rounded-full bg-[#ff7a3c] blur-[1px] anim-lamp" />
      {/* Volutes */}
      {[0, 3.6, 7.2].map((delay, i) => (
        <div
          key={i}
          className="absolute bottom-[52px] left-[14px] h-[70px] w-[12px] rounded-full anim-smoke"
          style={{
            animationDelay: `${delay}s`,
            filter: "blur(9px)",
            background: "linear-gradient(to top, rgba(210,220,245,0.55), rgba(210,220,245,0.10) 70%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

// ── Laptop ──────────────────────────────────────────────────────────────────
// La dalle reste dans le plan de l'écran (donc NETTE) ; seul le clavier part en
// perspective, et lui n'a aucun texte à rendre. Le volume vient des matières :
// dégradés d'aluminium, liserés, ombre de contact, reflet de dalle.
function Laptop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute left-1/2 bottom-[-14px] h-10 w-[92%] -translate-x-1/2 rounded-[50%] bg-black/80 blur-2xl" />

      <div className="relative rounded-[14px] bg-[linear-gradient(150deg,#3a4150_0%,#22262f_35%,#12151b_100%)] p-[9px] pb-[16px] shadow-[0_26px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.10]">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[7px] bg-[#06070c] ring-1 ring-black/70">
          {children}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(116deg,rgba(255,255,255,0.09)_0%,transparent_34%,transparent_66%,rgba(255,255,255,0.04)_100%)]" />
        </div>
        <div className="absolute left-1/2 top-[3.5px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white/25" />
        <div className="absolute inset-x-0 bottom-[4px] text-center text-[6px] tracking-[0.3em] text-white/20">FOCUSFLOW</div>
      </div>

      <div className="relative" style={{ perspective: "900px" }}>
        <div
          className="relative -mt-[3px] h-[46px] rounded-b-[12px] bg-[linear-gradient(to_bottom,#333a47_0%,#1f242e_28%,#12151c_75%,#0a0c11_100%)] ring-1 ring-white/[0.06]"
          style={{ transform: "rotateX(72deg)", transformOrigin: "top center" }}
        >
          <div className="absolute inset-x-8 top-0 h-px bg-white/[0.14]" />
          <div className="absolute inset-x-[9%] top-[6px] h-[16px] rounded-[2px] bg-[repeating-linear-gradient(to_right,rgba(255,255,255,0.05)_0_5px,transparent_5px_9px)] opacity-70" />
          <div className="absolute left-1/2 top-[26px] h-[14px] w-[30%] -translate-x-1/2 rounded-[3px] bg-[#171b23] ring-1 ring-white/[0.05]" />
        </div>
        <div className="relative mx-[3%] h-[5px] rounded-b-[6px] bg-[linear-gradient(to_bottom,#22262f,#0b0d12)] ring-1 ring-white/[0.05]">
          <div className="absolute left-1/2 h-[3px] w-[12%] -translate-x-1/2 rounded-b-full bg-black/60" />
        </div>
      </div>
    </div>
  );
}
