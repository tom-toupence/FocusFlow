"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
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
  WebGLRenderer,
  type Texture,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// ═══════════════════════════════════════════════════════════════════════════
// LE MONDE — une avenue nocturne, derrière TOUTE la page
//
// ── Pourquoi c'est le fond de page, et pas une section ────────────────────
// La version d'avant posait cette scène dans une section épinglée, au milieu
// d'une page dont le reste était photographique. Résultat : un bloc noir
// rapporté, qui ne partageait ni la lumière, ni les couleurs, ni le grain du
// reste. Le raccord était impossible à rattraper parce que le problème était
// structurel.
// Ici la scène EST le décor de la page entière : le scroll fait marcher la
// caméra du haut au bas du document, et le contenu se lit par-dessus. Il n'y a
// plus rien à incruster, et la ville a enfin la place de respirer.
//
// ── La nuit tombe pendant qu'on marche ────────────────────────────────────
// Un pomodoro c'est du temps qui passe. En descendant l'avenue, le couchant
// s'éteint, le brouillard s'épaissit, et LES FENÊTRES S'ALLUMENT : la couleur
// du matériau des façades est multipliée au fil de la marche, donc les carrés
// lumineux montent pendant que le ciel tombe. C'est une seule ligne de code, et
// c'est tout le propos du produit.
//
// ── Ce qui la rend belle plutôt que bricolée ──────────────────────────────
//   1. des SILHOUETTES : les immeubles sont quasi noirs, seules les fenêtres
//      existent. On ne cherche pas le détail, on cherche la découpe.
//   2. du BROUILLARD EXPONENTIEL dense : la profondeur se lit toute seule et
//      le fond se dissout dans le ciel, sans ligne de raccord.
//   3. du BLOOM : c'est lui, et rien d'autre, qui fait qu'une ville de nuit
//      rendue en temps réel cesse d'avoir l'air d'un jeu vidéo de 2005.
//   4. UNE SEULE couleur chaude (l'ambre de la page) sur un indigo froid.
//
// ── Fluidité ──────────────────────────────────────────────────────────────
// Rendu À LA DEMANDE : si la position de scroll n'a pas bougé, on ne repeint
// rien du tout. À l'arrêt, le coût GPU de cette page est donc nul. Le reste
// tient en quelques appels de dessin (les immeubles sont instanciés), en
// matériaux non éclairés (une ville de nuit n'est que de l'émissif, il n'y a
// aucune lumière à calculer) et en un bloom à demi-résolution.
//
// ── Déterminisme ──────────────────────────────────────────────────────────
// Générateur pseudo-aléatoire à graine : la ville est identique à chaque
// visite. Aucun `Math.random`.
// ═══════════════════════════════════════════════════════════════════════════

/** L'avancée de la marche, 0 à 1, écrite par le ScrollTrigger de la page et
 *  lue à la frame. Aucune valeur ne transite par un state React. */
export type WalkProgress = { v: number };

const EYE = 5.6;
const START_Z = 70;
const END_Z = -980;

/** Mulberry32 : court, rapide, reproductible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une façade : noire, percée de fenêtres. Le fond reste très sombre pour que
 *  l'immeuble se lise en silhouette et que seules les lumières existent. */
