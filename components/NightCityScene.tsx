"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";

// FOND du landing (React Three Fiber) : une avenue nocturne qui DÉFILE — la ville
// passe derrière le contenu pendant que l'on scrolle. Ambiance lofi / « night
// drive », chill, en boucle infinie.
//
// Modélisation (au-delà de la boîte) : immeubles à RETRAITS (base + étage en
// retrait + couronne) avec fenêtres allumées procédurales, ENSEIGNES NÉON
// verticales sur les façades, BALISES rouges clignotantes sur les toits,
// lampadaires + REFLETS mouillés étirés sur l'asphalte, trafic (phares blancs qui
// viennent, feux rouges qui s'éloignent), arbres, et un MÉTRO AÉRIEN qui traverse
// le fond de temps en temps.
//
// Chorégraphie au scroll : le scroll injecte un « boost » de vitesse amorti et
// signé (remonter fait reculer la ville) et fait plonger la caméra vers la rue.
// Sans scroll la ville dérive doucement : la scène vit toute seule.
//
// Perf : ~14 instancedMesh (≈220 instances), AUCUN post-processing, DPR plafonné,
// rendu en PAUSE dès qu'on a dépassé le premier écran (la ville est alors masquée
// par le voile) ou quand l'onglet est caché.

const SPAN = 86; // profondeur de la boucle : ce qui dépasse est recyclé au fond
const NEAR = 10; // z le plus proche (derrière la caméra) avant recyclage
const BASE_SPEED = 2.4; // dérive de croisière (unités/s)

const TOWERS = 30;
const SHOPS = 20;
const LAMPS = 22;
const SIGNS = 16;
const DASHES = 28;
const CARS = 6;
const TREES = 14;

// PRNG déterministe : la ville est identique à chaque montage (pas de « saut »).
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mod = (v: number, m: number) => ((v % m) + m) % m;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// État du scroll partagé par la scène. Volontairement au niveau MODULE (une seule
// ville à l'écran) : le passer en prop ferait muter un prop dans useFrame, ce que
// le compilateur React interdit.
const drive = { boost: 0, progress: 0 };

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

// Fenêtres allumées procédurales (une texture = toute une catégorie d'immeubles).
function makeWindowTexture(cols: number, rows: number, seed: number, lit: number) {
  const cell = 8;
  const c = document.createElement("canvas");
  c.width = cols * cell;
  c.height = rows * cell;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, c.width, c.height);
  const rnd = mulberry32(seed);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (rnd() > lit) continue;
      const tone = rnd();
      ctx.fillStyle = tone > 0.86 ? "#a9d4ff" : tone > 0.4 ? "#ffd39a" : "#ffb267";
      ctx.globalAlpha = 0.4 + rnd() * 0.6;
      ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

// Enseigne néon : bandeau vertical avec des « caractères » lumineux abstraits.
function makeSignTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 32, 128);
  const rnd = mulberry32(808);
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 7; i++) {
    const y = 8 + i * 17;
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    ctx.fillRect(8 + rnd() * 4, y, 14 + rnd() * 4, 9);
  }
  ctx.globalAlpha = 0.9;
  ctx.fillRect(2, 2, 2, 124);
  ctx.fillRect(28, 2, 2, 124);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dégradé de ciel nocturne — se fond avec la couleur du brouillard (horizon).
function makeSkyTexture() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#080a1e");
  g.addColorStop(0.4, "#111635");
  g.addColorStop(0.72, "#1b2049");
  g.addColorStop(0.88, "#2a2a55");
  g.addColorStop(1, "#0b0d18");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  h2: number; // hauteur de l'étage en retrait (0 = pas de retrait)
  h3: number; // couronne / antenne
  beacon: boolean;
}

function makeTowers(): Tower[] {
  const rnd = mulberry32(1337);
  const out: Tower[] = [];
  for (let i = 0; i < TOWERS; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const h = 5 + rnd() * 10;
    const stepped = rnd() > 0.35;
    out.push({
      x: side * (5.4 + rnd() * 8),
      z: -(i / TOWERS) * SPAN - rnd() * (SPAN / TOWERS),
      w: 1.9 + rnd() * 1.6,
      d: 1.9 + rnd() * 1.6,
      h,
      h2: stepped ? h * (0.25 + rnd() * 0.3) : 0,
      h3: rnd() > 0.55 ? 1 + rnd() * 2.4 : 0,
      beacon: h > 10,
    });
  }
  return out;
}

