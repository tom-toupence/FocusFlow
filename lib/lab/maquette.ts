// LAB 5 · Maquette (three WebGLRenderer + postprocessing TiltShift)
//
// Direction : maquette d'architecte vue d'avion, en plein jour pastel, flou
// de bascule (tilt-shift) qui rend la ville minuscule. Un quartier de Séoul
// généré en code : îlots, immeubles à retraits (gradins), toits techniques.
// Chaque minute de travail ALLUME une fenêtre dans le quartier ; à 25:00 la
// lumière bascule vers le soir (pause), les fenêtres allumées restent.
// Distraction : une fenêtre clignote. Le shader calcule lui-même la grille
// des fenêtres sur chaque façade (aucune texture).
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, TiltShiftEffect, SMAAEffect } from "postprocessing";
import { animate } from "motion";
import { reportInfo } from "@/lib/lab/LabShell";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Immeuble à gradins : 1 à 3 volumes empilés en retrait, fusionnés. */
function building(r: () => number, w: number, d: number, h: number, id: number) {
  const parts: THREE.BufferGeometry[] = [];
  let y = 0, cw = w, cd = d;
  const tiers = 1 + Math.floor(r() * 3);
  for (let i = 0; i < tiers; i++) {
    const th = (h / tiers) * (i === 0 ? 1.3 : 0.85);
    const g = new THREE.BoxGeometry(cw, th, cd);
    g.translate(0, y + th / 2, 0);
    parts.push(g);
    y += th;
    cw *= 0.72 + r() * 0.12;
    cd *= 0.72 + r() * 0.12;
  }
  // Édicule technique sur le toit
  const roof = new THREE.BoxGeometry(cw * 0.4, 0.25, cd * 0.35);
  roof.translate((r() - 0.5) * cw * 0.3, y + 0.125, (r() - 0.5) * cd * 0.3);
  parts.push(roof);
  const merged = mergeBoxes(parts);
  const ids = new Float32Array(merged.attributes.position.count).fill(id);
  merged.setAttribute("bid", new THREE.BufferAttribute(ids, 1));
  return merged;
}

function mergeBoxes(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of gs) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.attributes.position.array, n = ng.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) idx.push(off + i);
    off += p.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

