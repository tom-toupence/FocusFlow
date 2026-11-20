// LAB 2 · Chiffres physiques (opentype.js + Rapier + three WebGLRenderer)
//
// Direction : jouet de construction Bauhaus, couleurs primaires franches sur
// fond os, caméra orthographique en axonométrie, ombres portées nettes.
// Le temps restant est écrit en CHIFFRES PLEINS, extrudés depuis les contours
// réels d'une police (Archivo Black, OFL) : vraie géométrie, pas du texte.
// Chaque minute, le chiffre qui change bascule du socle et tombe ; le nouveau
// tombe d'en haut et rebondit. Fin de pomodoro : tout le socle s'effondre en
// tas (physique Rapier). Distraction : une secousse du socle.
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { parse, type Font } from "opentype.js";
import { reportInfo } from "@/lib/lab/LabShell";

const COLORS = ["#2440c8", "#e8432a", "#f3b51b", "#1b1b1b"];
const SIZE = 1.6;
const DEPTH = 0.55;


/** Contour de glyphe opentype → formes three (trous gérés par toShapes). */
function glyphGeometry(font: Font, ch: string) {
  const path = font.getPath(ch, 0, 0, SIZE);
  const sp = new THREE.ShapePath();
  for (const c of path.commands) {
    // opentype a l'axe y vers le bas (canvas) : on le retourne.
    if (c.type === "M") sp.moveTo(c.x, -c.y);
    else if (c.type === "L") sp.lineTo(c.x, -c.y);
    else if (c.type === "Q") sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === "C") sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  const shapes = sp.toShapes(); // three 0.187 : règle pair-impair, trous détectés seuls
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: DEPTH, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.025, bevelSegments: 3, curveSegments: 10,
  });
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  // Centre géométrique à l'origine (corps rigide centré).
  g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2);
  g.computeVertexNormals();
  return g;
}

export interface BlocksScene {
  setMinutes: (m: number) => void;
  collapse: () => void;
  reset: (m: number) => void;
  shake: () => void;
  dispose: () => void;
}