interface Shop {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

function makeShops(): Shop[] {
  const rnd = mulberry32(99);
  return Array.from({ length: SHOPS }, (_, i) => ({
    x: (i % 2 === 0 ? -1 : 1) * (3.2 + rnd() * 1.5),
    z: -(i / SHOPS) * SPAN - rnd() * 4,
    w: 1.5 + rnd() * 1.1,
    d: 1.5 + rnd() * 1.1,
    h: 1.1 + rnd() * 1.6,
  }));
}

const NEON = ["#ff5fa2", "#5ce1e6", "#ffd166", "#a78bfa", "#7dd3fc", "#fb7185"];

function City() {
  const towerBase = useRef<THREE.InstancedMesh>(null);
  const towerMid = useRef<THREE.InstancedMesh>(null);
  const towerCrown = useRef<THREE.InstancedMesh>(null);
  const shops = useRef<THREE.InstancedMesh>(null);
  const signs = useRef<THREE.InstancedMesh>(null);
  const beacons = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const reflections = useRef<THREE.InstancedMesh>(null);
  const dashes = useRef<THREE.InstancedMesh>(null);
  const headlights = useRef<THREE.InstancedMesh>(null);
  const taillights = useRef<THREE.InstancedMesh>(null);
  const cars = useRef<THREE.InstancedMesh>(null);
  const trees = useRef<THREE.InstancedMesh>(null);
  const train = useRef<THREE.Group>(null);
  const windowMat = useRef<THREE.MeshStandardMaterial>(null);
  const beaconMat = useRef<THREE.MeshBasicMaterial>(null);

  const travel = useRef(0);
  const carTravel = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Géométries à origine au sol : scale.y = hauteur réelle.
  const boxUp = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const coneUp = useMemo(() => new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), []);
  const towerTex = useMemo(() => makeWindowTexture(5, 18, 7, 0.48), []);
  const shopTex = useMemo(() => makeWindowTexture(4, 3, 21, 0.66), []);
  const signTex = useMemo(() => makeSignTexture(), []);
  const skyTex = useMemo(() => makeSkyTexture(), []);
  const trainTex = useMemo(() => makeWindowTexture(14, 2, 55, 0.8), []);

  const towerSlots = useMemo(() => makeTowers(), []);
  const shopSlots = useMemo(() => makeShops(), []);
  const lampSlots = useMemo(
    () => Array.from({ length: LAMPS }, (_, i) => ({ x: i % 2 === 0 ? -2.7 : 2.7, z: -(i / LAMPS) * SPAN })),
    []
  );
  const signSlots = useMemo(() => {
    const rnd = mulberry32(4711);
    return Array.from({ length: SIGNS }, (_, i) => {
      const t = towerSlots[i % towerSlots.length];
      return { tower: i % towerSlots.length, y: 2 + rnd() * Math.max(1, t.h - 4), h: 1.6 + rnd() * 2.2, color: NEON[i % NEON.length] };
    });
  }, [towerSlots]);
  const dashSlots = useMemo(() => Array.from({ length: DASHES }, (_, i) => -(i / DASHES) * SPAN), []);
  const carSlots = useMemo(() => {
    const rnd = mulberry32(5150);
    return Array.from({ length: CARS }, (_, i) => ({ z: -(i / CARS) * SPAN - rnd() * 8, speed: 0.55 + rnd() * 0.9 }));
  }, []);
  const treeSlots = useMemo(() => {
    const rnd = mulberry32(3131);
    return Array.from({ length: TREES }, (_, i) => ({
      x: (i % 2 === 0 ? -1 : 1) * (2.95 + rnd() * 0.25),
      z: -(i / TREES) * SPAN - rnd() * 5,
      h: 1.6 + rnd() * 0.9,
      r: 0.45 + rnd() * 0.2,
    }));
  }, []);

