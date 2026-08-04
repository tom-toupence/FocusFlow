"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  buildBusStop, buildNeonSign, buildStreetLamp, buildTrafficLight, buildTrain, buildTree, mulberry32,
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
const CAR_URLS = ["sedan", "taxi", "van"].map((n) => `/car_models/${n}.glb`);
const SKY_URL = "/skyboxes/skybox-night-2k.png";

CITY_URLS.forEach((u) => useGLTF.preload(u));
CAR_URLS.forEach((u) => useGLTF.preload(u));

const SPAN = 96; // profondeur de la boucle : ce qui dépasse est recyclé au fond
const NEAR = 14; // z le plus proche (derrière la caméra) avant recyclage
const BASE_SPEED = 3.2; // dérive de croisière (unités/s)
const BUILD_SCALE = 6.5; // kit ville → mètres (un immeuble de 1,29 fait ~8,4 m)
const CAR_SCALE = 1.6; // kit voitures → mètres (une berline fait ~4,1 m)
const LANE_X = 2.0; // axe des voies
const CURB_X = 3.6; // bord de trottoir
const FRONT_X = 5.6; // alignement des façades
const HORIZON = "#2d3a66"; // couleur d'horizon échantillonnée dans le skybox

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
  wheel: THREE.BufferGeometry;
  offsets: THREE.Vector3[];
  map: THREE.Texture | null;
  wheelRadius: number;
}

// Une voiture = une carrosserie + 4 roues en nœuds séparés. On isole la roue
// (recentrée sur son propre barycentre) et ses 4 positions pour pouvoir les
// FAIRE TOURNER pendant le trajet.
function extractCar(gltf: Gltf): CarModel {
  const bodies: THREE.BufferGeometry[] = [];
  const offsets: THREE.Vector3[] = [];
  let wheel: THREE.BufferGeometry | null = null;
  let wheelRadius = 0.3;
  let map: THREE.Texture | null = null;

  eachMesh(gltf.scene, (m) => {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    g.scale(CAR_SCALE, CAR_SCALE, CAR_SCALE);
    map = map ?? mapOf(m);
    if (!m.name.startsWith("wheel")) {
      bodies.push(g);
      return;
    }
    g.computeBoundingBox();
    const bb = g.boundingBox ?? new THREE.Box3();
    const c = new THREE.Vector3();
    bb.getCenter(c);
    offsets.push(c);
    if (wheel) {
      g.dispose();
      return;
    }
    g.translate(-c.x, -c.y, -c.z);
    wheel = g;
    wheelRadius = (bb.max.y - bb.min.y) / 2;
  });

  // Carrosserie : on garde le premier mesh et on jette les accessoires éventuels
  // (portes, calandres) plutôt que de fusionner des attributs hétérogènes.
  const body = bodies[0] ?? new THREE.BufferGeometry();
  bodies.slice(1).forEach((g) => g.dispose());
  return { body, wheel: wheel ?? new THREE.BufferGeometry(), offsets, map, wheelRadius };
}

// ── Matériaux ────────────────────────────────────────────────────────────────

function useNightMaterials() {
  return useMemo(() => {
    const cache = new Map<string, THREE.MeshStandardMaterial>();
    // Les atlas Kenney sont peints en couleurs de JOUR : on les refroidit
    // (multiplication par une teinte bleutée) et on ajoute une légère émission
    // pour que les façades restent lisibles la nuit.
    const forMap = (map: THREE.Texture | null, emissive: number) => {
      const key = (map?.uuid ?? "none") + ":" + emissive;
      let m = cache.get(key);
      if (!m) {
        m = new THREE.MeshStandardMaterial({
          map: map ?? undefined,
          color: "#aab6e4",
          roughness: 0.78,
          metalness: 0.08,
          emissive: new THREE.Color("#5b6699"),
          emissiveMap: map ?? undefined,
          emissiveIntensity: emissive,
        });
        cache.set(key, m);
      }
      return m;
    };
    const props = new THREE.MeshStandardMaterial({ color: "#171b28", roughness: 0.72, metalness: 0.45 });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    return { forMap, props, glow, cache };
  }, []);
}

type Materials = ReturnType<typeof useNightMaterials>;

// ── Rangées instanciées ──────────────────────────────────────────────────────

interface Lot { x: number; z: number; rot: number }

function useDummy() {
  return useMemo(() => new THREE.Object3D(), []);
}

