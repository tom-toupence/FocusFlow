// LAB 1 · Céladon (three WebGPURenderer + TSL, repli WebGL2 automatique)
//
// Direction : céramique claire, matière, lumière de studio photo.
// Le pomodoro est une ÉMAILLURE : l'émail céladon monte le long d'un vase
// tourné (maebyeong coréen, dynastie Goryeo) à mesure que le temps passe. En
// dessous, la terre crue, mate et mouchetée. Fin de pomodoro : l'émail atteint
// la lèvre, le vase fait un tour sur la tournette. Pause : la lumière tombe
// vers le bleu du soir. Distraction : le vase est heurté, il oscille.
//
// Tout est modélisé en code : profil du vase dessiné à la main (Catmull-Rom),
// tour (LatheGeometry), cyclorama de studio construit sommet par sommet.
import * as THREE from "three/webgpu";
import {
  uniform, positionLocal, float, mix, smoothstep, color, atan, sin, abs, pow,
  mx_worley_noise_vec2, mx_noise_float, vec3,
} from "three/tsl";
import { animate } from "motion";
import { reportInfo } from "@/lib/lab/LabShell";

const H = 2.1;

/** Profil du maebyeong : (rayon, hauteur), dessiné à la main. */
const PROFILE: [number, number][] = [
  [0.0, 0.0], [0.34, 0.0], [0.36, 0.02], [0.33, 0.06], [0.34, 0.14], [0.39, 0.34],
  [0.48, 0.66], [0.6, 1.02], [0.69, 1.32], [0.71, 1.46], [0.66, 1.62], [0.5, 1.78],
  [0.3, 1.88], [0.17, 1.93], [0.15, 1.99], [0.19, 2.05], [0.2, 2.08], [0.17, 2.1], [0.0, 2.1],
];

function vesselGeometry() {
  const curve = new THREE.CatmullRomCurve3(PROFILE.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, "centripetal");
  const pts = curve.getPoints(220).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, 200);
  g.computeVertexNormals();
  return g;
}

/** Cyclorama : sol qui se courbe en mur, comme un fond de studio. */
function coveGeometry(width = 14, depth = 7, height = 7, radius = 2.4, seg = 48) {
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    // sol (z de +depth à 0), quart de cercle, mur (y de radius à height)
    const L1 = depth, L2 = (Math.PI / 2) * radius, L3 = height - radius;
    const s = t * (L1 + L2 + L3);
    if (s < L1) profile.push(new THREE.Vector2(depth - s, 0));
    else if (s < L1 + L2) {
      const a = (s - L1) / radius;
      profile.push(new THREE.Vector2(-Math.sin(a) * radius, radius - Math.cos(a) * radius));
    } else profile.push(new THREE.Vector2(-radius, radius + (s - L1 - L2)));
  }
  const cols = 2;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) for (let j = 0; j < cols; j++) {
    const x = j === 0 ? -width / 2 : width / 2;
    pos.push(x, profile[i].y, profile[i].x);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * cols, b = (i + 1) * cols;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Ombre de contact précalculée (texture radiale), au lieu d'une ombre temps réel. */
function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const gr = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, "rgba(40,36,30,0.55)");
  gr.addColorStop(0.45, "rgba(40,36,30,0.18)");
  gr.addColorStop(1, "rgba(40,36,30,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  return m;
}

export interface CeladonScene {
  setLevel: (v: number) => void;
  pomodoroEnd: () => void;
  breakMode: (on: boolean) => void;
  bump: () => void;
  dispose: () => void;
}

