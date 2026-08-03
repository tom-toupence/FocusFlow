"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";

// « Mini ville de nuit » du landing (React Three Fiber) : une avenue low-poly qui
// DÉFILE vers la caméra — immeubles à fenêtres allumées, lampadaires, traînées de
// phares, lune avec un arc de progression (clin d'œil au timer). Ambiance lofi /
// « night drive », chill, en boucle infinie.
//
// Chorégraphie au scroll : le scroll injecte un « boost » de vitesse (amorti,
// signé — remonter fait reculer la ville) et fait plonger la caméra vers la rue.
// Sans scroll, la ville continue de dériver doucement : la scène vit toute seule.
//
// Perf (règle du projet) : ~7 instancedMesh (≈130 instances) + un ciel, AUCUN
// post-processing, canvas CONTENU, DPR plafonné, rendu en pause hors-viewport ou
// onglet caché. Le repli (reduced-motion / pas de WebGL) est géré par le parent.

const SPAN = 78; // profondeur de la boucle : tout ce qui dépasse est recyclé au fond
const NEAR = 8; // z le plus proche (derrière la caméra) avant recyclage
const BASE_SPEED = 2.6; // dérive de croisière (unités/s)

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

interface Drive {
  boost: number; // vitesse additionnelle injectée par le scroll (amortie)
  progress: number; // 0→1 sur le premier écran de scroll
}

