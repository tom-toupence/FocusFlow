// LAB 6 · Compteur (objet modélisé dans Blender en script headless + three)
//
// Direction : design industriel, objet de bureau en bakélite crème, rouleaux
// noirs à chiffres en relief, repère orange (Braun ET66, compteurs
// Veeder-Root). Prise de vue produit : softbox clé en haut à gauche, contre-
// jour, ombre portée sur un fond gris chaud.
// Le compteur affiche à gauche les pomodoros du jour, à droite les minutes
// restantes. Chaque changement de chiffre est un PLAN : le rouleau recule un
// peu (anticipation), tourne, dépasse et revient (ressort amorti).
// Fin de pomodoro : les minutes remontent à 25 en cascade, le compteur de
// gauche claque d'un cran, le repère orange s'allume. Pause : l'objet se
// penche en arrière et la lumière s'adoucit. Distraction : un petit choc.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { animate } from "motion";
import { reportInfo } from "@/lib/lab/LabShell";

const STEP = (Math.PI * 2) / 10;
const SPRING = { type: "spring" as const, stiffness: 220, damping: 17, mass: 0.9 };

export interface CounterScene {
  show: (left: number, right: number) => void;
  pomodoroEnd: (left: number) => void;
  breakMode: (on: boolean) => void;
  knock: () => void;
  dispose: () => void;
}

