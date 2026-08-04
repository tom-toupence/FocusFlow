"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  buildBusStop, buildNeonSign, buildStreetLamp, buildTrafficLight, buildTree, mulberry32,
} from "@/lib/cityMeshes";
import { cn } from "@/lib/utils";

// FOND du landing : une avenue nocturne qui DÉFILE derrière le contenu, en boucle
// infinie. Ambiance lofi « night drive », chill.
//
// Assets (kits Kenney, CC0, dans `public/`) :
//   • `city_models/*.glb` — immeubles et gratte-ciels
//   • `car_models/*.glb`  — voitures (carrosserie + 4 roues en nœuds séparés,
//                            donc les ROUES TOURNENT)
//   • `skyboxes/skybox-night-2k.png` — ciel équirectangulaire (réduit de 4K à 2K :
//     1074 Ko → 274 Ko, et 4× moins de VRAM)
// Le mobilier urbain (lampadaires, feux, abribus, arbres, enseignes néon, métro
// aérien) reste PROCÉDURAL — `lib/cityMeshes.ts` — parce que le kit n'en fournit
// pas et que c'est lui qui donne l'ambiance nocturne.
//
// Les deux kits n'ont pas la même échelle (immeuble ≈ 1 unité, voiture ≈ 2,5) :
// on normalise via BUILD_SCALE / CAR_SCALE et les bounding boxes mesurées au
// chargement, ce qui rend le placement indépendant du modèle.
//
// Chorégraphie scroll : le scroll injecte un boost de vitesse amorti et SIGNÉ
// (remonter fait reculer la ville) et fait plonger la caméra vers la rue au fil
// de la page. Sans scroll, la ville dérive doucement toute seule.
//
// Perf : tout est INSTANCIÉ (une instancedMesh par modèle), aucun post-processing
// ni shadow map, DPR plafonné. Le rendu ne s'arrête que si l'onglet est caché —
// le flow doit continuer jusqu'en bas de page.

const CITY_URLS = ["building-a", "building-e", "building-f", "building-skyscraper-a", "building-skyscraper-d", "building-skyscraper-e"]
  .map((n) => `/city_models/${n}.glb`);
const CAR_URLS = ["taxi", "normal-car1", "normal-car2", "suv"].map((n) => `/car_models/${n}.glb`);
const SKY_URL = "/skyboxes/skybox-night-2k.png";

CITY_URLS.forEach((u) => useGLTF.preload(u));
CAR_URLS.forEach((u) => useGLTF.preload(u));

const SPAN = 150; // profondeur de la boucle : ce qui dépasse est recyclé au fond
// ⚠️ NEAR doit rester DERRIÈRE la caméra (qui va de z=34 à z=22) : sinon les
// immeubles se téléportent en plein champ de vision au lieu de sortir de l'écran.
const NEAR = 46;
const BASE_SPEED = 3.2; // dérive de croisière (unités/s)
const BUILD_SCALE = 6.5; // kit ville → mètres (un immeuble de 1,29 fait ~8,4 m)
const CAR_SCALE = 1; // les voitures sont déjà normalisées (4,2 m) à la conversion
const LANE_X = 2.0; // axe des voies
const CURB_X = 3.6; // bord de trottoir
const FRONT_X = 5.6; // alignement des façades
const HORIZON = "#2d3a66"; // couleur d'horizon échantillonnée dans le skybox
// Sens de la façade des immeubles du kit (supposée sur +Z). Si les bâtiments
// tournent le dos à l'avenue, passer cette constante à -1 : c'est le seul
// réglage à changer.
const FACADE_DIR = 1;

const mod = (v: number, m: number) => ((v % m) + m) % m;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const loopZ = (z0: number, t: number) => mod(z0 + t, SPAN) - SPAN + NEAR;

// État partagé de la simulation. Au niveau MODULE (une seule ville à l'écran) :
// passé en prop, il serait muté dans useFrame — interdit par le compilateur React.
const drive = { boost: 0, progress: 0, travel: 0, cars: 0, speed: BASE_SPEED };