function facadeTexture(seed: number, repeatY: number): Texture {
  const W = 64;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#04050a";
  ctx.fillRect(0, 0, W, H);

  const rnd = rng(seed);
  const cols = 6;
  const rows = 26;
  const cw = W / cols;
  const ch = H / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const r = rnd();
      if (r < 0.68) continue;
      const a = r > 0.975 ? 1 : r > 0.9 ? 0.6 : 0.26;
      ctx.fillStyle = `rgba(255,198,140,${a})`;
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

/** Le ciel : un dégradé vertical, tenu derrière la ville. Il est teinté au fil
 *  de la marche par `material.color`, ce qui évite de régénérer la texture. */
function skyTexture(): Texture {
  const W = 8;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0a1738");
  g.addColorStop(0.55, "#222a4e");
  g.addColorStop(0.82, "#7a4a30");
  g.addColorStop(1, "#d8823c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
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
  g.addColorStop(0, "rgba(255,206,150,1)");
  g.addColorStop(0.3, "rgba(255,180,110,0.35)");
  g.addColorStop(1, "rgba(255,170,100,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export default function CityScene({
  progress,
  thumbnails,
}: {
  progress: React.RefObject<WalkProgress>;
  /** Vignettes du catalogue, montées en écrans géants sur les façades. */
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
      return; // pas de WebGL : le parent affiche un repli
    }

    const DUSK_FOG = new Color(0x2a2b44);
    const NIGHT_FOG = new Color(0x05060c);

    // Le bloom double le coût de remplissage : on plafonne bas, l'image est de
    // toute façon composée de silhouettes et de lumières, pas de détail fin.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.fog = new FogExp2(DUSK_FOG.getHex(), 0.0042);

    const camera = new PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.8, 1400);
    camera.position.set(0, EYE, START_Z);

    const textures: Texture[] = [];
    const disposables: { dispose: () => void }[] = [];

    /* ── Le ciel ───────────────────────────────────────────────────────── */
    // Un plan très large, accroché à la caméra : il ne se rapproche jamais et
    // ne prend donc jamais le brouillard.
    const skyTex = skyTexture();
    textures.push(skyTex);
    const skyGeo = new PlaneGeometry(2, 2);
    const skyMat = new MeshBasicMaterial({ map: skyTex, fog: false, depthWrite: false, depthTest: false });
    const sky = new Mesh(skyGeo, skyMat);
    sky.position.z = -1;
    sky.renderOrder = -1;
    camera.add(sky);
    scene.add(camera);
    disposables.push(skyGeo, skyMat);
    // Le plan est en coordonnées caméra : on le dimensionne pour couvrir le
    // champ de vision à un mètre devant l'objectif.
    const fitSky = () => {
      const h = 2 * Math.tan((camera.fov * Math.PI) / 360);
      sky.scale.set((h * camera.aspect) / 2, h / 2, 1);
    };
    fitSky();

    /* ── Le sol ────────────────────────────────────────────────────────── */
    const groundGeo = new PlaneGeometry(400, 2400);
    const groundMat = new MeshBasicMaterial({ color: 0x070810 });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -800;
    scene.add(ground);
    disposables.push(groundGeo, groundMat);

    /* ── Les immeubles, en silhouettes ─────────────────────────────────── */
    const BANDS = [
      { min: 9, max: 22, repeatY: 3, seed: 1013 },
      { min: 22, max: 46, repeatY: 6, seed: 7717 },
      { min: 46, max: 88, repeatY: 11, seed: 4441 },
    ];
    // Positions de FACE INTÉRIEURE, pas d'axes : sinon un immeuble large se
    // plante au milieu de la chaussée.
    const ROAD_EDGE = 15;
    const ROWS = [0, 19, 41, 68];

    const dummy = new Object3D();
    const rnd = rng(20260915);
    const perBand: Matrix4[][] = [[], [], []];

    for (const side of [-1, 1]) {
      for (let r = 0; r < ROWS.length; r++) {
        const row = ROWS[r];
        for (let z = START_Z; z > END_Z - 80; z -= 11 + rnd() * 9) {
          const band = r === 0 ? (rnd() < 0.55 ? 0 : 1) : r === 1 ? (rnd() < 0.5 ? 1 : 2) : rnd() < 0.3 ? 1 : 2;
          const b = BANDS[band];
          const h = b.min + rnd() * (b.max - b.min);
          const w = 7 + rnd() * 9;
          const d = 8 + rnd() * 10;
          const x = side * (ROAD_EDGE + row + rnd() * 3 + w / 2);

          dummy.position.set(x, h / 2, z);
          dummy.scale.set(w, h, d);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          perBand[band].push(dummy.matrix.clone());

          // Un retrait au sommet une fois sur trois : c'est cette découpe en
          // gradins qui empêche la skyline d'être une rangée de boîtes.
          if (rnd() < 0.34 && h > 24) {
            const h2 = h * (0.2 + rnd() * 0.3);
            dummy.position.set(x, h + h2 / 2, z);
            dummy.scale.set(w * 0.6, h2, d * 0.6);
            dummy.updateMatrix();
            perBand[Math.min(2, band + 1)].push(dummy.matrix.clone());
          }
        }
      }
    }

    const facadeMats: MeshBasicMaterial[] = [];
    BANDS.forEach((b, i) => {
      const list = perBand[i];
      if (list.length === 0) return;
      const tex = facadeTexture(b.seed, b.repeatY);
      textures.push(tex);
      const geo = new BoxGeometry(1, 1, 1);
      const mat = new MeshBasicMaterial({ map: tex });
      facadeMats.push(mat);
      const mesh = new InstancedMesh(geo, mat, list.length);
      list.forEach((m, k) => mesh.setMatrixAt(k, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false; // une seule boîte englobante géante : le test coûterait plus qu'il ne rapporte
      scene.add(mesh);
      disposables.push(geo, mat, mesh);
    });

    /* ── Les lampadaires ───────────────────────────────────────────────── */
    const glowTex = glowTexture();
    textures.push(glowTex);
    const lampMat = new SpriteMaterial({
      map: glowTex,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      // Très discret : le bloom, en aval, se charge de faire rayonner ces
      // points. Cumulé avec un sprite large, on obtenait des boules orange qui
      // mangeaient la rue.
      opacity: 0.3,
      fog: true,
    });
    const screenGlowMat = new SpriteMaterial({
      map: glowTex,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.18,
      fog: true,
    });
    disposables.push(lampMat, screenGlowMat);

    for (let z = START_Z; z > END_Z; z -= 22) {
      for (const side of [-1, 1]) {
        const s = new Sprite(lampMat);
        s.position.set(side * 11, 4.6, z);
        s.scale.setScalar(2.4);
        scene.add(s);
      }
    }

    /* ── Les écrans du catalogue, sur les façades ──────────────────────── */
    // i.ytimg.com renvoie `access-control-allow-origin: *`, indispensable pour
    // en faire des textures WebGL. Une vignette qui échoue est simplement
    // ignorée : la scène reste valide.
    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");
    const screenGeo = new PlaneGeometry(1, 1);
    disposables.push(screenGeo);

    const n = Math.max(1, thumbnails.length);
    thumbnails.forEach((url, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      // Répartis sur toute la descente, pas groupés : on en croise un de temps
      // en temps, comme des enseignes.
      const z = START_Z - 120 - (i / n) * (START_Z - END_Z - 220);
      const y = 13 + (i % 3) * 8;
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          textures.push(tex);
          const mat = new MeshBasicMaterial({ map: tex, toneMapped: false, fog: true });
          disposables.push(mat);
          const m = new Mesh(screenGeo, mat);
          m.scale.set(22.4, 14, 1); // 16:10, comme les vignettes
          m.position.set(side * 14.6, y, z);
          m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          scene.add(m);

          const halo = new Sprite(screenGlowMat);
          halo.position.set(side * 12.5, y, z);
          halo.scale.setScalar(10);
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
    const bloom = new UnrealBloomPass(size.clone().multiplyScalar(0.5), 0.62, 0.55, 0.62);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    disposables.push(composer, bloom);

    /* ── La marche ─────────────────────────────────────────────────────── */
    const fogColor = new Color();
    const skyTint = new Color();
    // Rendu À LA DEMANDE : sans mouvement, pas une frame n'est dessinée.
    let last = Number.NaN;

    const draw = (p: number) => {
      const z = START_Z + (END_Z - START_Z) * p;
      const walked = START_Z - z;

      // Le tangage du pas, indexé sur la DISTANCE et non sur le temps : au
      // scrub le pas reste calé sur le scroll, y compris en remontant. C'est
      // lui qui distingue une balade d'un travelling sur rail.
      camera.position.z = z;
      camera.position.y = EYE + Math.sin(walked * 0.34) * 0.2;
      camera.position.x = Math.sin(walked * 0.15) * 0.9;
      camera.lookAt(camera.position.x * 0.3, EYE - 0.6, z - 40);
      camera.rotateZ(Math.sin(walked * 0.15 + 1.1) * 0.009);

      // La nuit tombe sur le premier tiers de la descente.
      const night = Math.min(1, p / 0.34);
      fogColor.copy(DUSK_FOG).lerp(NIGHT_FOG, night);
      (scene.fog as FogExp2).color.copy(fogColor);
      (scene.fog as FogExp2).density = 0.0042 + night * 0.0052;
      skyTint.setScalar(1).lerp(new Color(0x2a3150), night);
      skyMat.color.copy(skyTint);
      // ...et les fenêtres s'allument pendant qu'il fait sombre.
      const lit = 0.45 + night * 0.95;
      facadeMats.forEach((m) => m.color.setScalar(lit));
      bloom.strength = 0.42 + night * 0.4;

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
      fitSky();
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