export async function createBlocks(canvas: HTMLCanvasElement): Promise<BlocksScene> {
  await RAPIER.init();
  const buf = await fetch("/lab/fonts/ArchivoBlack.ttf").then((r) => r.arrayBuffer());
  const font = parse(buf);
  const geos = new Map<string, THREE.ExtrudeGeometry>();
  const geo = (ch: string) => {
    if (!geos.has(ch)) geos.set(ch, glyphGeometry(font, ch));
    return geos.get(ch)!;
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#efe8da");

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  cam.position.set(9, 8, 11);
  cam.lookAt(0, 0.6, 0);

  // Lumière : soleil dur (key) qui porte l'ombre, ciel doux (fill), contre-jour léger.
  const sun = new THREE.DirectionalLight("#fff4e0", 2.6);
  sun.position.set(-6, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.0005;
  scene.add(sun, new THREE.HemisphereLight("#f6f1e6", "#c9bfa9", 1.1));
  const back = new THREE.DirectionalLight("#dfe8ff", 0.6);
  back.position.set(5, 4, -8);
  scene.add(back);

  // Sol et socle
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: "#efe8da", roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const plinthGeo = new THREE.BoxGeometry(6.2, 0.5, 1.6);
  const plinth = new THREE.Mesh(plinthGeo, new THREE.MeshStandardMaterial({ color: "#1b1b1b", roughness: 0.6 }));
  plinth.position.y = 0.25;
  plinth.castShadow = plinth.receiveShadow = true;
  scene.add(plinth);

  const world = new RAPIER.World({ x: 0, y: -14, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.1, 30).setTranslation(0, -0.1, 0).setFriction(0.9));
  const plinthBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.25, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(3.1, 0.25, 0.8).setFriction(0.8), plinthBody);

  type Piece = { mesh: THREE.Mesh; body: RAPIER.RigidBody; slot: number; char: string };
  let pieces: Piece[] = [];
  const mats = COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0 }));
  const SLOTS = [-2.0, -0.75, 0.75, 2.0];

  const spawn = (ch: string, slot: number, drop = true) => {
    const g = geo(ch);
    const mesh = new THREE.Mesh(g, mats[slot % mats.length]);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const y = drop ? 5 + slot * 0.4 : 1.35;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(SLOTS[slot], y, 0).setCanSleep(true));
    const verts = g.attributes.position.array as Float32Array;
    const hull = RAPIER.ColliderDesc.convexHull(verts) ?? RAPIER.ColliderDesc.cuboid(0.5, 0.8, DEPTH / 2);
    world.createCollider(hull.setRestitution(0.25).setFriction(0.7).setDensity(1.2), body);
    pieces.push({ mesh, body, slot, char: ch });
  };

  const removePiece = (p: Piece) => { scene.remove(p.mesh); world.removeRigidBody(p.body); };

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const a = w / h, s = 4.2;
    cam.left = -s * a; cam.right = s * a; cam.top = s; cam.bottom = -s;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let current = "";
  let shakeT = -1;
  let frame = 0;
  renderer.setAnimationLoop(() => {
    const t0 = performance.now();
    if (shakeT >= 0) {
      shakeT += 1 / 60;
      const off = Math.sin(shakeT * 48) * Math.exp(-shakeT * 6) * 0.12;
      plinthBody.setNextKinematicTranslation({ x: off, y: 0.25, z: 0 });
      plinth.position.x = off;
      if (shakeT > 1) { shakeT = -1; plinthBody.setNextKinematicTranslation({ x: 0, y: 0.25, z: 0 }); plinth.position.x = 0; }
    }
    world.step();
    for (const p of pieces) {
      const t = p.body.translation(), r = p.body.rotation();
      p.mesh.position.set(t.x, t.y, t.z);
      p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    // Pièces tombées loin : retirées.
    pieces = pieces.filter((p) => { if (p.body.translation().y < -5) { removePiece(p); return false; } return true; });
    renderer.render(scene, cam);
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - t0).toFixed(2), triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
  });

  const write = (text: string, dropAll: boolean) => {
    const chars = text.split("");
    chars.forEach((ch, slot) => {
      if (ch === " ") return;
      const prev = current[slot];
      if (!dropAll && prev === ch) return;
      // L'ancien chiffre bascule vers l'avant et tombe du socle.
      pieces.filter((p) => p.slot === slot && p.char !== "_fallen").forEach((p) => {
        p.char = "_fallen";
        p.body.applyImpulse({ x: (Math.random() - 0.5) * 0.6, y: 1.2, z: 3.2 }, true);
        p.body.applyTorqueImpulse({ x: 1.6, y: (Math.random() - 0.5) * 0.4, z: 0 }, true);
      });
      spawn(ch, slot, true);
    });
    current = text;
  };

  return {
    setMinutes: (m) => {
      const text = ` ${String(Math.floor(m)).padStart(2, "0")} `;
      if (text !== current) write(text, current === "");
    },
    collapse: () => {
      // Le socle s'efface d'un coup : tout tombe en tas.
      for (const p of pieces) {
        p.char = "_fallen";
        p.body.applyImpulse({ x: (Math.random() - 0.5) * 2, y: 2, z: (Math.random() - 0.3) * 2 }, true);
        p.body.applyTorqueImpulse({ x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 }, true);
      }
      current = "";
    },
    reset: (m) => {
      pieces.forEach(removePiece);
      pieces = [];
      current = "";
      write(` ${String(Math.floor(m)).padStart(2, "0")} `, true);
    },
    shake: () => { shakeT = 0; },
    dispose: () => { renderer.setAnimationLoop(null); ro.disconnect(); renderer.dispose(); world.free(); },
  };
}
