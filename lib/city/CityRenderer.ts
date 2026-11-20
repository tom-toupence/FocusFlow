// La ruelle : scène 3D de production (direction « la ville qui ne dort pas »,
// docs/redesign/LAB.md 2·1 et 04-3D-MOTION.md).
//
// Tout est modélisé en code, aucun modèle téléchargé : baies de façades à
// retraits, caissons lumineux (mots réels, latin uniquement), climatiseurs,
// câbles en chaînette, distributeur, lampadaire au sodium, taxi extrudé d'un
// profil dessiné à la main. Sol mouillé = Reflector basse résolution sous un
// asphalte à flaques. Pluie et vapeur en shaders instanciés. Bloom pmndrs.
//
// Le temps de la session EST la nuit de la ruelle (événements de ville) :
//   travail            → rue active, enseignes allumées, pluie fine ;
//   panneau à LED      → le temps restant, au-dessus de la laverie ;
//   distraction        → une enseigne grésille ;
//   fin de pomodoro    → la halte : les enseignes s'éteignent du fond vers
//                        nous, restent la supérette, le distributeur, le
//                        lampadaire ;
//   playlist prolongée → une enseigne neuve s'allume (« OPEN LATE ») ;
//   objectif atteint   → un taxi traverse la ruelle, phares dans les flaques ;
//   amis en focus      → des fenêtres allumées en vert supérette ;
//   thème clair        → la même ruelle au petit matin (uDawn).
//
// Perf : boucle coupée hors écran (IntersectionObserver) et onglet caché,
// pixel ratio plafonné, qualité basse sur petit écran (moins de pluie, miroir
// plus petit). Reduced motion : aucune boucle, une image recalculée à chaque
// changement d'état, événements appliqués sans animation.
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { Text, configureTextBuilder } from "troika-three-text";
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from "postprocessing";
import { animate } from "motion";

// Sans worker : la CSP du site interdit importScripts() depuis un worker blob.
configureTextBuilder({ useWorker: false });

/** Palette de nuit (aucun rose, aucun magenta + cyan). Miroir de globals.css. */
export const NIGHT = {
  sodium: "#ff9a3c",
  konbini: "#53e0a1",
  neon: "#e9f2ff",
  tail: "#ff3b2b",
  taxi: "#ffc21a",
  asphalt: "#0b1016",
};

// Sous-ensembles latins (8 Ko et 3 Ko) des polices de l'app.
const FONT_SIGN = "/fonts/city-signage.woff";
const FONT_LED = "/fonts/city-led.woff";