function useScrollDrive() {
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      drive.boost = clamp(drive.boost + (y - last) * 0.05, -9, 18);
      // Progression sur TOUTE la page : la chorégraphie ne s'arrête pas au hero.
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      drive.progress = clamp(y / max, 0, 1);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

// Avance la simulation. Monté EN PREMIER : les autres useFrame lisent `drive`
// déjà à jour (l'ordre d'exécution suit l'ordre de montage).
function Simulation() {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    drive.boost *= Math.exp(-dt * 2.1);
    const speed = BASE_SPEED + drive.boost;
    drive.speed = speed;
    drive.travel += speed * dt;
    drive.cars += (Math.abs(speed) * 1.4 + 6) * dt;
  });
  return null;
}

// ── Extraction des modèles glTF ──────────────────────────────────────────────

type Gltf = { scene: THREE.Group };

const eachMesh = (root: THREE.Object3D, fn: (m: THREE.Mesh) => void) => {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) fn(m);
  });
};

const mapOf = (m: THREE.Mesh) => (m.material as THREE.MeshStandardMaterial)?.map ?? null;

interface BuildingModel {
  geometry: THREE.BufferGeometry;
  map: THREE.Texture | null;
  width: number;
  depth: number;
  height: number;
}

// Un immeuble = un seul mesh. On applique la transformée du nœud, on met à
// l'échelle, on recentre en x/z (base au sol) puis on mesure la bounding box :
// le placement ne dépend donc d'aucune constante codée en dur par modèle.
function extractBuilding(gltf: Gltf): BuildingModel {
  const parts: THREE.BufferGeometry[] = [];
  let map: THREE.Texture | null = null;
  eachMesh(gltf.scene, (m) => {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    g.scale(BUILD_SCALE, BUILD_SCALE, BUILD_SCALE);
    parts.push(g);
    map = map ?? mapOf(m);
  });
  // Les immeubles du kit n'ont qu'un seul mesh ; on ignore d'éventuels extras
  // plutôt que de fusionner des attributs hétérogènes.
  const geometry = parts[0] ?? new THREE.BufferGeometry();
  parts.slice(1).forEach((g) => g.dispose());
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox ?? new THREE.Box3();
  geometry.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geometry.computeBoundingBox();
  const b2 = geometry.boundingBox ?? new THREE.Box3();
  return {
    geometry,
    map,
    width: b2.max.x - b2.min.x,
    depth: b2.max.z - b2.min.z,
    height: b2.max.y - b2.min.y,
  };
}

interface CarModel {
  body: THREE.BufferGeometry;
  lights: THREE.BufferGeometry | null;
  wheels: { geometry: THREE.BufferGeometry; offset: THREE.Vector3 }[];
  wheelRadius: number;
}

// Une voiture = les nœuds `body` (carrosserie, couleurs par sommet), `lights`
// (phares/feux, rendus ÉMISSIFS) et `wheel-*` (recentrés sur leur moyeu à la
// conversion, donc ils TOURNENT). Cf. le convertisseur OBJ→GLB : les roues
// arrière forment un seul nœud (l'essieu), ce qui est exactement ce qu'il faut.
function extractCar(gltf: Gltf): CarModel {
  const bodies: THREE.BufferGeometry[] = [];
  const wheels: { geometry: THREE.BufferGeometry; offset: THREE.Vector3 }[] = [];
  let lights: THREE.BufferGeometry | null = null;
  let wheelRadius = 0.35;

  eachMesh(gltf.scene, (m) => {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (CAR_SCALE !== 1) g.scale(CAR_SCALE, CAR_SCALE, CAR_SCALE);

    if (m.name.startsWith("wheel")) {
      // La transformée du nœud a replacé la roue : on la ramène à l'origine et
      // on garde sa position comme décalage d'instance.
      g.computeBoundingBox();
      const bb = g.boundingBox ?? new THREE.Box3();
      const c = new THREE.Vector3();
      bb.getCenter(c);
      g.translate(-c.x, -c.y, -c.z);
      wheels.push({ geometry: g, offset: c });
      wheelRadius = Math.max(wheelRadius, (bb.max.y - bb.min.y) / 2);
      return;
    }
    if (m.name === "lights") {
      lights = g;
      return;
    }
    bodies.push(g);
  });

  const body = bodies[0] ?? new THREE.BufferGeometry();
  bodies.slice(1).forEach((g) => g.dispose());
  return { body, lights, wheels, wheelRadius };
}

