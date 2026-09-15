"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Fog,
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
  WebGLRenderer,
  type Texture,
} from "three";

// ═══════════════════════════════════════════════════════════════════════════
// LA VILLE, MODÉLISÉE — on descend l'avenue à pied
//
// POURQUOI DE LA VRAIE 3D. La version précédente faisait grossir une photo et
// croiser des vignettes en CSS 3D. Ça ne marchait pas, et pas seulement parce
// que les maths étaient fausses (à z=640 sous une perspective de 1000, une
// carte est agrandie 2,78 fois et part hors cadre) : une image plate qui
// grossit donne un ZOOM, jamais un DÉPLACEMENT. Le point de fuite ne bouge
// pas, les façades ne défilent pas, rien ne se dépasse. Il faut une scène.
//
// CE QUI EST MODÉLISÉ. Une avenue nocturne procédurale : deux rangées
// d'immeubles sur trois profondeurs, des façades dont les fenêtres sont
// allumées de façon inégale, des lampadaires, le sol, et au fond la crête et
// le couchant de la photo du projet. La caméra marche : elle avance, tangue
// légèrement et roule un peu, parce que c'est ce tangage qui distingue une
// balade d'un travelling sur rail.
//
// LE CATALOGUE EST DANS LA SCÈNE. Les paysages de `data/videos.ts` sont
// montés en écrans géants sur les façades. C'est du contenu réel du produit,
// pas du décor, et ça correspond exactement aux avenues que le catalogue filme.
//
// PERF. Tout est en `MeshBasicMaterial` : aucune lumière à calculer, ce qui est
// correct puisqu'une ville de nuit n'est QUE de l'émissif. Les immeubles
// passent par trois `InstancedMesh` (un seul appel de dessin chacun), le
// brouillard masque le fond, et le pixel ratio est plafonné. La boucle de
// rendu est branchée sur `gsap.ticker`, donc synchronisée avec le reste de la
// page et arrêtée avec elle.
//
// DÉTERMINISME. Générateur pseudo-aléatoire à graine : la ville est la même à
// chaque visite et à chaque rendu. Aucun `Math.random`.
// ═══════════════════════════════════════════════════════════════════════════

/** L'avancée de la marche, 0 à 1. Écrite par le ScrollTrigger du parent, lue
 *  à chaque frame : aucune valeur ne transite par un state React. */
export type WalkProgress = { v: number };

const EYE = 5.4; // hauteur des yeux
const START_Z = 34;
const END_Z = -320;

/** Mulberry32 : court, rapide, et surtout reproductible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une façade : fond sombre, fenêtres allumées en minorité et à des
 *  intensités différentes. C'est ce déséquilibre qui fait une ville plutôt
 *  qu'un damier. */
function facadeTexture(seed: number, repeatY: number): Texture {
  const W = 64;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#070910";
  ctx.fillRect(0, 0, W, H);

  const rnd = rng(seed);
  const cols = 6;
  const rows = 26;
  const cw = W / cols;
  const ch = H / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const r = rnd();
      if (r < 0.63) continue;
      const a = r > 0.97 ? 0.92 : r > 0.88 ? 0.5 : 0.2;
      ctx.fillStyle = `rgba(255,198,140,${a})`;
      ctx.fillRect(x * cw + 2.5, y * ch + 1, cw - 5, ch - 2);
    }
  }

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  // Les UV d'une boîte s'étirent avec ses dimensions : sans répétition, les
  // fenêtres d'une tour seraient des rectangles géants, et celles d'une façade
  // large des tirets horizontaux. On répète donc sur LES DEUX axes, davantage
  // en hauteur sur les bandes hautes, ce qui garde des fenêtres de taille
  // comparable d'un immeuble à l'autre.
  t.repeat.set(2, repeatY);
  return t;
}

/** Le marquage au sol. Sans lui la chaussée est un trou noir, et surtout on ne
 *  sent plus qu'on avance : c'est la ligne médiane qui défile qui donne la
 *  vitesse, bien plus que les façades. */
function roadTexture(): Texture {
  const W = 32;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0e1019";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(226,205,175,0.34)";
  // Bande fine : la chaussée fait 22 unités de large, un trait de 3 px sur 32
  // donnait des dalles blanches de 2 unités au premier plan.
  ctx.fillRect(W / 2 - 0.6, 10, 1.2, H * 0.45);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(1, 64);
  return t;
}