export async function createCeladon(canvas: HTMLCanvasElement): Promise<CeladonScene> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e9e3d8");
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0.9, 1.55, 7.2);
  camera.lookAt(0, 1.0, 0);

  // ── Matériaux ────────────────────────────────────────────────────────
  const level = uniform(0);
  const p = positionLocal;
  const h = p.y.div(H);
  const ang = atan(p.z, p.x);
  // Bord d'émail irrégulier : bruit + coulures (pics étroits répartis sur le tour).
  const drips = pow(abs(sin(ang.mul(7.0).add(mx_noise_float(p.mul(2.0)).mul(2.0)))), float(18.0)).mul(0.045);
  const edge = level.add(mx_noise_float(p.mul(7.0)).mul(0.012)).sub(drips);
  const glazed = smoothstep(edge.sub(0.006), edge.add(0.006), h).oneMinus();
  // Craquelure : bords de cellules de Voronoï (F2 - F1).
  const w = mx_worley_noise_vec2(p.mul(vec3(9.0, 7.0, 9.0)));
  const crack = smoothstep(0.0, 0.035, w.y.sub(w.x)).oneMinus();
  // L'émail s'épaissit (et fonce) dans les creux bas : approximation par la hauteur.
  const pool = smoothstep(0.55, 0.05, h).mul(0.35);
  const celadon = mix(color("#a9c2ad"), color("#6f8f7c"), pool);
  const glaze = mix(celadon, color("#4f6a5c"), crack.mul(0.5));
  const speck = smoothstep(0.62, 0.7, mx_noise_float(p.mul(90.0)));
  const clay = mix(color("#c3b49a"), color("#6d6150"), speck.mul(0.7));

  const vesselMat = new THREE.MeshPhysicalNodeMaterial();
  vesselMat.colorNode = mix(clay, glaze, glazed);
  vesselMat.roughnessNode = mix(float(0.86), float(0.16), glazed);
  vesselMat.clearcoatNode = glazed.mul(0.55);
  vesselMat.clearcoatRoughnessNode = float(0.12);

  const vessel = new THREE.Mesh(vesselGeometry(), vesselMat);
  const turntable = new THREE.Group();
  turntable.add(vessel);
  scene.add(turntable);
  scene.add(contactShadow());

  const coveMat = new THREE.MeshStandardNodeMaterial({ color: "#e6dfd2", roughness: 0.95 });
  const cove = new THREE.Mesh(coveGeometry(), coveMat);
  cove.position.z = -2.2;
  scene.add(cove);

  // ── Lumière : direction photo (key chaude, fill froide, rim) ─────────
  const key = new THREE.DirectionalLight("#ffe7cc", 3.2);
  key.position.set(-4, 6, 4);
  const fill = new THREE.HemisphereLight("#dfe7ef", "#b7a98f", 0.9);
  const rim = new THREE.DirectionalLight("#cfe0ff", 2.2);
  rim.position.set(3.5, 3, -4);
  scene.add(key, fill, rim);

  const resize = () => {
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Entrée en scène : le vase monte d'un léger creux (anticipation), se pose.
  turntable.position.y = -0.25;
  turntable.rotation.y = -0.6;
  vesselMat.opacity = 1;
  animate(turntable.position, { y: [-0.25, -0.31, 0] }, { duration: 1.4, times: [0, 0.25, 1], ease: [0.2, 0.8, 0.2, 1] });
  animate(turntable.rotation, { y: [-0.6, 0.08, 0] }, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });

  let target = 0;
  let frame = 0;
  renderer.setAnimationLoop(() => {
    const t0 = performance.now();
    level.value += (target - level.value) * 0.08;
    renderer.render(scene, camera);
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - t0).toFixed(2), triangles: renderer.info.render.triangles, calls: renderer.info.render.drawCalls });
  });

  return {
    setLevel: (v) => { target = Math.min(1.02, Math.max(0, v)); },
    pomodoroEnd: () => {
      // Un tour de tournette : départ lent, élan, arrivée amortie.
      animate(turntable.rotation, { y: [turntable.rotation.y, turntable.rotation.y + Math.PI * 2] }, { duration: 2.2, ease: [0.65, 0, 0.25, 1] });
    },
    breakMode: (on) => {
      animate(key.color, on ? { r: 0.72, g: 0.8, b: 1 } : { r: 1, g: 0.906, b: 0.8 }, { duration: 1.6, ease: [0.45, 0, 0.55, 1] });
      animate(key, { intensity: on ? 1.3 : 3.2 }, { duration: 1.6, ease: [0.45, 0, 0.55, 1] });
      animate(scene.background as THREE.Color, on ? { r: 0.76, g: 0.79, b: 0.84 } : { r: 0.914, g: 0.89, b: 0.847 }, { duration: 1.6 });
    },
    bump: () => {
      // Heurt : oscillation amortie autour de la base (pivot au pied).
      animate(turntable.rotation, { z: [0, 0.07, -0.045, 0.022, -0.008, 0] }, { duration: 1.3, ease: "easeOut" });
    },
    dispose: () => { renderer.setAnimationLoop(null); ro.disconnect(); renderer.dispose(); },
  };
}