const VERT = /* glsl */ `
attribute float bid;
varying vec3 vPos; varying vec3 vNor; varying float vId;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz; vNor = normalize(mat3(modelMatrix) * normal); vId = bid;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform float uLit;      // part de fenêtres allumées (0..1)
uniform float uDusk;     // 0 = jour, 1 = soir
uniform float uBlink;    // fenêtre qui clignote (distraction)
uniform vec3 uSun;
varying vec3 vPos; varying vec3 vNor; varying float vId;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 n = normalize(vNor);
  // Façade claire (béton peint), toit plus sombre
  vec3 wall = mix(vec3(0.93, 0.9, 0.86), vec3(0.85, 0.88, 0.92), step(0.5, fract(vId * 0.37)));
  vec3 base = n.y > 0.5 ? vec3(0.72, 0.73, 0.74) : wall;
  // Lumière faite main : soleil (key), ciel (fill), occlusion au pied
  float key = max(dot(n, normalize(uSun)), 0.0);
  float sky = 0.55 + 0.45 * n.y;
  float ao = smoothstep(0.0, 1.2, vPos.y) * 0.35 + 0.65;
  vec3 dayCol = base * (0.45 * sky + 0.75 * key) * ao;
  vec3 duskCol = base * (0.18 * sky + 0.12 * key) * ao * vec3(0.7, 0.75, 1.0);
  vec3 col = mix(dayCol, duskCol, uDusk);
  // Fenêtres sur les façades verticales
  if (abs(n.y) < 0.5) {
    vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
    float u = dot(vPos, t) * 3.2;
    float v = vPos.y * 3.6;
    vec2 cell = floor(vec2(u, v));
    vec2 f = fract(vec2(u, v));
    float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.25, f.y) * step(f.y, 0.75) * step(0.6, vPos.y);
    float h = hash(vec3(cell, vId));
    float lit = step(h, uLit) * win;
    // Amis en focus : quelques fenêtres vertes (supérette), toujours allumées.
    float friend = step(h, 0.012) * win;
    float blink = step(abs(h - 0.5), 0.004) * win * uBlink;
    vec3 glass = mix(vec3(0.45, 0.55, 0.65), vec3(0.08, 0.1, 0.16), uDusk);
    col = mix(col, glass, win * 0.85);
    col = mix(col, mix(vec3(1.0, 0.72, 0.4), vec3(0.85, 0.92, 1.0), step(0.5, fract(h * 13.0))) * 1.4, lit);
    col = mix(col, vec3(0.33, 0.88, 0.63) * 1.6, friend);
    col = mix(col, vec3(1.0, 0.3, 0.2), blink);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export interface MaquetteScene {
  setProgress: (p: number) => void;
  dusk: (on: boolean) => void;
  blink: () => void;
  dispose: () => void;
}

export function createMaquette(canvas: HTMLCanvasElement): MaquetteScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  // Lab 2 : la maquette passe la nuit (dayBg = nuit active, duskBg = fin de nuit plus sombre).
  const dayBg = new THREE.Color("#141a24"), duskBg = new THREE.Color("#0a0d12");
  scene.background = dayBg.clone();
  const cam = new THREE.PerspectiveCamera(22, 1, 0.5, 200);
  cam.position.set(26, 30, 30);
  cam.lookAt(0, 0, 0);

  const uniforms = { uLit: { value: 0 }, uDusk: { value: 1 }, uBlink: { value: 0 }, uSun: { value: new THREE.Vector3(-0.5, 0.9, 0.35) } };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });

  // Quartier : grille d'îlots séparés par des rues, immeubles par îlot.
  const r = rng(7);
  const city = new THREE.Group();
  let id = 0;
  for (let bx = -3; bx <= 3; bx++) for (let bz = -3; bz <= 3; bz++) {
    const cx = bx * 5.2, cz = bz * 5.2;
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const w = 1.1 + r() * 1.4, d = 1.1 + r() * 1.4;
      const tall = Math.hypot(cx, cz) < 9 ? 1.6 : 1;
      const h = (0.8 + r() * r() * 4.5) * tall;
      const m = new THREE.Mesh(building(r, w, d, h, id++), mat);
      m.position.set(cx + (r() - 0.5) * 2.6, 0, cz + (r() - 0.5) * 2.6);
      city.add(m);
    }
  }
  scene.add(city);
  // Sol : asphalte et îlots (dalles plus claires)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: "#1b2028" }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const lots = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ color: "#232831" }), 49);
  const mtx = new THREE.Matrix4();
  let li = 0;
  for (let bx = -3; bx <= 3; bx++) for (let bz = -3; bz <= 3; bz++) {
    mtx.makeRotationX(-Math.PI / 2).setPosition(bx * 5.2, 0.01, bz * 5.2);
    lots.setMatrixAt(li++, mtx);
  }
  scene.add(lots);
  // Circulation : phares (blancs) et feux arrière (rouges) qui suivent les rues.
  const CARS = 70;
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.08, 0.5), new THREE.MeshBasicMaterial({ toneMapped: false }), CARS);
  const carState = Array.from({ length: CARS }, (_, i) => ({ lane: (i % 7) - 3, axis: i % 2, dir: i % 3 === 0 ? -1 : 1, t: Math.random() * 40, speed: 2.5 + Math.random() * 3, taxi: i % 5 === 0 }));
  carState.forEach((c, i) => cars.setColorAt(i, new THREE.Color(c.taxi ? "#ffc21a" : c.dir > 0 ? "#e9f2ff" : "#ff3b2b")));
  scene.add(cars);
  const carM = new THREE.Matrix4();
  const moveCars = (dt: number) => {
    carState.forEach((c, i) => {
      c.t = (c.t + dt * c.speed * c.dir + 80) % 40;
      const along = c.t - 20, across = c.lane * 5.2 + 2.6 + (c.dir > 0 ? 0.5 : -0.5);
      carM.makeRotationY(c.axis ? Math.PI / 2 : 0).setPosition(c.axis ? along : across, 0.06, c.axis ? across : along);
      cars.setMatrixAt(i, carM);
    });
    cars.instanceMatrix.needsUpdate = true;
  };

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  const tilt = new TiltShiftEffect({ focusArea: 0.5, feather: 0.3, offset: 0.04 });
  composer.addPass(new EffectPass(cam, tilt, new SMAAEffect()));

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Entrée : la caméra descend vers la maquette (travelling), puis se pose.
  animate(cam.position, { x: [34, 26], y: [44, 30], z: [38, 30] }, {
    duration: 2.4, ease: [0.22, 1, 0.36, 1],
    onUpdate: () => cam.lookAt(0, 0, 0),
  });

  let target = 0, frame = 0, lastT = performance.now();
  const loop = () => {
    const t0 = performance.now();
    moveCars(Math.min(0.1, (t0 - lastT) / 1000));
    lastT = t0;
    uniforms.uLit.value += (target - uniforms.uLit.value) * 0.05;
    (scene.background as THREE.Color).lerpColors(dayBg, duskBg, Math.max(0, uniforms.uDusk.value - 1) / 0.3);
    composer.render();
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - t0).toFixed(2), triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
  };
  renderer.setAnimationLoop(loop);

  return {
    setProgress: (p) => { target = 0.02 + p * 0.38; },
    // Halte : la moitié des fenêtres s'éteint, la nuit devient plus profonde.
    dusk: (on) => { animate(uniforms.uDusk, { value: on ? 1.3 : 1 }, { duration: 2.2, ease: [0.45, 0, 0.55, 1] }); target = on ? target * 0.45 : target; },
    blink: () => { animate(uniforms.uBlink, { value: [0, 1, 0, 1, 0, 1, 0] }, { duration: 1.2, ease: "easeInOut" }); },
    dispose: () => { renderer.setAnimationLoop(null); ro.disconnect(); composer.dispose(); renderer.dispose(); },
  };
}
