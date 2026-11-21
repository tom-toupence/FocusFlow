// « La fenêtre » : la ville la nuit, vue d'une fenêtre en haut d'une tour.
//
// Matière : la capture photogrammétrique « TOKYO NIGHT » (Nikitos & 3130,
// Sketchfab, CC BY 4.0) fournie par l'utilisateur dans public/tokyo_night.glb,
// allégée en deux niveaux de détail (public/city/tokyo/, voir ASSETS.md).
// Elle n'est crédible que vue de haut : on s'y place donc en surplomb, comme
// quelqu'un qui travaille tard à sa fenêtre.
//
// Rendu (three + postprocessing) :
//   . matériau de la ville : les lumières sont extraites des textures cuites
//     (luminance), on peut donc les éteindre en vague du fond vers nous
//     (la halte), en faire grésiller un quartier (distraction), en allumer un
//     pâté de maisons (playlist prolongée) ou faire passer une onde chaude sur
//     toute la ville (objectif atteint) ; brume en hauteur, heure bleue ;
//   . ciel : dégradé fait main, halo de pollution lumineuse à l'horizon,
//     nuages bas éclairés par-dessous qui dérivent très lentement ;
//   . écran géant sur un toit (le panneau : temps restant), posé par lancer
//     de rayon sur la capture ;
//   . post : bloom sur les lumières, profondeur de champ (mise au point
//     pilotée), pluie sur la vitre qui réfracte la ville, montant de fenêtre,
//     reflet de la pièce, grain, vignette, ACES.
// Mouvement : travelling avant lent à l'arrivée avec bascule de point (de la
// vitre vers la ville) ; pendant la halte la mise au point revient sur la vitre
// et la ville se brouille ; à la reprise elle revient sur la ville.
// Même interface que les autres scènes (lib/city/types).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  EffectComposer, RenderPass, EffectPass, Effect, BloomEffect, DepthOfFieldEffect,
  ToneMappingEffect, ToneMappingMode, NoiseEffect, VignetteEffect,
} from "postprocessing";
import { tween as clockTween } from "@/lib/city/tween";
import type { CityOptions, CityPhase, CityRenderer } from "@/lib/city/types";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_TIDE: [number, number, number, number] = [0.45, 0, 0.55, 1];
const EASE_SNAP: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

// Cadrage de chef opérateur : focale ~50 mm, en surplomb, la tour au tiers gauche.
const CAM = { pos: new THREE.Vector3(24, 52, 42), look: new THREE.Vector3(-28.7, 42, 13.4), fov: 40 };
const CAM_IN = new THREE.Vector3(28, 53.2, 46); // départ du travelling d'arrivée

