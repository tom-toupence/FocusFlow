// LAB 2·5 · Les toits au petit matin (@thi.ng/geom + three) : le thème CLAIR.
//
// Direction : la même ville, mais à l'aube. On est sur un toit ; autour, les
// toits voisins encombrés (réservoirs d'eau, condenseurs, cabanons d'escalier,
// antennes), au loin les tours de bureaux où des fenêtres sont encore
// allumées. Lumière froide et lavée, ombres bleues, béton humide.
//
// La géométrie des toits est générée avec @thi.ng/geom : emprises (rect),
// parapets (rect moins rect décalé par `offset`), semis des équipements
// (`scatter` à l'intérieur de l'emprise réduite), cabanons (`roundedRect`).
// Les réservoirs sont tournés (profil dessiné à la main).
//
// Le temps : l'aube avance avec la session (ciel qui pâlit, fenêtres des tours
// qui s'éteignent une à une). Fin de pomodoro : le soleil passe au-dessus des
// tours et chauffe les toits (la pause). Distraction : une fenêtre s'allume
// là-bas (quelqu'un s'est réveillé).
import * as THREE from "three";
import { rect, offset, scatter, roundedRect, vertices } from "@thi.ng/geom";
import { Smush32 } from "@thi.ng/random";
import { animate } from "motion";
import { reportInfo } from "@/lib/lab/LabShell";

const toV2 = (pts: number[][]) => pts.map(([x, y]) => new THREE.Vector2(x, y));