export async function createCounter(canvas: HTMLCanvasElement): Promise<CounterScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  const bgDay = new THREE.Color("#d9d4cb"), bgBreak = new THREE.Color("#b9bec6");
  scene.background = bgDay.clone();
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  cam.position.set(0, 1.1, 11);
  cam.lookAt(0, 0, 0);

  const gltf = await new GLTFLoader().loadAsync("/lab/counter.glb");
  const model = gltf.scene;
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);

  // Matériaux réglés à la main (on garde la répartition du modèle, pas ses réglages).
  const body = new THREE.MeshPhysicalMaterial({ color: "#ddd5c6", roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.2, sheenColor: new THREE.Color("#fff3df") });
  const drum = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.55 });
  const digit = new THREE.MeshStandardMaterial({ color: "#f1ede3", roughness: 0.5 });
  const accent = new THREE.MeshStandardMaterial({ color: "#ee6a1f", roughness: 0.45, emissive: new THREE.Color("#ff6a10"), emissiveIntensity: 0 });
  const drums: THREE.Object3D[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const name = (Array.isArray(m.material) ? m.material[0] : m.material).name;
    m.material = name === "body" ? body : name === "drum" ? drum : name === "digit" ? digit : name === "accent" ? accent : m.material;
  });
  for (let i = 0; i < 4; i++) {
    const d = model.getObjectByName(`drum_${i}`);
    if (d) drums.push(d);
  }

  // Lumière : softbox clé (rect area), contre-jour froid, ombre portée douce.
  const key = new THREE.RectAreaLight("#fff1dc", 7, 6, 4);
  key.position.set(-5, 6, 6);
  key.lookAt(0, 0, 0);
  const rim = new THREE.RectAreaLight("#d6e4ff", 5, 5, 2);
  rim.position.set(5, 3, -6);
  rim.lookAt(0, 0, 0);
  const fill = new THREE.HemisphereLight("#f3efe8", "#a39a8c", 0.6);
  const shadowSun = new THREE.DirectionalLight("#ffffff", 0.9);
  shadowSun.position.set(-3, 8, 4);
  shadowSun.castShadow = true;
  shadowSun.shadow.mapSize.set(1024, 1024);
  shadowSun.shadow.radius = 8;
  shadowSun.shadow.blurSamples = 16;
  // Lumière rasante dans la fenêtre : comme une lampe de bureau au-dessus de l'objet,
  // elle éclaire la face des rouleaux sans entrer dans le boîtier.
  const windowLight = new THREE.RectAreaLight("#fff6e8", 9, 2.8, 0.6);
  windowLight.position.set(0, 0.9, 2.2);
  windowLight.lookAt(0, -0.1, 0.5);
  scene.add(key, rim, fill, shadowSun, windowLight);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  floor.receiveShadow = true;
  scene.add(floor);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = w / h < 1 ? 40 : 24;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Valeur affichée par rouleau (en crans, cumulée : on ne tourne jamais à l'envers).
  const shown = [0, 0, 0, 0];
  const turnTo = (i: number, digitValue: number, opts?: { delay?: number; fullTurns?: number }) => {
    const d = drums[i];
    if (!d) return;
    const cur = shown[i];
    let next = cur - (cur % 10) + digitValue;
    if (next < cur) next += 10;
    next += (opts?.fullTurns ?? 0) * 10;
    if (next === cur) return;
    shown[i] = next;
    const from = d.rotation.x;
    const to = next * STEP;
    // Anticipation : un léger recul avant le départ, puis ressort.
    animate(d.rotation, { x: [from, from - STEP * 0.12] }, { duration: 0.12, delay: opts?.delay ?? 0, ease: [0.4, 0, 1, 1] })
      .then(() => animate(d.rotation, { x: to }, SPRING));
  };

  // Entrée en scène : l'objet arrive de trois-quarts, se tourne face à nous.
  pivot.rotation.set(0.25, -0.75, 0);
  pivot.position.y = -0.4;
  animate(pivot.rotation, { x: 0, y: 0 }, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
  animate(pivot.position, { y: [-0.4, 0.05, 0] }, { duration: 1.4, times: [0, 0.7, 1], ease: [0.22, 1, 0.36, 1] });

  let frame = 0;
  renderer.setAnimationLoop(() => {
    const t0 = performance.now();
    renderer.render(scene, cam);
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - t0).toFixed(2), triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
  });

  let last = [-1, -1, -1, -1];
  return {
    show: (left, right) => {
      const v = [Math.floor(left / 10) % 10, left % 10, Math.floor(right / 10) % 10, right % 10];
      v.forEach((d, i) => { if (d !== last[i]) turnTo(i, d, { delay: i * 0.06 }); });
      last = v;
    },
    pomodoroEnd: (left) => {
      // Cascade de remontée des minutes (un tour complet + le reste), puis le cran de gauche.
      turnTo(2, 2, { fullTurns: 1 });
      turnTo(3, 5, { fullTurns: 2, delay: 0.1 });
      turnTo(1, left % 10, { delay: 0.5 });
      turnTo(0, Math.floor(left / 10) % 10, { delay: 0.55 });
      last = [Math.floor(left / 10) % 10, left % 10, 2, 5];
      animate(accent, { emissiveIntensity: [0, 2.4, 0.6] }, { duration: 1.4, times: [0, 0.15, 1], ease: [0.2, 0.8, 0.2, 1] });
    },
    breakMode: (on) => {
      animate(pivot.rotation, { x: on ? -0.14 : 0 }, { type: "spring", stiffness: 120, damping: 20 });
      animate(key, { intensity: on ? 3 : 7 }, { duration: 1.6, ease: [0.45, 0, 0.55, 1] });
      animate(scene.background as THREE.Color, on ? { r: bgBreak.r, g: bgBreak.g, b: bgBreak.b } : { r: bgDay.r, g: bgDay.g, b: bgDay.b }, { duration: 1.6, ease: [0.45, 0, 0.55, 1] });
      if (!on) animate(accent, { emissiveIntensity: 0 }, { duration: 0.6 });
    },
    knock: () => {
      animate(pivot.rotation, { z: [0, -0.05, 0.035, -0.015, 0] }, { duration: 0.9, ease: [0.3, 0.7, 0.4, 1] });
      animate(pivot.position, { x: [0, 0.06, -0.03, 0] }, { duration: 0.6, ease: [0.3, 0.7, 0.4, 1] });
    },
    dispose: () => { renderer.setAnimationLoop(null); ro.disconnect(); renderer.dispose(); },
  };
}