// ── Pluie sur la vitre (effet écran fait main) ─────────────────────────────
const GLASS = /* glsl */ `
uniform float uTime, uRain, uMullion, uReflect;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Une goutte posée : lentille qui renvoie l'image retournée.
vec3 bead(vec2 p, float cell, float t, float amount) {
  vec2 g = p / cell, id = floor(g), f = fract(g) - 0.5;
  float r = hh(id);
  if (r > amount) return vec3(0.0);
  vec2 c = (vec2(hh(id + 1.3), hh(id + 2.7)) - 0.5) * 0.6;
  float rad = 0.08 + 0.14 * hh(id + 4.1);
  vec2 d = f - c;
  float m = smoothstep(rad, rad * 0.8, length(d));
  return vec3(-d * 2.2 * cell, m);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float ar = resolution.x / resolution.y;
  vec2 p = vec2(uv.x * ar, uv.y);
  vec2 off = vec2(0.0); float mask = 0.0;
  // Petites gouttes immobiles, deux tailles.
  vec3 b1 = bead(p, 0.022, uTime, 0.10 * uRain); off += b1.xy * b1.z; mask = max(mask, b1.z);
  vec3 b2 = bead(p + 7.1, 0.05, uTime, 0.05 * uRain); off += b2.xy * b2.z; mask = max(mask, b2.z);
  // Gouttes qui glissent par à-coups, avec leur traînée.
  float col = floor(p.x / 0.05);
  float cr = hh(vec2(col, 9.0));
  if (cr < 0.22 * uRain) {
    float speed = 0.05 + cr * 0.12;
    float tt = uTime * speed + cr * 10.0;
    float y = 1.15 - fract(tt) * 1.3 - 0.04 * sin(tt * 30.0) * step(0.5, fract(tt * 3.0));
    float x = (col + 0.5) * 0.05 + 0.006 * sin(p.y * 40.0 + cr * 6.0);
    vec2 d = vec2((p.x - x) * 1.0, (p.y - y) * 0.7);
    float m = smoothstep(0.012, 0.009, length(d));
    off += -d * 1.6 * m; mask = max(mask, m);
    float trail = smoothstep(0.004, 0.0, abs(p.x - x)) * step(y, p.y) * smoothstep(y + 0.35, y, p.y);
    mask = max(mask, trail * 0.4); off += vec2(0.0015, 0.0) * trail;
  }
  // Vitre : un voile très léger (buée), net dans les gouttes et leurs traînées.
  vec3 sharp = texture2D(inputBuffer, uv + off / vec2(ar, 1.0)).rgb;
  vec3 soft = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float a = float(i) * 1.5708 + 0.4;
    soft += texture2D(inputBuffer, uv + vec2(cos(a), sin(a)) * 0.0022).rgb;
  }
  soft /= 4.0;
  // Une goutte la nuit : sombre au bord, l'image renversée au centre, un point de reflet.
  vec3 c = mix(mix(inputColor.rgb, soft, 0.25 * uRain), sharp * 0.85, mask);
  c *= 1.0 - 0.35 * smoothstep(0.2, 0.9, mask) * (1.0 - smoothstep(0.9, 1.0, mask));
  // Reflet de la pièce derrière nous : une lampe chaude, en bas à droite.
  c += vec3(1.0, 0.62, 0.3) * uReflect * 0.045 * smoothstep(0.75, 0.0, distance(uv, vec2(0.9, 0.08)));
  // Montant de fenêtre au tiers gauche et appui en bas : premier plan sombre.
  float mul = smoothstep(0.012, 0.0, abs(uv.x - 0.16) - 0.022) * uMullion;
  float sill = smoothstep(0.075, 0.06, uv.y) * uMullion;
  vec3 frameCol = vec3(0.012, 0.013, 0.016) + vec3(1.0, 0.6, 0.3) * 0.02 * uReflect;
  c = mix(c, frameCol, max(mul, sill));
  outputColor = vec4(c, inputColor.a);
}`;

class GlassEffect extends Effect {
  constructor() {
    super("GlassEffect", GLASS, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uTime", new THREE.Uniform(0)], ["uRain", new THREE.Uniform(1)],
        ["uMullion", new THREE.Uniform(1)], ["uReflect", new THREE.Uniform(1)],
      ]),
    });
  }
}

// ── Ciel ──────────────────────────────────────────────────────────────────
const SKY_V = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_F = `
uniform float uTime, uDawn;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
void main(){
  float y = vDir.y;
  // Nuit : zénith bleu-noir, horizon ambré (la ville éclaire le ciel par-dessous).
  vec3 zen = vec3(0.006, 0.009, 0.018), hor = vec3(0.09, 0.055, 0.035);
  vec3 col = mix(hor, zen, smoothstep(-0.02, 0.35, y));
  vec2 cp = vDir.xz / max(0.08, y + 0.12) * 1.6 + vec2(uTime * 0.004, 0.0);
  float cl = smoothstep(0.45, 0.85, fbm(cp)) * smoothstep(0.4, 0.04, y) * smoothstep(-0.05, 0.05, y);
  col += vec3(0.12, 0.075, 0.05) * cl;
  // Petit matin : ciel lavé, bleu froid, un peu plus clair à l'est.
  vec3 dz = vec3(0.12, 0.17, 0.26), dh = vec3(0.42, 0.42, 0.44);
  vec3 dawn = mix(dh, dz, smoothstep(-0.02, 0.5, y)) + vec3(0.08, 0.06, 0.05) * cl;
  gl_FragColor = vec4(mix(col, dawn, uDawn), 1.0);
}`;