/** Halo d'un lampadaire : un dégradé radial, en fusion additive. */
function glowTexture(): Texture {
  const S = 64;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,206,150,1)");
  g.addColorStop(0.35, "rgba(255,180,110,0.42)");
  g.addColorStop(1, "rgba(255,170,100,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Le fond de vallée : le couchant et la ligne de crête de la photo du projet,
 *  redessinés en dégradé. Hors brouillard, pour rester lisible au loin. */
function horizonTexture(): Texture {
  const W = 512;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // Volontairement SOMBRE. Un dégradé plus clair, agrandi à 700 unités au fond
  // de l'avenue, ne se lit pas comme un couchant mais comme un mur de brume
  // gris qui bouche la perspective.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#03040a");
  sky.addColorStop(0.45, "#070d1f");
  sky.addColorStop(0.72, "#17182e");
  sky.addColorStop(0.9, "#5e3218");
  sky.addColorStop(1, "#8f4f1d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // La crête, en silhouette
  const rnd = rng(9137);
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H * 0.72);
  for (let x = 0; x <= W; x += 16) {
    const ridge = H * (0.66 + Math.sin(x * 0.017) * 0.05 + rnd() * 0.05);
    ctx.lineTo(x, ridge);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = "#070a16";
  ctx.fill();

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export default function CityScene({
  progress,
  thumbnails,
}: {
  progress: React.RefObject<WalkProgress>;
  /** URLs des vignettes du catalogue, montées en écrans sur les façades. */
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
      return; // pas de WebGL : le parent affiche déjà un repli
    }

    const NIGHT = 0x05060c;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    renderer.setClearColor(NIGHT, 1);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.fog = new Fog(NIGHT, 26, 235);

    const camera = new PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.5, 620);
    camera.position.set(0, EYE, START_Z);

    // Tout ce qui devra être libéré à la fin.
    const textures: Texture[] = [];
    const disposables: { dispose: () => void }[] = [];

    /* ── Le sol ────────────────────────────────────────────────────────── */
    const groundGeo = new PlaneGeometry(260, 900);
    const groundMat = new MeshBasicMaterial({ color: 0x090b13 });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -300;
    scene.add(ground);
    disposables.push(groundGeo, groundMat);

    // La chaussée, à peine plus claire, pour que l'avenue se lise.
    const roadTex = roadTexture();
    textures.push(roadTex);
    const roadGeo = new PlaneGeometry(22, 900);
    const roadMat = new MeshBasicMaterial({ map: roadTex });
    const road = new Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, -300);
    scene.add(road);
    disposables.push(roadGeo, roadMat);

    /* ── Le fond : couchant et crête ───────────────────────────────────── */
    const horizonTex = horizonTexture();
    textures.push(horizonTex);
    const horizonGeo = new PlaneGeometry(460, 180);
    const horizonMat = new MeshBasicMaterial({ map: horizonTex, fog: false, depthWrite: false });
    const horizon = new Mesh(horizonGeo, horizonMat);
    horizon.position.set(0, 52, -440);
    scene.add(horizon);
    disposables.push(horizonGeo, horizonMat);

    /* ── Les immeubles ─────────────────────────────────────────────────── */
    // Trois bandes de hauteur, chacune avec sa densité de fenêtres : c'est ce
    // qui garde des fenêtres de taille comparable sur toute l'avenue.
    const BANDS = [
      { min: 7, max: 17, repeatY: 2, seed: 1013 },
      { min: 17, max: 33, repeatY: 4, seed: 7717 },
      { min: 33, max: 58, repeatY: 7, seed: 4441 },
    ];
    // Trois rangées de part et d'autre : la rue a une épaisseur, on ne longe
    // pas un mur plat.
    // ⚠️ Ce sont des positions de FACE INTÉRIEURE, pas des axes. Avec un axe,
    // un immeuble large de 13 posé sur un axe à 14 avançait jusqu'à x=7,5,
    // c'est-à-dire À L'INTÉRIEUR de la chaussée (large de 22, donc ±11) : les
    // immeubles se tenaient dans la rue et avalaient les écrans du catalogue.
    const ROAD_EDGE = 13;
    const ROWS = [0, 15, 31];

    const dummy = new Object3D();
    const rnd = rng(20260915);
    const perBand: { m: Matrix4 }[][] = [[], [], []];

    for (const side of [-1, 1]) {
      for (const row of ROWS) {
        for (let z = 30; z > -360; z -= 9 + rnd() * 7) {
          const band = row === ROWS[0] ? (rnd() < 0.6 ? 0 : 1) : rnd() < 0.45 ? 1 : 2;
          const b = BANDS[band];
          const h = b.min + rnd() * (b.max - b.min);
          const w = 6 + rnd() * 7;
          const d = 7 + rnd() * 8;
          // Face intérieure alignée sur le bord de rue, corps qui s'éloigne :
          // la chaussée reste dégagée quelle que soit la largeur tirée.
          dummy.position.set(side * (ROAD_EDGE + row + rnd() * 2 + w / 2), h / 2, z);
          dummy.scale.set(w, h, d);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          perBand[band].push({ m: dummy.matrix.clone() });
        }
      }
    }

    BANDS.forEach((b, i) => {
      const list = perBand[i];
      if (list.length === 0) return;
      const tex = facadeTexture(b.seed, b.repeatY);
      textures.push(tex);
      const geo = new BoxGeometry(1, 1, 1);
      const mat = new MeshBasicMaterial({ map: tex });
      const mesh = new InstancedMesh(geo, mat, list.length);
      list.forEach((item, k) => mesh.setMatrixAt(k, item.m));
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      disposables.push(geo, mat, mesh);
    });

    /* ── Les lampadaires ───────────────────────────────────────────────── */
    const glowTex = glowTexture();
    textures.push(glowTex);
    // DEUX matériaux, pas un seul partagé : en fusion additive, la taille et
    // l'opacité se cumulent vite. Avec un halo unique réglé pour les écrans,
    // les lampadaires devenaient des taches orange qui mangeaient la rue.
    const lampMat = new SpriteMaterial({
      map: glowTex,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
      fog: true,
    });
    const screenGlowMat = new SpriteMaterial({
      map: glowTex,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.32,
      fog: true,
    });
    disposables.push(lampMat, screenGlowMat);

    for (let z = 28; z > -340; z -= 14) {
      for (const side of [-1, 1]) {
        const s = new Sprite(lampMat);
        s.position.set(side * 9.5, 4.2, z);
        s.scale.setScalar(4.2);
        scene.add(s);
      }
    }

    /* ── Les écrans du catalogue, montés sur les façades ───────────────── */
    // Chargés en `anonymous` : i.ytimg.com renvoie bien `access-control-allow-
    // origin: *`, sans quoi WebGL refuserait la texture. En cas d'échec, on ne
    // monte simplement pas l'écran (la scène reste valide).
    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");
    const screenGeo = new PlaneGeometry(1, 1);
    disposables.push(screenGeo);

    thumbnails.slice(0, 8).forEach((url, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const z = 6 - i * 38;
      const y = 11 + (i % 3) * 6;
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          textures.push(tex);
          const mat = new MeshBasicMaterial({ map: tex, toneMapped: false });
          disposables.push(mat);
          const m = new Mesh(screenGeo, mat);
          m.scale.set(19.2, 12, 1); // 16:10, comme les vignettes
          m.position.set(side * 12.6, y, z);
          // L'écran est plaqué sur la façade et regarde la chaussée.
          m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          scene.add(m);

          // Le halo que l'écran jette sur la rue.
          const halo = new Sprite(screenGlowMat);
          halo.position.set(side * 11, y, z);
          halo.scale.setScalar(13);
          scene.add(halo);
        },
        undefined,
        () => {
          /* vignette indisponible : on n'ajoute rien */
        }
      );
    });

    /* ── La marche ─────────────────────────────────────────────────────── */
    const render = () => {
      const p = Math.min(1, Math.max(0, progress.current?.v ?? 0));
      const z = START_Z + (END_Z - START_Z) * p;
      const walked = START_Z - z;

      // Le tangage du pas. C'est lui, et rien d'autre, qui fait la différence
      // entre une balade et un travelling sur rail. Il est indexé sur la
      // DISTANCE parcourue, pas sur le temps : au scrub, le pas reste calé sur
      // le scroll, y compris en remontant.
      camera.position.z = z;
      camera.position.y = EYE + Math.sin(walked * 0.42) * 0.17;
      camera.position.x = Math.sin(walked * 0.19) * 0.7;
      camera.lookAt(camera.position.x * 0.35, EYE - 0.5, z - 34);
      camera.rotateZ(Math.sin(walked * 0.19 + 1.1) * 0.008);

      renderer.render(scene, camera);
    };

    render();
    gsap.ticker.add(render);

    const onResize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
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
