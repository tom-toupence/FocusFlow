"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { cn } from "@/lib/utils";

// Décor 3D du landing (React Three Fiber) : une petite VILLE de nuit stylisée,
// avec un CYCLE JOUR→NUIT piloté par le SCROLL. En haut de page = crépuscule
// doré (soleil), en scrollant = la nuit tombe, les fenêtres et néons s'allument,
// la lune se lève, la caméra tourne lentement autour de la ville. Un clin d'œil
// aux ambiances « study with me / lofi night city » du catalogue.
//
// Tout est PROCÉDURAL (aucun modèle/asset externe → gratuit, hors-ligne,
// CSP-safe). Rendu en pause hors-viewport / onglet caché. Le repli
// reduced-motion / pas de WebGL est géré par le parent (composant non monté).

type NightRef = RefObject<number>;

// Palettes jour → nuit (créées une fois, côté client).
const DAY_TOP = new THREE.Color("#3b4a86");
const DAY_BOT = new THREE.Color("#e0954e");
const NIGHT_TOP = new THREE.Color("#06060f");
const NIGHT_BOT = new THREE.Color("#241539");
const DAY_FOG = new THREE.Color("#33406a");
const NIGHT_FOG = new THREE.Color("#0a0814");
const SUN_DAY = new THREE.Color("#ffd8a0");
const SUN_SET = new THREE.Color("#ff5a2a");
const DIR_DAY = new THREE.Color("#ffdcb0");
const DIR_NIGHT = new THREE.Color("#5a72b8");

const lerp = THREE.MathUtils.lerp;
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

function pageScroll(): number {
  if (typeof window === "undefined") return 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? clamp01(window.scrollY / max) : 0;
}

// Fait avancer `night` (0→1) doucement vers la progression de scroll.
function ScrollDriver({ nightRef }: { nightRef: NightRef }) {
  useFrame(() => { nightRef.current += (pageScroll() - nightRef.current) * 0.06; });
  return null;
}

// Ciel : dôme en dégradé vertical, couleurs lerpées jour→nuit.
function SkyDome({ nightRef }: { nightRef: NightRef }) {
  const uniforms = useMemo(
    () => ({ uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() } }),
    []
  );
  useFrame(() => {
    const n = nightRef.current;
    uniforms.uTop.value.copy(DAY_TOP).lerp(NIGHT_TOP, n);
    uniforms.uBottom.value.copy(DAY_BOT).lerp(NIGHT_BOT, n);
  });
  return (
    <mesh>
      <sphereGeometry args={[60, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`varying vec3 vP; uniform vec3 uTop; uniform vec3 uBottom; void main(){ float t = smoothstep(-0.15, 0.55, normalize(vP).y); gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0); }`}
      />
    </mesh>
  );
}

// Soleil (jour) + lune (nuit) qui arquent, se croisent au crépuscule.
function Celestial({ nightRef }: { nightRef: NightRef }) {
  const sun = useRef<THREE.Mesh>(null);
  const sunMat = useRef<THREE.MeshBasicMaterial>(null);
  const moon = useRef<THREE.Mesh>(null);
  const moonMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const n = nightRef.current;
    if (sun.current) sun.current.position.set(-15, lerp(15, -12, n), -34);
    if (sunMat.current) {
      sunMat.current.opacity = clamp01(1 - n * 1.4);
      sunMat.current.color.copy(SUN_DAY).lerp(SUN_SET, clamp01(n * 1.6));
    }
    if (moon.current) moon.current.position.set(17, lerp(-12, 16, n), -34);
    if (moonMat.current) moonMat.current.opacity = clamp01((n - 0.35) * 1.8);
  });
  return (
    <>
      <mesh ref={sun}>
        <sphereGeometry args={[3.2, 32, 32]} />
        <meshBasicMaterial ref={sunMat} color={SUN_DAY} transparent toneMapped={false} />
      </mesh>
      <mesh ref={moon}>
        <sphereGeometry args={[2.1, 32, 32]} />
        <meshBasicMaterial ref={moonMat} color="#cdd6ff" transparent opacity={0} toneMapped={false} />
      </mesh>
    </>
  );
}