// Easings nommés (miroir de lib/motion.ts).
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_TIDE: [number, number, number, number] = [0.45, 0, 0.55, 1];
const EASE_CUT: [number, number, number, number] = [0.4, 0, 1, 1];
const EASE_SNAP: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ── Façades : fenêtres calculées dans le shader, éclairage fait main ─────────
const WALL_VERT = /* glsl */ `
varying vec3 vPos; varying vec3 vNor; varying float vSeed;
attribute float aSeed;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz; vNor = normalize(mat3(modelMatrix) * normal); vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WALL_FRAG = /* glsl */ `
uniform float uLit; uniform vec3 uFog; uniform float uFogD; uniform vec3 uSodium;
uniform float uFriends; uniform vec3 uKonbini; uniform float uDawn;
varying vec3 vPos; varying vec3 vNor; varying float vSeed;
float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 n = normalize(vNor);
  // Crépi sombre, légères variations d'un immeuble à l'autre.
  vec3 wall = mix(vec3(0.028, 0.03, 0.033), vec3(0.036, 0.032, 0.028), step(0.5, fract(vSeed * 7.3)));
  // Petit matin : béton gris clair, lumière froide et diffuse venue du ciel.
  vec3 dawnWall = mix(vec3(0.2, 0.215, 0.23), vec3(0.24, 0.23, 0.22), step(0.5, fract(vSeed * 7.3)));
  float sky = 0.55 + 0.45 * max(n.y, 0.0) + 0.15 * (1.0 - abs(n.x));
  // Éclairage fait main, trois sources :
  //  . ambiance froide (le ciel urbain renvoie un peu de lumière) ;
  //  . flaque de sodium serrée autour du lampadaire (côté gauche, z = 4,6) ;
  //  . débord des enseignes : bandes colorées à hauteur d'enseigne.
  float sodium = exp(-max(vPos.y - 0.6, 0.0) * 0.32) * exp(-pow(vPos.z - 4.6, 2.0) * 0.14) * step(vPos.x, 0.0);
  float band = pow(0.5 + 0.5 * sin(vPos.z * 0.45 + vSeed * 6.0), 6.0);
  float spill = exp(-max(vPos.y - 2.5, 0.0) * 0.35) * smoothstep(1.5, 3.0, vPos.y) * band;
  float pick = fract(floor(vPos.z / 7.0) * 0.618 + vSeed);
  vec3 spillCol = pick < 0.4 ? vec3(0.85, 0.92, 1.0) : pick < 0.7 ? vec3(0.32, 0.88, 0.63) : vec3(1.0, 0.6, 0.24);
  vec3 light = vec3(0.16, 0.19, 0.26) + sodium * uSodium * 1.9 + spill * spillCol * 1.6;
  vec3 night = wall * light;
  vec3 col = mix(night, dawnWall * sky, uDawn);
  if (abs(n.y) < 0.5) {
    vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
    vec2 uv = vec2(dot(vPos, t) * 1.5, vPos.y * 1.05);
    vec2 c = floor(uv), f = fract(uv);
    // Fenêtres petites, des étages entiers sans fenêtre (enseignes, techniques).
    float floorOn = step(0.25, h(vec3(c.y, vSeed, 3.0)));
    float win = step(0.26, f.x) * step(f.x, 0.74) * step(0.3, f.y) * step(f.y, 0.72) * step(3.6, vPos.y) * floorOn;
    float r = h(vec3(c, vSeed));
    float lit = step(r, uLit * (1.0 - 0.85 * uDawn)) * win;
    vec3 warm = vec3(1.0, 0.72, 0.42), cold = vec3(0.75, 0.88, 1.0);
    vec3 glass = mix(vec3(0.04, 0.05, 0.07), vec3(0.3, 0.36, 0.42), uDawn);
    col = mix(col, glass, win);
    col = mix(col, mix(warm, cold, step(0.6, h(vec3(c.yx, vSeed)))) * (0.3 + 0.4 * h(c.xyy)), lit);
    // Amis en focus : quelques fenêtres basses et proches, vert supérette.
    float near = step(vPos.z, 6.0) * step(-26.0, vPos.z) * step(vPos.y, 13.0);
    float friend = step(1.0 - uFriends * 0.012, h(vec3(c.xy * 1.7, vSeed + 9.0))) * win * near;
    col = mix(col, uKonbini * mix(0.85, 0.55, uDawn), friend);
  }
  float d = length(vPos - cameraPosition);
  col = mix(col, uFog, 1.0 - exp(-uFogD * uFogD * d * d));
  gl_FragColor = vec4(col, 1.0);
}`;

// ── Sol : asphalte mouillé, flaques qui laissent voir le reflet ─────────────
const GROUND_FRAG = /* glsl */ `
uniform vec3 uFog; uniform float uFogD; uniform float uDawn; varying vec3 vPos;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float puddle = smoothstep(0.36, 0.58, n2(vPos.xz * 0.45) * 0.7 + n2(vPos.xz * 1.7) * 0.3);
  float grit = n2(vPos.xz * 40.0) * mix(0.012, 0.05, uDawn);
  // Le lampadaire au sodium dessine aussi sa flaque de lumière au sol.
  float pool = exp(-(pow(vPos.x + 2.2, 2.0) + pow(vPos.z - 4.6, 2.0)) * 0.3) * (1.0 - uDawn);
  vec3 asphalt = mix(vec3(0.012, 0.014, 0.018), vec3(0.13, 0.14, 0.15), uDawn) + grit + pool * vec3(0.16, 0.07, 0.02);
  float d = length(vPos - cameraPosition);
  vec3 col = mix(asphalt, uFog, 1.0 - exp(-uFogD * uFogD * d * d));
  // Flaque = transparente : on voit le Reflector dessous. Asphalte sec = opaque.
  gl_FragColor = vec4(col, mix(0.86, 0.05, puddle));
}`;
const GROUND_VERT = /* glsl */ `varying vec3 vPos; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

