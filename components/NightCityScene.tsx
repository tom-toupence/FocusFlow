"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  buildBuilding, buildBusStop, buildCar, buildNeonSign, buildStreetLamp,
  buildTrafficLight, buildTrain, buildTree, mulberry32,
  type Building, type Car, type CarKind,
} from "@/lib/cityMeshes";
import { cn } from "@/lib/utils";

// FOND du landing : une avenue nocturne qui DÉFILE derrière le contenu.
// Ambiance lofi « night drive », boucle infinie, chill.
//
// Les modèles (immeubles à corniches/balcons/châteaux d'eau, voitures à
// carrosserie extrudée + roues + phares, lampadaires à col de cygne, feux
// tricolores, abribus, arbres, enseignes néon, rame de métro aérien) sont
// construits dans `lib/cityMeshes.ts` : de vraies géométries, fusionnées par
// matériau, puis INSTANCIÉES ici. Zéro asset externe, zéro dépendance en plus.
//
// Chorégraphie scroll : le scroll injecte un boost de vitesse amorti et SIGNÉ
// (remonter fait reculer la ville) et fait plonger la caméra vers la rue. Sans
// scroll, la ville dérive doucement toute seule.
//
// Perf : ~20 instancedMesh, AUCUN post-processing ni shadow map, DPR plafonné,
// rendu en PAUSE dès qu'on a dépassé un écran et demi (la ville est alors
// masquée par le voile du landing) ou quand l'onglet est caché.

const SPAN = 92; // profondeur de la boucle : ce qui dépasse est recyclé au fond
const NEAR = 12; // z le plus proche (derrière la caméra) avant recyclage
const BASE_SPEED = 2.4; // dérive de croisière (unités/s)
const ROAD_X = 1.45; // demi-écartement des voies
const CURB_X = 3.1; // bord de trottoir

const mod = (v: number, m: number) => ((v % m) + m) % m;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// État partagé de la simulation. Au niveau MODULE (une seule ville à l'écran) :
// passé en prop, il serait muté dans useFrame — interdit par le compilateur React.
const drive = { boost: 0, progress: 0, travel: 0, cars: 0 };

function useScrollDrive() {
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      drive.boost = clamp(drive.boost + (y - last) * 0.05, -9, 18);
      drive.progress = clamp(y / Math.max(1, window.innerHeight), 0, 1);
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
    drive.travel += speed * dt;
    drive.cars += (Math.abs(speed) * 1.6 + 5.5) * dt;
  });
  return null;
}

// Recyclage : ramène un z de départ dans la fenêtre visible, en boucle.
const loopZ = (z0: number, t: number) => mod(z0 + t, SPAN) - SPAN + NEAR;

function useInstancePlacer() {
  const dummy = useMemo(() => new THREE.Object3D(), []);
  return useMemo(
    () => (mesh: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, rotY = 0) => {
      if (!mesh) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    },
    [dummy]
  );
}

// ── Matériaux partagés ───────────────────────────────────────────────────────

function useCityMaterials() {
  return useMemo(() => {
    const concrete = new THREE.MeshStandardMaterial({ color: "#151926", roughness: 0.93, metalness: 0.06 });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const glass = new THREE.MeshStandardMaterial({ color: "#080c16", roughness: 0.12, metalness: 0.92 });
    const metal = new THREE.MeshStandardMaterial({ color: "#1b1f2b", roughness: 0.5, metalness: 0.7 });
    const rubber = new THREE.MeshStandardMaterial({ color: "#0a0b10", roughness: 0.95 });
    const paint = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.32, metalness: 0.62 });
    return { concrete, glow, glass, metal, rubber, paint };
  }, []);
}

// ── Immeubles ────────────────────────────────────────────────────────────────

interface Lot { x: number; z: number; rot: number }