// Écoute du scroll hors du cycle de rendu React : on écrit dans un ref lu par
// useFrame (aucun re-render du Canvas, donc aucun coût).
function useScrollDrive() {
  const drive = useRef<Drive>({ boost: 0, progress: 0 });
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const d = y - last;
      last = y;
      drive.current.boost = clamp(drive.current.boost + d * 0.05, -9, 18);
      drive.current.progress = clamp(y / Math.max(1, window.innerHeight), 0, 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return drive;
}

// Texture procédurale de fenêtres allumées (une seule pour toute une catégorie
// d'immeubles : 1 draw call, aucun asset externe).
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
      ctx.fillStyle = tone > 0.82 ? "#a9d4ff" : tone > 0.42 ? "#ffd39a" : "#ffb267";
      ctx.globalAlpha = 0.45 + rnd() * 0.55;
      ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Dégradé de ciel nocturne (plan lointain) — se fond avec la couleur du brouillard
// pour donner un horizon crédible sans skybox.
function makeSkyTexture() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#0d1030");
  g.addColorStop(0.45, "#141a3d");
  g.addColorStop(0.78, "#1d2148");
  g.addColorStop(1, "#0b0d18");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Slot {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

function makeBlocks(count: number, seed: number, minX: number, maxX: number, minH: number, maxH: number, minW: number, maxW: number): Slot[] {
  const rnd = mulberry32(seed);
  const out: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    out.push({
      x: side * (minX + rnd() * (maxX - minX)),
      z: -(i / count) * SPAN - rnd() * (SPAN / count),
      w: minW + rnd() * (maxW - minW),
      d: minW + rnd() * (maxW - minW),
      h: minH + rnd() * (maxH - minH),
    });
  }
  return out;
}

function City({ drive }: { drive: React.RefObject<Drive> }) {
  const towers = useRef<THREE.InstancedMesh>(null);
  const shops = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const dashes = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const tail = useRef<THREE.InstancedMesh>(null);
  const towerMat = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);

  const travel = useRef(0);
  const carTravel = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Géométries à origine au sol (translate) : scale.y = hauteur réelle.
  const boxUp = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const towerTex = useMemo(() => makeWindowTexture(5, 16, 7, 0.5), []);
  const shopTex = useMemo(() => makeWindowTexture(4, 3, 21, 0.62), []);
  const skyTex = useMemo(() => makeSkyTexture(), []);

  const towerSlots = useMemo(() => makeBlocks(34, 1337, 5.2, 13, 5, 14, 1.8, 3.2), []);
  const shopSlots = useMemo(() => makeBlocks(22, 99, 3.1, 4.8, 1.1, 2.6, 1.4, 2.4), []);
  const lampSlots = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < 22; i++) out.push({ x: i % 2 === 0 ? -2.5 : 2.5, z: -(i / 22) * SPAN });
    return out;
  }, []);
  const dashSlots = useMemo(() => Array.from({ length: 26 }, (_, i) => -(i / 26) * SPAN), []);
  const carSlots = useMemo(() => {
    const rnd = mulberry32(5150);
    return Array.from({ length: 6 }, (_, i) => ({ z: -(i / 6) * SPAN - rnd() * 6, speed: 0.6 + rnd() * 0.9 }));
  }, []);

  // Étoiles : un seul Points, hors brouillard.
  const stars = useMemo(() => {
    const rnd = mulberry32(4242);
    const pos = new Float32Array(220 * 3);
    for (let i = 0; i < 220; i++) {
      pos[i * 3] = (rnd() - 0.5) * 120;
      pos[i * 3 + 1] = 14 + rnd() * 40;
      pos[i * 3 + 2] = -30 - rnd() * 60;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useEffect(() => {
    return () => {
      towerTex.dispose();
      shopTex.dispose();
      skyTex.dispose();
      boxUp.dispose();
      stars.dispose();
    };
  }, [towerTex, shopTex, skyTex, boxUp, stars]);

  const place = (mesh: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    if (!mesh) return;
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const d = drive.current;
    // Le boost du scroll s'amortit : la ville revient à sa vitesse de croisière.
    d.boost *= Math.exp(-dt * 2.1);
    const speed = BASE_SPEED + d.boost;
    travel.current += speed * dt;
    carTravel.current += (speed * 2.4 + 5) * dt;

    const t = travel.current;
    for (let i = 0; i < towerSlots.length; i++) {
      const s = towerSlots[i];
      place(towers.current, i, s.x, 0, mod(s.z + t, SPAN) - SPAN + NEAR, s.w, s.h, s.d);
    }
    for (let i = 0; i < shopSlots.length; i++) {
      const s = shopSlots[i];
      place(shops.current, i, s.x, 0, mod(s.z + t, SPAN) - SPAN + NEAR, s.w, s.h, s.d);
    }
    for (let i = 0; i < lampSlots.length; i++) {
      const s = lampSlots[i];
      const z = mod(s.z + t, SPAN) - SPAN + NEAR;
      place(poles.current, i, s.x, 0, z, 0.08, 2.2, 0.08);
      place(bulbs.current, i, s.x + (s.x < 0 ? 0.32 : -0.32), 2.2, z, 1, 1, 1);
    }
    for (let i = 0; i < dashSlots.length; i++) {
      place(dashes.current, i, 0, 0.02, mod(dashSlots[i] + t, SPAN) - SPAN + NEAR, 0.14, 1, 1.6);
    }
    for (let i = 0; i < carSlots.length; i++) {
      const c = carSlots[i];
      // Phares : viennent vers nous (voie de droite). Feux : s'éloignent (voie de gauche).
      place(head.current, i, 1.25, 0.32, mod(c.z + t + carTravel.current * c.speed, SPAN) - SPAN + NEAR, 0.5, 0.12, 1.4);
      place(tail.current, i, -1.25, 0.32, mod(c.z + t - carTravel.current * c.speed, SPAN) - SPAN + NEAR, 0.5, 0.12, 1.4);
    }

    for (const m of [towers, shops, poles, bulbs, dashes, head, tail]) {
      if (m.current) m.current.instanceMatrix.needsUpdate = true;
    }

    // Respiration des fenêtres + arc « pomodoro » qui tourne autour de la lune.
    const e = state.clock.elapsedTime;
    if (towerMat.current) towerMat.current.emissiveIntensity = 1.25 + Math.sin(e * 0.7) * 0.12;
    if (ring.current) ring.current.rotation.z = e * 0.16;
  });

  return (
    <group>
      {/* Ciel + étoiles + lune (hors brouillard pour rester nets) */}
      <mesh position={[0, 16, -62]}>
        <planeGeometry args={[180, 100]} />
        <meshBasicMaterial map={skyTex} fog={false} depthWrite={false} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial size={0.22} sizeAttenuation color="#cdd6ff" transparent opacity={0.75} fog={false} depthWrite={false} />
      </points>
      <group position={[-11, 21, -52]}>
        <mesh>
          <sphereGeometry args={[2.2, 24, 24]} />
          <meshBasicMaterial color="#f4f1e4" fog={false} toneMapped={false} />
        </mesh>
        <mesh ref={ring}>
          <torusGeometry args={[3.2, 0.07, 6, 40, Math.PI * 1.25]} />
          <meshBasicMaterial color="#a5b4fc" fog={false} toneMapped={false} transparent opacity={0.7} />
        </mesh>
      </group>

      {/* Sol mouillé (léger reflet spéculaire de la lune) + chaussée */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -20]}>
        <planeGeometry args={[220, 200]} />
        <meshStandardMaterial color="#0a0c16" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -20]}>
        <planeGeometry args={[5.4, 200]} />
        <meshStandardMaterial color="#14161f" roughness={0.5} metalness={0.35} />
      </mesh>

      {/* Immeubles : tours + rez-de-chaussée commerçants */}
      <instancedMesh ref={towers} args={[undefined, undefined, towerSlots.length]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial
          ref={towerMat}
          color="#171c2c"
          roughness={0.92}
          metalness={0.05}
          emissive="#ffffff"
          emissiveMap={towerTex}
          emissiveIntensity={1.25}
        />
      </instancedMesh>
      <instancedMesh ref={shops} args={[undefined, undefined, shopSlots.length]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial color="#1c1a26" roughness={0.9} emissive="#ffffff" emissiveMap={shopTex} emissiveIntensity={1.6} />
      </instancedMesh>

      {/* Lampadaires (mât + halo) — pas de vraie lumière : trop coûteux */}
      <instancedMesh ref={poles} args={[undefined, undefined, lampSlots.length]} frustumCulled={false}>
        <primitive object={boxUp} attach="geometry" />
        <meshStandardMaterial color="#20242f" roughness={0.7} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, lampSlots.length]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshBasicMaterial color="#ffc27a" toneMapped={false} />
      </instancedMesh>

      {/* Marquage au sol */}
      <instancedMesh ref={dashes} args={[undefined, undefined, dashSlots.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#5b6280" transparent opacity={0.4} />
      </instancedMesh>

      {/* Trafic : traînées de phares / de feux arrière */}
      <instancedMesh ref={head} args={[undefined, undefined, carSlots.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#fff0cf" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={tail} args={[undefined, undefined, carSlots.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ff5f6d" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// Caméra : parallax pointeur + plongée vers la rue au fil du scroll.
function CameraRig({ drive }: { drive: React.RefObject<Drive> }) {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = Math.min(1, dt * 2.6);
    const t = state.clock.elapsedTime;
    const p = drive.current.progress;
    const cam = state.camera;
    cam.position.x += (state.pointer.x * 1.1 - cam.position.x) * k;
    cam.position.y += (3.7 - p * 1.9 + Math.sin(t * 0.34) * 0.14 - cam.position.y) * k;
    cam.position.z += (13 - p * 2.5 - cam.position.z) * k;
    cam.lookAt(0, 3.2 - state.pointer.y * 0.8 - p * 1.2, -22);
  });
  return null;
}

export default function NightCityScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(true);
  const drive = useScrollDrive();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setFrameloop(visibleRef.current && !document.hidden ? "always" : "never");
    const io = new IntersectionObserver(([e]) => {
      visibleRef.current = e.isIntersecting;
      apply();
    }, { threshold: 0 });
    io.observe(el);
    document.addEventListener("visibilitychange", apply);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, []);

  return (
    <div ref={wrapRef} className={cn("absolute inset-0", className)}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.5]}
        camera={{ position: [0, 3.7, 13], fov: 46 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        {/* Le brouillard fond les immeubles recyclés dans la nuit (boucle invisible) */}
        <fogExp2 attach="fog" args={["#0b0d18", 0.026]} />
        <ambientLight intensity={0.45} color="#6f7bc0" />
        {/* Clair de lune */}
        <directionalLight position={[-8, 12, -6]} intensity={0.75} color="#b9c6ff" />
        {/* Halo chaud de l'avenue, juste devant la caméra */}
        <pointLight position={[0, 2.6, 2]} intensity={14} distance={16} decay={2} color="#ffa860" />
        <City drive={drive} />
        <CameraRig drive={drive} />
      </Canvas>
    </div>
  );
}