// ── Pluie : traits instanciés animés dans le vertex shader ──────────────────
const RAIN_VERT = /* glsl */ `
uniform float uTime; attribute vec3 aOff; varying float vA;
void main() {
  vec3 p = aOff;
  p.y = mod(aOff.y - uTime * 9.0, 16.0) - 1.0;
  vec4 mv = viewMatrix * modelMatrix * vec4(p + position, 1.0);
  vA = smoothstep(16.0, 4.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const RAIN_FRAG = /* glsl */ `uniform float uAmount; uniform vec3 uTint; varying float vA; void main() { gl_FragColor = vec4(uTint, 0.18 * vA * uAmount); }`;

// ── Vapeur : plans qui montent d'une grille, bruit doux ─────────────────────
const STEAM_FRAG = /* glsl */ `
uniform float uTime; uniform float uSeed; uniform float uAmount; varying vec2 vUv;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 uv = vUv; uv.y -= uTime * 0.12 + uSeed;
  float n = n2(uv * vec2(3.0, 2.0)) * 0.6 + n2(uv * vec2(7.0, 5.0)) * 0.4;
  float shape = smoothstep(0.5, 0.0, abs(vUv.x - 0.5)) * smoothstep(1.0, 0.25, vUv.y) * smoothstep(0.0, 0.15, vUv.y);
  gl_FragColor = vec4(vec3(0.62, 0.66, 0.7), n * shape * 0.22 * uAmount);
}`;
const UV_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

interface Sign {
  group: THREE.Group;
  glow: THREE.MeshBasicMaterial[];
  texts: Text[];
  base: THREE.Color[];
  on: { v: number };
  z: number;
  keep: boolean;
}

export type CityPhase = "work" | "break" | "idle";

export interface CityOptions {
  reducedMotion?: boolean;
  /** 0 = nuit, 1 = petit matin (thème clair). */
  dawn?: number;
  phase?: CityPhase;
  board?: string;
  friends?: number;
}

export interface CityRenderer {
  setPhase: (p: CityPhase) => void;
  setBoard: (text: string) => void;
  setFriends: (n: number) => void;
  setDawn: (v: number) => void;
  /** Distraction : une enseigne grésille. */
  flicker: () => void;
  /** Playlist prolongée : une enseigne neuve s'allume. */
  extend: () => void;
  /** Objectif atteint : un taxi traverse la ruelle. */
  goal: () => void;
  dispose: () => void;
}

/** Profil latéral du taxi, dessiné à la main (mètres), extrudé ensuite. */
function taxiProfile(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-2.1, 0.32);
  s.lineTo(-2.15, 0.62);
  s.quadraticCurveTo(-2.14, 0.8, -1.95, 0.84); // coffre
  s.lineTo(-1.25, 0.88);
  s.quadraticCurveTo(-0.95, 1.36, -0.65, 1.38); // lunette arrière
  s.lineTo(0.55, 1.38);
  s.quadraticCurveTo(0.85, 1.36, 1.15, 0.92); // pare-brise
  s.lineTo(1.95, 0.82);
  s.quadraticCurveTo(2.18, 0.78, 2.2, 0.6); // capot, calandre
  s.lineTo(2.18, 0.32);
  // Passages de roue : on remonte la ligne de bas de caisse en arc.
  s.lineTo(1.72, 0.32);
  s.absarc(1.35, 0.32, 0.37, 0, Math.PI, false);
  s.lineTo(-0.98, 0.32);
  s.absarc(-1.35, 0.32, 0.37, 0, Math.PI, false);
  s.lineTo(-2.1, 0.32);
  return s;
}

export function createCity(canvas: HTMLCanvasElement, opts: CityOptions = {}): CityRenderer {
  const reduce = !!opts.reducedMotion;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 600;
  const low = narrow || (navigator.hardwareConcurrency ?? 8) <= 4;

  // Rendu à la demande (reduced motion, polices chargées) : déclaré en tête,
  // les callbacks de troika peuvent arriver pendant la construction.
  let dirty = true;
  const requestRender = () => { dirty = true; };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.2;

  const NIGHT_FOG = new THREE.Color("#0b1119");
  const DAWN_FOG = new THREE.Color("#9fadba");
  const fogCol = NIGHT_FOG.clone();
  const scene = new THREE.Scene();
  scene.background = fogCol;
  const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  const camRest = new THREE.Vector3(0.4, 1.55, 9);
  cam.position.copy(camRest);
  const look = new THREE.Vector3(-0.3, 4.2, -20);
  cam.lookAt(look);
  const r = rng(11);
  const state = { dawn: opts.dawn ?? 0, phase: opts.phase ?? "work" as CityPhase };

  const wallU = {
    uLit: { value: 0.55 }, uFog: { value: fogCol }, uFogD: { value: 0.035 }, uSodium: { value: new THREE.Color(NIGHT.sodium) },
    uFriends: { value: opts.friends ?? 0 }, uKonbini: { value: new THREE.Color(NIGHT.konbini) }, uDawn: { value: state.dawn },
  };
  const wallMat = new THREE.ShaderMaterial({ vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, uniforms: wallU });
  const disposables: { dispose: () => void }[] = [wallMat];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  // ── Façades : une baie = un immeuble étroit, retraits variés. Toutes les
  // baies d'un côté sont fusionnées en une géométrie (un appel de dessin).
  const signs: Sign[] = [];
  const acPos: THREE.Matrix4[] = [];
  const W = 3.1; // demi-largeur de la ruelle
  for (const side of [-1, 1]) {
    const pos: number[] = [], nor: number[] = [], seed: number[] = [], idx: number[] = [];
    let z = 16; // la rue commence derrière la caméra : aucune face avant en plein champ
    while (z > -60) {
      const w = 3 + r() * 3.2;
      const hgt = 8 + r() * r() * 22;
      const set = r() * 0.35;
      const g = new THREE.BoxGeometry(1.4, hgt, w);
      g.translate(side * (W + 0.7 + set), hgt / 2, z - w / 2);
      const s = r();
      const base = pos.length / 3;
      pos.push(...g.attributes.position.array);
      nor.push(...g.attributes.normal.array);
      for (let i = 0; i < g.attributes.position.count; i++) seed.push(s);
      for (const i of g.index!.array) idx.push(base + i);
      g.dispose();
      // Climatiseurs accrochés en façade
      const n = Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Matrix4().makeTranslation(side * (W - 0.18 + set), 3 + r() * (hgt - 4), z - 0.6 - r() * (w - 1.2));
        if (side > 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
        acPos.push(m);
      }
      z -= w;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
    geo.setIndex(idx);
    scene.add(new THREE.Mesh(geo, wallMat));
  }

  // Climatiseurs : caisson + hélice, instanciés (deux appels de dessin).
  const acBox = new THREE.InstancedMesh(track(new THREE.BoxGeometry(0.32, 0.55, 0.8)), track(new THREE.MeshStandardMaterial({ color: "#8d8a83", roughness: 0.7 })), acPos.length);
  const acFan = new THREE.InstancedMesh(track(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20).rotateZ(Math.PI / 2)), track(new THREE.MeshStandardMaterial({ color: "#3a3b3d", roughness: 0.5 })), acPos.length);
  acPos.forEach((m, i) => {
    acBox.setMatrixAt(i, m);
    acFan.setMatrixAt(i, m.clone().multiply(new THREE.Matrix4().makeTranslation(0.17, 0, 0.08)));
  });
  scene.add(acBox, acFan);

  // ── Enseignes : caissons perpendiculaires au mur, mots réels ─────────────
  const frameMat = track(new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.6 }));
  const buildSign = (word: string, col: string, vertical: boolean, keep: boolean, side: number, y: number, z: number, scale = 1, lightPanel = r() > 0.45): Sign => {
    const group = new THREE.Group();
    const len = (vertical ? 0.66 : Math.max(1.1, word.length * 0.3)) * scale;
    const hgt = (vertical ? word.length * 0.46 + 0.3 : 0.6) * scale;
    group.add(new THREE.Mesh(track(new THREE.BoxGeometry(0.16, hgt, len)), frameMat));
    const glow: THREE.MeshBasicMaterial[] = [];
    const texts: Text[] = [];
    const base: THREE.Color[] = [];
    for (const face of [-1, 1]) {
      const pm = track(new THREE.MeshBasicMaterial({ color: lightPanel ? col : "#141518", toneMapped: false }));
      const panel = new THREE.Mesh(track(new THREE.PlaneGeometry(len - 0.06, hgt - 0.06)), pm);
      panel.position.x = face * 0.081;
      panel.rotation.y = (face * Math.PI) / 2;
      group.add(panel);
      if (lightPanel) { glow.push(pm); base.push(new THREE.Color(col)); }
      const t = new Text();
      t.text = vertical ? word.split("").join("\n") : word;
      t.font = FONT_SIGN;
      t.fontSize = (vertical ? 0.42 : 0.38) * scale;
      t.lineHeight = 1.05;
      t.anchorX = "center"; t.anchorY = "middle"; t.textAlign = "center";
      const ink = lightPanel ? "#14110d" : col;
      t.position.x = face * 0.086;
      t.rotation.y = (face * Math.PI) / 2;
      const tm = track(new THREE.MeshBasicMaterial({ color: ink, toneMapped: false }));
      t.material = tm;
      t.sync(requestRender);
      group.add(t);
      texts.push(t);
      if (!lightPanel) { glow.push(tm); base.push(new THREE.Color(col)); }
    }
    const arm = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.05, 0.05)), frameMat);
    arm.position.set(-side * 0.3, hgt / 2 - 0.1, 0);
    group.add(arm);
    group.position.set(side * (W - 0.55), y, z);
    scene.add(group);
    const s = { group, glow, texts, base, on: { v: 1 }, z, keep, hgt };
    signs.push(s);
    return s;
  };

  const WORDS: [string, string, boolean][] = [
    ["HOTEL", NIGHT.neon, false], ["BAR", NIGHT.sodium, false], ["24", NIGHT.konbini, true], ["COIN LAUNDRY", NIGHT.neon, false],
    ["NOODLES", NIGHT.taxi, false], ["PARKING", NIGHT.neon, false], ["PHARMACY", NIGHT.konbini, false], ["KARAOKE", NIGHT.tail, false],
    ["OPEN", NIGHT.sodium, false], ["HOSTEL", NIGHT.neon, false], ["GRILL", NIGHT.tail, false], ["SAUNA", NIGHT.taxi, false],
  ];
  WORDS.forEach(([word, col, keep], i) => {
    const side = i % 2 === 0 ? -1 : 1;
    buildSign(word, col, word.length <= 7 && r() > 0.35, keep, side, 3 + r() * 5, 2 - i * 3.6 - r() * 1.5, 1.25);
  });

  // Colonnes de caissons empilés, un commerce par étage (mots réels uniquement).
  const STACK = ["BAR", "CLINIC", "DENTAL", "STUDIO", "LOUNGE", "GAMES", "BILLIARDS", "SNACK", "INTERNET", "TAILOR", "PHOTO", "REPAIR", "CAFE", "GYM"];
  const COLS = [NIGHT.neon, NIGHT.sodium, NIGHT.konbini, NIGHT.taxi, NIGHT.neon, NIGHT.tail];
  for (let k = 0; k < (low ? 5 : 7); k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const z = 0.5 - k * 6.2 - r() * 2;
    let y = 2.6;
    const count = 4 + Math.floor(r() * 4);
    for (let j = 0; j < count; j++) {
      const word = STACK[(k * 5 + j * 3) % STACK.length];
      const s = buildSign(word, COLS[(k + j * 2) % COLS.length], false, false, side, y + 0.3, z, 1.15);
      y += (s as Sign & { hgt: number }).hgt + 0.08;
    }
  }

  // L'enseigne neuve de la playlist prolongée : posée, éteinte, au milieu de la rue.
  // Elle est suspendue en travers de la ruelle, face à nous : un caisson
  // parallèle aux murs ne se lirait que par la tranche depuis la caméra.
  const lateSign = buildSign("OPEN LATE", NIGHT.taxi, false, true, -1, 4.6, -13, 1.5, false);
  lateSign.group.rotation.y = Math.PI / 2;
  lateSign.group.position.x = 0.15;
  lateSign.group.children[lateSign.group.children.length - 1].visible = false; // pas de potence
  lateSign.on.v = 0;

  // ── Panneau à LED au-dessus de la laverie : le temps restant ─────────────
  const led = new Text();
  led.text = opts.board ?? "";
  led.font = FONT_LED;
  led.fontSize = 0.62;
  led.anchorX = "center"; led.anchorY = "middle";
  const ledMat = track(new THREE.MeshBasicMaterial({ color: NIGHT.taxi, toneMapped: false }));
  led.material = ledMat;
  const ledG = new THREE.Group();
  ledG.add(new THREE.Mesh(track(new THREE.BoxGeometry(2.8, 0.95, 0.12)), track(new THREE.MeshStandardMaterial({ color: "#07080a", roughness: 0.4 }))));
  led.position.z = 0.065;
  ledG.add(led);
  ledG.position.set(-W + 0.08, 6.4, -4.5);
  ledG.rotation.y = Math.PI / 2;
  led.sync(requestRender);
  scene.add(ledG);

  // ── Câbles en chaînette d'un mur à l'autre ───────────────────────────────
  const cableMat = track(new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.8 }));
  for (let i = 0; i < 9; i++) {
    const z = 4 - i * 6 - r() * 3, y = 6.5 + r() * 4, sag = 0.4 + r() * 0.8;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-W, y, z), new THREE.Vector3(0, y - sag * 2, z + (r() - 0.5) * 2), new THREE.Vector3(W, y + (r() - 0.5), z - r() * 2));
    scene.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 24, 0.014, 5)), cableMat));
  }

  // ── Distributeur automatique et lampadaire, au premier plan ──────────────
  const vm = new THREE.Group();
  vm.add(new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 1.9, 0.75)), track(new THREE.MeshStandardMaterial({ color: "#d9dcdf", roughness: 0.4 }))));
  const vc = document.createElement("canvas");
  vc.width = 128; vc.height = 256;
  const vctx = vc.getContext("2d")!;
  vctx.fillStyle = "#eef6ff"; vctx.fillRect(0, 0, 128, 256);
  const cans = ["#d7372b", "#2c63c7", "#f2b51e", "#3aa85f", "#ebebeb", "#8a6b4a"];
  for (let row = 0; row < 6; row++) for (let c = 0; c < 5; c++) {
    vctx.fillStyle = cans[(row * 5 + c * 3) % cans.length];
    vctx.fillRect(10 + c * 23, 14 + row * 30, 14, 22);
  }
  const vTex = track(new THREE.CanvasTexture(vc));
  vTex.colorSpace = THREE.SRGBColorSpace;
  const vPanel = new THREE.Mesh(track(new THREE.PlaneGeometry(0.72, 1.2)), track(new THREE.MeshBasicMaterial({ map: vTex, toneMapped: false })));
  vPanel.position.set(0, 0.25, 0.38);
  vm.add(vPanel);
  vm.position.set(W - 0.6, 0.95, -1.5);
  vm.rotation.y = -Math.PI / 2;
  scene.add(vm);
  const vmLight = new THREE.PointLight("#dff0ff", 6, 6, 1.8);
  vmLight.position.set(W - 1.4, 1.3, -1.5);
  scene.add(vmLight);

  const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.08, 5, 10)), track(new THREE.MeshStandardMaterial({ color: "#26282b" })));
  pole.position.set(-W + 0.4, 2.5, 4.6);
  scene.add(pole);
  const lampMat = track(new THREE.MeshBasicMaterial({ color: NIGHT.sodium, toneMapped: false }));
  const lampHead = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.12, 0.25)), lampMat);
  lampHead.position.set(-W + 0.65, 5, 4.6);
  scene.add(lampHead);
  const lamp = new THREE.PointLight(NIGHT.sodium, 30, 18, 1.7);
  lamp.position.set(-W + 0.7, 4.8, 4.6);
  const hemi = new THREE.HemisphereLight("#2a3446", "#0a0806", 0.5);
  scene.add(lamp, hemi);

  // ── Le taxi : profil extrudé, toit lumineux, phares et feux arrière ──────
  const taxi = new THREE.Group();
  const body = track(new THREE.ExtrudeGeometry(taxiProfile(), { depth: 1.62, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 8 }));
  body.translate(0, 0, -0.81);
  taxi.add(new THREE.Mesh(body, track(new THREE.MeshStandardMaterial({ color: "#d79f0c", roughness: 0.45, metalness: 0.1 }))));
  // Vitres : un second profil plus petit, sombre, légèrement en saillie.
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-1.12, 0.94); glassShape.quadraticCurveTo(-0.9, 1.3, -0.62, 1.31); glassShape.lineTo(0.52, 1.31); glassShape.quadraticCurveTo(0.8, 1.3, 1.02, 0.95); glassShape.lineTo(-1.12, 0.94);
  const glassGeo = track(new THREE.ExtrudeGeometry(glassShape, { depth: 1.7, bevelEnabled: false }));
  glassGeo.translate(0, 0, -0.85);
  taxi.add(new THREE.Mesh(glassGeo, track(new THREE.MeshStandardMaterial({ color: "#0d1117", roughness: 0.1 }))));
  // Roues : profil de pneu en révolution (flanc arrondi), pas un cylindre brut.
  const tire = track(new THREE.LatheGeometry([0.0, 0.2, 0.3, 0.34, 0.35, 0.34, 0.3].map((x, i) => new THREE.Vector2(Math.max(x, 0.001), i * 0.035 - 0.1)), 18).rotateX(Math.PI / 2));
  const tireMat = track(new THREE.MeshStandardMaterial({ color: "#0c0c0d", roughness: 0.9 }));
  for (const [x, zz] of [[1.35, 0.82], [1.35, -0.82], [-1.35, 0.82], [-1.35, -0.82]]) {
    const w = new THREE.Mesh(tire, tireMat);
    w.position.set(x, 0.33, zz);
    taxi.add(w);
  }
  // Pare-chocs et bas de caisse sombres : la silhouette se lit même en contre-jour.
  const trim = track(new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 0.7 }));
  for (const x of [2.2, -2.15]) {
    const b = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.2, 1.74)), trim);
    b.position.set(x, 0.42, 0); taxi.add(b);
  }
  const sill = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 0.1, 1.76)), trim);
  sill.position.set(0, 0.37, 0); taxi.add(sill);
  const headMat = track(new THREE.MeshBasicMaterial({ color: "#f4f8ff", toneMapped: false }));
  const tailMat = track(new THREE.MeshBasicMaterial({ color: NIGHT.tail, toneMapped: false }));
  for (const zz of [0.55, -0.55]) {
    const hl = new THREE.Mesh(track(new THREE.PlaneGeometry(0.3, 0.12)), headMat);
    hl.position.set(2.23, 0.62, zz); hl.rotation.y = Math.PI / 2; taxi.add(hl);
    const tl = new THREE.Mesh(track(new THREE.PlaneGeometry(0.28, 0.1)), tailMat);
    tl.position.set(-2.18, 0.66, zz); tl.rotation.y = -Math.PI / 2; taxi.add(tl);
  }
  const roof = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.18, 0.7)), track(new THREE.MeshBasicMaterial({ color: "#fff1c2", toneMapped: false })));
  roof.position.set(-0.05, 1.5, 0);
  taxi.add(roof);
  const roofText = new Text();
  roofText.text = "TAXI"; roofText.font = FONT_SIGN; roofText.fontSize = 0.13;
  roofText.anchorX = "center"; roofText.anchorY = "middle";
  roofText.material = track(new THREE.MeshBasicMaterial({ color: "#1a1408", toneMapped: false }));
  roofText.position.set(-0.05, 1.5, 0.352);
  roofText.sync(requestRender);
  taxi.add(roofText);
  const beam = new THREE.PointLight("#eaf2ff", 0, 12, 1.6);
  beam.position.set(5.5, 0.25, 0);
  taxi.add(beam);
  // Le taxi roule vers nous : son avant (+x local) pointe vers +z.
  taxi.rotation.y = -Math.PI / 2;
  taxi.position.set(1.15, 0, -70);
  taxi.visible = false;
  taxi.scale.setScalar(0.92);
  scene.add(taxi);

  // ── Sol mouillé : miroir basse résolution (flou naturel) sous l'asphalte ──
  const mirror = new Reflector(track(new THREE.PlaneGeometry(2 * W, 80)), { textureWidth: low ? 256 : 384, textureHeight: low ? 320 : 512, color: 0x8a929c, clipBias: 0.003 });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0, -30);
  scene.add(mirror);
  const groundU = { uFog: { value: fogCol }, uFogD: { value: 0.035 }, uDawn: { value: state.dawn } };
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(2 * W, 80)), track(new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, transparent: true, uniforms: groundU })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0.003, -30);
  scene.add(ground);

  // ── Pluie et vapeur ──────────────────────────────────────────────────────
  const N = low ? 600 : 1400;
  const rainGeo = track(new THREE.InstancedBufferGeometry());
  const streak = track(new THREE.PlaneGeometry(0.008, 0.38));
  rainGeo.index = streak.index;
  rainGeo.setAttribute("position", streak.attributes.position);
  const off = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) off.set([(r() - 0.5) * 2 * W, r() * 16, 8 - r() * 30], i * 3);
  rainGeo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
  rainGeo.instanceCount = N;
  const rainU = { uTime: { value: 0 }, uAmount: { value: 1 }, uTint: { value: new THREE.Color(0.75, 0.82, 0.9) } };
  scene.add(new THREE.Mesh(rainGeo, track(new THREE.ShaderMaterial({ vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
  const steamU: { uTime: { value: number }; uSeed: { value: number }; uAmount: { value: number } }[] = [];
  for (let i = 0; i < 3; i++) {
    const u = { uTime: { value: 0 }, uSeed: { value: i * 0.37 }, uAmount: { value: 1 } };
    steamU.push(u);
    const s = new THREE.Mesh(track(new THREE.PlaneGeometry(1.6, 3.2)), track(new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: STEAM_FRAG, uniforms: u, transparent: true, depthWrite: false })));
    s.position.set(1.2 + i * 0.25, 1.6, -7 - i * 0.3);
    s.rotation.y = -0.2 + i * 0.2;
    scene.add(s);
  }

  // ── Post-traitement : bloom sur ce qui émet vraiment ─────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new BloomEffect({ luminanceThreshold: 0.55, luminanceSmoothing: 0.2, intensity: 1.15, mipmapBlur: true, resolutionScale: low ? 0.4 : 0.5 });
  composer.addPass(new EffectPass(cam, bloom));

  // ── Rendu : boucle seulement si visible, sinon une image à la demande ────

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const a = w / h;
    cam.aspect = a;
    // Bandeau très large (résumé) : focale plus longue, regard plus haut.
    cam.fov = a < 1 ? 62 : a > 2.6 ? 30 : 46;
    look.y = a > 2.6 ? 5.4 : 4.2;
    cam.lookAt(look);
    cam.updateProjectionMatrix();
    requestRender();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Halte, nuit/matin : appliqués à chaque image (quelques dizaines de matériaux).
  const applyLights = () => {
    const d = state.dawn;
    const signK = 1 - 0.88 * d;
    for (const s of signs) s.glow.forEach((m, i) => m.color.copy(s.base[i]).multiplyScalar((0.06 + 0.94 * s.on.v) * signK + 0.12 * d));
    fogCol.copy(NIGHT_FOG).lerp(DAWN_FOG, d);
    wallU.uDawn.value = d;
    groundU.uDawn.value = d;
    wallU.uFogD.value = groundU.uFogD.value = 0.035 - 0.01 * d;
    hemi.intensity = 0.5 + 1.5 * d;
    renderer.toneMappingExposure = 1.2 - 0.3 * d;
    hemi.color.set(d > 0.5 ? "#cdd8e3" : "#2a3446");
    lamp.intensity = 30 * (1 - 0.8 * d);
    lampMat.color.set(NIGHT.sodium).multiplyScalar(1 - 0.6 * d);
    bloom.intensity = 1.15 * (1 - 0.75 * d);
    rainU.uTint.value.setRGB(0.75 - 0.45 * d, 0.82 - 0.45 * d, 0.9 - 0.45 * d);
    ledMat.color.set(NIGHT.taxi).multiplyScalar(1 - 0.35 * d);
  };

  let visible = true;
  let tabVisible = !document.hidden;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestRender(); });
  io.observe(canvas);
  const onVis = () => { tabVisible = !document.hidden; if (tabVisible) requestRender(); };
  document.addEventListener("visibilitychange", onVis);

  // Taxi : avance piloté par une valeur 0..1 (position le long de la rue).
  const taxiRun = { t: -1 };
  const placeTaxi = () => {
    if (taxiRun.t < 0 || taxiRun.t > 1) { taxi.visible = false; beam.intensity = 0; return; }
    taxi.visible = true;
    taxi.position.z = -55 + taxiRun.t * 70;
    beam.intensity = 10;
  };

  const t0 = performance.now();
  let animating = 0; // animations en cours : forcent le rendu même en reduced motion
  const loop = () => {
    if (!visible || !tabVisible) return;
    if (reduce && !dirty && animating === 0) return;
    const t = (performance.now() - t0) / 1000;
    if (!reduce) {
      rainU.uTime.value = t;
      steamU.forEach((u) => (u.uTime.value = t));
    }
    placeTaxi();
    applyLights();
    composer.render();
    dirty = false;
  };
  renderer.setAnimationLoop(loop);

  const run = (p: { finished: Promise<unknown> } | undefined) => {
    if (!p) return;
    animating++;
    p.finished.finally(() => { animating--; requestRender(); });
  };
  const tween = <T extends object>(target: T, to: Record<string, number | number[]>, o: Record<string, unknown> = {}) => {
    if (reduce) {
      for (const k in to) { const v = to[k]; (target as Record<string, number>)[k] = Array.isArray(v) ? v[v.length - 1] : v; }
      requestRender();
      return;
    }
    run(animate(target, to as never, o as never) as unknown as { finished: Promise<unknown> });
  };

  // Entrée : léger travelling avant dans la ruelle, puis repos.
  if (!reduce) {
    run(animate(cam.position, { z: [11, camRest.z], y: [1.75, camRest.y] }, { duration: 2.6, ease: EASE_OUT, onUpdate: () => cam.lookAt(look) }) as unknown as { finished: Promise<unknown> });
  }

  /** Amorçage d'un tube néon : ratés irréguliers puis allumé. */
  const ignite = (s: Sign, delay: number) =>
    tween(s.on, { v: [0, 0.8, 0.1, 0.6, 0.05, 1] }, { duration: 0.9, delay, times: [0, 0.12, 0.2, 0.45, 0.55, 1], ease: EASE_SNAP });

  const halt = (on: boolean) => {
    if (on) {
      // La halte : les enseignes s'éteignent du fond vers nous, sauf la supérette.
      const order = [...signs].sort((a, b) => a.z - b.z);
      order.forEach((s, i) => { if (!s.keep) tween(s.on, { v: [s.on.v, 0.3, 0.8, 0] }, { duration: 0.5, delay: 0.15 + (i / order.length) * 2, times: [0, 0.3, 0.45, 1], ease: EASE_CUT }); });
      tween(rainU.uAmount, { value: 0.3 }, { duration: 3, ease: EASE_TIDE });
      tween(wallU.uLit, { value: 0.22 }, { duration: 3, ease: EASE_TIDE });
      tween(cam.position, { z: camRest.z + 0.8, y: camRest.y - 0.1 }, { duration: 2.4, ease: EASE_OUT, onUpdate: () => cam.lookAt(look) });
    } else {
      const order = [...signs].sort((a, b) => b.z - a.z);
      order.forEach((s, i) => { if (!s.keep && s.on.v < 0.5) ignite(s, (i / order.length) * 1.6); });
      tween(rainU.uAmount, { value: 1 }, { duration: 2, ease: EASE_TIDE });
      tween(wallU.uLit, { value: 0.55 }, { duration: 2, ease: EASE_TIDE });
      tween(cam.position, { z: camRest.z, y: camRest.y }, { duration: 2, ease: EASE_OUT, onUpdate: () => cam.lookAt(look) });
    }
  };

  // État initial sans animation.
  if (state.phase === "break") {
    for (const s of signs) if (!s.keep) s.on.v = 0;
    rainU.uAmount.value = 0.3;
    wallU.uLit.value = 0.22;
  }
  applyLights();

  return {
    setPhase: (p) => {
      if (p === state.phase) return;
      const wasBreak = state.phase === "break";
      state.phase = p;
      if (p === "break") halt(true);
      else if (wasBreak) halt(false);
    },
    setBoard: (text) => {
      if (led.text === text) return;
      led.text = text;
      led.sync(requestRender);
    },
    setFriends: (n) => { wallU.uFriends.value = Math.max(0, Math.min(n, 12)); requestRender(); },
    setDawn: (v) => { tween(state, { dawn: v }, { duration: 1.2, ease: EASE_TIDE }); },
    flicker: () => {
      const lit = signs.filter((s) => s.on.v > 0.5 && s !== lateSign);
      const s = lit[Math.floor(Math.random() * lit.length)];
      if (s) tween(s.on, { v: [1, 0.15, 0.9, 0.05, 0.7, 0.2, 1] }, { duration: 1.1, times: [0, 0.1, 0.18, 0.32, 0.5, 0.62, 1], ease: EASE_SNAP });
    },
    extend: () => {
      if (lateSign.on.v > 0.5) {
        // Déjà allumée : un clin d'œil (deux ratés) suffit à signaler le nouveau lot.
        tween(lateSign.on, { v: [1, 0.2, 1, 0.3, 1] }, { duration: 0.8, times: [0, 0.2, 0.4, 0.6, 1], ease: EASE_SNAP });
      } else ignite(lateSign, 0.1);
    },
    goal: () => {
      if (reduce) { requestRender(); return; }
      if (taxiRun.t >= 0 && taxiRun.t <= 1) return;
      // Le taxi arrive de loin, ralentit à notre hauteur puis file derrière nous.
      tween(taxiRun, { t: [0, 0.78, 1.05] }, { duration: 6.5, times: [0, 0.7, 1], ease: [0.3, 0.1, 0.4, 1] });
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      composer.dispose();
      mirror.getRenderTarget().dispose();
      (mirror.material as THREE.Material).dispose();
      signs.forEach((s) => s.texts.forEach((t) => t.dispose()));
      led.dispose();
      roofText.dispose();
      acBox.dispose(); acFan.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
