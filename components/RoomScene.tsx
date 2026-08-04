"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { cn } from "@/lib/utils";

// ÉTAPE 0 — « la boîte blanche ».
//
// Une pièce VIDE, sans mobilier ni texture : uniquement des murs blancs, une
// fenêtre percée, et l'éclairage. C'est le test décisif du réalisme, et c'est
// précisément ce qui manquait à toutes les tentatives précédentes — elles
// dessinaient des objets sans jamais calculer la lumière.
//
// Les cinq leviers, par ordre d'impact :
//   1. HDRI (`<Environment>`) — la lumière et les reflets viennent d'une vraie
//      capture de ville de nuit (Poly Haven, CC0). C'est 80 % du résultat.
//   2. Ombres portées — le soleil rasant traverse le percement et projette la
//      CROIX DES MENEAUX sur le sol. Ce détail-là, à lui seul, dit « pièce ».
//   3. N8AO — l'occlusion ambiante noircit les angles et les contacts. Sans
//      elle, tout flotte.
//   4. Depth of field — le flou d'avant-plan, signature photographique.
//   5. Tone mapping ACES + bloom + vignette + grain — la finition « caméra ».
//
// Unités : le mètre. La pièce fait 5 × 3 × 4,5 m, la caméra est à hauteur d'œil
// assise (1,25 m). Respecter l'échelle réelle est ce qui rend l'éclairage et la
// profondeur de champ crédibles.

RectAreaLightUniformsLib.init();

const WALL = "#d8d4cd"; // blanc cassé (un blanc pur crame en ACES)