// ── Matériaux ────────────────────────────────────────────────────────────────

function useNightMaterials() {
  return useMemo(() => {
    const cache = new Map<string, THREE.MeshStandardMaterial>();
    // Les atlas des kits sont peints en couleurs de JOUR. On garde une base
    // presque neutre (sinon tout vire au bleu) : la couleur vient de la TEINTE
    // PAR INSTANCE (`setColorAt`, multipliée par l'atlas) et l'émission, faible,
    // évite juste que les façades tombent dans le noir.
    const forMap = (map: THREE.Texture | null, emissive: number) => {
      const key = (map?.uuid ?? "none") + ":" + emissive;
      let m = cache.get(key);
      if (!m) {
        m = new THREE.MeshStandardMaterial({
          map: map ?? undefined,
          color: "#f0f2ff",
          roughness: 0.8,
          metalness: 0.1,
          emissive: new THREE.Color("#232c57"),
          emissiveMap: map ?? undefined,
          emissiveIntensity: emissive,
        });
        cache.set(key, m);
      }
      return m;
    };
    const props = new THREE.MeshStandardMaterial({ color: "#171b28", roughness: 0.72, metalness: 0.45 });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    // Carrosseries : couleurs cuites en vertex colors à la conversion OBJ→GLB,
    // un peu vernies pour accrocher les lumières de la rue.
    const car = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.38 });
    return { forMap, props, glow, car, cache };
  }, []);
}

type Materials = ReturnType<typeof useNightMaterials>;

// ── Rangées instanciées ──────────────────────────────────────────────────────

interface Lot { x: number; z: number; rot: number; tint?: string }

function useDummy() {
  return useMemo(() => new THREE.Object3D(), []);
}

// Teintes de nuit appliquées PAR INSTANCE (multipliées par l'atlas du kit) :
// c'est ce qui donne une ville colorée plutôt qu'un décor monochrome.
const CITY_TINTS = ["#ffd2a1", "#9fd0ff", "#ffb3cd", "#a6f0d3", "#c9b6ff", "#ffe6a8", "#8fc4ff", "#ffc08f"];

