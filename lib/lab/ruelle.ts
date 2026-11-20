// LAB 2·1 · Ruelle sous la pluie
// Techniques nouvelles pour le projet : troika-three-text (enseignes en vraie
// typographie SDF dans la 3D), Reflector (sol mouillé qui reflète), pluie et
// vapeur en shaders instanciés, bloom pmndrs sur les sources lumineuses.
//
// Tout est modélisé en code : baies de façades, caissons lumineux empilés et
// enseignes en drapeau, climatiseurs, conduites, câbles en chaînette,
// distributeur automatique, lampadaire au sodium.
//
// Le temps de la session EST la nuit de la ruelle :
//   travail   → rue active, toutes les enseignes allumées, pluie fine ;
//   la minute → le panneau à LED au-dessus de la laverie affiche le temps restant ;
//   distraction → une enseigne grésille ;
//   fin de pomodoro → les enseignes s'éteignent du fond vers nous : la halte.
//     Restent le distributeur, le lampadaire et la supérette (vert) ;
//   reprise → elles se rallument de près en loin, avec l'amorçage des tubes.
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { Text, configureTextBuilder } from "troika-three-text";

// Sans worker : la CSP du site interdit importScripts() depuis un worker blob.
configureTextBuilder({ useWorker: false });
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from "postprocessing";
import { animate } from "motion";
import { reportInfo } from "@/lib/lab/LabShell";

/** Palette de nuit (aucun rose, aucun magenta + cyan). */
export const NIGHT = {
  sodium: "#ff9a3c",
  konbini: "#53e0a1",
  neon: "#e9f2ff",
  tail: "#ff3b2b",
  taxi: "#ffc21a",
  asphalt: "#0a0e13",
};