function BuildingRow({ model, lots, material }: { model: BuildingModel; lots: Lot[]; material: THREE.Material }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useDummy();
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

function CarRow({ model, slots, material }: { model: CarModel; slots: CarSlot[]; material: THREE.Material }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const wheels = useRef<THREE.InstancedMesh>(null);
  const dummy = useDummy();
  const offset = useMemo(() => new THREE.Vector3(), []);
  const spin = useRef(0);
  const wheelCount = slots.length * model.offsets.length;

  useFrame((_, delta) => {
    const t = drive.travel;
    // Les roues roulent à la vitesse réelle du véhicule (défilement + sa propre
    // vitesse), rapportée à leur rayon.
    const ground = Math.abs(drive.speed) + 6;
    spin.current -= (Math.min(delta, 0.05) * ground) / Math.max(0.05, model.wheelRadius);
    let w = 0;
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
      for (const o of model.offsets) {
        offset.copy(o);
        if (rot !== 0) offset.set(-o.x, o.y, -o.z);
        dummy.position.set(x + offset.x, offset.y, z + offset.z);
        dummy.rotation.set(0, rot, 0);
        dummy.rotateX(spin.current * s.lane);
        dummy.updateMatrix();
        wheels.current?.setMatrixAt(w++, dummy.matrix);
      }
    }
    if (body.current) body.current.instanceMatrix.needsUpdate = true;
    if (wheels.current) wheels.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={body} args={[model.body, material, slots.length]} frustumCulled={false} />
      <instancedMesh ref={wheels} args={[model.wheel, material, wheelCount]} frustumCulled={false} />
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
  const slots = useMemo(() => Array.from({ length: 32 }, (_, i) => -(i / 32) * SPAN), []);
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

// Métro aérien : traverse le fond de la scène en boucle.
function Train({ materials }: { materials: Materials }) {
  const group = useRef<THREE.Group>(null);
  const model = useMemo(() => buildTrain(), []);
  useEffect(() => () => { model.shell.dispose(); model.glow.dispose(); }, [model]);
  useFrame((state) => {
    if (group.current) group.current.position.x = mod(state.clock.elapsedTime * 9 + 60, 220) - 110;
  });
  return (
    <group position={[0, 15, -62]}>
      <mesh position={[0, -1.7, 0]}>
        <boxGeometry args={[220, 0.6, 4]} />
        <meshStandardMaterial color="#0d1020" roughness={0.95} />
      </mesh>
      {[-46, -16, 16, 46].map((x) => (
        <mesh key={x} position={[x, -8.5, 0]}>
          <boxGeometry args={[1.8, 14, 1.8]} />
          <meshStandardMaterial color="#0d1020" roughness={0.95} />
        </mesh>
      ))}
      <group ref={group} rotation-y={Math.PI / 2} scale={1.6}>
        <mesh geometry={model.shell} material={materials.props} />
        <mesh geometry={model.glow} material={materials.glow} />
      </group>
    </group>
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

  // Immeubles : un archétype par modèle, semés le long des deux trottoirs.
  const city = useMemo(() => {
    const models = cityGltf.map(extractBuilding);
    const rnd = mulberry32(24);
    const lots: Lot[][] = models.map(() => []);
    const beacons: { x: number; y: number; z: number }[] = [];
    const perSide = 11;
    for (const side of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const mi = Math.floor(rnd() * models.length);
        const m = models[mi];
        const x = side * (FRONT_X + m.depth / 2 + rnd() * 1.5);
        const z = -((i + (side < 0 ? 0 : 0.5)) / perSide) * SPAN;
        // Les modèles du kit ont leur façade sur +Z : on les tourne vers la rue.
        lots[mi].push({ x, z, rot: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
        if (m.height > 20) beacons.push({ x, y: m.height + 0.3, z });
      }
    }
    return { models, lots, beacons };
  }, [cityGltf]);

  // Trafic : 3 carrosseries réparties sur les deux voies.
  const traffic = useMemo(() => {
    const models = carGltf.map(extractCar);
    const rnd = mulberry32(77);
    const slots: CarSlot[][] = models.map(() => []);
    for (let i = 0; i < 11; i++) {
      const mi = Math.floor(rnd() * models.length);
      slots[mi].push({ z: -(i / 11) * SPAN - rnd() * 6, lane: i % 2 === 0 ? 1 : -1, speed: 0.45 + rnd() * 0.6 });
    }
    return { models, slots };
  }, [carGltf]);

  // Mobilier urbain procédural.
  const props = useMemo(() => {
    const rnd = mulberry32(303);
    const lampL = buildStreetLamp(false);
    const lampR = buildStreetLamp(true);
    const lightsL: Lot[] = [];
    const lightsR: Lot[] = [];
    const reflections: { x: number; z: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const z = -(i / 14) * SPAN;
      if (i % 2 === 0) { lightsL.push({ x: -CURB_X - 0.5, z, rot: 0 }); reflections.push({ x: -CURB_X, z }); }
      else { lightsR.push({ x: CURB_X + 0.5, z, rot: 0 }); reflections.push({ x: CURB_X, z }); }
    }
    const trafficLight = buildTrafficLight();
    const tlSlots: Lot[] = [0, 1, 2, 3].map((i) => ({
      x: i % 2 === 0 ? -CURB_X - 0.2 : CURB_X + 0.2,
      z: -(i / 4) * SPAN - 7,
      rot: i % 2 === 0 ? 0 : Math.PI,
    }));
    const busStop = buildBusStop();
    const bsSlots: Lot[] = [0, 1].map((i) => ({
      x: i === 0 ? -CURB_X - 1.1 : CURB_X + 1.1,
      z: -(i / 2) * SPAN - 20,
      rot: i === 0 ? 0 : Math.PI,
    }));
    const tree = buildTree(12);
    const treeSlots: Lot[] = Array.from({ length: 12 }, (_, i) => ({
      x: (i % 2 === 0 ? -1 : 1) * (CURB_X + 0.9),
      z: -(i / 12) * SPAN - 4 - rnd() * 3,
      rot: rnd() * Math.PI,
    }));
    const sign = buildNeonSign(56);
    const signSlots = Array.from({ length: 7 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return {
        slot: { x: side * (FRONT_X - 0.3), z: -(i / 7) * SPAN - rnd() * 6, rot: side > 0 ? Math.PI / 2 : -Math.PI / 2 } as Lot,
        y: 4 + rnd() * 5,
      };
    });
    return { lampL, lampR, lightsL, lightsR, reflections, trafficLight, tlSlots, busStop, bsSlots, tree, treeSlots, sign, signSlots };
  }, []);

  // Libération mémoire au démontage (géométries clonées + matériaux).
  useEffect(() => {
    const geos = [
      ...city.models.map((m) => m.geometry),
      ...traffic.models.flatMap((m) => [m.body, m.wheel]),
      props.lampL.shell, props.lampL.glow, props.lampR.shell, props.lampR.glow,
      props.trafficLight.shell, props.trafficLight.glow, props.busStop.shell, props.busStop.glow,
      props.tree.shell, props.tree.glow, props.sign.shell, props.sign.glow,
    ];
    const mats = [materials.props, materials.glow, ...materials.cache.values()];
    return () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    };
  }, [city, traffic, props, materials]);

  return (
    <group>
      <Simulation />
      <NightSky />
      <Train materials={materials} />

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
      <PropRow shell={props.lampL.shell} glow={props.lampL.glow} slots={props.lightsL} materials={materials} />
      <PropRow shell={props.lampR.shell} glow={props.lampR.glow} slots={props.lightsR} materials={materials} />
      <WetReflections slots={props.reflections} />
      <PropRow shell={props.trafficLight.shell} glow={props.trafficLight.glow} slots={props.tlSlots} materials={materials} />
      <PropRow shell={props.busStop.shell} glow={props.busStop.glow} slots={props.bsSlots} materials={materials} />
      <PropRow shell={props.tree.shell} glow={props.tree.glow} slots={props.treeSlots} materials={materials} />
      {props.signSlots.map((s, i) => (
        <PropRow key={i} shell={props.sign.shell} glow={props.sign.glow} slots={[s.slot]} y={s.y} materials={materials} />
      ))}

      {/* Trafic (kit voitures, roues qui tournent) */}
      {traffic.models.map((m, i) =>
        traffic.slots[i].length > 0
          ? <CarRow key={i} model={m} slots={traffic.slots[i]} material={materials.forMap(m.map, 0.12)} />
          : null
      )}
    </group>
  );
}

// Caméra : parallax pointeur + plongée vers la rue au fil du scroll.
function CameraRig() {
  useFrame((state, delta) => {
    const k = Math.min(1, Math.min(delta, 0.05) * 2.4);
    const t = state.clock.elapsedTime;
    const p = drive.progress;
    const cam = state.camera;
    cam.position.x += (state.pointer.x * 1.8 - cam.position.x) * k;
    cam.position.y += (7 - p * 3 + Math.sin(t * 0.3) * 0.25 - cam.position.y) * k;
    cam.position.z += (22 - p * 5 - cam.position.z) * k;
    cam.lookAt(0, 9 - state.pointer.y * 1.4 - p * 2.5, -34);
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
        camera={{ position: [0, 7, 22], fov: 52 }}
        scene={{ backgroundIntensity: 0.85 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor(HORIZON)}
      >
        {/* Le brouillard fond les immeubles recyclés dans la nuit (boucle
            invisible) — sa couleur est celle de l'horizon du skybox. */}
        <fogExp2 attach="fog" args={[HORIZON, 0.011]} />
        <ambientLight intensity={0.6} color="#7d88c8" />
        {/* Clair de lune */}
        <directionalLight position={[-14, 20, -10]} intensity={0.9} color="#c3cdff" />
        {/* Halo chaud de l'avenue, juste devant la caméra */}
        <pointLight position={[0, 5, 6]} intensity={40} distance={34} decay={2} color="#ffa860" />
        <Suspense fallback={null}>
          <City />
        </Suspense>
        <CameraRig />
      </Canvas>
    </div>
  );
}