function Lights({ nightRef }: { nightRef: NightRef }) {
  const dir = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  useFrame(() => {
    const n = nightRef.current;
    if (dir.current) {
      dir.current.intensity = lerp(2.6, 0.28, n);
      dir.current.position.set(-15, lerp(15, 5, n), -8);
      dir.current.color.copy(DIR_DAY).lerp(DIR_NIGHT, n);
    }
    if (amb.current) amb.current.intensity = lerp(0.55, 0.16, n);
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.55} />
      <directionalLight ref={dir} intensity={2.6} />
    </>
  );
}

// Texture de fenêtres (canvas) → emissiveMap ; s'allume la nuit.
function makeWindowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#050509"; ctx.fillRect(0, 0, 64, 128);
  const cols = 4, rows = 9, cw = 64 / cols, ch = 128 / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (Math.random() < 0.5) continue;
    ctx.fillStyle = Math.random() < 0.82 ? "#ffd8a0" : "#7fe6ff";
    ctx.fillRect(x * cw + 3, y * ch + 3, cw - 6, ch - 7);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  return tex;
}

interface B { x: number; z: number; h: number; w: number; d: number; }
function generateBuildings(): B[] {
  const out: B[] = [];
  const grid = 12, spacing = 2.15;
  for (let i = -grid; i <= grid; i++) for (let j = -grid; j <= grid; j++) {
    if (i % 4 === 0 || j % 4 === 0) continue;      // « rues »
    if (Math.random() < 0.28) continue;
    const x = i * spacing + (Math.random() - 0.5) * 0.5;
    const z = j * spacing + (Math.random() - 0.5) * 0.5;
    const dist = Math.hypot(x, z);
    const h = Math.max(0.7, (5.2 - dist * 0.14) * (0.35 + Math.random() * 0.95));
    out.push({ x, z, h, w: 1.15 + Math.random() * 0.55, d: 1.15 + Math.random() * 0.55 });
  }
  return out;
}

function City({ nightRef }: { nightRef: NightRef }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const winTex = useMemo(makeWindowTexture, []);
  const buildings = useMemo(generateBuildings, []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    buildings.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [buildings]);

  useFrame(() => { if (mat.current) mat.current.emissiveIntensity = 0.1 + nightRef.current * 1.7; });

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, buildings.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={mat}
          color="#0b0b14"
          roughness={0.72}
          metalness={0.35}
          emissive="#ffcf8f"
          emissiveMap={winTex}
          emissiveIntensity={0}
        />
      </instancedMesh>
      {/* sol sombre légèrement réfléchissant */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#050508" roughness={0.55} metalness={0.5} />
      </mesh>
    </group>
  );
}

// Fog scène (couleur lerpée jour→nuit) — profondeur + fondu de l'horizon.
function SceneFog({ nightRef }: { nightRef: NightRef }) {
  const ref = useRef<THREE.Fog>(null);
  useFrame(() => { if (ref.current) ref.current.color.copy(DAY_FOG).lerp(NIGHT_FOG, nightRef.current); });
  return <fog attach="fog" ref={ref} args={["#33406a", 16, 62]} />;
}

// Caméra : orbite lente autour de la ville selon le scroll + parallax pointeur.
function Rig() {
  useFrame((state) => {
    const p = pageScroll();
    const angle = 0.25 + p * 0.8 + state.pointer.x * 0.12;
    const radius = 18;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const y = lerp(4.5, 9, p) + state.pointer.y * 0.7;
    state.camera.position.set(x, y, z);
    state.camera.lookAt(0, 2.6, 0);
  });
  return null;
}

export default function HeroScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(true);
  const nightRef = useRef(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setFrameloop(visibleRef.current && !document.hidden ? "always" : "never");
    const io = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; apply(); }, { threshold: 0 });
    io.observe(el);
    document.addEventListener("visibilitychange", apply);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", apply); };
  }, []);

  return (
    <div ref={wrapRef} className={cn("absolute inset-0", className)}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.5]}
        camera={{ position: [0, 4.5, 18], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <ScrollDriver nightRef={nightRef} />
        <SceneFog nightRef={nightRef} />
        <SkyDome nightRef={nightRef} />
        <Celestial nightRef={nightRef} />
        <Lights nightRef={nightRef} />
        <City nightRef={nightRef} />
        <Rig />
        <EffectComposer>
          <Bloom mipmapBlur intensity={1.0} luminanceThreshold={0.25} luminanceSmoothing={0.25} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