function BuildingRow({ model, lots, materials }: { model: Building; lots: Lot[]; materials: ReturnType<typeof useCityMaterials> }) {
  const shell = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.InstancedMesh>(null);
  const place = useInstancePlacer();

  useFrame(() => {
    const t = drive.travel;
    for (let i = 0; i < lots.length; i++) {
      const l = lots[i];
      const z = loopZ(l.z, t);
      place(shell.current, i, l.x, 0, z, l.rot);
      place(glow.current, i, l.x, 0, z, l.rot);
    }
    if (shell.current) shell.current.instanceMatrix.needsUpdate = true;
    if (glow.current) glow.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={shell} args={[model.shell, materials.concrete, lots.length]} frustumCulled={false} />
      <instancedMesh ref={glow} args={[model.glow, materials.glow, lots.length]} frustumCulled={false} />
    </>
  );
}

// ── Trafic ───────────────────────────────────────────────────────────────────

interface CarSlot { z: number; lane: 1 | -1; speed: number }

function CarRow({ model, slots, materials, colors }: { model: Car; slots: CarSlot[]; materials: ReturnType<typeof useCityMaterials>; colors: string[] }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const glass = useRef<THREE.InstancedMesh>(null);
  const wheels = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const tail = useRef<THREE.InstancedMesh>(null);
  const place = useInstancePlacer();

  // Une couleur de carrosserie par voiture.
  useEffect(() => {
    const mesh = body.current;
    if (!mesh) return;
    const c = new THREE.Color();
    slots.forEach((_, i) => mesh.setColorAt(i, c.set(colors[i % colors.length])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [slots, colors]);

  useFrame(() => {
    const t = drive.travel;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      // Voie proche (+1) : vient vers nous. Voie éloignée (−1) : s'éloigne.
      const z = loopZ(s.z + s.lane * drive.cars * s.speed, t);
      const x = s.lane * ROAD_X;
      const rot = s.lane > 0 ? 0 : Math.PI;
      for (const m of [body, glass, wheels, head, tail]) place(m.current, i, x, 0, z, rot);
    }
    for (const m of [body, glass, wheels, head, tail]) if (m.current) m.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={body} args={[model.shell, materials.paint, slots.length]} frustumCulled={false} />
      <instancedMesh ref={glass} args={[model.glass, materials.glass, slots.length]} frustumCulled={false} />
      <instancedMesh ref={wheels} args={[model.wheels, materials.rubber, slots.length]} frustumCulled={false} />
      <instancedMesh ref={head} args={[model.head, materials.glow, slots.length]} frustumCulled={false} />
      <instancedMesh ref={tail} args={[model.tail, materials.glow, slots.length]} frustumCulled={false} />
    </>
  );
}

// ── Mobilier urbain (même géométrie, semée le long de l'avenue) ──────────────

function PropRow({
  shell, glow, slots, materials,
}: {
  shell: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  slots: { x: number; z: number; rot: number }[];
  materials: ReturnType<typeof useCityMaterials>;
}) {
  const a = useRef<THREE.InstancedMesh>(null);
  const b = useRef<THREE.InstancedMesh>(null);
  const place = useInstancePlacer();

  useFrame(() => {
    const t = drive.travel;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const z = loopZ(s.z, t);
      place(a.current, i, s.x, 0, z, s.rot);
      place(b.current, i, s.x, 0, z, s.rot);
    }
    if (a.current) a.current.instanceMatrix.needsUpdate = true;
    if (b.current) b.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={a} args={[shell, materials.metal, slots.length]} frustumCulled={false} />
      <instancedMesh ref={b} args={[glow, materials.glow, slots.length]} frustumCulled={false} />
    </>
  );
}

// Reflets mouillés sous les lampadaires (quads étirés sur l'asphalte).
function WetReflections({ slots }: { slots: { x: number; z: number }[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const t = drive.travel;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      dummy.position.set(s.x * 0.72, 0.02, loopZ(s.z, t) + 2);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1.1, 5.5, 1);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, slots.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffb464" transparent opacity={0.13} depthWrite={false} />
    </instancedMesh>
  );
}

// Balises rouges clignotantes en haut des tours.
function Beacons({ lots }: { lots: { x: number; z: number; y: number }[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const place = useInstancePlacer();
  useFrame((state) => {
    const t = drive.travel;
    for (let i = 0; i < lots.length; i++) place(mesh.current, i, lots[i].x, lots[i].y, loopZ(lots[i].z, t));
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = Math.sin(state.clock.elapsedTime * 2.4) > 0.25 ? 1 : 0.06;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, lots.length]} frustumCulled={false}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial ref={mat} color="#ff4d5e" toneMapped={false} transparent fog={false} />
    </instancedMesh>
  );
}

// Métro aérien : traverse le fond de la scène en boucle.
function Train({ materials }: { materials: ReturnType<typeof useCityMaterials> }) {
  const group = useRef<THREE.Group>(null);
  const model = useMemo(() => buildTrain(), []);
  useEffect(() => () => { model.shell.dispose(); model.glow.dispose(); }, [model]);
  useFrame((state) => {
    if (group.current) group.current.position.x = mod(state.clock.elapsedTime * 8 + 40, 190) - 95;
  });
  return (
    <group position={[0, 11.4, -52]}>
      {/* viaduc */}
      <mesh position={[0, -1.5, 0]}>
        <boxGeometry args={[190, 0.5, 3.4]} />
        <meshStandardMaterial color="#0e1120" roughness={0.95} />
      </mesh>
      {[-40, -14, 14, 40].map((x) => (
        <mesh key={x} position={[x, -6.5, 0]}>
          <boxGeometry args={[1.4, 10, 1.4]} />
          <meshStandardMaterial color="#0e1120" roughness={0.95} />
        </mesh>
      ))}
      <group ref={group} rotation-y={Math.PI / 2}>
        <mesh geometry={model.shell} material={materials.metal} />
        <mesh geometry={model.glow} material={materials.glow} />
      </group>
    </group>
  );
}

// ── La ville ─────────────────────────────────────────────────────────────────

const CAR_COLORS = ["#26304a", "#5b2740", "#1f3b3a", "#4a3a22", "#2b2f3d", "#3d2434", "#1c2b40"];
const CAR_KINDS: CarKind[] = ["sedan", "coupe", "van"];

function City() {
  const materials = useCityMaterials();

  // 6 archétypes d'immeubles, semés des deux côtés de l'avenue.
  const buildings = useMemo(() => {
    const models = Array.from({ length: 6 }, (_, i) => buildBuilding(1000 + i * 137));
    const rnd = mulberry32(24);
    const lots: Lot[][] = models.map(() => []);
    const beacons: { x: number; y: number; z: number }[] = [];
    const perSide = 15;
    for (let i = 0; i < perSide * 2; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ai = Math.floor(rnd() * models.length);
      const m = models[ai];
      const x = side * (CURB_X + 1.1 + m.width / 2 + rnd() * 2.2);
      const z = -((i / (perSide * 2)) * SPAN) - rnd() * 2.4;
      lots[ai].push({ x, z, rot: rnd() > 0.5 ? Math.PI : 0 });
      if (m.hasBeacon) beacons.push({ x, y: m.height, z });
    }
    return { models, lots, beacons };
  }, []);

  // Trafic : 3 carrosseries, réparties sur les deux voies.
  const traffic = useMemo(() => {
    const models = CAR_KINDS.map((k, i) => buildCar(k, 700 + i * 91));
    const rnd = mulberry32(77);
    const slots: CarSlot[][] = models.map(() => []);
    for (let i = 0; i < 12; i++) {
      const mi = Math.floor(rnd() * models.length);
      slots[mi].push({
        z: -(i / 12) * SPAN - rnd() * 6,
        lane: i % 2 === 0 ? 1 : -1,
        speed: 0.5 + rnd() * 0.7,
      });
    }
    return { models, slots };
  }, []);

  // Mobilier : lampadaires (alternés), feux, abribus, arbres, enseignes.
  const props = useMemo(() => {
    const rnd = mulberry32(303);
    const lampL = buildStreetLamp(false);
    const lampR = buildStreetLamp(true);
    const lightsL: { x: number; z: number; rot: number }[] = [];
    const lightsR: { x: number; z: number; rot: number }[] = [];
    const reflections: { x: number; z: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const z = -(i / 14) * SPAN;
      if (i % 2 === 0) { lightsL.push({ x: -CURB_X + 0.5, z, rot: 0 }); reflections.push({ x: -CURB_X, z }); }
      else { lightsR.push({ x: CURB_X - 0.5, z, rot: 0 }); reflections.push({ x: CURB_X, z }); }
    }
    const trafficLight = buildTrafficLight();
    const tlSlots = [0, 1, 2, 3].map((i) => ({
      x: i % 2 === 0 ? -CURB_X + 0.4 : CURB_X - 0.4,
      z: -(i / 4) * SPAN - 6,
      rot: i % 2 === 0 ? 0 : Math.PI,
    }));
    const busStop = buildBusStop();
    const bsSlots = [0, 1].map((i) => ({
      x: i === 0 ? -CURB_X - 0.55 : CURB_X + 0.55,
      z: -(i / 2) * SPAN - 18,
      rot: i === 0 ? 0 : Math.PI,
    }));
    const tree = buildTree(12);
    const treeSlots = Array.from({ length: 12 }, (_, i) => ({
      x: (i % 2 === 0 ? -1 : 1) * (CURB_X + 0.2),
      z: -(i / 12) * SPAN - 3 - rnd() * 3,
      rot: rnd() * Math.PI,
    }));
    const sign = buildNeonSign(56);
    const signSlots = Array.from({ length: 8 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return { x: side * (CURB_X + 1.4), z: -(i / 8) * SPAN - rnd() * 5, rot: side > 0 ? Math.PI / 2 : -Math.PI / 2, y: 3 + rnd() * 3 };
    });
    return { lampL, lampR, lightsL, lightsR, reflections, trafficLight, tlSlots, busStop, bsSlots, tree, treeSlots, sign, signSlots };
  }, []);

  // Enseignes : posées en hauteur → PropRow ne gère que y=0, on décale le groupe.
  const signGroups = useMemo(
    () => props.signSlots.map((s) => ({ y: s.y, slot: [{ x: s.x, z: s.z, rot: s.rot }] })),
    [props.signSlots]
  );

  const stars = useMemo(() => {
    const rnd = mulberry32(4242);
    const pos = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      pos[i * 3] = (rnd() - 0.5) * 200;
      pos[i * 3 + 1] = 18 + rnd() * 55;
      pos[i * 3 + 2] = -40 - rnd() * 80;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const skyTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#06081a");
      g.addColorStop(0.42, "#101538");
      g.addColorStop(0.74, "#1c2149");
      g.addColorStop(0.9, "#2d2b58");
      g.addColorStop(1, "#0b0d18");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 256);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Libération mémoire au démontage (géométries fusionnées + textures).
  useEffect(() => {
    const geos: THREE.BufferGeometry[] = [
      ...buildings.models.flatMap((m) => [m.shell, m.glow]),
      ...traffic.models.flatMap((m) => [m.shell, m.glass, m.wheels, m.head, m.tail, m.glow]),
      props.lampL.shell, props.lampL.glow, props.lampR.shell, props.lampR.glow,
      props.trafficLight.shell, props.trafficLight.glow, props.busStop.shell, props.busStop.glow,
      props.tree.shell, props.tree.glow, props.sign.shell, props.sign.glow, stars,
    ];
    const mats = Object.values(materials);
    return () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      skyTex.dispose();
    };
  }, [buildings, traffic, props, materials, stars, skyTex]);

  return (
    <group>
      <Simulation />

      {/* Ciel, étoiles, lune + arc « pomodoro » (hors brouillard : restent nets) */}
      <mesh position={[0, 20, -86]}>
        <planeGeometry args={[380, 170]} />
        <meshBasicMaterial map={skyTex} fog={false} depthWrite={false} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial size={0.26} sizeAttenuation color="#cdd6ff" transparent opacity={0.7} fog={false} depthWrite={false} />
      </points>
      <group position={[-19, 28, -70]}>
        <mesh>
          <sphereGeometry args={[2.6, 24, 24]} />
          <meshBasicMaterial color="#f6f2e2" fog={false} toneMapped={false} />
        </mesh>
        <mesh rotation-z={0.6}>
          <torusGeometry args={[3.9, 0.07, 6, 44, Math.PI * 1.3]} />
          <meshBasicMaterial color="#a5b4fc" fog={false} toneMapped={false} transparent opacity={0.5} />
        </mesh>
      </group>

      <Train materials={materials} />

      {/* Asphalte mouillé (reflet spéculaire), chaussée, trottoirs */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -30]}>
        <planeGeometry args={[300, 280]} />
        <meshStandardMaterial color="#070911" roughness={0.26} metalness={0.66} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, -30]}>
        <planeGeometry args={[5.9, 280]} />
        <meshStandardMaterial color="#11141f" roughness={0.42} metalness={0.42} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (CURB_X + 0.75), 0.08, -30]}>
            <boxGeometry args={[1.5, 0.16, 280]} />
            <meshStandardMaterial color="#171b26" roughness={0.9} />
          </mesh>
          <mesh position={[s * CURB_X, 0.11, -30]}>
            <boxGeometry args={[0.14, 0.22, 280]} />
            <meshStandardMaterial color="#20242f" roughness={0.85} />
          </mesh>
        </group>
      ))}
      <RoadMarkings />

      {/* Immeubles + balises de toit */}
      {buildings.models.map((m, i) =>
        buildings.lots[i].length > 0 ? <BuildingRow key={i} model={m} lots={buildings.lots[i]} materials={materials} /> : null
      )}
      <Beacons lots={buildings.beacons} />

      {/* Mobilier urbain */}
      <PropRow shell={props.lampL.shell} glow={props.lampL.glow} slots={props.lightsL} materials={materials} />
      <PropRow shell={props.lampR.shell} glow={props.lampR.glow} slots={props.lightsR} materials={materials} />
      <WetReflections slots={props.reflections} />
      <PropRow shell={props.trafficLight.shell} glow={props.trafficLight.glow} slots={props.tlSlots} materials={materials} />
      <PropRow shell={props.busStop.shell} glow={props.busStop.glow} slots={props.bsSlots} materials={materials} />
      <PropRow shell={props.tree.shell} glow={props.tree.glow} slots={props.treeSlots} materials={materials} />
      {signGroups.map((g, i) => (
        <group key={i} position={[0, g.y, 0]}>
          <PropRow shell={props.sign.shell} glow={props.sign.glow} slots={g.slot} materials={materials} />
        </group>
      ))}

      {/* Trafic */}
      {traffic.models.map((m, i) =>
        traffic.slots[i].length > 0 ? <CarRow key={i} model={m} slots={traffic.slots[i]} materials={materials} colors={CAR_COLORS} /> : null
      )}
    </group>
  );
}

