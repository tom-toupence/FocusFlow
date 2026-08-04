"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";

// FOND du landing : la vue « study with me » — on est ASSIS DANS LA CHAMBRE, la
// nuit, devant une fenêtre pleine de pluie ; dehors, la ville est FLOUE, réduite
// à des halos de lumière. Rien ne défile : la scène est immobile, seuls la pluie,
// le scintillement des fenêtres et un phare qui passe en bas donnent de la vie.
//
// Chorégraphie au scroll : « la nuit avance » — les fenêtres de la ville
// s'éteignent une à une, la pluie forcit, la caméra se rapproche imperceptiblement
// de la vitre. (Et non plus « on accélère », qui disait l'inverse du produit.)
//
// ── Pourquoi zéro asset ─────────────────────────────────────────────────────
// Un flou d'arrière-plan détruit tout détail : des modèles texturés y seraient du
// poids pur. Les lumières floues sont des QUADS additifs (une texture générée en
// canvas, 64×64), les immeubles des BOÎTES quasi noires, la pluie un shader. Tout
// est instancié : ~10 draw calls, quelques milliers de triangles, 0 Ko à
// télécharger, aucun post-processing, aucune shadow map.

// Fond lointain : photo de ville de nuit hors focus (Unsplash, Juhee Kim —
// licence Unsplash : usage commercial libre, sans attribution obligatoire).
// Servie via l'optimiseur d'images de Next (WebP/AVIF selon le navigateur,
// ~900 Ko → ~250 Ko, mis en cache à l'edge Vercel) ; repli sur le fichier brut si
// l'optimiseur n'est pas disponible.
const PHOTO_RAW = "/juhee-kim-u_o-Lbx3FUI-unsplash.jpg";
const PHOTO_OPTIMIZED = `/_next/image?url=${encodeURIComponent(PHOTO_RAW)}&w=1920&q=75`;

// Le procédural ne fait plus que ce que la photo ne PEUT pas faire : scintiller,
// s'éteindre quand la nuit avance, et parallaxer devant le fond.
const LIGHTS = 90; // halos proches, en avant de la photo
const BLOCKS = 16; // silhouettes proches (parallaxe)
const STREAKS = 5; // phares qui traversent la rue en contrebas

