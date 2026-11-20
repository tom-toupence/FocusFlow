# Recherche de librairies créatives (recadrage, 2026-11-20)

Méthode : recherche web (Codrops 2025-2026, GitHub topics, CreativeApplications),
puis **vérification sur le registre npm** (`npm view` : version, date de dernière
publication, licence, dépôt) et **lecture de la doc et des types embarqués dans
la version installée** (`node_modules/<lib>/README.md`, `*.d.ts`), parce que ma
mémoire n'est pas fiable sur le récent. Aucune lib payante, aucune clé.

Sources web consultées :
- [Codrops : Exploring Procedural Geometry with Three.js and WebGPU (2026-08)](https://tympanus.net/codrops/2026/08/11/exploring-procedural-geometry-with-three-js-and-webgpu/)
- [Codrops : Interactive Text Destruction with Three.js, WebGPU and TSL (2025-07)](https://tympanus.net/codrops/2025/07/22/interactive-text-destruction-with-three-js-webgpu-and-tsl/)
- [Codrops : Procedural Vortex Inside a Glass Sphere with TSL (2025-03)](https://tympanus.net/codrops/2025/03/10/rendering-a-procedural-vortex-inside-a-glass-sphere-with-three-js-and-tsl/)
- [three.js manual : WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer.html), [TSL docs](https://threejs.org/docs/TSL.html)
- [textmode.js sur CreativeApplications](https://www.creativeapplications.net/news/textmode-js-library-for-dynamic-ascii-art-text-graphics-with-real-time-rendering/)
- [Manifold : intégration three.js](https://manifoldcad.org/three)
- [Liste de frameworks WebGL/WebGPU (dmnsgn)](https://gist.github.com/dmnsgn/76878ba6903cf15789b712464875cfdc)
- [Theatre.js (dépôt)](https://github.com/theatre-js/theatre)

## Tableau

| Lib | Version (npm) | Dernière publication | Licence | Rôle possible | Verdict |
|---|---|---|---|---|---|
| **three** (WebGPURenderer + **TSL**) | 0.187.0 | 2026-10-30 | MIT | 3D modélisée, matériaux en nœuds, repli WebGL2 (`forceWebGL`) | **retenue** (lab) |
| **opentype.js** | 2.0.0 | 2026-05-06 | MIT | lire les contours de glyphes → extrusion de chiffres en vraie géométrie | **retenue** (lab) |
| **@dimforge/rapier3d-compat** | 0.21.0 | 2026-09-25 | Apache-2.0 | physique 3D (WASM inline, `init()` async) | **retenue** (lab) |
| **textmode.js** | 0.18.2 | 2026-10-31 | MIT (dist) | rendu textmode / ASCII temps réel en WebGL2, polices TTF au runtime | **retenue** (lab) ; source TS privée, seule la dist est MIT |
| **paper** (Paper.js) | 0.17.0 | 2026-11-03 | MIT | vectoriel génératif (tracés, booléens 2D) | **retenue** (lab) |
| **postprocessing** (pmndrs) | 6.39.6 | 2026-11-01 | Zlib | passes : `TiltShiftEffect`, `DepthOfFieldEffect`, `SMAAEffect`… | **retenue** (lab) |
| **bpy** (Blender 5.3 en module Python, PyPI) | 5.3.0 | 2026 | GPL (outil, n'est pas livré) | modéliser en script headless, exporter .glb | **retenue** (outil hors bundle) |
| **@gltf-transform/core + functions**, **meshoptimizer** | 4.5.1 / 1.3.0 | 2026-09 | MIT | compression meshopt / quantisation des .glb | **retenue** (outil) |
| **tweakpane** | 4.0.5 | 2024-11 | MIT | réglage en direct dans le lab | retenue, **lab uniquement** |
| **manifold-3d** | 3.5.5 | 2026-11-13 | Apache-2.0 | booléens robustes (WASM) | en réserve |
| **troika-three-text** | 0.53.1 | 2026-11-02 | MIT | texte SDF dans three | en réserve |
| **gpu-curtains** | 0.17.4 | 2026-11-16 | MIT | plans WebGPU synchronisés au DOM | en réserve |
| **@thi.ng/geom** | 8.3.38 | 2026-09 | Apache-2.0 | géométrie générative 2D | en réserve |
| **pixi.js** v8 | 8.23.0 | 2026-11-20 | MIT | 2D WebGPU | écartée (registre 2D déjà couvert par Paper/textmode) |
| **@theatre/core** / studio | 0.7.2 | **2024-05** | Apache-2.0 / **AGPL** (studio) | séquences keyframées | **écartée** : plus de publication depuis 2024, keyframes écrits dans l'éditeur (studio AGPL, inutilisable sans interface). Les séquences seront écrites en code avec `motion` (`animate()` sur des objets JS, `times`, easings nommés) |
| **lygia** | 1.4.1 | 2026-02 | **Prosperity + Patron** | fonctions GLSL | **écartée** : licence non libre (usage commercial soumis à paiement), incompatible avec un projet open source |
| **three-custom-shader-material** | 6.4.0 | 2025-10 | MIT | patch des matériaux three | écartée au profit de TSL natif (même besoin, sans dépendance) |
| **@rive-app/canvas** | 2.52.0 | 2026-11-19 | MIT (runtime) | animations vectorielles d'état | écartée : les fichiers `.riv` se créent dans l'éditeur Rive (outil propriétaire, pas de création en script) |
| **@motion-canvas/core** | 3.17.2 | 2025-02 | MIT | vidéos animées en code | écartée : orientée rendu vidéo, pas UI temps réel |
| **matter-js** | 0.20.0 | 2024-06 | MIT | physique 2D | écartée (Rapier couvre la 3D, plus maintenu) |
| **regl**, **ogl** | 2.1.1 / 1.0.11 | 2024-11 / 2025-01 | MIT / Unlicense | WebGL fonctionnel minimal | écartées : peu actives, three+TSL couvre le besoin |
| **splitting** | 1.1.0 | 2024-05 | MIT | découpe de texte en spans | écartée : découper le texte en lettres animées est un de mes réflexes (R13) |
| **p5** 2.x | 2.4.0 | 2026-11 | LGPL-2.1 | génératif | écartée : LGPL et doublon de Paper/textmode |
| **shader-park-core** | 0.2.8 | 2024-05 | Apache-2.0 | SDF en JS | écartée (peu active) ; le SDF sera écrit à la main si besoin |

## Notes de lecture (doc embarquée)

- **three 0.187** : `three/webgpu` exporte `WebGPURenderer` (option `forceWebGL`
  pour le backend WebGL2, utile en headless et sur navigateurs sans WebGPU),
  `three/tsl` les nœuds ; les matériaux `MeshStandardNodeMaterial` prennent
  `colorNode`, `positionNode`, `normalNode`, `roughnessNode`. `renderer.init()`
  est asynchrone. Builds : `three.webgpu.js`, `three.tsl.js`.
- **opentype.js 2.0** : `opentype.parse(arrayBuffer)` → `Font` ;
  `font.getPath(text, x, y, size)` → `Path` avec `commands` (M, L, Q, C, Z) ;
  WOFF2 non supporté sans décompression (utiliser TTF/OTF/WOFF).
- **Rapier compat 0.21** : `await RAPIER.init()` ; `new World({x,y,z})`,
  `world.step()`, `RigidBodyDesc.dynamic()/fixed()`, `ColliderDesc.cuboid()`,
  `convexHull(Float32Array)` (peut renvoyer `null`), `setRestitution`,
  `setFriction`.
- **textmode.js 0.18** : `textmode.create({ canvas, fontSize, frameRate,
  pixelDensity, fontSource })`, `t.setup()`, `t.draw(cb)`, primitives
  `char()`, `charColor()`, `cellColor()`, `rect(w, h)` positionnées par
  `translate()/push()/pop()`, conversion d'images et de vidéos en glyphes,
  matériaux GLSL ES 3.00, `t.grid` (cols/rows).
- **postprocessing 6.39** : `EffectComposer`, `RenderPass`, `EffectPass`,
  effets disponibles : TiltShift, DepthOfField, Bloom, SMAA, Vignette, Noise,
  ChromaticAberration, ASCII… ; s'utilise avec `WebGLRenderer` (pas le
  renderer WebGPU, qui a son propre pipeline TSL).