function skyTexture(t: number) {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  const top = new THREE.Color("#6f8fb4").lerp(new THREE.Color("#a9c4dc"), t);
  const mid = new THREE.Color("#b9c6d6").lerp(new THREE.Color("#dfe6ec"), t);
  const low = new THREE.Color("#d9b8a2").lerp(new THREE.Color("#f6dcc2"), t);
  gr.addColorStop(0, `#${top.getHexString()}`);
  gr.addColorStop(0.62, `#${mid.getHexString()}`);
  gr.addColorStop(1, `#${low.getHexString()}`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TOWER_FRAG = /* glsl */ `
uniform float uLit; varying vec3 vPos; varying vec3 vNor; varying float vSeed;
float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 n = normalize(vNor);
  vec3 base = mix(vec3(0.62, 0.65, 0.69), vec3(0.72, 0.71, 0.7), step(0.5, fract(vSeed * 3.7)));
  float shade = 0.75 + 0.25 * max(dot(n, normalize(vec3(-0.6, 0.4, 0.7))), 0.0);
  vec3 col = base * shade;
  if (abs(n.y) < 0.5) {
    vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
    vec2 uv = vec2(dot(vPos, t) * 0.8, vPos.y * 0.9);
    vec2 c = floor(uv), f = fract(uv);
    float win = step(0.15, f.x) * step(f.x, 0.85) * step(0.25, f.y) * step(f.y, 0.75);
    col = mix(col, vec3(0.42, 0.5, 0.6) * shade, win * 0.8);
    float lit = step(h(vec3(c, vSeed)), uLit) * win;
    col = mix(col, vec3(1.0, 0.86, 0.6), lit);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
const TOWER_VERT = /* glsl */ `
attribute float aSeed; varying vec3 vPos; varying vec3 vNor; varying float vSeed;
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; vNor = normalize(mat3(modelMatrix) * normal); vSeed = aSeed; gl_Position = projectionMatrix * viewMatrix * wp; }`;

export interface ToitsScene {
  dawn: (p: number) => void;
  sunUp: (on: boolean) => void;
  wake: () => void;
  dispose: () => void;
}

export function createToits(canvas: HTMLCanvasElement): ToitsScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  let sky = skyTexture(0);
  scene.background = sky;
  scene.fog = new THREE.Fog("#c8d2dc", 30, 140);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  cam.position.set(-4, 9.5, 12); // debout sur le parapet du toit le plus haut, regard plongeant
  cam.lookAt(6, 3, -26);
  const rnd = new Smush32(0x0f0c05);

  const concrete = new THREE.MeshStandardMaterial({ color: "#b9b6b0", roughness: 0.92 });
  const wet = new THREE.MeshStandardMaterial({ color: "#8f9196", roughness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: "#c7ccd1", roughness: 0.5, metalness: 0.3 });
  const tankMat = new THREE.MeshStandardMaterial({ color: "#e6e3dc", roughness: 0.6 });

  // Réservoir d'eau tourné : pieds + cuve + couvercle conique
  const tankProfile = toV2([[0, 0], [0.75, 0], [0.75, 1.5], [0.7, 1.6], [0.3, 1.85], [0, 1.88]]);
  const tankGeo = new THREE.LatheGeometry(tankProfile, 28);

  const roofs: { x: number; z: number; w: number; d: number; y: number }[] = [
    { x: -6, z: -2, w: 12, d: 14, y: 0 },
    { x: 8, z: -8, w: 9, d: 10, y: 3.2 },
    { x: -2, z: -22, w: 14, d: 9, y: 6 },
    { x: 14, z: -24, w: 10, d: 12, y: 1.5 },
  ];
  const sun = new THREE.DirectionalLight("#ffd9b8", 0.6);
  sun.position.set(-30, 8, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 200 });
  scene.add(sun, new THREE.HemisphereLight("#cfdbe8", "#7f7a73", 1.25));

  for (const r of roofs) {
    const fp = rect([r.x, r.z], [r.w, r.d]);
    // Bâtiment sous le toit
    const body = new THREE.Mesh(new THREE.BoxGeometry(r.w, 30, r.d), concrete);
    body.position.set(r.x + r.w / 2, r.y - 15, r.z + r.d / 2);
    body.receiveShadow = true;
    scene.add(body);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.05, r.d), wet);
    slab.position.set(r.x + r.w / 2, r.y + 0.02, r.z + r.d / 2);
    slab.receiveShadow = true;
    scene.add(slab);
    // Parapet : emprise moins emprise décalée vers l'intérieur
    const outer = vertices(fp) as number[][];
    const inner = vertices(offset(fp, -0.22)) as number[][];
    const shape = new THREE.Shape(toV2(outer));
    shape.holes.push(new THREE.Path(toV2(inner).reverse()));
    const parapet = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, r.y + 0.9, 0), concrete);
    parapet.castShadow = parapet.receiveShadow = true;
    scene.add(parapet);
    // Équipements semés dans l'emprise réduite
    const inside = offset(fp, -1.1);
    const pts = (scatter(inside, 5 + Math.floor(rnd.float() * 4), rnd) ?? []) as number[][];
    pts.forEach(([x, z], i) => {
      const kind = i % 3;
      if (kind === 0) {
        const t = new THREE.Mesh(tankGeo, tankMat);
        const legs = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), metal);
        legs.position.set(x, r.y + 0.5, z);
        t.position.set(x, r.y + 1, z);
        t.castShadow = legs.castShadow = true;
        scene.add(t, legs);
      } else if (kind === 1) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.7), metal);
        ac.position.set(x, r.y + 0.45, z);
        ac.rotation.y = rnd.float() * 0.4;
        ac.castShadow = true;
        scene.add(ac);
      } else {
        const hut = roundedRect([0, 0], [2.4, 2.0], 0.25);
        const hs = new THREE.Shape(toV2(vertices(hut, 24) as number[][]));
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 2.4, bevelEnabled: false }).rotateX(-Math.PI / 2), concrete);
        m.position.set(x - 1.2, r.y, z + 1);
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
      }
    });
    // Antenne
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4, 6), metal);
    ant.position.set(r.x + r.w - 1, r.y + 2, r.z + 1);
    scene.add(ant);
  }

  // Tours au loin : fenêtres encore allumées
  const towerU = { uLit: { value: 0.35 } };
  const towerMat = new THREE.ShaderMaterial({ vertexShader: TOWER_VERT, fragmentShader: TOWER_FRAG, uniforms: towerU });
  for (let i = 0; i < 14; i++) {
    const w = 6 + rnd.float() * 8, h = 30 + rnd.float() * 70;
    const g = new THREE.BoxGeometry(w, h, w * (0.7 + rnd.float() * 0.6));
    g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(rnd.float()), 1));
    const m = new THREE.Mesh(g, towerMat);
    m.position.set(-40 + i * 9 + rnd.float() * 4, h / 2 - 10, -70 - rnd.float() * 50);
    scene.add(m);
  }

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = w / h < 1 ? 58 : 38;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let frame = 0;
  renderer.setAnimationLoop(() => {
    const c0 = performance.now();
    renderer.render(scene, cam);
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - c0).toFixed(2), triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
  });

  let lastDawn = -1;
  return {
    dawn: (p) => {
      const q = Math.round(p * 20) / 20;
      if (q === lastDawn) return;
      lastDawn = q;
      sky.dispose();
      sky = skyTexture(q);
      scene.background = sky;
      towerU.uLit.value = 0.35 * (1 - q * 0.8);
    },
    sunUp: (on) => {
      animate(sun.position, { y: on ? 40 : 8 }, { duration: 3.5, ease: [0.45, 0, 0.55, 1] });
      animate(sun, { intensity: on ? 2.6 : 0.6 }, { duration: 3.5, ease: [0.45, 0, 0.55, 1] });
    },
    wake: () => { animate(towerU.uLit, { value: [towerU.uLit.value, towerU.uLit.value + 0.05] }, { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }); },
    dispose: () => { renderer.setAnimationLoop(null); ro.disconnect(); renderer.dispose(); sky.dispose(); },
  };
}