// Progression du scroll partagée par la scène. Au niveau MODULE : passée en prop,
// elle serait mutée dans useFrame, ce que le compilateur React interdit.
const drive = { progress: 0 };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function useScrollDrive() {
  useEffect(() => {
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      drive.progress = clamp(window.scrollY / max, 0, 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

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

// Tache de bokeh : disque doux avec un léger rebord — c'est ce rebord qui fait
// lire l'image comme « hors focus » plutôt que comme un simple flou.
function makeBokehTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.45, "rgba(255,255,255,0.55)");
    g.addColorStop(0.78, "rgba(255,255,255,0.22)");
    g.addColorStop(0.9, "rgba(255,255,255,0.3)"); // rebord de bokeh
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Fond photographique. Chargé impérativement (pas de Suspense) pour pouvoir
// retomber sur le fichier brut si l'optimiseur d'images n'a pas répondu.
//
// CADRAGE : le plan est assez grand pour couvrir tout ce que la fenêtre laisse
// voir à cette profondeur (≈195×130 à z=−118), et descendu (y=−6) pour que la
// bande lumineuse de la photo tombe dans la MOITIÉ BASSE de l'ouverture — on
// regarde la ville depuis un étage élevé, le ciel noir occupe le haut.
function PhotoBackdrop() {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const done = (t: THREE.Texture) => {
      if (cancelled) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace;
      setTex(t);
    };
    loader.load(PHOTO_OPTIMIZED, done, undefined, () => loader.load(PHOTO_RAW, done));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;

  return (
    <mesh position={[0, -6, -118]}>
      <planeGeometry args={[195, 130]} />
      {/* `fog={false}` : sinon la brume, à 124 unités, effacerait la photo. */}
      <meshBasicMaterial map={tex} fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

// ── Dehors : ville floue ─────────────────────────────────────────────────────

const LIGHT_COLORS = [
  "#ffd9a0", "#ffc178", "#ffe9c4", "#fff2d8", // fenêtres chaudes (la majorité)
  "#ffd9a0", "#ffc178", "#a9c8ff", "#cfe0ff", // quelques néons froids
  "#ff8fb0", "#7fe6d8",                        // deux touches d'enseigne
];

function CityLights() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => makeBokehTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const lastProgress = useRef(-1);

  const lights = useMemo(() => {
    const rnd = mulberry32(9137);
    return Array.from({ length: LIGHTS }, () => {
      // Uniquement des lumières PROCHES : le lointain, c'est la photo.
      const z = -16 - rnd() * 54;
      const depth = (-z - 16) / 54;
      return {
        x: (rnd() - 0.5) * (24 + depth * 34),
        y: 0.6 + rnd() * (8 + depth * 10),
        z,
        size: (0.28 + rnd() * 0.5) * (1 - depth * 0.45),
        color: LIGHT_COLORS[Math.floor(rnd() * LIGHT_COLORS.length)],
        twinkle: 0.4 + rnd() * 2.2,
        phase: rnd() * 7,
        // Seuil d'extinction : la fenêtre s'éteint quand la nuit avance.
        off: 0.35 + rnd() * 1.4,
      };
    });
  }, []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    lights.forEach((l, i) => {
      dummy.position.set(l.x, l.y, l.z);
      dummy.scale.setScalar(l.size);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [lights, dummy]);

  useEffect(() => () => tex.dispose(), [tex]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const p = drive.progress;
    const t = state.clock.elapsedTime;
    // Les couleurs ne sont réécrites que si la nuit a bougé (sinon on scintille
    // seulement, et on évite un upload GPU par frame).
    const moved = Math.abs(p - lastProgress.current) > 0.004;
    if (!moved && lastProgress.current >= 0) return;
    lastProgress.current = p;
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const alive = 1 - clamp((p - l.off + 0.25) / 0.25, 0, 1); // extinction douce
      const flicker = 0.82 + Math.sin(t * l.twinkle + l.phase) * 0.18;
      color.set(l.color).multiplyScalar(alive * flicker);
      m.setColorAt(i, color);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, LIGHTS]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

// Silhouettes : masses sombres qui découpent le ciel et cachent les lumières
// situées derrière — c'est ce qui donne la profondeur, pas le détail.
function Skyline() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const blocks = useMemo(() => {
    const rnd = mulberry32(4021);
    // Une seule rangée, PROCHE : elle sert de repoussoir devant la photo (c'est
    // elle qui crée la parallaxe quand la caméra bouge), pas de décor de fond.
    return Array.from({ length: BLOCKS }, (_, i) => {
      const row = i % 2;
      const z = -22 - row * 14 - rnd() * 10;
      return {
        x: (rnd() - 0.5) * (30 + row * 26),
        w: 3 + rnd() * 7,
        h: 4 + rnd() * (9 + row * 6),
        z,
        shade: 0.03 + row * 0.018, // plus c'est loin, plus la brume l'éclaircit
      };
    });
  }, []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    blocks.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.w, b.h, 3);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, c.setRGB(b.shade * 0.85, b.shade * 0.95, b.shade * 1.6));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [blocks, dummy]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BLOCKS]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// Phares qui traversent la rue en contrebas : une trace allongée et douce, pas
// une voiture — à cette distance et hors focus, c'est ce que l'œil voit.
function TrafficStreaks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => makeBokehTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const streaks = useMemo(() => {
    const rnd = mulberry32(555);
    return Array.from({ length: STREAKS }, (_, i) => ({
      dir: i % 2 === 0 ? 1 : -1,
      y: 0.5 + rnd() * 0.5,
      z: -19 - rnd() * 6,
      speed: 2.4 + rnd() * 2.6,
      offset: rnd() * 24,
      size: 0.5 + rnd() * 0.4,
      warm: i % 2 === 0,
    }));
  }, []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    streaks.forEach((s, i) => m.setColorAt(i, c.set(s.warm ? "#fff0d0" : "#ff6b6b")));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [streaks]);

  useEffect(() => () => tex.dispose(), [tex]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      const span = 30;
      const x = (((t * s.speed + s.offset) % span) - span / 2) * s.dir;
      dummy.position.set(x, s.y, s.z);
      dummy.scale.set(s.size * 4.5, s.size, 1); // étirée = filé de vitesse
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, STREAKS]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

// ── La vitre : pluie procédurale ─────────────────────────────────────────────

const RAIN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Gouttes + traînées, deux couches d'échelles différentes. Rendu en ADDITIF : les
// gouttes « attrapent » la lumière de la ville derrière, ce qui donne le mouillé
// sans passe de réfraction (qui coûterait un render target).
const RAIN_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uTint;

  float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }

  float dropLayer(vec2 uv, float t, vec2 scale, float seed) {
    vec2 st = uv * scale + seed;
    vec2 id = floor(st);
    vec2 f = fract(st) - 0.5;
    float n = hash21(id + seed);
    if (n < 0.42) return 0.0; // toutes les cellules ne portent pas de goutte

    float speed = 0.25 + n * 0.5;
    float y = fract(t * speed + n * 9.7);
    vec2 dp = vec2((n - 0.5) * 0.66, 0.5 - y);

    float d = length((f - dp) * vec2(1.0, 0.82));
    float drop = smoothstep(0.115, 0.02, d);

    // traînée laissée AU-DESSUS de la goutte, qui s'estompe
    float above = f.y - dp.y;
    float trail = smoothstep(0.03, 0.0, abs(f.x - dp.x))
                * step(0.0, above) * (1.0 - smoothstep(0.0, 0.42, above));

    // fines perles résiduelles dans la traînée
    float beads = smoothstep(0.022, 0.0, abs(f.x - dp.x))
                * smoothstep(0.5, 0.0, fract(above * 9.0)) * step(0.0, above) * 0.5;

    return drop + trail * 0.32 + beads * 0.25;
  }

  void main() {
    float t = uTime * 0.35;
    float r = dropLayer(vUv, t, vec2(9.0, 5.0), 0.0)
            + dropLayer(vUv, t * 1.35, vec2(16.0, 9.0), 4.7) * 0.65;

    // buée fixe très légère, pour que la vitre ne soit jamais « vide »
    float mist = hash21(floor(vUv * 220.0)) * 0.035;

    float a = clamp(r * uIntensity + mist, 0.0, 1.0);
    if (a < 0.004) discard;
    gl_FragColor = vec4(uTint * a, a);
  }
`;

function RainGlass() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.85 },
      uTint: { value: new THREE.Color("#cfe0ff") },
    }),
    []
  );
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    // La pluie forcit à mesure que la nuit avance.
    mat.current.uniforms.uIntensity.value = 0.7 + drive.progress * 0.55;
  });
  return (
    <mesh position={[0, 2.1, -0.15]}>
      <planeGeometry args={[13, 8]} />
      <shaderMaterial
        ref={mat}
        vertexShader={RAIN_VERT}
        fragmentShader={RAIN_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Dedans : la chambre, en contre-jour ──────────────────────────────────────

// Tout l'intérieur est une SILHOUETTE quasi noire : à contre-jour d'une fenêtre
// nocturne, c'est exactement ce que l'œil voit — et ça coûte trois fois rien.
function Room() {
  const glow = useRef<THREE.Mesh>(null);
  const lampMat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => makeBokehTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Respiration très lente de la lampe (une lampe ne clignote pas).
    const k = 0.92 + Math.sin(t * 0.7) * 0.05 + drive.progress * 0.12;
    if (glow.current) glow.current.scale.setScalar(3.6 * k);
    if (lampMat.current) lampMat.current.opacity = 0.5 * k;
  });

  const dark = "#04050b";

  return (
    <group>
      {/* Menuiserie de la fenêtre : cadre + croisillons */}
      <group position={[0, 2.1, -0.1]}>
        <mesh position={[0, 3.35, 0]}><boxGeometry args={[13, 1.4, 0.3]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[0, -3.5, 0]}><boxGeometry args={[13, 1.6, 0.45]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[-5.1, 0, 0]}><boxGeometry args={[2.6, 8, 0.3]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[5.1, 0, 0]}><boxGeometry args={[2.6, 8, 0.3]} /><meshBasicMaterial color={dark} /></mesh>
        {/* croisillons */}
        <mesh position={[0, 0, 0.05]}><boxGeometry args={[0.13, 7, 0.16]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[0, 1.1, 0.05]}><boxGeometry args={[8, 0.11, 0.16]} /><meshBasicMaterial color={dark} /></mesh>
      </group>

      {/* Coin bureau, en bas à droite : plan, écran, tasse, lampe, plante */}
      <group position={[3.1, 0, 1.5]}>
        <mesh position={[0, -0.62, 0]}><boxGeometry args={[5, 0.12, 2.2]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[-0.4, -0.16, -0.35]} rotation-x={-0.12}>
          <boxGeometry args={[1.7, 1.05, 0.06]} />
          <meshBasicMaterial color="#080a14" />
        </mesh>
        <mesh position={[-0.4, -0.5, 0.1]}><boxGeometry args={[1.7, 0.05, 0.75]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[0.85, -0.42, 0.25]}><cylinderGeometry args={[0.17, 0.15, 0.28, 12]} /><meshBasicMaterial color={dark} /></mesh>
        {/* lampe : pied, bras, abat-jour lumineux */}
        <mesh position={[1.75, -0.36, -0.3]}><cylinderGeometry args={[0.26, 0.3, 0.1, 14]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[1.75, 0.1, -0.3]} rotation-z={0.22}><cylinderGeometry args={[0.05, 0.05, 1.1, 8]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[1.45, 0.66, -0.3]} rotation-z={-0.5}>
          <coneGeometry args={[0.4, 0.5, 16, 1, true]} />
          <meshBasicMaterial ref={lampMat} color="#ffb765" transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {/* halo chaud de la lampe */}
        <mesh ref={glow} position={[1.4, 0.4, -0.1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} color="#ff9d47" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        {/* plante */}
        <mesh position={[-2.1, -0.4, -0.4]}><cylinderGeometry args={[0.22, 0.18, 0.32, 10]} /><meshBasicMaterial color={dark} /></mesh>
        <mesh position={[-2.1, 0.05, -0.4]}><icosahedronGeometry args={[0.42, 0] as [number, number]} /><meshBasicMaterial color={dark} /></mesh>
      </group>

      {/* Rideau côté gauche, pour cadrer */}
      <mesh position={[-4.6, 2, 1.2]}>
        <planeGeometry args={[2.4, 9]} />
        <meshBasicMaterial color={dark} transparent opacity={0.96} />
      </mesh>
    </group>
  );
}

// Caméra quasi immobile : léger parallaxe au pointeur et rapprochement
// imperceptible de la vitre au fil du scroll. L'immobilité EST le sujet.
function CameraRig() {
  useFrame((state, delta) => {
    const k = Math.min(1, Math.min(delta, 0.05) * 1.8);
    const p = drive.progress;
    const cam = state.camera;
    cam.position.x += (state.pointer.x * 0.32 - cam.position.x) * k;
    cam.position.y += (2.1 + state.pointer.y * 0.16 - cam.position.y) * k;
    cam.position.z += (6.4 - p * 0.9 - cam.position.z) * k;
    cam.lookAt(0, 2.15 - p * 0.15, -6);
  });
  return null;
}

export default function WindowScene({ className }: { className?: string }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  useScrollDrive();

  // On ne coupe le rendu que si l'onglet passe en arrière-plan : le fond doit
  // rester vivant jusqu'en bas de page.
  useEffect(() => {
    const apply = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, []);

  return (
    <div className={cn("absolute inset-0", className)}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.25]}
        camera={{ position: [0, 2.1, 6.4], fov: 46 }}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance", toneMappingExposure: 1 }}
        onCreated={({ gl }) => gl.setClearColor("#04050c")}
      >
        {/* Brume urbaine : elle n'agit que sur le procédural proche (la photo est
            en `fog={false}`), ce qui fond les silhouettes dans le fond. */}
        <fogExp2 attach="fog" args={["#0b1026", 0.0075]} />
        <PhotoBackdrop />
        <Skyline />
        <CityLights />
        <TrafficStreaks />
        <RainGlass />
        <Room />
        <CameraRig />
      </Canvas>
    </div>
  );
}