const FONT_SIGN = "/lab/fonts/BigShoulders.ttf";
const FONT_LED = "/lab/fonts/Doto.ttf";

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
varying vec3 vPos; varying vec3 vNor; varying float vSeed;
float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 n = normalize(vNor);
  vec3 wall = mix(vec3(0.075, 0.08, 0.085), vec3(0.095, 0.085, 0.075), step(0.5, fract(vSeed * 7.3)));
  // Taches de lumière : le lampadaire au sodium près de nous, des enseignes plus loin.
  float sodium = exp(-max(vPos.y - 1.0, 0.0) * 0.35) * exp(-pow(vPos.z - 4.6, 2.0) * 0.03) * step(vPos.x, 0.0) * 0.8;
  float spill = exp(-max(vPos.y - 2.5, 0.0) * 0.4) * (0.5 + 0.5 * sin(vPos.z * 0.45 + vSeed * 6.0)) * 0.35;
  vec3 col = wall * (0.3 + sodium * uSodium * 1.6 + spill * vec3(0.5, 0.95, 0.75));
  if (abs(n.y) < 0.5) {
    vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
    vec2 uv = vec2(dot(vPos, t) * 1.5, vPos.y * 1.05);
    vec2 c = floor(uv), f = fract(uv);
    // Fenêtres plus petites, des étages entiers sans fenêtre (enseignes, techniques).
    float floorOn = step(0.25, h(vec3(c.y, vSeed, 3.0)));
    float win = step(0.26, f.x) * step(f.x, 0.74) * step(0.3, f.y) * step(f.y, 0.72) * step(3.6, vPos.y) * floorOn;
    float r = h(vec3(c, vSeed));
    float lit = step(r, uLit) * win;
    vec3 warm = vec3(1.0, 0.72, 0.42), cold = vec3(0.75, 0.88, 1.0);
    vec3 glass = vec3(0.04, 0.05, 0.07);
    col = mix(col, glass, win);
    col = mix(col, mix(warm, cold, step(0.6, h(vec3(c.yx, vSeed)))) * (0.3 + 0.4 * h(c.xyy)), lit);
  }
  float d = length(vPos - cameraPosition);
  col = mix(col, uFog, 1.0 - exp(-uFogD * uFogD * d * d));
  gl_FragColor = vec4(col, 1.0);
}`;

// ── Sol : asphalte mouillé, flaques qui laissent voir le reflet ─────────────
const GROUND_FRAG = /* glsl */ `
uniform vec3 uFog; uniform float uFogD; varying vec3 vPos;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float puddle = smoothstep(0.36, 0.58, n2(vPos.xz * 0.45) * 0.7 + n2(vPos.xz * 1.7) * 0.3);
  float grit = n2(vPos.xz * 40.0) * 0.05;
  vec3 asphalt = vec3(0.035, 0.04, 0.048) + grit;
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
  vec4 mv = viewMatrix * modelMatrix * vec4(p + position * vec3(1.0, 1.0, 1.0), 1.0);
  vA = smoothstep(16.0, 4.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const RAIN_FRAG = /* glsl */ `uniform float uAmount; varying float vA; void main() { gl_FragColor = vec4(vec3(0.75, 0.82, 0.9), 0.18 * vA * uAmount); }`;

// ── Vapeur : plans qui montent d'une grille, bruit doux ─────────────────────
const STEAM_FRAG = /* glsl */ `
uniform float uTime; uniform float uSeed; varying vec2 vUv;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 uv = vUv; uv.y -= uTime * 0.12 + uSeed;
  float n = n2(uv * vec2(3.0, 2.0)) * 0.6 + n2(uv * vec2(7.0, 5.0)) * 0.4;
  float shape = smoothstep(0.5, 0.0, abs(vUv.x - 0.5)) * smoothstep(1.0, 0.25, vUv.y) * smoothstep(0.0, 0.15, vUv.y);
  gl_FragColor = vec4(vec3(0.62, 0.66, 0.7), n * shape * 0.22);
}`;
const UV_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

interface Sign { group: THREE.Group; glow: THREE.MeshBasicMaterial[]; texts: Text[]; base: THREE.Color[]; on: { v: number }; z: number; keep: boolean }

export interface RuelleScene {
  setMinutes: (m: number) => void;
  halt: (on: boolean) => void;
  flicker: () => void;
  dispose: () => void;
}

export function createRuelle(canvas: HTMLCanvasElement): RuelleScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.2;
  const fogCol = new THREE.Color("#0b1119");
  const scene = new THREE.Scene();
  scene.background = fogCol.clone();
  const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  cam.position.set(0.4, 1.55, 9);
  const look = new THREE.Vector3(-0.3, 4.2, -20);
  cam.lookAt(look);
  const r = rng(11);

  const wallU = { uLit: { value: 0.55 }, uFog: { value: fogCol }, uFogD: { value: 0.035 }, uSodium: { value: new THREE.Color(NIGHT.sodium) } };
  const wallMat = new THREE.ShaderMaterial({ vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, uniforms: wallU });

  // ── Façades : une baie = un immeuble étroit, retraits variés ──────────────
  const signs: Sign[] = [];
  const acPos: THREE.Matrix4[] = [];
  const W = 3.1; // demi-largeur de la ruelle
  for (const side of [-1, 1]) {
    let z = 16; // la rue commence derrière la caméra : aucune face avant en plein champ
    while (z > -60) {
      const w = 3 + r() * 3.2;
      const hgt = 8 + r() * r() * 22;
      const set = r() * 0.35;
      const g = new THREE.BoxGeometry(1.4, hgt, w);
      g.translate(side * (W + 0.7 + set), hgt / 2, z - w / 2);
      const seeds = new Float32Array(g.attributes.position.count).fill(r());
      g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      scene.add(new THREE.Mesh(g, wallMat));
      // Climatiseurs accrochés en façade
      const n = Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Matrix4().makeTranslation(side * (W - 0.18 + set), 3 + r() * (hgt - 4), z - 0.6 - r() * (w - 1.2));
        if (side > 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
        acPos.push(m);
      }
      z -= w;
    }
  }
  // Climatiseurs : caisson + hélice, instanciés (deux appels de dessin).
  const acBox = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.55, 0.8), new THREE.MeshStandardMaterial({ color: "#8d8a83", roughness: 0.7 }), acPos.length);
  const acFan = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#3a3b3d", roughness: 0.5 }), acPos.length);
  acPos.forEach((m, i) => {
    acBox.setMatrixAt(i, m);
    acFan.setMatrixAt(i, m.clone().multiply(new THREE.Matrix4().makeTranslation(0.17, 0, 0.08)));
  });
  scene.add(acBox, acFan);

  // ── Enseignes : drapeaux perpendiculaires et caissons à plat, mots réels ──
  const WORDS: [string, string, boolean][] = [
    ["HOTEL", NIGHT.neon, false], ["BAR", NIGHT.sodium, false], ["24", NIGHT.konbini, true], ["COIN LAUNDRY", NIGHT.neon, false],
    ["NOODLES", NIGHT.taxi, false], ["PARKING", NIGHT.neon, false], ["PHARMACY", NIGHT.konbini, false], ["KARAOKE", NIGHT.tail, false],
    ["OPEN", NIGHT.sodium, false], ["HOSTEL", NIGHT.neon, false], ["GRILL", NIGHT.tail, false], ["SAUNA", NIGHT.taxi, false],
  ];
  /** Caisson lumineux perpendiculaire au mur (faces visibles depuis la rue). */
  const buildSign = (word: string, col: string, vertical: boolean, keep: boolean, side: number, y: number, z: number, scale = 1, lightPanel = r() > 0.45) => {
    const group = new THREE.Group();
    const len = (vertical ? 0.66 : Math.max(1.1, word.length * 0.3)) * scale;
    const hgt = (vertical ? word.length * 0.46 + 0.3 : 0.6) * scale;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, hgt, len), new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.6 }));
    group.add(frame);
    const glow: THREE.MeshBasicMaterial[] = [];
    const texts: Text[] = [];
    const base: THREE.Color[] = [];
    for (const face of [-1, 1]) {
      const pm = new THREE.MeshBasicMaterial({ color: lightPanel ? col : "#141518", toneMapped: false });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.06, hgt - 0.06), pm);
      panel.position.x = face * 0.081;
      panel.rotation.y = face * Math.PI / 2;
      group.add(panel);
      if (lightPanel) { glow.push(pm); base.push(new THREE.Color(col)); }
      const t = new Text();
      t.text = vertical ? word.split("").join("\n") : word;
      t.font = FONT_SIGN;
      t.fontSize = (vertical ? 0.42 : 0.38) * scale;
      t.lineHeight = 1.05;
      t.anchorX = "center"; t.anchorY = "middle"; t.textAlign = "center";
      const ink = lightPanel ? "#14110d" : col;
      t.color = ink;
      t.position.x = face * 0.086;
      t.rotation.y = face * Math.PI / 2;
      const tm = new THREE.MeshBasicMaterial({ color: ink, toneMapped: false });
      t.material = tm;
      t.sync();
      group.add(t);
      texts.push(t);
      if (!lightPanel) { glow.push(tm); base.push(new THREE.Color(col)); }
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), frame.material);
    arm.position.set(-side * 0.3, hgt / 2 - 0.1, 0);
    group.add(arm);
    group.position.set(side * (W - 0.55), y, z);
    scene.add(group);
    signs.push({ group, glow, texts, base, on: { v: 1 }, z, keep });
    return hgt;
  };

  WORDS.forEach(([word, col, keep], i) => {
    const side = i % 2 === 0 ? -1 : 1;
    buildSign(word, col, word.length <= 7 && r() > 0.35, keep, side, 3 + r() * 5, 2 - i * 3.6 - r() * 1.5, 1.25);
  });

  // Colonnes de caissons empilés, un commerce par étage (mots réels uniquement).
  const STACK = ["BAR", "CLINIC", "DENTAL", "STUDIO", "LOUNGE", "GAMES", "BILLIARDS", "SNACK", "INTERNET", "TAILOR", "PHOTO", "REPAIR", "CAFE", "GYM"];
  const COLS = [NIGHT.neon, NIGHT.sodium, NIGHT.konbini, NIGHT.taxi, NIGHT.neon, NIGHT.tail];
  for (let k = 0; k < 7; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const z = 0.5 - k * 6.2 - r() * 2;
    let y = 2.6;
    const count = 4 + Math.floor(r() * 4);
    for (let j = 0; j < count; j++) {
      const word = STACK[(k * 5 + j * 3) % STACK.length];
      y += buildSign(word, COLS[(k + j * 2) % COLS.length], false, false, side, y + 0.3, z, 1.15) + 0.08;
    }
  }

  // ── Panneau à LED au-dessus de la laverie : il affiche le temps restant ──
  const led = new Text();
  led.text = "25:00";
  led.font = FONT_LED;
  led.fontSize = 0.7;
  led.anchorX = "center"; led.anchorY = "middle";
  led.color = NIGHT.taxi;
  led.material = new THREE.MeshBasicMaterial({ color: NIGHT.taxi, toneMapped: false });
  const ledBox = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.12), new THREE.MeshStandardMaterial({ color: "#07080a", roughness: 0.4 }));
  const ledG = new THREE.Group();
  ledG.add(ledBox);
  led.position.z = 0.065;
  ledG.add(led);
  ledG.position.set(-W + 0.08, 6.4, -4.5);
  ledG.rotation.y = Math.PI / 2;
  led.sync();
  scene.add(ledG);

  // ── Câbles en chaînette d'un mur à l'autre ───────────────────────────────
  const cableMat = new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.8 });
  for (let i = 0; i < 9; i++) {
    const z = 4 - i * 6 - r() * 3, y = 6.5 + r() * 4, sag = 0.4 + r() * 0.8;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-W, y, z), new THREE.Vector3(0, y - sag * 2, z + (r() - 0.5) * 2), new THREE.Vector3(W, y + (r() - 0.5), z - r() * 2));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.014, 5), cableMat));
  }

  // ── Distributeur automatique et lampadaire, au premier plan ──────────────
  const vm = new THREE.Group();
  vm.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.75), new THREE.MeshStandardMaterial({ color: "#d9dcdf", roughness: 0.4 })));
  const vc = document.createElement("canvas");
  vc.width = 128; vc.height = 256;
  const vctx = vc.getContext("2d")!;
  vctx.fillStyle = "#eef6ff"; vctx.fillRect(0, 0, 128, 256);
  const cans = ["#d7372b", "#2c63c7", "#f2b51e", "#3aa85f", "#ebebeb", "#7b3fa8"];
  for (let row = 0; row < 6; row++) for (let c = 0; c < 5; c++) {
    vctx.fillStyle = cans[(row * 5 + c * 3) % cans.length];
    vctx.fillRect(10 + c * 23, 14 + row * 30, 14, 22);
  }
  const vPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(vc), toneMapped: false }));
  vPanel.position.set(0, 0.25, 0.38);
  vm.add(vPanel);
  vm.position.set(W - 0.6, 0.95, -1.5);
  vm.rotation.y = -Math.PI / 2;
  scene.add(vm);
  const vmLight = new THREE.PointLight("#dff0ff", 6, 6, 1.8);
  vmLight.position.set(W - 1.4, 1.3, -1.5);
  scene.add(vmLight);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 10), new THREE.MeshStandardMaterial({ color: "#26282b" }));
  pole.position.set(-W + 0.4, 2.5, 4.6);
  scene.add(pole);
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), new THREE.MeshBasicMaterial({ color: NIGHT.sodium, toneMapped: false }));
  lampHead.position.set(-W + 0.65, 5, 4.6);
  scene.add(lampHead);
  const lamp = new THREE.PointLight(NIGHT.sodium, 30, 18, 1.7);
  lamp.position.set(-W + 0.7, 4.8, 4.6);
  scene.add(lamp, new THREE.HemisphereLight("#2a3446", "#0a0806", 0.5));

  // ── Sol mouillé : miroir basse résolution (flou naturel) sous l'asphalte ──
  const mirror = new Reflector(new THREE.PlaneGeometry(2 * W, 80), { textureWidth: 384, textureHeight: 512, color: 0x8a929c, clipBias: 0.003 });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0, -30);
  scene.add(mirror);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 80), new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, transparent: true, uniforms: { uFog: { value: fogCol }, uFogD: { value: 0.035 } } }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0.003, -30);
  scene.add(ground);

  // ── Pluie et vapeur ──────────────────────────────────────────────────────
  const N = 1400;
  const rainGeo = new THREE.InstancedBufferGeometry();
  const streak = new THREE.PlaneGeometry(0.008, 0.38);
  rainGeo.index = streak.index;
  rainGeo.setAttribute("position", streak.attributes.position);
  const off = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) off.set([(r() - 0.5) * 2 * W, r() * 16, 8 - r() * 30], i * 3);
  rainGeo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
  rainGeo.instanceCount = N;
  const rainU = { uTime: { value: 0 }, uAmount: { value: 1 } };
  scene.add(new THREE.Mesh(rainGeo, new THREE.ShaderMaterial({ vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const steamU: { uTime: { value: number }; uSeed: { value: number } }[] = [];
  for (let i = 0; i < 3; i++) {
    const u = { uTime: { value: 0 }, uSeed: { value: i * 0.37 } };
    steamU.push(u);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: STEAM_FRAG, uniforms: u, transparent: true, depthWrite: false }));
    s.position.set(1.2 + i * 0.25, 1.6, -7 - i * 0.3);
    s.rotation.y = -0.2 + i * 0.2;
    scene.add(s);
  }

  // ── Post-traitement : bloom sur ce qui émet vraiment ─────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new EffectPass(cam, new BloomEffect({ luminanceThreshold: 0.55, luminanceSmoothing: 0.2, intensity: 1.15, mipmapBlur: true })));

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    cam.aspect = w / h;
    cam.fov = w / h < 1 ? 62 : 46;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const applySigns = () => {
    for (const s of signs) s.glow.forEach((m, i) => m.color.copy(s.base[i]).multiplyScalar(0.06 + 0.94 * s.on.v));
  };

  // Entrée : léger travelling avant dans la ruelle, puis repos.
  animate(cam.position, { z: [11, 9], y: [1.75, 1.55] }, { duration: 2.6, ease: [0.22, 1, 0.36, 1], onUpdate: () => cam.lookAt(look) });

  const t0 = performance.now();
  let frame = 0;
  renderer.setAnimationLoop(() => {
    const c0 = performance.now();
    const t = (c0 - t0) / 1000;
    rainU.uTime.value = t;
    steamU.forEach((u) => (u.uTime.value = t));
    applySigns();
    composer.render();
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - c0).toFixed(2), triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
  });

  /** Amorçage d'un tube néon : trois ratés irréguliers puis allumé. */
  const ignite = (s: Sign, delay: number) =>
    animate(s.on, { v: [0, 0.8, 0.1, 0.6, 0.05, 1] }, { duration: 0.9, delay, times: [0, 0.12, 0.2, 0.45, 0.55, 1], ease: [0.2, 0.8, 0.2, 1] });

  let lastMin = -1;
  return {
    setMinutes: (m) => {
      if (m === lastMin) return;
      lastMin = m;
      led.text = `${String(m).padStart(2, "0")}:00`;
      led.sync();
    },
    halt: (on) => {
      if (on) {
        // La halte : les enseignes s'éteignent du fond vers nous, sauf la supérette.
        const order = [...signs].sort((a, b) => a.z - b.z);
        order.forEach((s, i) => { if (!s.keep) animate(s.on, { v: [1, 0.3, 0.8, 0] }, { duration: 0.5, delay: 0.15 + (i / order.length) * 2, times: [0, 0.3, 0.45, 1], ease: [0.4, 0, 1, 1] }); });
        animate(rainU.uAmount, { value: 0.3 }, { duration: 3, ease: [0.45, 0, 0.55, 1] });
        animate(wallU.uLit, { value: 0.22 }, { duration: 3, ease: [0.45, 0, 0.55, 1] });
        animate(cam.position, { z: 9.8, y: 1.45 }, { type: "spring", stiffness: 60, damping: 20, onUpdate: () => cam.lookAt(look) });
      } else {
        const order = [...signs].sort((a, b) => b.z - a.z);
        order.forEach((s, i) => { if (!s.keep) ignite(s, (i / order.length) * 1.6); });
        animate(rainU.uAmount, { value: 1 }, { duration: 2, ease: [0.45, 0, 0.55, 1] });
        animate(wallU.uLit, { value: 0.55 }, { duration: 2, ease: [0.45, 0, 0.55, 1] });
        animate(cam.position, { z: 9, y: 1.55 }, { type: "spring", stiffness: 60, damping: 20, onUpdate: () => cam.lookAt(look) });
      }
    },
    flicker: () => {
      const lit = signs.filter((s) => s.on.v > 0.5);
      const s = lit[Math.floor(Math.random() * lit.length)];
      if (s) animate(s.on, { v: [1, 0.15, 0.9, 0.05, 0.7, 0.2, 1] }, { duration: 1.1, times: [0, 0.1, 0.18, 0.32, 0.5, 0.62, 1], ease: [0.2, 0.8, 0.2, 1] });
    },
    dispose: () => { renderer.setAnimationLoop(null); ro.disconnect(); composer.dispose(); renderer.dispose(); signs.forEach((s) => s.texts.forEach((t) => t.dispose())); led.dispose(); },
  };
}