  const stars = useMemo(() => {
    const rnd = mulberry32(4242);
    const pos = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      pos[i * 3] = (rnd() - 0.5) * 160;
      pos[i * 3 + 1] = 16 + rnd() * 46;
      pos[i * 3 + 2] = -35 - rnd() * 70;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  // Couleurs d'instance (néons) — posées une fois.
  useEffect(() => {
    const mesh = signs.current;
    if (!mesh) return;
    const c = new THREE.Color();
    signSlots.forEach((s, i) => mesh.setColorAt(i, c.set(s.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [signSlots]);

  useEffect(() => {
    const disposables = [towerTex, shopTex, signTex, skyTex, trainTex, boxUp, coneUp, stars];
    return () => disposables.forEach((d) => d.dispose());
  }, [towerTex, shopTex, signTex, skyTex, trainTex, boxUp, coneUp, stars]);

  const place = (
    mesh: THREE.InstancedMesh | null,
    i: number,
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    rotY = 0
  ) => {
    if (!mesh) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    // Le boost du scroll s'amortit : la ville revient à sa vitesse de croisière.
    drive.boost *= Math.exp(-dt * 2.1);
    const speed = BASE_SPEED + drive.boost;
    travel.current += speed * dt;
    carTravel.current += (Math.abs(speed) * 2 + 6) * dt;
    const t = travel.current;
    const e = state.clock.elapsedTime;

    // Immeubles : base + étage en retrait + couronne (les 3 recyclés ensemble).
    for (let i = 0; i < towerSlots.length; i++) {
      const s = towerSlots[i];
      const z = mod(s.z + t, SPAN) - SPAN + NEAR;
      place(towerBase.current, i, s.x, 0, z, s.w, s.h, s.d);
      place(towerMid.current, i, s.x, s.h, z, s.w * 0.66, s.h2, s.d * 0.66);
      const crownY = s.h + s.h2;
      place(towerCrown.current, i, s.x, crownY, z, 0.14, s.h3, 0.14);
      place(beacons.current, i, s.x, crownY + s.h3 + 0.12, z, s.beacon ? 1 : 0, s.beacon ? 1 : 0, s.beacon ? 1 : 0);
    }
    for (let i = 0; i < shopSlots.length; i++) {
      const s = shopSlots[i];
      place(shops.current, i, s.x, 0, mod(s.z + t, SPAN) - SPAN + NEAR, s.w, s.h, s.d);
    }
    // Enseignes néon plaquées sur la façade côté rue de leur immeuble.
    for (let i = 0; i < signSlots.length; i++) {
      const s = signSlots[i];
      const tw = towerSlots[s.tower];
      const z = mod(tw.z + t, SPAN) - SPAN + NEAR;
      const inner = tw.x < 0 ? tw.x + tw.w / 2 + 0.06 : tw.x - tw.w / 2 - 0.06;
      place(signs.current, i, inner, s.y, z, 0.55, s.h, 1, tw.x < 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    // Lampadaires + reflet mouillé étiré sur l'asphalte.
    for (let i = 0; i < lampSlots.length; i++) {
      const s = lampSlots[i];
      const z = mod(s.z + t, SPAN) - SPAN + NEAR;
      const bx = s.x + (s.x < 0 ? 0.34 : -0.34);
      place(poles.current, i, s.x, 0, z, 0.07, 2.4, 0.07);
      place(bulbs.current, i, bx, 2.4, z, 1, 1, 1);
      place(reflections.current, i, bx, 0.015, z + 1.4, 0.5, 1, 3.4);
    }
    for (let i = 0; i < dashSlots.length; i++) {
      place(dashes.current, i, 0, 0.02, mod(dashSlots[i] + t, SPAN) - SPAN + NEAR, 0.14, 1, 1.7);
    }
    for (let i = 0; i < treeSlots.length; i++) {
      const s = treeSlots[i];
      place(trees.current, i, s.x, 0, mod(s.z + t, SPAN) - SPAN + NEAR, s.r, s.h, s.r);
    }
    // Trafic : carrosseries + phares (venant vers nous) / feux (s'éloignant).
    for (let i = 0; i < carSlots.length; i++) {
      const c = carSlots[i];
      const zHead = mod(c.z + t + carTravel.current * c.speed, SPAN) - SPAN + NEAR;
      const zTail = mod(c.z + t - carTravel.current * c.speed, SPAN) - SPAN + NEAR;
      place(cars.current, i, 1.3, 0, zHead, 0.66, 0.42, 1.5);
      place(cars.current, i + CARS, -1.3, 0, zTail, 0.66, 0.42, 1.5);
      place(headlights.current, i, 1.3, 0.24, zHead + 0.78, 0.56, 0.1, 0.06);
      place(taillights.current, i, -1.3, 0.24, zTail + 0.78, 0.56, 0.1, 0.06);
    }

    for (const m of [towerBase, towerMid, towerCrown, shops, signs, beacons, poles, bulbs, reflections, dashes, cars, headlights, taillights, trees]) {
      if (m.current) m.current.instanceMatrix.needsUpdate = true;
    }

    // Métro aérien : traverse le fond, puis repart de l'autre côté.
    if (train.current) train.current.position.x = mod(e * 7 + 20, 150) - 75;
    // Respiration des fenêtres + clignotement des balises de toit.
    if (windowMat.current) windowMat.current.emissiveIntensity = 1.3 + Math.sin(e * 0.7) * 0.12;
    if (beaconMat.current) beaconMat.current.opacity = Math.sin(e * 2.6) > 0.2 ? 1 : 0.08;
  });

  return (
    <group>
      {/* Ciel, étoiles, lune + arc « pomodoro » (hors brouillard : restent nets) */}
      <mesh position={[0, 18, -74]}>
        <planeGeometry args={[300, 140]} />
        <meshBasicMaterial map={skyTex} fog={false} depthWrite={false} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial size={0.24} sizeAttenuation color="#cdd6ff" transparent opacity={0.7} fog={false} depthWrite={false} />
      </points>
      <group position={[-15, 24, -60]}>
        <mesh>
          <sphereGeometry args={[2.4, 24, 24]} />
          <meshBasicMaterial color="#f6f2e2" fog={false} toneMapped={false} />
        </mesh>
        <mesh rotation-z={0.6}>
          <torusGeometry args={[3.6, 0.07, 6, 44, Math.PI * 1.3]} />
          <meshBasicMaterial color="#a5b4fc" fog={false} toneMapped={false} transparent opacity={0.55} />
        </mesh>
      </group>

      {/* Métro aérien : viaduc + rame éclairée */}
      <group position={[0, 9.5, -46]}>
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[150, 0.4, 2.2]} />
          <meshStandardMaterial color="#0f1220" roughness={0.9} />
        </mesh>
        <group ref={train}>
          <mesh>
            <boxGeometry args={[14, 1.5, 1.6]} />
            <meshStandardMaterial color="#1a1f33" roughness={0.6} metalness={0.3} emissive="#ffffff" emissiveMap={trainTex} emissiveIntensity={1.5} />
          </mesh>
        </group>
      </group>

      {/* Asphalte mouillé (reflet spéculaire) + chaussée + trottoirs */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -24]}>
        <planeGeometry args={[260, 240]} />
        <meshStandardMaterial color="#080a13" roughness={0.28} metalness={0.62} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, -24]}>
        <planeGeometry args={[5.6, 240]} />
        <meshStandardMaterial color="#12141f" roughness={0.45} metalness={0.4} />
      </mesh>
      {[-3.15, 3.15].map((x) => (
        <mesh key={x} position={[x, 0.06, -24]}>
          <boxGeometry args={[0.7, 0.12, 240]} />
          <meshStandardMaterial color="#191d29" roughness={0.85} />
        </mesh>
      ))}

      {/* Immeubles : base + retrait (mêmes fenêtres) + couronne/antenne */}
      <instancedMesh ref={towerBase} args={[undefined, undefined, TOWERS]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial
          ref={windowMat}
          color="#141827"
          roughness={0.92}
          metalness={0.08}
          emissive="#ffffff"
          emissiveMap={towerTex}
          emissiveIntensity={1.3}
        />
      </instancedMesh>
      <instancedMesh ref={towerMid} args={[undefined, undefined, TOWERS]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial color="#161a2b" roughness={0.92} emissive="#ffffff" emissiveMap={towerTex} emissiveIntensity={1.1} />
      </instancedMesh>
      <instancedMesh ref={towerCrown} args={[undefined, undefined, TOWERS]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial color="#232838" roughness={0.6} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={shops} args={[undefined, undefined, SHOPS]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial color="#1b1826" roughness={0.9} emissive="#ffffff" emissiveMap={shopTex} emissiveIntensity={1.7} />
      </instancedMesh>

      {/* Enseignes néon (couleur par instance) */}
      <instancedMesh ref={signs} args={[undefined, undefined, SIGNS]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshBasicMaterial map={signTex} transparent toneMapped={false} fog={false} />
      </instancedMesh>

      {/* Balises rouges clignotantes sur les toits */}
      <instancedMesh ref={beacons} args={[undefined, undefined, TOWERS]} frustumCulled={false}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshBasicMaterial ref={beaconMat} color="#ff4d5e" toneMapped={false} transparent fog={false} />
      </instancedMesh>

      {/* Lampadaires : mât, halo, reflet mouillé */}
      <instancedMesh ref={poles} args={[undefined, undefined, LAMPS]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial color="#1d212c" roughness={0.7} metalness={0.45} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, LAMPS]} frustumCulled={false}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshBasicMaterial color="#ffc27a" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={reflections} args={[undefined, undefined, LAMPS]} rotation-x={-Math.PI / 2} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffb464" transparent opacity={0.16} depthWrite={false} />
      </instancedMesh>

      {/* Marquage au sol */}
      <instancedMesh ref={dashes} args={[undefined, undefined, DASHES]} rotation-x={-Math.PI / 2} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#5b6280" transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>

      {/* Arbres d'alignement */}
      <instancedMesh ref={trees} args={[undefined, undefined, TREES]} frustumCulled={false}>
        <primitive object={coneUp} attach="geometry" />
        <meshStandardMaterial color="#16281f" roughness={0.95} />
      </instancedMesh>

      {/* Trafic */}
      <instancedMesh ref={cars} args={[undefined, undefined, CARS * 2]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial color="#0e1119" roughness={0.35} metalness={0.7} />
      </instancedMesh>
      <instancedMesh ref={headlights} args={[undefined, undefined, CARS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#fff3d6" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={taillights} args={[undefined, undefined, CARS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ff4f63" toneMapped={false} />
      </instancedMesh>
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
    cam.position.x += (state.pointer.x * 1.4 - cam.position.x) * k;
    cam.position.y += (4.4 - p * 2.1 + Math.sin(t * 0.32) * 0.16 - cam.position.y) * k;
    cam.position.z += (14 - p * 3 - cam.position.z) * k;
    cam.lookAt(0, 4.6 - state.pointer.y * 0.9 - p * 1.4, -26);
  });
  return null;
}

export default function NightCityScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  useScrollDrive();

  // La ville est en fond de page : on coupe le rendu dès qu'elle est masquée par
  // le voile (au-delà d'un écran et demi) ou quand l'onglet passe en arrière-plan.
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      const hidden = document.hidden || window.scrollY > window.innerHeight * 1.6;
      setFrameloop(hidden ? "never" : "always");
    };
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
        camera={{ position: [0, 4.4, 14], fov: 52 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor("#070912")}
      >
        {/* Le brouillard fond les immeubles recyclés dans la nuit (boucle invisible) */}
        <fogExp2 attach="fog" args={["#0a0c18", 0.022]} />
        <ambientLight intensity={0.5} color="#6f7bc0" />
        {/* Clair de lune */}
        <directionalLight position={[-10, 14, -6]} intensity={0.8} color="#b9c6ff" />
        {/* Halo chaud de l'avenue, juste devant la caméra */}
        <pointLight position={[0, 3, 3]} intensity={20} distance={20} decay={2} color="#ffa860" />
        <City />
        <CameraRig />
      </Canvas>
    </div>
  );
}
