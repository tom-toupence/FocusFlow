"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, Environment, useGLTF, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
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

// ⚠️ Étalonnage nocturne : les murs sont un gris FROID et sombre. Une teinte
// crème, multipliée par une lumière chaude, donne le beige d'une chambre
// d'hôpital en plein jour — l'erreur du premier jet. La nuit, une pièce est
// sombre à 80 %, et seules quelques flaques de lumière la sculptent.
const WALL = "#9aa0ad";
const FLOOR = "#6f7480";

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
        <meshStandardMaterial color={FLOOR} roughness={0.62} />
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

      <Desk />
      {/* Mobilier Poly Haven (CC0), à l'échelle réelle */}
      <Prop url="/models/ArmChair_01/ArmChair_01_1k.gltf" position={[-0.35, 0, -0.75]} rotationY={Math.PI - 0.32} />
      <Prop url="/models/desk_lamp_arm_01/desk_lamp_arm_01_1k.gltf" position={[0.66, 0.74, -2.02]} rotationY={-2.1} />
    </group>
  );
}

// Le bureau : géométrie simple, mais MATIÈRES RÉELLES — les cartes PBR viennent
// du modèle Poly Haven (bois massif : couleur, normales, rugosité). C'est le
// bon compromis quand l'asset existant n'est pas à la bonne échelle : on garde
// ses textures, on refait la forme.
function Desk() {
  const tex = useTexture({
    map: "/models/WoodenTable_02/textures/WoodenTable_02_diff_1k.jpg",
    normalMap: "/models/WoodenTable_02/textures/WoodenTable_02_nor_gl_1k.jpg",
    roughnessMap: "/models/WoodenTable_02/textures/WoodenTable_02_arm_1k.jpg",
  });

  // On travaille sur des CLONES : les textures renvoyées par `useTexture` sont
  // mises en cache par drei et muter un retour de hook est interdit par le
  // compilateur React. Le clone partage l'image, il ne coûte qu'un upload GPU.
  const mats = useMemo(() => {
    const out: Record<string, THREE.Texture> = {};
    for (const [key, t] of Object.entries(tex)) {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(2.2, 1);
      if (key === "map") c.colorSpace = THREE.SRGBColorSpace;
      c.needsUpdate = true;
      out[key] = c;
    }
    return out as { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
  }, [tex]);

  const TOP_Y = 0.74;
  const W = 1.75;
  const D = 0.72;

  return (
    <group position={[0.05, 0, -1.86]}>
      {/* Plateau */}
      <mesh position={[0, TOP_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, 0.045, D]} />
        <meshStandardMaterial {...mats} roughness={0.75} metalness={0.02} />
      </mesh>
      {/* Joues latérales pleines : elles créent l'ombre franche sous le plateau */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (W - 0.06)) / 2, TOP_Y / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.045, TOP_Y, D - 0.06]} />
          <meshStandardMaterial {...mats} roughness={0.78} metalness={0.02} />
        </mesh>
      ))}
      {/* Fond de caisson, pour que le dessous ne soit pas traversant */}
      <mesh position={[0, TOP_Y - 0.34, -D / 2 + 0.05]} receiveShadow>
        <boxGeometry args={[W - 0.12, 0.5, 0.03]} />
        <meshStandardMaterial {...mats} roughness={0.8} />
      </mesh>
    </group>
  );
}

// Charge un glTF Poly Haven et active les ombres sur tous ses maillages.
function Prop({ url, position, rotationY = 0, scale = 1 }: { url: string; position: [number, number, number]; rotationY?: number; scale?: number }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={cloned} position={position} rotation-y={rotationY} scale={scale} />;
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
      {/* Le ciel urbain qui entre par la vitre : FROID, et seule vraie source
          générale de la pièce. */}
      <rectAreaLight
        position={[0, 1.75, -2.34]}
        rotation={[0, Math.PI, 0]}
        width={2.7}
        height={1.6}
        intensity={2.8}
        color="#7d97e8"
      />
      {/* Clair de lune rasant : il ne sert QU'À projeter la croix des meneaux
          sur le sol. Froid et faible — c'est un accent, pas un éclairage. */}
      <directionalLight
        ref={dir}
        position={[-2.2, 4.2, -8]}
        intensity={0.9}
        color="#aebfff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />
      {/* Rebond minimal : juste de quoi ne pas boucher les noirs */}
      <ambientLight intensity={0.045} color="#6f80ad" />
      {/* Lampe de bureau : lumière CONTENUE sur le plateau (portée courte).
          ⚠️ SURTOUT PAS de `castShadow` ici : l'ombre d'une lumière ponctuelle
          est une shadow map CUBE — la scène est rendue 6 fois de plus par
          frame. C'était la cause principale des ralentissements. */}
      <pointLight position={[0.6, 1.06, -1.86]} intensity={1.1} distance={1.9} decay={2} color="#ffb066" />
      {/* Débord infime, pour que le halo ne s'arrête pas net */}
      <pointLight position={[0.5, 1.3, -1.6]} intensity={0.25} distance={3.2} decay={2} color="#ff9d4d" />
    </>
  );
}