function BuildingRow({ model, lots, material }: { model: BuildingModel; lots: Lot[]; material: THREE.Material }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useDummy();

  // Une teinte par immeuble (multipliée par la texture du kit).
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    lots.forEach((l, i) => m.setColorAt(i, c.set(l.tint ?? "#ffffff")));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [lots]);

  useFrame(() => {
    for (let i = 0; i < lots.length; i++) {
      const l = lots[i];
      dummy.position.set(l.x, 0, loopZ(l.z, drive.travel));
      dummy.rotation.set(0, l.rot, 0);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[model.geometry, material, lots.length]} frustumCulled={false} />;
}

interface CarSlot { z: number; lane: 1 | -1; speed: number }

function CarRow({ model, slots, materials }: { model: CarModel; slots: CarSlot[]; materials: Materials }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const wheelRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const dummy = useDummy();
  const spin = useRef(0);

  useFrame((_, delta) => {
    const t = drive.travel;
    // Les roues roulent à la vitesse réelle du véhicule (défilement de la ville
    // + sa propre vitesse), rapportée à leur rayon.
    const ground = Math.abs(drive.speed) + 6;
    spin.current -= (Math.min(delta, 0.05) * ground) / Math.max(0.05, model.wheelRadius);

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      // Voie proche (+1) : vient vers nous. Voie éloignée (−1) : s'éloigne.
      const z = loopZ(s.z + s.lane * drive.cars * s.speed, t);
      const x = s.lane * LANE_X;
      const rot = s.lane > 0 ? 0 : Math.PI;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, rot, 0);
      dummy.updateMatrix();
      body.current?.setMatrixAt(i, dummy.matrix);
      lights.current?.setMatrixAt(i, dummy.matrix);

      for (let w = 0; w < model.wheels.length; w++) {
        const o = model.wheels[w].offset;
        // Demi-tour = décalage miroir en x/z (pas de clone par frame).
        const ox = rot === 0 ? o.x : -o.x;
        const oz = rot === 0 ? o.z : -o.z;
        dummy.position.set(x + ox, o.y, z + oz);
        dummy.rotation.set(0, rot, 0);
        dummy.rotateX(spin.current * s.lane);
        dummy.updateMatrix();
        wheelRefs.current[w]?.setMatrixAt(i, dummy.matrix);
      }
    }
    if (body.current) body.current.instanceMatrix.needsUpdate = true;
    if (lights.current) lights.current.instanceMatrix.needsUpdate = true;
    for (const m of wheelRefs.current) if (m) m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={body} args={[model.body, materials.car, slots.length]} frustumCulled={false} />
      {model.lights && (
        <instancedMesh ref={lights} args={[model.lights, materials.glow, slots.length]} frustumCulled={false} />
      )}
      {model.wheels.map((w, i) => (
        <instancedMesh
          key={i}
          ref={(el) => { wheelRefs.current[i] = el; }}
          args={[w.geometry, materials.car, slots.length]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

// Mobilier procédural : deux buckets (structure + surfaces lumineuses).
function PropRow({
  shell, glow, slots, y = 0, materials,
}: {
  shell: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  slots: Lot[];
  y?: number;
  materials: Materials;
}) {
  const a = useRef<THREE.InstancedMesh>(null);
  const b = useRef<THREE.InstancedMesh>(null);
  const dummy = useDummy();
  useFrame(() => {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      dummy.position.set(s.x, y, loopZ(s.z, drive.travel));
      dummy.rotation.set(0, s.rot, 0);
      dummy.updateMatrix();
      a.current?.setMatrixAt(i, dummy.matrix);
      b.current?.setMatrixAt(i, dummy.matrix);
    }
    if (a.current) a.current.instanceMatrix.needsUpdate = true;
    if (b.current) b.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={a} args={[shell, materials.props, slots.length]} frustumCulled={false} />
      <instancedMesh ref={b} args={[glow, materials.glow, slots.length]} frustumCulled={false} />
    </>
  );
}

// Reflets mouillés sous les lampadaires (quads étirés sur l'asphalte).
function WetReflections({ slots }: { slots: { x: number; z: number }[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useDummy();
  useFrame(() => {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      dummy.position.set(s.x * 0.8, 0.03, loopZ(s.z, drive.travel) + 2.5);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1.6, 7, 1);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, slots.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffb464" transparent opacity={0.12} depthWrite={false} />
    </instancedMesh>
  );
}

// Balises rouges clignotantes au sommet des tours.
function Beacons({ lots }: { lots: { x: number; y: number; z: number }[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useDummy();
  useFrame((state) => {
    for (let i = 0; i < lots.length; i++) {
      dummy.position.set(lots[i].x, lots[i].y, loopZ(lots[i].z, drive.travel));
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = Math.sin(state.clock.elapsedTime * 2.4) > 0.25 ? 1 : 0.05;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(1, lots.length)]} frustumCulled={false}>
      <sphereGeometry args={[0.22, 8, 8]} />
      <meshBasicMaterial ref={mat} color="#ff4d5e" toneMapped={false} transparent fog={false} />
    </instancedMesh>
  );
}

// Bandes blanches de l'axe central.
function RoadMarkings() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useDummy();
  const slots = useMemo(() => Array.from({ length: 48 }, (_, i) => -(i / 48) * SPAN), []);
  useFrame(() => {
    for (let i = 0; i < slots.length; i++) {
      dummy.position.set(0, 0.025, loopZ(slots[i], drive.travel));
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(0.2, 2.2, 1);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, slots.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#7c86a8" transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}

// Ciel équirectangulaire du kit (remplace ciel + étoiles + lune procéduraux).
function NightSky() {
  const tex = useTexture(SKY_URL);
  // On travaille sur un clone : muter la texture renvoyée par le hook est
  // interdit par le compilateur React (et elle est mise en cache par drei).
  const bg = useMemo(() => {
    const t = tex.clone();
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [tex]);
  useEffect(() => () => bg.dispose(), [bg]);
  // `attach` = façon déclarative de poser scene.background (aucune mutation).
  return <primitive object={bg} attach="background" />;
}

// ── La ville ─────────────────────────────────────────────────────────────────

function City() {
  const materials = useNightMaterials();
  const cityGltf = useGLTF(CITY_URLS) as unknown as Gltf[];
  const carGltf = useGLTF(CAR_URLS) as unknown as Gltf[];

  // Immeubles : plusieurs RANGÉES en profondeur de chaque côté — une file unique
  // donne une impression de couloir, alors qu'un tissu urbain se voit derrière la
  // première ligne. Les rangées lointaines privilégient les tours (silhouette).
  const city = useMemo(() => {
    const models = cityGltf.map(extractBuilding);
    const towers = models.map((_, i) => i).filter((i) => models[i].height > 18);
    const rnd = mulberry32(24);
    const lots: Lot[][] = models.map(() => []);
    const beacons: { x: number; y: number; z: number }[] = [];
    const signs: { x: number; z: number; rot: number; y: number }[] = [];

    const ROWS = [
      { front: FRONT_X, count: 16, jitter: 1.5, tall: false, signs: true },
      { front: FRONT_X + 12, count: 12, jitter: 3.5, tall: false, signs: false },
      { front: FRONT_X + 26, count: 9, jitter: 6, tall: true, signs: false },
      { front: FRONT_X + 46, count: 6, jitter: 10, tall: true, signs: false },
    ];

    for (const side of [-1, 1]) {
      for (const row of ROWS) {
        for (let i = 0; i < row.count; i++) {
          const pool = row.tall && towers.length > 0 ? towers : models.map((_, k) => k);
          const mi = pool[Math.floor(rnd() * pool.length)];
          const m = models[mi];
          const x = side * (row.front + m.depth / 2 + rnd() * row.jitter);
          const z = -((i + (side < 0 ? 0 : 0.5)) / row.count) * SPAN - rnd() * 4;
          // Façade tournée vers la rue (cf. FACADE_DIR).
          lots[mi].push({
            x,
            z,
            rot: (side < 0 ? Math.PI / 2 : -Math.PI / 2) * FACADE_DIR,
            tint: CITY_TINTS[Math.floor(rnd() * CITY_TINTS.length)],
          });
          if (m.height > 20) beacons.push({ x, y: m.height + 0.3, z });
          // Enseignes PLAQUÉES sur la façade réelle (et pas posées dans le vide).
          if (row.signs && rnd() > 0.55) {
            signs.push({
              x: x - side * (m.depth / 2 + 0.12),
              z,
              rot: 0, // les panneaux du caisson regardent déjà ±X, donc la rue
              y: 2.5 + rnd() * Math.max(1, m.height * 0.45),
            });
          }
        }
      }
    }
    return { models, lots, beacons, signs };
  }, [cityGltf]);

  // Trafic : 3 carrosseries réparties sur les deux voies.
  const traffic = useMemo(() => {
    const models = carGltf.map(extractCar);
    const rnd = mulberry32(77);
    const slots: CarSlot[][] = models.map(() => []);
    const CARS = 16;
    for (let i = 0; i < CARS; i++) {
      const mi = Math.floor(rnd() * models.length);
      slots[mi].push({ z: -(i / CARS) * SPAN - rnd() * 6, lane: i % 2 === 0 ? 1 : -1, speed: 0.45 + rnd() * 0.6 });
    }
    return { models, slots };
  }, [carGltf]);

  // Mobilier urbain procédural.
  const props = useMemo(() => {
    const rnd = mulberry32(303);
    // UN seul modèle de lampadaire : le bras pointe vers +X, on tourne l'objet
    // d'un demi-tour pour le trottoir d'en face (le bras vise toujours la rue).
    const lamp = buildStreetLamp();
    const lamps: Lot[] = [];
    const reflections: { x: number; z: number }[] = [];
    const LAMPS = 22; // un lampadaire tous les ~7 m sur la longueur de boucle
    for (let i = 0; i < LAMPS; i++) {
      const z = -(i / LAMPS) * SPAN;
      const left = i % 2 === 0;
      lamps.push({ x: left ? -CURB_X - 0.5 : CURB_X + 0.5, z, rot: left ? 0 : Math.PI });
      reflections.push({ x: left ? -CURB_X : CURB_X, z });
    }
    const trafficLight = buildTrafficLight();
    const tlSlots: Lot[] = [0, 1, 2, 3, 4, 5].map((i) => ({
      x: i % 2 === 0 ? -CURB_X - 0.2 : CURB_X + 0.2,
      z: -(i / 6) * SPAN - 7,
      rot: i % 2 === 0 ? 0 : Math.PI,
    }));
    const busStop = buildBusStop();
    const bsSlots: Lot[] = [0, 1, 2].map((i) => ({
      x: i % 2 === 0 ? -CURB_X - 1.1 : CURB_X + 1.1,
      z: -(i / 3) * SPAN - 20,
      rot: i % 2 === 0 ? 0 : Math.PI,
    }));
    const tree = buildTree(12);
    const treeSlots: Lot[] = Array.from({ length: 20 }, (_, i) => ({
      x: (i % 2 === 0 ? -1 : 1) * (CURB_X + 0.9),
      z: -(i / 20) * SPAN - 4 - rnd() * 3,
      rot: rnd() * Math.PI,
    }));
    const sign = buildNeonSign(56);
    return { lamp, lamps, reflections, trafficLight, tlSlots, busStop, bsSlots, tree, treeSlots, sign };
  }, []);

  // Libération mémoire au démontage (géométries clonées + matériaux).
  useEffect(() => {
    const geos = [
      ...city.models.map((m) => m.geometry),
      ...traffic.models.flatMap((m) => [m.body, ...(m.lights ? [m.lights] : []), ...m.wheels.map((w) => w.geometry)]),
      props.lamp.shell, props.lamp.glow,
      props.trafficLight.shell, props.trafficLight.glow, props.busStop.shell, props.busStop.glow,
      props.tree.shell, props.tree.glow, props.sign.shell, props.sign.glow,
    ];
    const mats = [materials.props, materials.glow, materials.car, ...materials.cache.values()];
    return () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    };
  }, [city, traffic, props, materials]);

  return (
    <group>
      <Simulation />
      <NightSky />

      {/* Asphalte mouillé (reflet spéculaire), chaussée, trottoirs */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -30]}>
        <planeGeometry args={[400, 320]} />
        <meshStandardMaterial color="#080b14" roughness={0.24} metalness={0.68} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -30]}>
        <planeGeometry args={[CURB_X * 2, 320]} />
        <meshStandardMaterial color="#12151f" roughness={0.4} metalness={0.45} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (CURB_X + 1), 0.09, -30]}>
            <boxGeometry args={[2, 0.18, 320]} />
            <meshStandardMaterial color="#181c28" roughness={0.9} />
          </mesh>
          <mesh position={[s * CURB_X, 0.13, -30]}>
            <boxGeometry args={[0.16, 0.26, 320]} />
            <meshStandardMaterial color="#222735" roughness={0.85} />
          </mesh>
        </group>
      ))}
      <RoadMarkings />

      {/* Immeubles (kit ville) + balises de toit */}
      {city.models.map((m, i) =>
        city.lots[i].length > 0
          ? <BuildingRow key={i} model={m} lots={city.lots[i]} material={materials.forMap(m.map, 0.32)} />
          : null
      )}
      <Beacons lots={city.beacons} />

      {/* Mobilier urbain (procédural) */}
      <PropRow shell={props.lamp.shell} glow={props.lamp.glow} slots={props.lamps} materials={materials} />
      <WetReflections slots={props.reflections} />
      <PropRow shell={props.trafficLight.shell} glow={props.trafficLight.glow} slots={props.tlSlots} materials={materials} />
      <PropRow shell={props.busStop.shell} glow={props.busStop.glow} slots={props.bsSlots} materials={materials} />
      <PropRow shell={props.tree.shell} glow={props.tree.glow} slots={props.treeSlots} materials={materials} />
      {/* Enseignes néon : une rangée par hauteur d'accroche, chacune calée sur la
          façade d'un immeuble réel. */}
      {city.signs.map((s, i) => (
        <PropRow key={i} shell={props.sign.shell} glow={props.sign.glow} slots={[{ x: s.x, z: s.z, rot: s.rot }]} y={s.y} materials={materials} />
      ))}

      {/* Trafic (kit voitures, roues qui tournent) */}
      {traffic.models.map((m, i) =>
        traffic.slots[i].length > 0 ? <CarRow key={i} model={m} slots={traffic.slots[i]} materials={materials} /> : null
      )}
    </group>
  );
}

// Caméra : vue en PLONGÉE au-dessus de l'avenue (on domine la ville, on voit les
// voitures avancer sous nous), qui descend vers la rue au fil du scroll.
// Parallax au pointeur par-dessus.
function CameraRig() {
  useFrame((state, delta) => {
    const k = Math.min(1, Math.min(delta, 0.05) * 2.4);
    const t = state.clock.elapsedTime;
    const p = drive.progress;
    const cam = state.camera;
    cam.position.x += (state.pointer.x * 2.4 - cam.position.x) * k;
    cam.position.y += (19 - p * 9 + Math.sin(t * 0.28) * 0.4 - cam.position.y) * k;
    cam.position.z += (34 - p * 12 - cam.position.z) * k;
    // On vise la chaussée devant nous : plus on descend, plus on regarde loin.
    cam.lookAt(0, 1.5 + p * 3.5 - state.pointer.y * 1.6, -26 - p * 8);
  });
  return null;
}

export default function NightCityScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  useScrollDrive();

  // Le flow ne doit jamais s'arrêter, même en bas de page : on ne coupe le rendu
  // que si l'onglet passe en arrière-plan.
  useEffect(() => {
    const apply = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, []);

  return (
    <div className={cn("absolute inset-0", className)}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.4]}
        camera={{ position: [0, 19, 34], fov: 50 }}
        scene={{ backgroundIntensity: 0.8 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMappingExposure: 0.92 }}
        onCreated={({ gl }) => gl.setClearColor(HORIZON)}
      >
        {/* Le brouillard fond les immeubles recyclés dans la nuit (boucle
            invisible) — sa couleur est celle de l'horizon du skybox. */}
        {/* Dense au point que le fond de la boucle (≈140 unités) soit noyé : c'est
            lui qui cache l'apparition des immeubles recyclés. */}
        <fogExp2 attach="fog" args={[HORIZON, 0.0135]} />
        {/* Éclairage volontairement FAIBLE : les atlas des kits sont peints en
            couleurs de jour et se délavent (tout blanc) dès qu'on sur-expose. */}
        <ambientLight intensity={0.32} color="#5a67ad" />
        {/* Clair de lune */}
        <directionalLight position={[-14, 22, -10]} intensity={0.42} color="#b6c3ff" />
        {/* Halo chaud de l'avenue, sous la caméra */}
        <pointLight position={[0, 7, 8]} intensity={9} distance={30} decay={2} color="#ff9d4d" />
        {/* Contre-jour froid au fond de l'avenue : détache les silhouettes */}
        <pointLight position={[0, 10, -40]} intensity={14} distance={60} decay={2} color="#4d6dff" />
        <Suspense fallback={null}>
          <City />
        </Suspense>
        <CameraRig />
      </Canvas>
    </div>
  );
}