// Bandes blanches de l'axe central.
function RoadMarkings() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const slots = useMemo(() => Array.from({ length: 30 }, (_, i) => -(i / 30) * SPAN), []);
  useFrame(() => {
    const t = drive.travel;
    for (let i = 0; i < slots.length; i++) {
      dummy.position.set(0, 0.02, loopZ(slots[i], t));
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(0.16, 1.8, 1);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, slots.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#7c86a8" transparent opacity={0.38} depthWrite={false} />
    </instancedMesh>
  );
}

// Caméra : parallax pointeur + plongée vers la rue au fil du scroll.
function CameraRig() {
  useFrame((state, delta) => {
    const k = Math.min(1, Math.min(delta, 0.05) * 2.4);
    const t = state.clock.elapsedTime;
    const p = drive.progress;
    const cam = state.camera;
    cam.position.x += (state.pointer.x * 1.5 - cam.position.x) * k;
    cam.position.y += (4.8 - p * 2.2 + Math.sin(t * 0.3) * 0.18 - cam.position.y) * k;
    cam.position.z += (16 - p * 3.5 - cam.position.z) * k;
    cam.lookAt(0, 5.2 - state.pointer.y * 1 - p * 1.6, -30);
  });
  return null;
}

export default function NightCityScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  useScrollDrive();

  // Fond de page : on coupe le rendu dès que la ville est masquée par le voile
  // du landing (au-delà d'un écran et demi) ou quand l'onglet passe derrière.
  useEffect(() => {
    let raf = 0;
    const apply = () => setFrameloop(document.hidden || window.scrollY > window.innerHeight * 1.6 ? "never" : "always");
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", apply);
    };
  }, []);

  return (
    <div className={cn("absolute inset-0", className)}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.4]}
        camera={{ position: [0, 4.8, 16], fov: 55 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor("#070912")}
      >
        {/* Le brouillard fond les immeubles recyclés dans la nuit (boucle invisible) */}
        <fogExp2 attach="fog" args={["#0a0c18", 0.019]} />
        <ambientLight intensity={0.55} color="#6f7bc0" />
        {/* Clair de lune */}
        <directionalLight position={[-12, 16, -8]} intensity={0.85} color="#b9c6ff" />
        {/* Halo chaud de l'avenue, juste devant la caméra */}
        <pointLight position={[0, 3.4, 4]} intensity={26} distance={26} decay={2} color="#ffa860" />
        <City />
        <CameraRig />
      </Canvas>
    </div>
  );
}