// Les ombres portées ne changent JAMAIS (aucun objet ne bouge, et la lumière non
// plus) : on les calcule sur les premières frames, puis on gèle la shadow map.
// three la recalcule sinon à chaque frame, pour rien.
function FreezeShadows() {
  const done = useRef(0);
  useFrame((state) => {
    if (done.current > 3) return;
    done.current += 1;
    if (done.current === 3) {
      state.gl.shadowMap.autoUpdate = false;
      state.gl.shadowMap.needsUpdate = true;
    }
  });
  return null;
}

// Léger flottement de caméra : une caméra tenue à la main ne se fige jamais.
function CameraBreath() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Reculée et abaissée : on voit le sol (donc la croix d'ombre) et le volume
    // du bureau, au lieu d'être collé au mur de façade.
    state.camera.position.x = 0.55 + Math.sin(t * 0.18) * 0.04;
    state.camera.position.y = 1.18 + Math.sin(t * 0.24) * 0.02;
    state.camera.lookAt(-0.1, 1.32, -2.6);
  });
  return null;
}

export default function RoomScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");

  // On ne rend que si l'onglet est visible ET qu'on est encore sur le hero :
  // une fois la page défilée, la scène est masquée par le contenu, la calculer
  // est du gaspillage pur.
  useEffect(() => {
    let raf = 0;
    const apply = () =>
      setFrameloop(document.hidden || window.scrollY > window.innerHeight * 1.15 ? "never" : "always");
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
    <div className={cn("absolute inset-0 bg-[#05060a]", className)}>
      <Canvas
        shadows
        frameloop={frameloop}
        // DPR plafonné à 1,25 : sur un écran dense, 1,5 c'est déjà 2,25× les
        // pixels à calculer, effets compris.
        dpr={[1, 1.25]}
        performance={{ min: 0.5 }}
        camera={{ position: [0.55, 1.18, 2.35], fov: 46 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          {/* La ville de nuit sert à la fois de lumière et de vue par la fenêtre */}
          {/* L'HDRI n'éclaire que faiblement (sinon elle lave les murs), mais la
              ville derrière la vitre reste VIVE : c'est cet écart qui fait la
              nuit — dehors brille, dedans est sombre.
              `backgroundBlurriness` donne le bokeh de la ville UNE FOIS pour
              toutes, au chargement : ça remplace la passe de profondeur de champ
              qui coûtait, elle, à chaque frame. */}
          <Environment
            files="/hdri/hansaplatz_1k.hdr"
            background
            backgroundBlurriness={0.34}
            environmentIntensity={0.22}
            backgroundIntensity={1.35}
          />
          <Lighting />
          <Room />
          <CameraBreath />
          <FreezeShadows />
          {/* Baisse automatiquement la résolution de rendu si la machine peine */}
          <AdaptiveDpr pixelated />

          {/* MSAA retiré (`multisampling={0}`) : sur un buffer plein écran c'est
              très cher, et le grain + le flou du fond masquent l'aliasing. */}
          <EffectComposer multisampling={0}>
            {/* L'occlusion ambiante : c'est elle qui « pose » les volumes.
                Seul effet coûteux conservé — en demi-résolution et en qualité
                « performance », car c'est lui qui porte le réalisme. */}
            <N8AO aoRadius={0.6} intensity={2.4} distanceFalloff={0.8} quality="performance" halfRes />
            <Bloom intensity={0.32} luminanceThreshold={0.9} luminanceSmoothing={0.3} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.32} darkness={0.72} />
            <Noise opacity={0.035} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
