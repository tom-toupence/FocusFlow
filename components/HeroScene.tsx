"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";
import type { Group, Mesh, PointLight, MeshStandardMaterial } from "three";
import { cn } from "@/lib/utils";

// « Mini maquette » du landing (React Three Fiber) : un petit BUREAU d'étudiant
// cozy en low-poly — lampe chaude, laptop allumé, tasse de café, une pile de
// livres, une plante, et un MINUTEUR TOMATE (pomodoro) dont l'aiguille tourne.
// Un·e étudiant·e penché·e sur son laptop. Ambiance « study with me » nocturne.
//
// Volontairement LÉGER (giga fluide) : ~30 meshes primitifs, AUCUN
// post-processing/bloom, canvas CONTENU (pas plein écran), DPR plafonné, rendu en
// pause hors-viewport / onglet caché. Le repli (reduced-motion / pas de WebGL)
// est géré par le parent (composant non monté → illustration statique).

function StudyDesk() {
  const group = useRef<Group>(null);
  const hand = useRef<Mesh>(null);      // aiguille du minuteur tomate
  const lamp = useRef<PointLight>(null);
  const screen = useRef<MeshStandardMaterial>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      // Rotation « tourne-disque » très douce + léger parallax au pointeur.
      group.current.rotation.y = Math.sin(t * 0.18) * 0.28 + state.pointer.x * 0.35;
      group.current.rotation.x = -0.02 + state.pointer.y * 0.06;
    }
    if (hand.current) hand.current.rotation.z = -t * 0.6;           // aiguille qui tourne
    if (lamp.current) lamp.current.intensity = 7.5 + Math.sin(t * 3.1) * 0.5; // léger scintillement
    if (screen.current) screen.current.emissiveIntensity = 1.1 + Math.sin(t * 2.2) * 0.15;
  });

  return (
    <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.35}>
      <group ref={group} position={[0, -0.25, 0]}>
        {/* Socle de la maquette */}
        <mesh position={[0, -0.55, 0]} receiveShadow>
          <cylinderGeometry args={[2.15, 2.25, 0.35, 48]} />
          <meshStandardMaterial color="#15131c" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* Tapis */}
        <mesh position={[0, -0.37, 0.2]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.5, 40]} />
          <meshStandardMaterial color="#2a2340" roughness={0.95} />
        </mesh>

        {/* ── Bureau ─────────────────────────────────────────── */}
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.02, 0]} castShadow>
            <boxGeometry args={[2.4, 0.12, 1.1]} />
            <meshStandardMaterial color="#6d4a2c" roughness={0.6} metalness={0.05} />
          </mesh>
          {[[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]].map(([x, z], i) => (
            <mesh key={i} position={[x, -0.28, z]}>
              <boxGeometry args={[0.12, 0.62, 0.12]} />
              <meshStandardMaterial color="#4d3420" roughness={0.7} />
            </mesh>
          ))}
        </group>

        {/* ── Laptop ─────────────────────────────────────────── */}
        <group position={[-0.15, 0.08, 0.08]} rotation-y={0.25}>
          <mesh position={[0, 0.02, 0.16]}>
            <boxGeometry args={[0.72, 0.03, 0.48]} />
            <meshStandardMaterial color="#2b2e36" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.24, -0.06]} rotation-x={-1.18}>
            <boxGeometry args={[0.72, 0.46, 0.03]} />
            <meshStandardMaterial color="#23252b" roughness={0.4} metalness={0.6} />
          </mesh>
          {/* écran émissif */}
          <mesh position={[0, 0.245, -0.045]} rotation-x={-1.18}>
            <planeGeometry args={[0.64, 0.38]} />
            <meshStandardMaterial ref={screen} color="#0a1a2a" emissive="#7db4ff" emissiveIntensity={1.1} toneMapped={false} />
          </mesh>
        </group>

        {/* ── Lampe de bureau (arm + tête + lumière) ─────────── */}
        <group position={[0.92, 0.08, -0.32]}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.11, 0.13, 0.04, 20]} />
            <meshStandardMaterial color="#caa25a" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation-z={0.35}>
            <cylinderGeometry args={[0.02, 0.02, 0.6, 12]} />
            <meshStandardMaterial color="#caa25a" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[-0.2, 0.55, 0]} rotation-z={-0.9}>
            <cylinderGeometry args={[0.02, 0.02, 0.42, 12]} />
            <meshStandardMaterial color="#caa25a" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[-0.42, 0.62, 0]} rotation-z={-1.5}>
            <coneGeometry args={[0.14, 0.22, 20, 1, true]} />
            <meshStandardMaterial color="#e0b45a" roughness={0.35} metalness={0.6} side={2} emissive="#ffcf7a" emissiveIntensity={0.6} />
          </mesh>
          <pointLight ref={lamp} position={[-0.42, 0.5, 0.05]} intensity={7.5} distance={4} decay={2} color="#ffb457" />
        </group>

        {/* ── Minuteur tomate (pomodoro) ─────────────────────── */}
        <group position={[-0.85, 0.16, 0.28]}>
          <mesh scale={[1, 0.82, 1]}>
            <sphereGeometry args={[0.17, 24, 24]} />
            <meshStandardMaterial color="#e23b32" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.16, 0]} rotation-x={0.3}>
            <coneGeometry args={[0.05, 0.1, 8]} />
            <meshStandardMaterial color="#3f9a46" roughness={0.6} />
          </mesh>
          {/* cadran */}
          <mesh position={[0, 0.02, 0.15]} rotation-x={-0.15}>
            <circleGeometry args={[0.1, 24]} />
            <meshStandardMaterial color="#f4efe6" roughness={0.5} />
          </mesh>
          <mesh ref={hand} position={[0, 0.02, 0.151]} rotation-x={-0.15}>
            <planeGeometry args={[0.012, 0.08]} />
            <meshStandardMaterial color="#c0392b" side={2} />
          </mesh>
        </group>

        {/* ── Tasse de café ──────────────────────────────────── */}
        <group position={[0.55, 0.12, 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.09, 0.16, 20]} />
            <meshStandardMaterial color="#e9e3d8" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.02, 20]} />
            <meshStandardMaterial color="#3a2417" roughness={0.3} />
          </mesh>
          <mesh position={[0.13, 0, 0]} rotation-z={Math.PI / 2}>
            <torusGeometry args={[0.05, 0.014, 8, 16]} />
            <meshStandardMaterial color="#e9e3d8" roughness={0.5} />
          </mesh>
        </group>

        {/* ── Pile de livres ─────────────────────────────────── */}
        <group position={[0.78, 0.1, -0.05]}>
          <mesh position={[0, 0, 0]} rotation-y={0.2}>
            <boxGeometry args={[0.4, 0.06, 0.28]} />
            <meshStandardMaterial color="#c0563f" roughness={0.7} />
          </mesh>
          <mesh position={[0.02, 0.07, 0]} rotation-y={-0.15}>
            <boxGeometry args={[0.38, 0.06, 0.26]} />
            <meshStandardMaterial color="#3f6f86" roughness={0.7} />
          </mesh>
          <mesh position={[-0.01, 0.14, 0]} rotation-y={0.08}>
            <boxGeometry args={[0.36, 0.06, 0.26]} />
            <meshStandardMaterial color="#d8a13c" roughness={0.7} />
          </mesh>
        </group>

        {/* ── Petite plante ──────────────────────────────────── */}
        <group position={[-1.0, 0.12, -0.34]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.08, 0.16, 16]} />
            <meshStandardMaterial color="#b06a48" roughness={0.8} />
          </mesh>
          {[[0, 0.18, 0], [0.06, 0.22, 0.03], [-0.05, 0.2, -0.03]].map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshStandardMaterial color="#4c8a5a" roughness={0.8} />
            </mesh>
          ))}
        </group>

        {/* ── Étudiant·e (low-poly, penché·e sur le laptop) ──── */}
        <group position={[-0.1, 0.06, 0.62]} rotation-x={0.28}>
          <mesh position={[0, 0.28, 0]}>
            <capsuleGeometry args={[0.24, 0.28, 6, 14]} />
            <meshStandardMaterial color="#5a5f9c" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.66, -0.08]}>
            <sphereGeometry args={[0.19, 20, 20]} />
            <meshStandardMaterial color="#e7bd94" roughness={0.7} />
          </mesh>
          {/* cheveux / capuche */}
          <mesh position={[0, 0.72, -0.12]} scale={[1, 0.9, 1]}>
            <sphereGeometry args={[0.205, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial color="#3a3358" roughness={0.9} />
          </mesh>
        </group>

        {/* Ombre de contact douce (cheap, pas de shadow map) */}
        <ContactShadows position={[0, -0.35, 0.2]} scale={4} blur={2.6} far={2} opacity={0.5} color="#000000" />
      </group>
    </Float>
  );
}

export default function HeroScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(true);

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
        camera={{ position: [3.6, 2.7, 4.6], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.5} color="#8a90c0" />
        <directionalLight position={[3, 5, 2]} intensity={0.5} color="#cdd6ff" />
        {/* remplissage chaud côté lampe */}
        <pointLight position={[-1.5, 1.2, 1.5]} intensity={3} distance={7} color="#ffb060" />
        <StudyDesk />
      </Canvas>
    </div>
  );
}
