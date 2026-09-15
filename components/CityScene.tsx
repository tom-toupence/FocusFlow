"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  FogExp2,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Sprite,
  SpriteMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// ═══════════════════════════════════════════════════════════════════════════
// LE MONDE — Séoul depuis Namsan, à l'heure bleue
//
// ── Ce qu'on reproduit, et pourquoi ───────────────────────────────────────
// La scène est modelée sur LA PHOTO du projet
// (`public/pexels-ethan-brooke-1123775-3142005.jpg`), plan par plan. La version
// précédente était un canyon symétrique vu du trottoir : ni montagnes, ni
// vallée, ni plongée. Ce n'était tout simplement pas le même plan.
//
// La photo, du haut vers le bas :
//   1. un ciel d'heure bleue traversé de nuages sombres, qui vire au crème
//      puis à une BANDE ORANGE saturée juste au-dessus de la crête ;
//   2. trois plans de MONTAGNES en silhouettes, de plus en plus claires avec
//      la distance (perspective atmosphérique) ;
//   3. une VALLÉE DENSE de tours dans la brume, et non deux rangées ;
//   4. deux tours de premier plan qui CADRENT le boulevard, dont une aux
//      fenêtres VERTES, détail très caractéristique des barres coréennes ;
//   5. LE BOULEVARD qui fuit vers le point de fuite, ses filés de phares
//      blancs à l'aller et rouges au retour ;
//   6. tout en bas, un tissu de petits immeubles dont on voit les TOITS.
//
// ── Le mouvement ──────────────────────────────────────────────────────────
// Le scroll est une DESCENTE. On démarre sur le cadrage de la photo, très
// au-dessus du boulevard, et on descend en avançant jusqu'au niveau de la rue,
// loin dans l'avenue. La nuit tombe pendant la descente : le ciel s'éteint, la
// brume s'épaissit, et les fenêtres s'allument. Un pomodoro, c'est du temps qui
// passe ; ici c'est le scroll qui le fait passer.
//
// ── Ce qui la rend crédible plutôt que bricolée ───────────────────────────
//   . des TOITS sombres : en vue plongeante on VOIT le dessus des immeubles,
//     et une boîte texturée de fenêtres sur sa face supérieure trahit
//     immédiatement le pavé. D'où deux matériaux par immeuble ;
//   . un CHAMP d'immeubles sur une trame de rues, avec une carte de hauteurs
//     (basses au premier plan, hautes à mi-distance près de l'axe) ;
//   . de la BRUME EXPONENTIELLE, qui donne la profondeur et fond le lointain
//     dans le ciel sans ligne de raccord ;
//   . du BLOOM, qui fait rayonner les fenêtres comme le ferait un capteur ;
//   . une minorité de fenêtres VERTES parmi les ambres.
//
// ── Fluidité ──────────────────────────────────────────────────────────────
// Rendu À LA DEMANDE : sans changement de scroll, pas une frame n'est
// dessinée. Les milliers d'immeubles tiennent en trois `InstancedMesh`, les
// matériaux sont non éclairés (une ville de nuit n'est que de l'émissif, il n'y
// a aucune lumière à calculer), et le bloom travaille à demi-résolution.
//
// ── Déterminisme ──────────────────────────────────────────────────────────
// Générateur pseudo-aléatoire à graine : la ville est identique à chaque
// visite et à chaque rendu. Aucun `Math.random`.
// ═══════════════════════════════════════════════════════════════════════════

export type WalkProgress = { v: number };

/** Demi-largeur du boulevard : aucun immeuble ne s'y plante. */
const ROAD_HALF = 15;
/** Emprise du champ urbain. */
const CITY_X = 760;
const CITY_Z_NEAR = 260;
const CITY_Z_FAR = -2500;
/** Aucune tour ne dépasse la ligne de crête. */
const MAX_H = 150;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ── Textures ───────────────────────────────────────────────────────────── */

/** Une façade. Fond très sombre (l'immeuble se lit en silhouette), fenêtres en
 *  minorité, et une part de VERT parmi les ambres comme sur la photo. */
function facadeTexture(seed: number, repeatY: number): Texture {
  const W = 64;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#05070e";
  ctx.fillRect(0, 0, W, H);

  const rnd = rng(seed);
  const cols = 6;
  const rows = 26;
  const cw = W / cols;
  const ch = H / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const r = rnd();
      if (r < 0.66) continue;
      const a = r > 0.975 ? 1 : r > 0.9 ? 0.62 : 0.28;
      // Une fenêtre sur cinq tire vers le vert froid des néons coréens.
      ctx.fillStyle = rnd() < 0.2 ? `rgba(168,224,150,${a})` : `rgba(255,198,140,${a})`;
      ctx.fillRect(x * cw + 2.5, y * ch + 1, cw - 5, ch - 2);
    }
  }

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  // Les UV d'une boîte s'étirent avec ses dimensions : sans répétition sur LES
  // DEUX axes, les fenêtres d'une tour deviennent des rectangles géants et
  // celles d'une façade large des tirets horizontaux.
  t.repeat.set(2, repeatY);
  return t;
}

