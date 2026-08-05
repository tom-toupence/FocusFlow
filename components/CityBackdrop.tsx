"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform, useMotionTemplate } from "motion/react";

// FOND du landing : la photo de ville, plein écran, traversée par le scroll.
//
// ── L'idée ──────────────────────────────────────────────────────────────────
// La photo est en PORTRAIT (4:5) et le scroll est VERTICAL : au lieu de subir le
// recadrage, on s'en sert. Le conteneur est plus haut que l'écran et descend au
// fil de la page — on parcourt donc l'image entière, du ciel au boulevard, et
// rien n'est perdu.
// Pendant cette descente, LA NUIT TOMBE : le couchant s'efface, le bleu nuit
// monte, et les lumières de la ville s'embrasent. Un pomodoro c'est du temps qui
// passe ; ici c'est le scroll qui le fait passer.
//
// ── Comment les lumières « s'allument » ────────────────────────────────────
// Sans retoucher un seul pixel à la main : une COPIE de l'image, floutée et
// sur-exposée, est superposée en fusion `screen`. Ce mode ne garde que ce qui
// est déjà clair — donc seules les fenêtres, les enseignes et les phares
// montent. Il suffit d'animer son opacité.
//
// Perf : deux balises `next/image` (AVIF/WebP, cache edge Vercel) et des
// dégradés CSS. Aucune 3D, aucun canvas — uniquement des `opacity`/`transform`
// composés par le GPU.

const PHOTO = "/pexels-ethan-brooke-1123775-3142005.jpg";

// Grain photographique : bruit SVG en data-URI, zéro requête.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export default function CityBackdrop() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();

  // Descente dans l'image : le conteneur fait 138 % de la hauteur d'écran et
  // remonte de 27 % — on traverse donc toute la photo de haut en bas.
  // ⚠️ On n'anime QUE `translateY`. Animer aussi `scale` obligeait le navigateur
  // à re-rastériser une image de 4,6 Mpx à chaque palier de zoom : c'était l'une
  // des causes des ralentissements.
  const pan = useTransform(scrollYProgress, [0, 1], ["0%", "-27%"]);

  // Tombée de la nuit, calée sur le premier tiers de page (là où on regarde).
  const night = useTransform(scrollYProgress, [0, 0.42], [0, 1], { clamp: true });
  const dusk = useTransform(night, [0, 0.85], [1, 0]);
  const dark = useTransform(night, [0, 1], [0.18, 0.74]);
  const ignite = useTransform(night, [0.05, 1], [0.06, 0.7]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#05060c]">
      {/* La photo, dans un cadre plus haut que l'écran */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[138%]"
        style={reduce ? undefined : { y: pan, willChange: "transform" }}
      >
        <Image src={PHOTO} alt="" fill priority sizes="100vw" className="object-cover object-center" />
      </motion.div>

      {/* Embrasement : la même image floutée, en fusion `screen`.
          ⚠️ Le flou est calculé sur une couche au QUART de la taille, puis
          agrandie ×4 par transform (gratuit). Un `blur(26px)` en plein écran
          coûtait une fortune ; ici `blur(7px)` sur un quart de surface donne le
          même rendu pour ~1/16e du travail. */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[138%] mix-blend-screen"
        style={reduce ? { opacity: 0.35 } : { opacity: ignite, y: pan, willChange: "transform, opacity" }}
      >
        <div className="absolute left-0 top-0 h-1/4 w-1/4 origin-top-left scale-[4]">
          <Image
            src={PHOTO}
            alt=""
            fill
            sizes="25vw"
            className="object-cover object-center"
            style={{ filter: "blur(7px) brightness(1.55) saturate(1.4)" }}
          />
        </div>
      </motion.div>

      {/* Étalonnage : le couchant s'efface… */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: reduce ? 0.3 : dusk,
          background:
            "linear-gradient(to bottom, rgba(255,150,58,0.22) 0%, rgba(255,116,48,0.10) 32%, rgba(90,70,140,0.06) 64%, transparent 100%)",
        }}
      />
      {/* …et le bleu nuit monte */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: reduce ? 0.6 : dark,
          background:
            "linear-gradient(to bottom, rgba(3,6,24,0.94) 0%, rgba(4,8,28,0.42) 38%, rgba(5,9,30,0.34) 72%, rgba(12,8,22,0.58) 100%)",
        }}
      />

      {/* Étalonnage cinéma : ombres froides, hautes lumières chaudes (teal &
          orange). ⚠️ En alpha simple et NON en `soft-light` : un mode de fusion
          plein écran force une recomposition de toute la surface à chaque frame
          de scroll. Le rendu est à peine moins subtil, pour un coût nul. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(70% 60% at 18% 88%, rgba(255,150,70,0.30), transparent 62%), radial-gradient(70% 60% at 84% 10%, rgba(60,120,230,0.26), transparent 62%)",
        }}
      />

      {/* Grain + vignette : la finition photographique (en fusion normale).
          ⚠️ Vignettage OUVERT : à 0,8 d'opacité il noircissait tout le bord
          gauche — bien plus que le voile de texte lui-même. */}
      <div className="absolute inset-0 opacity-[0.10]" style={{ backgroundImage: GRAIN }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 120% 105% at 50% 46%, transparent 64%, rgba(2,3,8,0.34) 100%)" }}
      />

      {/* Lisibilité — SANS bandeau. Un dégradé gauche→droite se lit comme un
          voile noir posé sur la photo (« violent »), parce que l'œil repère la
          transition. On combine donc :
            1. un assombrissement UNIFORME et léger, qui n'a aucun bord ;
            2. un halo très large et très doux derrière le bloc de texte.
          Le contraste du titre vient surtout de son ombre portée (LandingPage). */}
      <div className="absolute inset-0 bg-[rgba(3,4,10,0.26)]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(78% 90% at 20% 52%, rgba(3,4,10,0.40), transparent 78%)" }}
      />

      {!reduce && <TimeRail progress={night} />}
    </div>
  );
}

// Repère d'heure : un rail discret sur le bord droit, où l'heure avance du
// crépuscule à la nuit au fil du scroll. Il dit en un coup d'œil ce que fait la
// chorégraphie — et rappelle le sujet du produit : le temps qui passe.
function TimeRail({ progress }: { progress: ReturnType<typeof useTransform<number, number>> }) {
  const top = useTransform(progress, [0, 1], ["0%", "100%"]);
  const glow = useTransform(progress, [0, 1], [0.35, 1]);
  // 18 h 20 → 23 h 05, en minutes depuis minuit
  const minutes = useTransform(progress, [0, 1], [1100, 1385]);
  const hh = useTransform(minutes, (m) => String(Math.floor(m / 60)).padStart(2, "0"));
  const mm = useTransform(minutes, (m) => String(Math.floor(m % 60)).padStart(2, "0"));
  const label = useMotionTemplate`${hh}:${mm}`;

  return (
    <div className="pointer-events-none absolute right-6 top-1/2 hidden h-[36vh] -translate-y-1/2 lg:block">
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      <motion.div className="absolute left-1/2 -translate-x-1/2" style={{ top }}>
        <motion.div
          className="h-1.5 w-1.5 rounded-full bg-[#ffd7a1]"
          style={{ opacity: glow, boxShadow: "0 0 12px 3px rgba(255,190,120,0.55)" }}
        />
        <motion.span className="absolute left-4 top-[-7px] text-[10px] tabular-nums tracking-widest text-white/45">
          {label}
        </motion.span>
      </motion.div>
    </div>
  );
}
