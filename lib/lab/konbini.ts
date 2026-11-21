// LAB 2·2 · Supérette 24 h (manifold-3d : modélisation par booléens en WASM)
//
// Direction : plan large et fixe, de l'autre côté d'une rue mouillée. La
// supérette ouverte toute la nuit est la seule source franche : intérieur
// blanc froid, bandeau vert, deux distributeurs. Matière : verre, plastique
// propre, sol brillant. Composition décentrée : le magasin occupe la droite.
//
// Le temps : la rue s'assombrit à mesure que la nuit avance (lampadaires qui
// faiblissent), le magasin, lui, ne change pas. Fin de pomodoro : les portes
// automatiques s'ouvrent et la caméra traverse la rue jusqu'au seuil : la
// pause, c'est entrer dans la lumière. Distraction : la porte s'entrouvre et se
// referme (quelqu'un passe). Reprise : on ressort, les portes se ferment.
//
// Toute la géométrie vient de manifold-3d : coque du bâtiment (cube moins
// cavité moins vitrine moins porte), meubles d'étagères (cube moins niches),
// distributeurs (cube moins façade en retrait). Aucune primitive posée telle quelle.
import * as THREE from "three";
import Module from "manifold-3d";
import { Text, configureTextBuilder } from "troika-three-text";
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from "postprocessing";
import { animate } from "motion";
import { reportInfo } from "@/lib/lab/LabShell";
import { NIGHT } from "@/lib/lab/ruelle";

configureTextBuilder({ useWorker: false });

type M = Awaited<ReturnType<typeof Module>>;

/** Manifold → BufferGeometry (positions, normales à facettes nettes). */
function toGeometry(man: InstanceType<M["Manifold"]>) {
  const mesh = man.getMesh();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(mesh.vertProperties.slice(), 3));
  g.setIndex(new THREE.BufferAttribute(mesh.triVerts.slice(), 1));
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

export interface KonbiniScene {
  progress: (p: number) => void;
  enter: (on: boolean) => void;
  passerby: () => void;
  dispose: () => void;
}