/** Le ciel ET les montagnes dans une seule image : dégradé d'heure bleue,
 *  nuages, bande orange, puis trois crêtes de plus en plus sombres à mesure
 *  qu'elles se rapprochent. Une texture, un plan, et tout le fond de la photo
 *  avec sa perspective atmosphérique. */
function skyTexture(): Texture {
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // 1. le dégradé, relevé sur la photo.
  // ⚠️ Les positions sont calées sur la BANDE RÉELLEMENT VISIBLE. Le plan de
  // fond est bien plus haut que le champ de la caméra : à ce cadrage on ne voit
  // que la portion v ∈ [0,34 ; 1] de la texture. Des arrêts répartis sur toute
  // la hauteur donnaient un ciel presque entièrement orange.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1d5478");
  g.addColorStop(0.3, "#2d6c93");
  g.addColorStop(0.5, "#6ba2c0");
  g.addColorStop(0.575, "#dfd0ae");
  g.addColorStop(0.635, "#ef9a3c");
  g.addColorStop(0.695, "#dd7a24");
  g.addColorStop(1, "#6b3714");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 2. les nuages : des ellipses très étirées, placées DANS la bande bleue
  // visible (et non tout en haut de la texture, hors champ).
  // Floues et très aplaties : une ellipse nette se lit comme un dessin animé.
  // Le flou du contexte 2D fait tout le travail, sans coût au rendu puisque la
  // texture n'est peinte qu'une fois.
  const cr = rng(5501);
  ctx.filter = "blur(7px)";
  for (let i = 0; i < 34; i++) {
    const y = H * (0.33 + cr() * 0.2);
    const x = cr() * W;
    const w = 120 + cr() * 360;
    const h = 3 + cr() * 7;
    ctx.globalAlpha = 0.14 + cr() * 0.2;
    ctx.fillStyle = cr() < 0.5 ? "#24415c" : "#1a2f45";
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, h / 2, (cr() - 0.5) * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = "none";
  ctx.globalAlpha = 1;

  // 3. les crêtes, de la plus lointaine (claire) à la plus proche (sombre)
  // Profil en sommes de sinus, SANS terme aléatoire par point : c'est ce bruit
  // ajouté à chaque abscisse qui produisait des dents de scie. Une crête
  // réelle est faite de croupes larges et de quelques pointes, pas de pics
  // réguliers. Le pas est court et le tracé passe par des courbes pour que la
  // ligne reste douce.
  // Profil en BRUIT « RIDGED » : `1 - |sin|` a des maxima ANGULEUX et des
  // minima arrondis, soit exactement la signature d'une ligne de crête. Une
  // somme de sinus ordinaires donnait des dunes ; un bruit aléatoire par point
  // donnait des dents de scie. Ni l'un ni l'autre ne ressemble à une montagne.
  //
  // ⚠️ Les fréquences se lisent par rapport à la LARGEUR DE LA TEXTURE : à
  // 0,003, `x * k` ne parcourt même pas une demi-période sur 1024 px, et la
  // crête devient une ligne droite qui disparaît derrière la ville.
  const ridged = (x: number, k: number, phase: number) => 1 - Math.abs(Math.sin(x * k + phase));
  const ridge = (baseY: number, amp: number, fill: string, seed: number) => {
    const h = (x: number) =>
      baseY -
      amp *
        (0.54 * ridged(x, 0.0072, seed) +
          0.27 * ridged(x, 0.0185, seed * 1.7) +
          0.13 * ridged(x, 0.047, seed * 2.3) +
          0.06 * ridged(x, 0.112, seed * 3.1));
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, h(0));
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, h(x));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  // ⚠️ Les bases doivent rester AU-DESSUS du niveau du sol une fois projetées
  // dans le monde. Placées trop bas, les deux crêtes les plus proches étaient
  // dessinées sous l'horizon et n'apparaissaient jamais : il ne restait qu'une
  // seule ligne de montagnes au lieu de trois.
  // Réglage délicat : trop hautes, les crêtes mangent la bande orange sur
  // toute la largeur ; trop basses, elles disparaissent derrière la ville et il
  // ne reste qu'une bosse. Il faut qu'elles dominent nettement la skyline tout
  // en laissant le couchant passer d'un bord à l'autre.
  // Elles sont aussi nettement plus SOMBRES que le ciel : sur la photo, ce sont
  // de vraies silhouettes, pas des masses grises.
  // Les bases sont bien décalées : trop rapprochées, les trois plans se
  // recouvrent et la perspective atmosphérique ne se lit plus.
  ridge(H * 0.655, 78, "#3d5578", 3);
  ridge(H * 0.71, 62, "#2b3e60", 11);
  ridge(H * 0.765, 46, "#1b2840", 29);

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Halo doux, en fusion additive. Le bloom fait le reste du travail. */
function glowTexture(): Texture {
  const S = 64;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,210,160,0.4)");
  g.addColorStop(1, "rgba(255,190,130,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/* ── Le plan de fond, et la hauteur à laquelle tombe la crête ───────────── */
const SKY_Z = -3400;
const SKY_W = 9000;
const SKY_H = 4500;
const SKY_Y = 900;

export default function CityScene({
  progress,
  thumbnails,
}: {
  progress: React.RefObject<WalkProgress>;
  thumbnails: string[];
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      return;
    }

    const DUSK = new Color(0x3d5372);
    const NIGHT = new Color(0x080b16);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new Scene();
    // Brume légère à l'heure bleue : plus dense, elle délavait toute la vallée
    // et la ville perdait son contraste.
    scene.fog = new FogExp2(DUSK.getHex(), 0.0004);

    // Focale plutôt longue : la photo est prise au téléobjectif, ce qui écrase
    // les plans et fait paraître les montagnes proches. Un grand angle donnerait
    // une tout autre image.
    const camera = new PerspectiveCamera(46, mount.clientWidth / mount.clientHeight, 1, 6000);

    const textures: Texture[] = [];
    const disposables: { dispose: () => void }[] = [];

    /* ── 1 & 2. Le ciel et les montagnes ───────────────────────────────── */
    const skyTex = skyTexture();
    textures.push(skyTex);
    const skyGeo = new PlaneGeometry(SKY_W, SKY_H);
    const skyMat = new MeshBasicMaterial({ map: skyTex, fog: false, depthWrite: false });
    const sky = new Mesh(skyGeo, skyMat);
    sky.position.set(0, SKY_Y, SKY_Z);
    sky.renderOrder = -1;
    scene.add(sky);
    disposables.push(skyGeo, skyMat);

    /* ── Le sol ────────────────────────────────────────────────────────── */
    const groundGeo = new PlaneGeometry(6000, 6000);
    const groundMat = new MeshBasicMaterial({ color: 0x090b14 });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -1000;
    scene.add(ground);
    disposables.push(groundGeo, groundMat);

    /* ── 3, 4 & 6. Le champ urbain ─────────────────────────────────────── */
    // Trame de rues : des îlots séparés par des voies. C'est cette trame, et la
    // variété des hauteurs, qui distingue une ville d'un tas de boîtes.
    const BLOCK = 74;
    const STREET = 17;
    const STEP = BLOCK + STREET;

    const BANDS = [
      { repeatY: 2, seed: 1013 }, // le tissu bas
      { repeatY: 5, seed: 7717 }, // les immeubles moyens
      { repeatY: 10, seed: 4441 }, // les tours
    ];

    const dummy = new Object3D();
    const rnd = rng(20260915);
    const perBand: Matrix4[][] = [[], [], []];

    for (let bx = -CITY_X; bx <= CITY_X; bx += STEP) {
      for (let bz = CITY_Z_NEAR; bz > CITY_Z_FAR; bz -= STEP) {
        // Carte de hauteurs : basse au premier plan, haute à mi-distance et
        // près de l'axe, décroissante vers les bords. C'est le relief de la
        // photo, où les tours se massent au centre et le tissu bas occupe le
        // bas du cadre.
        const depth = (CITY_Z_NEAR - bz) / (CITY_Z_NEAR - CITY_Z_FAR); // 0 → 1
        const axis = 1 - Math.min(1, Math.abs(bx) / CITY_X);
        const core = Math.exp(-Math.pow((depth - 0.42) / 0.3, 2));
        const potential = 0.1 + core * 0.72 * (0.35 + axis * 0.65);

        for (let k = 0; k < 4; k++) {
          const w = 12 + rnd() * 26;
          const d = 12 + rnd() * 26;
          const x = bx + (rnd() - 0.5) * (BLOCK - w);
          const z = bz - rnd() * (BLOCK - d);
          // Le boulevard reste dégagé, faces comprises.
          if (Math.abs(x) - w / 2 < ROAD_HALF) continue;

          const tall = rnd() < potential;
          const h = tall ? 26 + rnd() * rnd() * (MAX_H - 26) : 7 + rnd() * 22;
          const band = h > 62 ? 2 : h > 24 ? 1 : 0;

          dummy.position.set(x, h / 2, z);
          dummy.scale.set(w, h, d);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          perBand[band].push(dummy.matrix.clone());

          // Un retrait en gradin au sommet des tours : sans lui, la skyline est
          // une rangée de boîtes à bout plat.
          if (h > 70 && rnd() < 0.4) {
            const h2 = h * (0.12 + rnd() * 0.2);
            dummy.position.set(x, h + h2 / 2, z);
            dummy.scale.set(w * 0.55, h2, d * 0.55);
            dummy.updateMatrix();
            perBand[2].push(dummy.matrix.clone());
          }
        }
      }
    }

    // Les deux tours qui CADRENT le boulevard, comme sur la photo : très
    // proches, très hautes, elles donnent l'échelle et creusent la profondeur.
    // Sans elles, la vallée n'est qu'un tapis uniforme.
    [
      { side: -1, h: 150, z: 150, w: 26, d: 62 },
      { side: -1, h: 138, z: 62, w: 24, d: 52 },
      { side: 1, h: 146, z: 112, w: 34, d: 58 },
      { side: 1, h: 120, z: 6, w: 28, d: 44 },
    ].forEach((t) => {
      dummy.position.set(t.side * (ROAD_HALF + 6 + t.w / 2), t.h / 2, t.z);
      dummy.scale.set(t.w, t.h, t.d);
      dummy.updateMatrix();
      perBand[2].push(dummy.matrix.clone());
    });

    const facadeMats: MeshBasicMaterial[] = [];
    const roofMat = new MeshBasicMaterial({ color: 0x0c0f18 });
    disposables.push(roofMat);

    BANDS.forEach((b, i) => {
      const list = perBand[i];
      if (list.length === 0) return;
      const tex = facadeTexture(b.seed, b.repeatY);
      textures.push(tex);
      const geo = new BoxGeometry(1, 1, 1);
      const side = new MeshBasicMaterial({ map: tex });
      facadeMats.push(side);
      // ⚠️ En vue plongeante, on VOIT les toits. Une boîte dont la face
      // supérieure porte la texture de façade trahit immédiatement le pavé.
      // D'où deux matériaux, dans l'ordre des groupes de `BoxGeometry` :
      // +x, -x, +y (toit), -y, +z, -z.
      const mesh = new InstancedMesh(geo, [side, side, roofMat, roofMat, side, side], list.length);
      list.forEach((m, k) => mesh.setMatrixAt(k, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      disposables.push(geo, side, mesh);
    });

    /* ── 5. Le boulevard ───────────────────────────────────────────────── */
    const roadGeo = new PlaneGeometry(ROAD_HALF * 2, 3200);
    const roadMat = new MeshBasicMaterial({ color: 0x12141e });
    const road = new Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.4, -1100);
    scene.add(road);
    disposables.push(roadGeo, roadMat);

    const glowTex = glowTexture();
    textures.push(glowTex);

    // Les filés de phares : des quadrilatères étirés posés à plat, blancs dans
    // un sens et rouges dans l'autre. Avec le bloom, ils se lisent exactement
    // comme les traînées de la photo.
    const trailGeo = new PlaneGeometry(1, 1);
    disposables.push(trailGeo);
    const headMat = new MeshBasicMaterial({
      map: glowTex,
      color: 0xfff0d2,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: DoubleSide,
      opacity: 0.85,
    });
    const tailMat = new MeshBasicMaterial({
      map: glowTex,
      color: 0xff4d3a,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: DoubleSide,
      opacity: 0.7,
    });
    disposables.push(headMat, tailMat);

    const tr = rng(777);
    for (let z = CITY_Z_NEAR; z > CITY_Z_FAR; z -= 14 + tr() * 26) {
      for (const lane of [-1, 1]) {
        const m = new Mesh(trailGeo, lane < 0 ? headMat : tailMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(lane * (4 + tr() * 5), 1, z);
        m.scale.set(2.4, 16 + tr() * 30, 1);
        scene.add(m);
      }
    }

    // Les lampadaires, en chapelet le long de l'avenue.
    const lampMat = new SpriteMaterial({
      map: glowTex,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.3,
      fog: true,
    });
    const signGlowMat = new SpriteMaterial({
      map: glowTex,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.2,
      fog: true,
    });
    disposables.push(lampMat, signGlowMat);
    for (let z = CITY_Z_NEAR; z > CITY_Z_FAR; z -= 40) {
      for (const side of [-1, 1]) {
        const s = new Sprite(lampMat);
        s.position.set(side * (ROAD_HALF - 2), 7, z);
        s.scale.setScalar(7);
        scene.add(s);
      }
    }

    /* ── Les enseignes du catalogue ────────────────────────────────────── */
    // Sur la photo, la ville est constellée d'enseignes lumineuses. Les
    // paysages du catalogue en tiennent lieu : c'est du contenu réel du
    // produit, et c'est raccord avec le sujet.
    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");
    const signGeo = new PlaneGeometry(1, 1);
    disposables.push(signGeo);

    const n = Math.max(1, thumbnails.length);
    thumbnails.forEach((url, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const z = 10 - (i / n) * 1900;
      const y = 26 + (i % 4) * 22;
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          textures.push(tex);
          const mat = new MeshBasicMaterial({ map: tex, toneMapped: false, fog: true });
          disposables.push(mat);
          const m = new Mesh(signGeo, mat);
          m.scale.set(30, 18.75, 1); // 16:10, comme les vignettes
          m.position.set(side * (ROAD_HALF + 2), y, z);
          m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          scene.add(m);

          const halo = new Sprite(signGlowMat);
          halo.position.set(side * (ROAD_HALF - 4), y, z);
          halo.scale.setScalar(34);
          scene.add(halo);
        },
        undefined,
        () => {}
      );
    });

    /* ── Le bloom ──────────────────────────────────────────────────────── */
    const size = new Vector2(mount.clientWidth, mount.clientHeight);
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(size.clone().multiplyScalar(0.5), 0.5, 0.5, 0.6);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    disposables.push(composer, bloom);

    /* ── LA DESCENTE ───────────────────────────────────────────────────── */
    // p = 0 : le cadrage de la photo, haut au-dessus du boulevard, la crête
    //         dans le haut du cadre, la vallée qui s'étale.
    // p = 1 : au niveau de la rue, loin dans l'avenue.
    const CAM_FROM = new Vector3(6, 186, 300);
    const CAM_TO = new Vector3(0, 9, -1180);
    const LOOK_FROM = new Vector3(0, 116, -1500);
    const LOOK_TO = new Vector3(0, 13, -1900);

    const fogColor = new Color();
    const skyTint = new Color();
    const NIGHT_SKY = new Color(0x39415e);
    const pos = new Vector3();
    const look = new Vector3();
    let last = Number.NaN;

    const draw = (p: number) => {
      // La descente est amortie aux deux bouts : on décolle lentement du
      // cadrage photo, et on se pose sans à-coup.
      const e = easeInOut(p);
      pos.lerpVectors(CAM_FROM, CAM_TO, e);
      look.lerpVectors(LOOK_FROM, LOOK_TO, e);

      // Le pas n'apparaît que dans le dernier tiers, quand on est assez bas
      // pour marcher. Indexé sur la position et non sur le temps : au scrub il
      // reste calé sur le scroll, y compris en remontant.
      const foot = Math.max(0, (p - 0.66) / 0.34);
      const walked = e * 1500;
      pos.y += Math.sin(walked * 0.09) * 0.5 * foot;
      pos.x += Math.sin(walked * 0.05) * 1.6 * foot;

      camera.position.copy(pos);
      camera.lookAt(look);
      camera.rotateZ(Math.sin(walked * 0.05 + 1.1) * 0.008 * foot);

      // La nuit tombe sur la première moitié de la descente.
      const night = Math.min(1, p / 0.5);
      fogColor.copy(DUSK).lerp(NIGHT, night);
      (scene.fog as FogExp2).color.copy(fogColor);
      (scene.fog as FogExp2).density = 0.0004 + night * 0.0017;
      skyTint.setScalar(1).lerp(NIGHT_SKY, night * 0.92);
      skyMat.color.copy(skyTint);
      // ...pendant que les fenêtres s'allument.
      const lit = 0.4 + night * 1.05;
      facadeMats.forEach((m) => m.color.setScalar(lit));
      bloom.strength = 0.34 + night * 0.36;

      composer.render();
    };

    const render = () => {
      const p = Math.min(1, Math.max(0, progress.current?.v ?? 0));
      if (p === last) return;
      last = p;
      draw(p);
    };

    draw(0);
    gsap.ticker.add(render);

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w * 0.5, h * 0.5);
      last = Number.NaN;
      render();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      gsap.ticker.remove(render);
      ro.disconnect();
      textures.forEach((t) => t.dispose());
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [progress, thumbnails]);

  return <div ref={host} className="absolute inset-0" aria-hidden />;
}