function Room() {
  const W = 5;
  const H = 3;
  const D = 4.5;
  const T = 0.25; // épaisseur des murs
  // Percement de la fenêtre
  const OX = 1.35; // demi-largeur
  const OY0 = 0.95; // hauteur d'appui
  const OY1 = 2.55; // hauteur de linteau

  const wall = <meshStandardMaterial color={WALL} roughness={0.92} metalness={0} />;

  return (
    <group>
      {/* Sol */}
      <mesh position={[0, -T / 2, 0]} receiveShadow>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial color="#b9b2a8" roughness={0.75} />
      </mesh>
      {/* Plafond */}
      <mesh position={[0, H + T / 2, 0]} receiveShadow>
        <boxGeometry args={[W, T, D]} />
        {wall}
      </mesh>
      {/* Murs latéraux */}
      <mesh position={[-W / 2 - T / 2, H / 2, 0]} receiveShadow>
        <boxGeometry args={[T, H, D]} />
        {wall}
      </mesh>
      <mesh position={[W / 2 + T / 2, H / 2, 0]} receiveShadow>
        <boxGeometry args={[T, H, D]} />
        {wall}
      </mesh>
      {/* Mur du fond (derrière la caméra) : il renvoie la lumière */}
      <mesh position={[0, H / 2, D / 2 + T / 2]} receiveShadow>
        <boxGeometry args={[W, H, T]} />
        {wall}
      </mesh>

      {/* Mur de façade, PERCÉ : quatre volumes autour de l'ouverture. Les joues
          de l'embrasure sont de vraies épaisseurs → vraie occlusion, vraie ombre. */}
      <group position={[0, 0, -D / 2 - T / 2]}>
        <mesh position={[-(W / 2 + OX) / 2, H / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[W / 2 - OX, H, T]} />
          {wall}
        </mesh>
        <mesh position={[(W / 2 + OX) / 2, H / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[W / 2 - OX, H, T]} />
          {wall}
        </mesh>
        {/* allège */}
        <mesh position={[0, OY0 / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[OX * 2, OY0, T]} />
          {wall}
        </mesh>
        {/* linteau */}
        <mesh position={[0, (OY1 + H) / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[OX * 2, H - OY1, T]} />
          {wall}
        </mesh>
        {/* Tablette d'appui, qui déborde dans la pièce */}
        <mesh position={[0, OY0 + 0.02, T / 2 + 0.06]} receiveShadow castShadow>
          <boxGeometry args={[OX * 2 + 0.16, 0.04, T + 0.14]} />
          <meshStandardMaterial color="#c9c3b8" roughness={0.6} />
        </mesh>

        {/* Menuiserie : dormant + meneau + traverse. C'est elle qui découpe la
            lumière en croix sur le sol. */}
        <group position={[0, 0, 0]}>
          {[
            { p: [0, OY0 + 0.03, 0] as const, s: [OX * 2, 0.06, 0.08] as const },
            { p: [0, OY1 - 0.03, 0] as const, s: [OX * 2, 0.06, 0.08] as const },
            { p: [-OX + 0.03, (OY0 + OY1) / 2, 0] as const, s: [0.06, OY1 - OY0, 0.08] as const },
            { p: [OX - 0.03, (OY0 + OY1) / 2, 0] as const, s: [0.06, OY1 - OY0, 0.08] as const },
            { p: [0, (OY0 + OY1) / 2, 0] as const, s: [0.05, OY1 - OY0, 0.07] as const }, // meneau
            { p: [0, OY0 + (OY1 - OY0) * 0.62, 0] as const, s: [OX * 2, 0.05, 0.07] as const }, // traverse
          ].map((b, i) => (
            <mesh key={i} position={b.p} castShadow receiveShadow>
              <boxGeometry args={b.s} />
              <meshStandardMaterial color="#3a3733" roughness={0.55} metalness={0.05} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Un volume témoin : c'est lui qui montre l'ombre de contact et l'AO. */}
      <mesh position={[0.15, 0.37, -1.05]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.74, 0.7]} />
        <meshStandardMaterial color="#a89b8a" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Lumière : une nappe rectangulaire dans le plan de la vitre (le ciel qui entre)
// + une directionnelle rasante qui projette la croix des meneaux sur le sol.
function Lighting() {
  const dir = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    if (dir.current) dir.current.target.position.set(0, 0.4, 0.6);
    dir.current?.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <rectAreaLight
        position={[0, 1.75, -2.34]}
        rotation={[0, Math.PI, 0]}
        width={2.7}
        height={1.6}
        intensity={5.5}
        color="#9fb6ff"
      />
      <directionalLight
        ref={dir}
        position={[-2.2, 4.2, -8]}
        intensity={2.6}
        color="#ffd0a0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />
      {/* Rebond très doux depuis l'intérieur, pour que les ombres ne soient pas noires */}
      <ambientLight intensity={0.12} color="#8ea0c8" />
    </>
  );
}

// Léger flottement de caméra : une caméra tenue à la main ne se fige jamais.
function CameraBreath() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    state.camera.position.x = 0.25 + Math.sin(t * 0.18) * 0.035;
    state.camera.position.y = 1.26 + Math.sin(t * 0.24) * 0.018;
    state.camera.lookAt(0, 1.5, -2.6);
  });
  return null;
}

export default function RoomScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  useEffect(() => {
    const apply = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, []);

  return (
    <div className={cn("absolute inset-0 bg-[#05060a]", className)}>
      <Canvas
        shadows
        frameloop={frameloop}
        dpr={[1, 1.5]}
        camera={{ position: [0.25, 1.26, 1.15], fov: 50 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          {/* La ville de nuit sert à la fois de lumière et de vue par la fenêtre */}
          <Environment files="/hdri/hansaplatz_1k.hdr" background environmentIntensity={0.55} backgroundIntensity={0.7} />
          <Lighting />
          <Room />
          <CameraBreath />

          <EffectComposer multisampling={4}>
            {/* L'occlusion ambiante : c'est elle qui « pose » les volumes */}
            <N8AO aoRadius={0.65} intensity={2.6} distanceFalloff={0.8} quality="medium" halfRes />
            {/* Mise au point sur le bureau, la fenêtre part en flou */}
            <DepthOfField focusDistance={0.012} focalLength={0.045} bokehScale={4} />
            <Bloom intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.3} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.32} darkness={0.72} />
            <Noise opacity={0.035} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