export async function createKonbini(canvas: HTMLCanvasElement): Promise<KonbiniScene> {
  const wasm = await Module({ locateFile: () => "/lab/manifold.wasm" });
  wasm.setup();
  const { Manifold } = wasm;
  const box = (x: number, y: number, z: number, px = 0, py = 0, pz = 0) => Manifold.cube([x, y, z], true).translate([px, py, pz]);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0c1015");
  scene.fog = new THREE.FogExp2("#0c1015", 0.04);
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const outside = new THREE.Vector3(-4.2, 1.7, 12.5);
  const lookOut = new THREE.Vector3(1.6, 1.9, 0);
  cam.position.copy(outside);
  cam.lookAt(lookOut);

  // ── Bâtiment : coque obtenue par soustractions ─────────────────────────
  const W = 9, H = 4.2, D = 7;
  const shell = box(W, H, D, 2, H / 2, -D / 2)
    .subtract(box(W - 0.4, H - 0.5, D - 0.4, 2, H / 2 - 0.05, -D / 2))
    .subtract(box(5.6, 2.5, 1, 0.6, 1.45, 0))           // vitrine
    .subtract(box(1.8, 2.3, 1, 4.9, 1.35, 0));           // porte automatique
  const wallMat = new THREE.MeshStandardMaterial({ color: "#d9dcdc", roughness: 0.6 });
  scene.add(new THREE.Mesh(toGeometry(shell), wallMat));
  // Immeuble au-dessus (le magasin est au rez-de-chaussée) et voisins
  const upper = box(W + 0.4, 12, D, 2, H + 6, -D / 2).subtract(box(W - 1, 11, 1, 2, H + 6, 0.2));
  scene.add(new THREE.Mesh(toGeometry(upper), new THREE.MeshStandardMaterial({ color: "#26292d", roughness: 0.8 })));
  const neighbour = box(7, 16, D, -6.2, 8, -D / 2 - 0.6).subtract(box(6, 1.2, 0.6, -6.2, 1.5, -0.6 + 0.1));
  scene.add(new THREE.Mesh(toGeometry(neighbour), new THREE.MeshStandardMaterial({ color: "#1d2024", roughness: 0.85 })));

  // Bandeau : rayures vertes et blanc (générique, aucune marque)
  const band = new THREE.Group();
  const bandBase = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.9), new THREE.MeshBasicMaterial({ color: "#f2f6f3", toneMapped: false }));
  band.add(bandBase);
  for (const [y, h] of [[-0.3, 0.12], [-0.13, 0.06]] as const) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(W, h), new THREE.MeshBasicMaterial({ color: NIGHT.konbini, toneMapped: false }));
    s.position.set(0, y, 0.001);
    band.add(s);
  }
  const label = new Text();
  label.text = "24 HOURS";
  label.font = "/lab/fonts/BigShoulders.ttf";
  label.fontSize = 0.44;
  label.anchorX = "left"; label.anchorY = "middle";
  label.color = "#1f3d2e";
  label.position.set(-W / 2 + 0.4, 0.15, 0.002);
  label.material = new THREE.MeshBasicMaterial({ color: "#1f3d2e", toneMapped: false });
  label.sync();
  band.add(label);
  band.position.set(2, H - 0.55, 0.01);
  scene.add(band);

  // ── Intérieur : plafond à tubes, meubles d'étagères (booléens), produits ──
  const tubeMat = new THREE.MeshBasicMaterial({ color: "#f3f8ff", toneMapped: false });
  for (let i = 0; i < 5; i++) for (const x of [-0.6, 2, 4.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.12), tubeMat);
    t.position.set(x, H - 0.32, -1 - i * 1.25);
    scene.add(t);
  }
  const shelf = box(3.2, 1.6, 0.6).subtract(box(3.0, 0.38, 0.5, 0, -0.42, 0.06)).subtract(box(3.0, 0.38, 0.5, 0, 0.06, 0.06)).subtract(box(3.0, 0.38, 0.5, 0, 0.54, 0.06));
  const shelfGeo = toGeometry(shelf);
  const shelves = new THREE.InstancedMesh(shelfGeo, new THREE.MeshStandardMaterial({ color: "#e7e9ea", roughness: 0.5 }), 6);
  const products = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.26, 0.13), new THREE.MeshStandardMaterial({ roughness: 0.5 }), 6 * 3 * 18);
  const mx = new THREE.Matrix4();
  const pal = ["#d7372b", "#f2b51e", "#3aa85f", "#2c63c7", "#ece6d8", "#e57b2b", "#7a5130"].map((c) => new THREE.Color(c));
  let pi = 0;
  [[-0.3, -2.2], [3.3, -2.2], [-0.3, -4.2], [3.3, -4.2], [-0.3, -6.0], [3.3, -6.0]].forEach(([x, z], k) => {
    mx.makeTranslation(x, 0.8, z);
    shelves.setMatrixAt(k, mx);
    for (let row = 0; row < 3; row++) for (let c = 0; c < 18; c++) {
      mx.makeTranslation(x - 1.4 + c * 0.165, 0.42 + row * 0.48, z + 0.08);
      products.setMatrixAt(pi, mx);
      products.setColorAt(pi, pal[(c * 7 + row * 3 + k) % pal.length]);
      pi++;
    }
  });
  scene.add(shelves, products);
  const fills: THREE.PointLight[] = [];
  for (const x of [0, 3.6]) {
    const l = new THREE.PointLight("#eaf4ff", 14, 9, 1.4);
    l.position.set(x, 3.2, -2.6);
    scene.add(l);
    fills.push(l);
  }
  // La lumière du magasin sort sur le trottoir
  const spill = new THREE.SpotLight("#e6f2ff", 40, 14, 0.9, 0.7, 1.2);
  spill.position.set(2, 2.8, -1.2);
  spill.target.position.set(1.5, 0, 4);
  scene.add(spill, spill.target);

  // Portes automatiques (deux vantaux vitrés)
  const glass = new THREE.MeshPhysicalMaterial({ color: "#cfe6f0", roughness: 0.05, transmission: 0, transparent: true, opacity: 0.25 });
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.25, 0.04), glass);
  const doorR = doorL.clone();
  doorL.position.set(4.45, 1.33, 0.05);
  doorR.position.set(5.35, 1.33, 0.05);
  scene.add(doorL, doorR);
  // Vitrine
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.5), glass);
  pane.position.set(0.6, 1.45, 0.06);
  scene.add(pane);

  // ── Distributeurs : cube moins façade en retrait, panneau lumineux ──────
  const vmBody = toGeometry(box(0.95, 1.9, 0.8, 0, 0.95, 0).subtract(box(0.75, 1.25, 0.2, 0, 1.15, 0.38)));
  const vmCols = ["#c9282d", "#1f5fa8"];
  vmCols.forEach((c, i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(vmBody, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.2), new THREE.MeshBasicMaterial({ color: "#eef7ff", toneMapped: false }));
    p.position.set(0, 1.15, 0.3);
    g.add(p);
    g.position.set(-2.3 + i * 1.05, 0, 0.6);
    scene.add(g);
  });
  const vmLight = new THREE.PointLight("#e8f3ff", 6, 5, 1.6);
  vmLight.position.set(-1.8, 1.3, 1.6);
  scene.add(vmLight);

  // ── Rue : asphalte mouillé brillant, lampadaires au sodium ──────────────
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshPhysicalMaterial({ color: "#121518", roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = 6;
  scene.add(ground);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(40, 0.15, 3), new THREE.MeshStandardMaterial({ color: "#3a3d40", roughness: 0.7 }));
  curb.position.set(0, 0.075, 1.6);
  scene.add(curb);
  const lamps: THREE.PointLight[] = [];
  for (const x of [-9, 9]) {
    const l = new THREE.PointLight(NIGHT.sodium, 26, 16, 1.6);
    l.position.set(x, 5, 5);
    scene.add(l);
    lamps.push(l);
  }
  scene.add(new THREE.HemisphereLight("#1d2a3a", "#050505", 0.4));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new EffectPass(cam, new BloomEffect({ luminanceThreshold: 0.6, intensity: 0.9, mipmapBlur: true })));

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    cam.aspect = w / h;
    cam.fov = w / h < 1 ? 56 : 34;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let frame = 0;
  renderer.setAnimationLoop(() => {
    const c0 = performance.now();
    composer.render();
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - c0).toFixed(2), triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
  });

  const doors = (open: number, dur = 0.9) => {
    animate(doorL.position, { x: 4.45 - open * 0.85 }, { duration: dur, ease: [0.3, 0.9, 0.3, 1] });
    animate(doorR.position, { x: 5.35 + open * 0.85 }, { duration: dur, ease: [0.3, 0.9, 0.3, 1] });
  };
  const curLook = lookOut.clone();
  const camTo = (pos: THREE.Vector3, look: THREE.Vector3, dur: number) => {
    const from = cam.position.clone();
    const st = { t: 0 };
    const lk = new THREE.Vector3();
    const look0 = curLook.clone();
    return animate(st, { t: 1 }, {
      duration: dur, ease: [0.65, 0, 0.25, 1],
      onUpdate: () => { cam.position.lerpVectors(from, pos, st.t); lk.lerpVectors(look0, look, st.t); curLook.copy(lk); cam.lookAt(lk); },
    });
  };

  return {
    progress: (p) => {
      // La nuit avance : les lampadaires de la rue faiblissent, le magasin non.
      lamps.forEach((l) => (l.intensity = 26 * (1 - p * 0.55)));
    },
    enter: (on) => {
      if (on) { doors(1); camTo(new THREE.Vector3(4.2, 1.6, 4.2), new THREE.Vector3(3.2, 1.4, -4), 3.2); }
      else { camTo(outside, lookOut, 2.6); setTimeout(() => doors(0), 1600); }
    },
    passerby: () => { doors(0.55, 0.5); setTimeout(() => doors(0, 0.7), 900); },
    dispose: () => { renderer.setAnimationLoop(null); ro.disconnect(); composer.dispose(); renderer.dispose(); label.dispose(); },
  };
}