function loadGltf(url: string): Promise<THREE.Group> {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then((g) => g.scene);
}

export function supportsTokyoCity(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

export async function createTokyoCity(canvas: HTMLCanvasElement, opts: CityOptions = {}): Promise<CityRenderer> {
  const reduce = !!opts.reducedMotion;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 600;
  const low = narrow || (navigator.hardwareConcurrency ?? 8) <= 4;

  // Cadrage : lacet optionnel (une page qui pose son texte à gauche tourne la
  // caméra vers la gauche pour que la tour passe à droite du cadre).
  const LOOK = CAM.look.clone().sub(CAM.pos).applyAxisAngle(new THREE.Vector3(0, 1, 0), opts.yaw ?? 0).add(CAM.pos);
  const city = await loadGltf(`/city/tokyo/tokyo-${low ? "mob" : "desk"}.glb`);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(CAM.fov, 1, 0.05, 900);
  cam.position.copy(reduce ? CAM.pos : CAM_IN);
  cam.lookAt(LOOK);

  // ── Ville : lumières extraites, vagues, brume, heure bleue ─────────────
  const U = {
    uCam: { value: cam.position },
    uOrigin: { value: CAM.pos.clone() },
    uWaveR: { value: 1000 },       // au-delà de ce rayon, les lumières sont éteintes
    uOn: { value: 1 },             // allumage global (la halte descend à ~0,15)
    uDawn: { value: opts.dawn ?? 0 },
    uPulseC: { value: new THREE.Vector3() }, uPulseR: { value: -1 }, uPulseK: { value: 0 },
    uSpotC: { value: new THREE.Vector3() }, uSpotR: { value: 3 }, uSpotK: { value: 0 },
    uHazeCol: { value: new THREE.Color("#2a1d14") },
    uTime: { value: 0 },
  };
  city.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      if (!sh.vertexShader.includes("vWp = ")) {
        sh.vertexShader = sh.vertexShader.replace("#include <fog_vertex>", "#include <fog_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      }
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
varying vec3 vWp;
uniform vec3 uCam, uOrigin, uPulseC, uSpotC, uHazeCol;
uniform float uWaveR, uOn, uDawn, uPulseR, uPulseK, uSpotR, uSpotK, uTime;
float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  float lum = max(c.r, max(c.g, c.b));
  float sat = lum - min(c.r, min(c.g, c.b));
  // Ce qui émet : les pixels très lumineux de la capture (fenêtres, enseignes, rues).
  float light = smoothstep(0.22, 0.6, lum) * (0.7 + 0.6 * sat);
  float dist = distance(vWp.xz, uOrigin.xz);
  // La halte : éteint au-delà du front de vague, plus un plancher global.
  float on = mix(1.0, 0.0, smoothstep(uWaveR - 6.0, uWaveR, dist));
  on = max(on, 0.0) * uOn + (1.0 - uOn) * 0.12;
  // Distraction : un quartier grésille. Playlist : un pâté de maisons s'allume.
  float spot = 1.0 - smoothstep(uSpotR * 0.6, uSpotR, distance(vWp.xz, uSpotC.xz));
  on *= 1.0 - spot * uSpotK;
  // Objectif : une onde chaude traverse la ville depuis la tour.
  float ring = exp(-pow((distance(vWp.xz, uPulseC.xz) - uPulseR) * 0.35, 2.0)) * uPulseK;
  vec3 lit = c * mix(1.0, on, light) + c * light * ring * vec3(1.6, 1.1, 0.6);
  // Brume en hauteur : plus dense au ras du sol et au loin, ambrée.
  float d = distance(vWp, uCam);
  float haze = (1.0 - exp(-d * 0.012)) * (0.55 + 0.45 * smoothstep(46.0, 38.0, vWp.y));
  lit = mix(lit, uHazeCol, clamp(haze, 0.0, 0.75) * 0.6);
  // Petit matin : lumières presque toutes éteintes, béton bleuté, brume claire.
  vec3 day = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, 0.45) * vec3(0.9, 1.0, 1.12) * 1.7 + vec3(0.04, 0.055, 0.08);
  day = mix(day * (1.0 - light * 0.7), vec3(0.5, 0.55, 0.62), clamp(haze, 0.0, 0.8) * 0.75);
  diffuseColor.rgb = mix(lit, day, uDawn);
}`);
    };
    mat.needsUpdate = true;
  });
  scene.add(city);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, uniforms: { uTime: U.uTime, uDawn: U.uDawn } }));
  scene.add(sky);

  // ── Écran géant sur un toit : le panneau ───────────────────────────────
  const boardC = document.createElement("canvas");
  boardC.width = 512; boardC.height = 256;
  const bctx = boardC.getContext("2d")!;
  const ledFont = getComputedStyle(document.documentElement).getPropertyValue("--font-doto").trim() || "monospace";
  const drawBoard = (text: string) => {
    bctx.fillStyle = "#030303"; bctx.fillRect(0, 0, 512, 256);
    bctx.fillStyle = "#ffc21a"; bctx.textAlign = "center"; bctx.textBaseline = "middle";
    const lines = text.split(" ");
    const size = Math.min(230 / lines.length, 760 / Math.max(3, ...lines.map((l) => l.length)));
    bctx.font = `800 ${size}px ${ledFont}`;
    lines.forEach((l, i) => bctx.fillText(l, 256, 128 + (i - (lines.length - 1) / 2) * size));
  };
  drawBoard(opts.board ?? "");
  const boardTex = new THREE.CanvasTexture(boardC);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Group();
  const screenMat = new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), screenMat);
  face.position.z = 0.031;
  screen.add(face, new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.9, 0.06, 2, 0.015), new THREE.MeshBasicMaterial({ color: "#050506" })));
  const legMat = new THREE.MeshBasicMaterial({ color: "#08090b" });
  for (const x of [-0.6, 0.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), legMat); leg.position.set(x, -0.68, -0.02); screen.add(leg); }
  // Posé par lancer de rayon sur la capture, au milieu-droit du cadre.
  cam.position.copy(CAM.pos); cam.aspect = 16 / 9; cam.updateProjectionMatrix(); cam.lookAt(LOOK); cam.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0.74, -0.52), cam);
  const hit = ray.intersectObject(city, true)[0];
  const anchor = hit ? hit.point.clone() : LOOK.clone();
  screen.position.copy(anchor).add(new THREE.Vector3(0, 1.25, 0));
  screen.lookAt(new THREE.Vector3(CAM.pos.x, screen.position.y, CAM.pos.z));
  screen.scale.setScalar(1.7);
  screen.rotateY(-0.32); // pas parfaitement face à nous : il est posé, pas collé
  screen.visible = !!opts.board;
  scene.add(screen);
  cam.position.copy(reduce ? CAM.pos : CAM_IN);

  // ── Post-traitement ────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, cam));
  const focusFar = CAM.pos.distanceTo(anchor);
  const dof = new DepthOfFieldEffect(cam, { focusDistance: reduce ? focusFar : 0.6, focusRange: 30, bokehScale: low ? 1.2 : 1.8, resolutionScale: 0.5 });
  const bloom = new BloomEffect({ luminanceThreshold: 0.42, luminanceSmoothing: 0.3, intensity: 1.35, mipmapBlur: true, radius: 0.75 });
  const glass = new GlassEffect();
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const noise = new NoiseEffect({ premultiply: true });
  noise.blendMode.opacity.value = 0.16;
  const vig = new VignetteEffect({ darkness: 0.6, offset: 0.28 });
  composer.addPass(new EffectPass(cam, dof));
  composer.addPass(new EffectPass(cam, bloom));
  composer.addPass(new EffectPass(cam, glass));
  composer.addPass(new EffectPass(cam, tone, noise, vig));
  const gU = glass.uniforms;
  gU.get("uRain")!.value = reduce ? 0.6 : 1;

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const a = w / h;
    cam.aspect = a;
    // Bandeau très large (résumé) : focale longue, pas de montant, regard
    // abaissé sur la ville et la tour. Portrait : focale courte.
    band = a > 2.4;
    cam.fov = a < 1 ? 62 : band ? 22 : CAM.fov;
    cam.updateProjectionMatrix();
    if (glassU) glassU.get("uMullion")!.value = band ? 0 : 1;
    dirty = true;
  };
  let dirty = true;
  let band = false;
  const glassU: Map<string, THREE.Uniform> | null = glass.uniforms;
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true, tabVisible = !document.hidden;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; dirty = true; });
  io.observe(canvas);
  const onVis = () => { tabVisible = !document.hidden; dirty = true; };
  document.addEventListener("visibilitychange", onVis);
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPtr = (e: PointerEvent) => { ptr.tx = e.clientX / window.innerWidth - 0.5; ptr.ty = e.clientY / window.innerHeight - 0.5; };
  if (!reduce && !narrow) window.addEventListener("pointermove", onPtr, { passive: true });

  const st = { focus: reduce ? focusFar : 0.6, dawn: opts.dawn ?? 0, pull: 0 };
  let animating = 0;
  const run = (a: Promise<unknown>) => { animating++; a.finally(() => { animating--; dirty = true; }); };
  const tween = <T extends object>(target: T, to: Record<string, number | number[]>, o: Record<string, unknown> = {}) => {
    if (reduce) {
      for (const k in to) { const v = to[k]; (target as Record<string, number>)[k] = Array.isArray(v) ? v[v.length - 1] : v; }
      dirty = true;
      return;
    }
    run(clockTween(target, to as never, o as never));
  };

  const camPos = (reduce ? CAM.pos : CAM_IN).clone();
  // En bandeau, on vise un peu plus bas et vers la tour.
  const bandLook = LOOK.clone().lerp(new THREE.Vector3(-17, 41, 29), 0.35).add(new THREE.Vector3(0, -2.5, 0));
  const t0 = performance.now();
  let last = t0;
  renderer.setAnimationLoop((now) => {
    if (!visible || !tabVisible) return;
    if (reduce && !dirty && animating === 0) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;
    const k = 1 - Math.exp(-dt * 2);
    ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
    // Respiration (période ~9 s) et main, autour de la position animée.
    const breathe = reduce ? 0 : Math.sin(t * 0.7) * 0.02;
    const base = camPos;
    cam.position.set(base.x + ptr.x * 0.5 + st.pull * 0.6, base.y + breathe - ptr.y * 0.25 + st.pull * 0.2, base.z + st.pull * 0.9);
    cam.lookAt(band ? bandLook : LOOK);
    U.uTime.value = reduce ? 0 : t;
    U.uDawn.value = st.dawn;
    gU.get("uTime")!.value = reduce ? 0 : t;
    gU.get("uReflect")!.value = 1 - st.dawn * 0.7;
    dof.cocMaterial.focusDistance = st.focus;
    composer.render(dt);
    dirty = false;
  });

  // Arrivée : travelling avant de 9 s ; la mise au point bascule de la vitre vers la ville.
  if (!reduce) {
    run(clockTween(camPos, { x: CAM.pos.x, y: CAM.pos.y, z: CAM.pos.z }, { duration: 9, ease: EASE_OUT }));
    tween(st, { focus: [0.6, 0.6, focusFar] }, { duration: 4.5, times: [0, 0.35, 1], ease: EASE_TIDE });
  }

  if (location.pathname.startsWith("/lab")) (window as unknown as Record<string, unknown>).__city = { st, U };
  let phase: CityPhase = opts.phase ?? "work";
  const halt = (on: boolean) => {
    if (on) {
      // Les lumières s'éteignent du fond vers nous, la mise au point revient sur la vitre.
      U.uWaveR.value = 200;
      tween(U.uWaveR, { value: [200, 0] }, { duration: 3.2, ease: [0.4, 0, 0.7, 1] });
      tween(U.uOn, { value: 0.18 }, { duration: 3.2, ease: EASE_TIDE });
      tween(st, { focus: 0.7, pull: 1 }, { duration: 2.8, delay: 0.8, ease: EASE_TIDE });
    } else {
      U.uWaveR.value = 0;
      tween(U.uWaveR, { value: [0, 200] }, { duration: 2.6, ease: [0.3, 0, 0.6, 1] });
      tween(U.uOn, { value: 1 }, { duration: 2, ease: EASE_TIDE });
      tween(st, { focus: focusFar, pull: 0 }, { duration: 2.4, ease: EASE_OUT });
    }
  };
  if (phase === "break") { U.uWaveR.value = 0; U.uOn.value = 0.18; st.focus = 0.7; st.pull = 1; }

  // Points d'intérêt pour les événements : la tour (à gauche) et le cadre.
  const pick = (sx: number, sy: number) => {
    const c2 = cam.clone(); c2.position.copy(CAM.pos); c2.lookAt(LOOK); c2.updateMatrixWorld();
    ray.setFromCamera(new THREE.Vector2(sx, sy), c2);
    return ray.intersectObject(city, true)[0]?.point.clone() ?? anchor.clone();
  };
  const towerPt = new THREE.Vector3(-17, 44, 29); // la tour, repérée par lancer de rayon

  let boardText = opts.board ?? "";
  return {
    setPhase: (p) => {
      if (p === phase) return;
      const wasBreak = phase === "break";
      phase = p;
      if (p === "break") halt(true);
      else if (wasBreak) halt(false);
    },
    setBoard: (text) => {
      if (text === boardText) return;
      boardText = text;
      drawBoard(text);
      boardTex.needsUpdate = true;
      screen.visible = !!text;
      dirty = true;
    },
    setFriends: () => { /* les amis en focus sont affichés par l'interface */ },
    setDawn: (v) => tween(st, { dawn: v }, { duration: 1.4, ease: EASE_TIDE }),
    flicker: () => {
      U.uSpotC.value.copy(pick((Math.random() - 0.3) * 1.2, -0.2 - Math.random() * 0.4));
      U.uSpotR.value = 4 + Math.random() * 3;
      tween(U.uSpotK, { value: [0, 0.9, 0.1, 0.8, 0.0, 0.6, 0] }, { duration: 1.2, times: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 1], ease: EASE_SNAP });
    },
    extend: () => {
      // Un pâté de maisons sombre s'allume d'un coup (onde courte au milieu du cadre).
      U.uPulseC.value.copy(pick(0.1 + Math.random() * 0.4, -0.3));
      tween(U.uPulseR, { value: [0, 9] }, { duration: 1.6, ease: EASE_OUT });
      tween(U.uPulseK, { value: [0, 0.8, 0] }, { duration: 1.8, ease: EASE_TIDE });
    },
    goal: () => {
      // Une onde chaude part de la tour et traverse toute la ville.
      U.uPulseC.value.copy(towerPt);
      tween(U.uPulseR, { value: [0, 160] }, { duration: 5.5, ease: [0.3, 0.1, 0.5, 1] });
      tween(U.uPulseK, { value: [0, 1, 1, 0] }, { duration: 5.5, times: [0, 0.1, 0.7, 1], ease: EASE_TIDE });
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPtr);
      composer.dispose();
      city.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.MeshBasicMaterial).map?.dispose(); (m.material as THREE.Material).dispose(); } });
      boardTex.dispose();
      // Ciel et écran du toit : géométries et matériaux libérés aussi (la scène
      // est recréée à chaque halte). Pas de forceContextLoss : un remontage
      // StrictMode récupérerait un contexte perdu sur le même canvas.
      for (const o of [sky, screen]) o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
      renderer.dispose();
    },
  };
}
