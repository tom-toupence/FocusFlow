// LAB 3 · piste C : 3D temps réel à partir d'assets photoscannés (Poly Haven,
// CC0). Assemblage, éclairage et post-traitement faits ici ; aucune géométrie
// tapée à la main hormis les caissons d'enseigne (boîtes biseautées).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  NoiseEffect, VignetteEffect, ChromaticAberrationEffect, SSAOEffect, NormalPass, BlendFunction, DepthOfFieldEffect,
} from "postprocessing";
import { reportInfo } from "@/lib/lab/LabShell";

const A = "/lab/city/assets";
const W = 4.4; // largeur de la ruelle

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export interface Alley3D { dispose: () => void; halt: (on: boolean) => void }

export async function createAlley3D(canvas: HTMLCanvasElement): Promise<Alley3D> {
  RectAreaLightUniformsLib.init();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false, depth: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // AgX dans le post-traitement
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const fogCol = new THREE.Color("#0a0d12");
  scene.background = fogCol;
  scene.fog = new THREE.FogExp2(fogCol, 0.06);
  // Focale ~35 mm plein format, hauteur d'œil, regard un peu levé, cadre asymétrique.
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  cam.position.set(0.9, 1.62, 3.2);
  const look = new THREE.Vector3(-0.5, 2.6, -18);
  cam.lookAt(look);

  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = (n: string) => gltf.loadAsync(`${A}/${n}.glb`).then((g) => g.scene);
  const [facade, shutterDoor, shutterWin, aircon, fireEscape, gutter, util1, util2, lamp, duct, manhole, trash, hdr] = await Promise.all([
    load("modular_urban_apartments_facade"), load("rollershutter_door"), load("rollershutter_window_01"), load("exterior_aircon_unit"),
    load("modular_fire_escape"), load("modular_metal_gutter"), load("utility_box_01"), load("utility_box_02"), load("street_lamp_02"),
    load("modular_airduct_circular_01"), load("water_manhole_cover"), load("metal_trash_can"),
    new HDRLoader().loadAsync(`${A}/modern_buildings_night_1k.hdr`),
  ]);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;
  scene.environmentIntensity = 0.035;

  // Crépi plus sombre et moins saturé (béton de nuit, pas un enduit méditerranéen).
  facade.traverse((c) => { const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.name?.includes("plaster")) { m.color.set("#5d5a57"); } });
  const byName = (root: THREE.Object3D, name: string) => {
    const o = root.getObjectByName(name);
    if (!o) throw new Error(`pièce manquante : ${name}`);
    return o;
  };
  const place = (src: THREE.Object3D, x: number, y: number, z: number, ry: number) => {
    const o = src.clone(true);
    o.position.set(x, y, z);
    o.rotation.set(0, ry, 0);
    o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(o);
    return o;
  };

  // Fenêtres allumées : on duplique le verre avec une émission chaude/froide.
  const glassLit = (col: string, k: number) => new THREE.MeshStandardMaterial({ color: "#111", emissive: new THREE.Color(col), emissiveIntensity: k, roughness: 0.25 });
  const litWarm = glassLit("#ffb36b", 1.4), litCold = glassLit("#cfe3ff", 1.1), litGreen = glassLit("#53e0a1", 1.6);

  // ── Façades : deux rangées de modules face à face, 4 étages ───────────
  const r = rng(7);
  const UP = [["wall_window_centered_large_0", "window_centered_large_0"], ["wall_window_centered_double_0", "window_centered_double_0"], ["wall_window_offset_small_0", "window_offset_small_0"], ["wall_window_centered_small_0", "window_centered_small_0"]];
  const GROUND = [["wall_door_centered_large_01", "door_centered_large_01"], ["wall_door_offset_small_01", "door_offset_small_01"], ["wall_door_centered_small_01", "door_centered_small_01"], ["wall_standard_standard_01", ""]];
  const lampPos: THREE.Vector3[] = [];
  for (const side of [-1, 1]) {
    const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let i = 0; i < 9; i++) {
      // Gauche : le module occupe [z, z+3] ; droite : [z-3, z].
      const z = side < 0 ? -3 * (i + 1) + 6 : -3 * i + 6;
      const x = side * W / 2;
      const g = GROUND[Math.floor(r() * GROUND.length)];
      place(byName(facade, g[0]), x, 0, z, ry);
      if (g[1]) place(byName(facade, g[1]), x, 0, z, ry);
      else {
        // Pan aveugle : un rideau métallique de boutique fermée.
        const sh = place(r() > 0.5 ? shutterDoor.children[0] : shutterWin.children[0], 0, 0, 0, ry);
        sh.position.set(x - side * 0.05, 0, z + (side < 0 ? 1.5 : -1.5));
      }
      place(byName(facade, "base_standard_01"), x, 0, z, ry);
      for (let f = 1; f <= 3; f++) {
        const v = UP[Math.floor(r() * UP.length)];
        const n = f === 3 ? 3 : f; // variantes d'étage _01 _02 _03
        place(byName(facade, v[0] + n), x, 3 * f, z, ry);
        const win = place(byName(facade, v[1] + n), x, 3 * f, z, ry);
        // Une fenêtre sur trois est allumée (plus rare en haut), quelques amis en vert.
        if (r() < 0.38 - f * 0.05) {
          const m = r() < 0.12 ? litGreen : r() < 0.6 ? litWarm : litCold;
          win.traverse((c) => { const mm = c as THREE.Mesh; if (mm.isMesh && (mm.material as THREE.Material).name.includes("glass")) mm.material = m; });
        }
        place(byName(facade, "cornice_standard_standard_01"), x, 3 * f - 0.2, z, ry);
        // Climatiseurs accrochés sous les fenêtres.
        if (r() < 0.35) {
          const ac = place(aircon.children[Math.floor(r() * 2)], x + side * -0.22, 3 * f + 0.1, z + (side < 0 ? 0.6 + r() * 1.6 : -0.6 - r() * 1.6), ry);
          ac.scale.setScalar(0.9);
        }
      }
      place(byName(facade, "crown_standard_standard_01"), x, 12, z, ry);
    }
  }
  // Escalier de secours, gouttières, boîtiers, poubelles, plaque d'égout.
  place(fireEscape, W / 2 - 0.7, 3.0, -9, -Math.PI / 2).scale.setScalar(0.95);
  for (const z of [0.2, -8.8, -17.8]) { const gu = place(byName(gutter, "modular_metal_gutter_section"), -W / 2 + 0.12, 0, z, 0); gu.scale.set(1, 12, 1); }
  place(util1, -W / 2 + 0.25, 0.9, -1.8, Math.PI / 2);
  place(util2, W / 2 - 0.25, 0.4, -4.4, -Math.PI / 2);
  place(byName(trash, "metal_trash_can_rust"), W / 2 - 0.45, 0, 0.6, -0.4);
  place(byName(trash, "metal_trash_can"), W / 2 - 0.5, 0, 1.3, 0.2);
  place(byName(manhole, "water_manhole_cover_frame"), 0.3, 0.005, -3.5, 0.3);
  place(byName(manhole, "water_manhole_cover"), 0.3, 0.012, -3.5, 0.3);
  place(byName(duct, "modular_airduct_circular_triple"), -W / 2 + 0.3, 4.6, -6, 0);

  // ── Lumières dirigées ────────────────────────────────────────────────
  // Clé : applique murale au sodium (ombre portée), côté gauche.
  const wallLamp = place(lamp, -W / 2 + 0.02, 3.4, -2.5, Math.PI / 2);
  wallLamp.scale.setScalar(0.8);
  const sodium = new THREE.PointLight("#ff9a3c", 9, 12, 2);
  sodium.position.set(-W / 2 + 0.55, 3.1, -2.5);
  sodium.castShadow = true;
  sodium.shadow.mapSize.set(1024, 1024);
  sodium.shadow.bias = -0.002;
  scene.add(sodium);
  lampPos.push(sodium.position);
  // Remplissage froid : une supérette ouverte, sa vitrine éclaire la ruelle.
  const shop = new THREE.RectAreaLight("#e6f3ff", 4, 2.4, 2.4);
  shop.position.set(W / 2 - 0.05, 1.3, -6.5);
  shop.lookAt(-W / 2, 1.0, -6.5);
  scene.add(shop);
  // Contre-jour : le carrefour au bout de la ruelle, chaud et lointain.
  const back = new THREE.PointLight("#ffcf9a", 25, 30, 1.6);
  back.position.set(0.5, 4.5, -26);
  scene.add(back);

  // ── Enseignes : caissons biseautés, face émissive, débord sur le mur ──
  const signs: { mats: THREE.MeshStandardMaterial[]; light: THREE.RectAreaLight; base: number; k: { v: number } }[] = [];
  const makeSign = (word: string, col: string, side: number, y: number, z: number, wv = 0.9, hv = 2.2) => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = Math.round(256 * hv / wv);
    const x = c.getContext("2d")!;
    x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    // Diffusion du plexiglas : centre plus lumineux, bords plus sombres.
    const g = x.createRadialGradient(c.width / 2, c.height / 2, 10, c.width / 2, c.height / 2, c.height * 0.7);
    g.addColorStop(0, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(0,0,0,0.35)");
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#14100c";
    x.textAlign = "center"; x.textBaseline = "middle";
    const letters = word.split("");
    const sz = Math.min(c.width * 0.62, (c.height * 0.86) / letters.length);
    x.font = `800 ${sz}px ${getComputedStyle(document.documentElement).getPropertyValue("--font-signage") || "sans-serif"}`;
    letters.forEach((l, i) => x.fillText(l, c.width / 2, c.height / 2 + (i - (letters.length - 1) / 2) * sz * 1.02));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 1.2, roughness: 0.4 });
    const frame = new THREE.MeshStandardMaterial({ color: "#1a1b1e", roughness: 0.45, metalness: 0.6 });
    // Les faces latérales du caisson (±x local) portent le visuel.
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.2, hv, wv, 3, 0.03), [face, face, frame, frame, frame, frame]);
    box.castShadow = true;
    const grp = new THREE.Group();
    grp.add(box);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.06, 0.5, 2, 0.01), frame);
    arm.position.set(0, hv / 2 - 0.12, side * 0.5); grp.add(arm);
    grp.rotation.y = Math.PI / 2;
    grp.position.set(side * (W / 2 - 0.55), y, z);
    scene.add(grp);
    // Le caisson éclaire le mur et le sol autour de lui.
    const light = new THREE.RectAreaLight(col, 1.6, hv * 0.9, wv * 0.9);
    light.position.copy(grp.position).add(new THREE.Vector3(-side * 0.15, 0, 0));
    light.lookAt(side * W, y - 0.5, z);
    scene.add(light);
    signs.push({ mats: [face], light, base: 1.6, k: { v: 1 } });
  };
  makeSign("BAR", "#ffb064", -1, 2.9, -4.2);
  makeSign("NOODLES", "#f2f6ff", 1, 3.3, -8.5, 0.8, 2.9);
  makeSign("OPEN", "#53e0a1", -1, 2.6, -11);
  makeSign("HOTEL", "#ff5a4a", 1, 4.4, -14, 0.8, 2.4);
  makeSign("24H", "#ffd36b", -1, 3.1, -17, 0.8, 1.6);

  // ── Sol : asphalte PBR + flaques (rugosité très basse) au-dessus d'un miroir ──
  const tl = new THREE.TextureLoader();
  const tx = (n: string, srgb = false) => {
    const t = tl.load(`${A}/asphalt_${n}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 18);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const mirror = new Reflector(new THREE.PlaneGeometry(W, 40), { textureWidth: 512, textureHeight: 1024, color: 0x3a3f46, clipBias: 0.002 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -0.002, -12);
  scene.add(mirror);
  const groundMat = new THREE.MeshStandardMaterial({ map: tx("Diffuse", true), normalMap: tx("nor_gl"), roughnessMap: tx("Rough"), aoMap: tx("AO"), transparent: true, color: "#3a3d42" });
  // Flaques : bruit dans le shader, l'asphalte devient transparent (on voit le
  // miroir) et lisse là où l'eau stagne.
  groundMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vWp;
float ph(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(ph(i),ph(i+vec2(1,0)),f.x),mix(ph(i+vec2(0,1)),ph(i+vec2(1,1)),f.x),f.y);}
float puddle(){return smoothstep(0.48,0.62,pn(vWp.xz*0.55)*0.65+pn(vWp.xz*2.1)*0.35);}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor * 0.55, 0.04, puddle());")
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.a = mix(0.97, 0.18, puddle());");
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, 40), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -12);
  ground.receiveShadow = true;
  scene.add(ground);

  // ── Pluie : traits étirés, visibles seulement près des sources ───────
  const N = 2400;
  const rg = new THREE.InstancedBufferGeometry();
  const st = new THREE.PlaneGeometry(0.006, 0.42);
  rg.index = st.index; rg.setAttribute("position", st.attributes.position); rg.setAttribute("uv", st.attributes.uv);
  const off = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) off.set([(r() - 0.5) * W, r() * 9, 4 - r() * 26], i * 3);
  rg.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
  rg.instanceCount = N;
  const rainU = { uTime: { value: 0 }, uL: { value: [sodium.position, shop.position, new THREE.Vector3(-2, 2.9, -4.2), new THREE.Vector3(0.5, 4.5, -26)] }, uA: { value: 1 } };
  const rain = new THREE.Mesh(rg, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; uniform vec3 uL[4]; attribute vec3 aOff; varying float vA; varying vec2 vUv;
      void main(){ vec3 p=aOff; p.y=mod(aOff.y-uTime*8.5,9.0); p.x+=p.y*0.04;
        float l=0.0; for(int i=0;i<4;i++){ float d=distance(p,uL[i]); l+= (i==3?6.0:2.2)/(1.0+d*d*(i==3?0.02:0.6)); }
        vA=clamp(l,0.0,1.4); vUv=uv; gl_Position=projectionMatrix*viewMatrix*vec4(p+position,1.0);} `,
    fragmentShader: `uniform float uA; varying float vA; varying vec2 vUv; void main(){ float s=smoothstep(0.0,0.4,vUv.y)*smoothstep(1.0,0.6,vUv.y); gl_FragColor=vec4(vec3(0.8,0.85,0.95), s*vA*0.32*uA);} `,
  }));
  scene.add(rain);

  // ── Post-traitement : AO, bloom sélectif (seuil), AgX, DoF léger, grain ──
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, cam));
  const normalPass = new NormalPass(scene, cam);
  composer.addPass(normalPass);
  const ssao = new SSAOEffect(cam, normalPass.texture, { blendFunction: BlendFunction.MULTIPLY, samples: 12, rings: 4, radius: 0.08, intensity: 2.2, luminanceInfluence: 0.6, worldDistanceThreshold: 18, worldDistanceFalloff: 4, worldProximityThreshold: 0.6, worldProximityFalloff: 0.3 });
  const bloom = new BloomEffect({ luminanceThreshold: 0.9, luminanceSmoothing: 0.25, intensity: 1.1, mipmapBlur: true, radius: 0.72 });
  const dof = new DepthOfFieldEffect(cam, { focusDistance: 0.0, focalLength: 0.05, bokehScale: 1.6 });
  dof.target = new THREE.Vector3(0, 2, -6);
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const noise = new NoiseEffect({ premultiply: true }); noise.blendMode.opacity.value = 0.18;
  const vig = new VignetteEffect({ darkness: 0.55, offset: 0.3 });
  const ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0004), radialModulation: true, modulationOffset: 0.4 });
  composer.addPass(new EffectPass(cam, ssao, dof));
  composer.addPass(new EffectPass(cam, bloom));
  composer.addPass(new EffectPass(cam, ca, tone, noise, vig));

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    cam.aspect = w / h; cam.fov = w / h < 1 ? 58 : 38; cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  const t0 = performance.now();
  let frame = 0;
  renderer.setAnimationLoop(() => {
    const c0 = performance.now(), t = (c0 - t0) / 1000;
    rainU.uTime.value = t;
    // Respiration de caméra très lente.
    cam.position.y = 1.62 + Math.sin(t * 0.7) * 0.012;
    cam.lookAt(look);
    for (const s of signs) { s.light.intensity = s.base * s.k.v; s.mats.forEach((m) => (m.emissiveIntensity = 1.2 * (0.05 + 0.95 * s.k.v))); }
    composer.render();
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - c0).toFixed(2), triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
  });

  return {
    halt: (on) => { signs.forEach((s, i) => setTimeout(() => (s.k.v = on ? 0 : 1), i * 300)); },
    dispose: () => { renderer.setAnimationLoop(null); ro.disconnect(); composer.dispose(); renderer.dispose(); },
  };
}
