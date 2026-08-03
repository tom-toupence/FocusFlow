"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import type { Mesh } from "three";
import { cn } from "@/lib/utils";

// Hero 3D du landing (React Three Fiber). Une « flow orb » émissive qui se
// déforme et flotte, un champ d'étincelles pour la profondeur, un éclairage
// bi-teinte indigo/magenta, et un léger parallax au pointeur. Le rendu se met en
// pause hors-viewport / onglet caché (frameloop). Le repli reduced-motion / pas
// de WebGL est géré par le parent (qui ne monte pas ce composant du tout).

function FlowOrb() {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.12;
    ref.current.rotation.z = t * 0.04;
  });
  return (
    <Float speed={1.1} rotationIntensity={0.35} floatIntensity={0.5}>
      <mesh ref={ref} scale={1.55}>
        <icosahedronGeometry args={[1, 5]} />
        <MeshDistortMaterial
          color="#3b2fb0"
          emissive="#6d28d9"
          emissiveIntensity={0.5}
          roughness={0.22}
          metalness={0.55}
          distort={0.38}
          speed={1.5}
        />
      </mesh>
    </Float>
  );
}

// Parallax : la caméra suit doucement le pointeur.
function Rig() {
  useFrame((state) => {
    const { pointer, camera } = state;
    camera.position.x += (pointer.x * 1.1 - camera.position.x) * 0.03;
    camera.position.y += (pointer.y * 0.7 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function HeroScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setFrameloop(visibleRef.current && !document.hidden ? "always" : "never");
    const io = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; apply(); }, { threshold: 0.01 });
    io.observe(el);
    document.addEventListener("visibilitychange", apply);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", apply); };
  }, []);

  return (
    <div ref={wrapRef} className={cn("absolute inset-0", className)}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <fog attach="fog" args={["#0a0a0c", 4.5, 13]} />
        <ambientLight intensity={0.55} />
        <pointLight position={[5, 4, 5]} intensity={55} color="#818cf8" />
        <pointLight position={[-5, -3, 3]} intensity={40} color="#e879f9" />
        <FlowOrb />
        <Sparkles count={110} scale={[11, 7, 5]} size={2.4} speed={0.28} opacity={0.45} color="#a5b4fc" />
        <Rig />
      </Canvas>
    </div>
  );
}
