import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// MOBILIER URBAIN procédural de la ville de nuit du landing (`NightCityScene`).
// Les immeubles et les voitures viennent des kits Kenney (`public/city_models`,
// `public/car_models`) ; ce module fournit ce que le kit n'a pas et qui donne
// l'ambiance nocturne : lampadaires, feux, abribus, arbres, enseignes néon,
// métro aérien. Pur three.js, aucun asset externe.
//
// Chaque constructeur renvoie des BufferGeometry FUSIONNÉES par matériau : une
// seule géométrie par bucket → une seule instancedMesh par bucket, donc très peu
// de draw calls même avec des modèles détaillés.
//
// Buckets :
//   shell   → béton/tôle (MeshStandardMaterial sombre)
//   glow    → surfaces lumineuses (fenêtres, néons, phares) — COULEUR PAR SOMMET,
//             ce qui permet des centaines de teintes différentes avec un seul
//             matériau MeshBasicMaterial({ vertexColors: true }).
//   glass   → vitrages sombres (MeshStandardMaterial métallique)
//
// Convention d'orientation : « profondeur » = axe Z (le sens de circulation),
// origine au sol (y = 0), centré en x/z.

export interface Built {
  shell: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  glass?: THREE.BufferGeometry;
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Peint une géométrie (attribut `color`) pour le bucket « glow ».
function paint(geo: THREE.BufferGeometry, hex: string | number, intensity = 1) {
  const c = new THREE.Color(hex).multiplyScalar(intensity);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

// mergeGeometries exige des attributs homogènes : on ne fusionne que des
// géométries du même bucket (avec `color` partout, ou nulle part).
function merge(list: THREE.BufferGeometry[], fallback: THREE.BufferGeometry) {
  if (list.length === 0) return fallback;
  const g = mergeGeometries(list, false);
  list.forEach((x) => x.dispose());
  return g ?? fallback;
}

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) =>
  new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);

const EMPTY = () => new THREE.BufferGeometry();

// ─────────────────────────────────────────────────────────────────────────────
// MOBILIER URBAIN
// ─────────────────────────────────────────────────────────────────────────────

// Lampadaire à col de cygne : mât vertical, bras en quart de cercle qui prolonge
// EXACTEMENT le haut du mât, puis luminaire horizontal au bout du bras.
//
// ⚠️ Le quart de tore vit dans le plan XY : il ne faut SURTOUT pas le `rotateY`
// (ça l'envoie dans le plan ZY, le bras part alors le long de la rue et la tête
// paraît décrochée du mât). On reste dans le plan XY avec `rotateZ`, et on place
// le centre en (R, T) : l'arc va de (R, T+R) [tangente horizontale, où se pose le
// luminaire] jusqu'à (0, T) [tangente verticale = sommet exact du mât].
// Le bras pointe vers +X ; pour l'autre trottoir on tourne l'objet entier de π.
export function buildStreetLamp(): Built {
  const shell: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const T = 3.2; // hauteur du mât
  const R = 0.62; // rayon du col de cygne

  shell.push(new THREE.CylinderGeometry(0.13, 0.17, 0.22, 10).translate(0, 0.11, 0));
  shell.push(new THREE.CylinderGeometry(0.06, 0.08, T - 0.1, 10).translate(0, (T + 0.1) / 2, 0));

  // TorusGeometry n'a pas de `thetaStart` : l'arc part toujours de θ=0, on le
  // fait donc pivoter d'un quart de tour DANS son plan.
  const arm = new THREE.TorusGeometry(R, 0.05, 6, 14, Math.PI / 2);
  arm.rotateZ(Math.PI / 2);
  arm.translate(R, T, 0);
  shell.push(arm);

  // Luminaire posé au bout du bras (tangente horizontale) + lentille dessous.
  shell.push(box(0.55, 0.13, 0.3, R + 0.26, T + R - 0.13));
  glow.push(paint(box(0.42, 0.05, 0.24, R + 0.26, T + R - 0.18), "#ffc27a", 1));

  return { shell: merge(shell, EMPTY()), glow: merge(glow, EMPTY()) };
}

// Feu tricolore : mât, boîtier, 3 lentilles (la verte allumée).
export function buildTrafficLight(): Built {
  const shell: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  shell.push(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8).translate(0, 1.3, 0));
  shell.push(box(0.28, 0.78, 0.24, 0, 2.3, 0));
  shell.push(box(0.34, 0.06, 0.3, 0, 3.08, 0));
  glow.push(paint(box(0.14, 0.14, 0.06, 0, 2.82, 0.13), "#3a1216", 1));
  glow.push(paint(box(0.14, 0.14, 0.06, 0, 2.58, 0.13), "#3a2c12", 1));
  glow.push(paint(box(0.14, 0.14, 0.06, 0, 2.34, 0.13), "#4ade80", 1));
  return { shell: merge(shell, EMPTY()), glow: merge(glow, EMPTY()) };
}

// Abribus éclairé avec panneau publicitaire.
export function buildBusStop(): Built {
  const shell: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  shell.push(box(0.1, 2.3, 0.1, -1.3, 0, -0.7));
  shell.push(box(0.1, 2.3, 0.1, -1.3, 0, 0.7));
  shell.push(box(0.1, 2.3, 0.1, 1.3, 0, -0.7));
  shell.push(box(2.8, 0.08, 1.6, 0, 2.3, 0));
  shell.push(box(0.06, 1.9, 1.5, 1.32, 0.2, 0)); // paroi de fond
  shell.push(box(2.4, 0.1, 0.4, 0, 0.55, 0.45)); // banc
  glow.push(paint(box(0.05, 1.5, 0.9, -1.34, 0.4, -0.05), "#bfe0ff", 0.9)); // panneau lumineux
  glow.push(paint(box(2.4, 0.04, 0.5, 0, 2.24, 0), "#ffe1b0", 0.7)); // néon de plafond
  return { shell: merge(shell, EMPTY()), glow: merge(glow, EMPTY()) };
}

// Arbre : tronc + houppier en 3 sphères facettées (low-poly assumé).
export function buildTree(seed: number): Built {
  const rnd = mulberry32(seed);
  const shell: THREE.BufferGeometry[] = [];
  const h = 1.5 + rnd() * 0.7;
  shell.push(new THREE.CylinderGeometry(0.09, 0.14, h, 7).translate(0, h / 2, 0));
  const blobs: [number, number, number, number][] = [
    [0, h + 0.35, 0, 0.62],
    [0.3, h + 0.1, 0.12, 0.42],
    [-0.26, h + 0.18, -0.16, 0.46],
  ];
  for (const [x, y, z, r] of blobs) {
    shell.push(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z));
  }
  // bac au pied
  shell.push(box(0.8, 0.22, 0.8, 0, 0, 0));
  return { shell: merge(shell, EMPTY()), glow: EMPTY() };
}

// Enseigne néon verticale (caisson + tube lumineux) plaquée sur une façade.
export function buildNeonSign(seed: number): Built {
  const rnd = mulberry32(seed);
  const shell: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const h = 1.8 + rnd() * 2.4;
  const colors = ["#ff5fa2", "#5ce1e6", "#ffd166", "#a78bfa", "#7dd3fc", "#fb7185"];
  const color = colors[Math.floor(rnd() * colors.length)];
  shell.push(box(0.12, h, 0.62, 0, 0, 0)); // caisson
  glow.push(paint(box(0.06, h - 0.16, 0.46, 0.09, 0.08, 0), color, 1));
  glow.push(paint(box(0.06, h - 0.16, 0.46, -0.09, 0.08, 0), color, 1));
  // « lettres » : petits blocs sur la tranche
  const n = Math.max(3, Math.floor(h / 0.55));
  for (let i = 0; i < n; i++) {
    glow.push(paint(box(0.16, 0.3, 0.3, 0, 0.2 + (i * (h - 0.5)) / n, 0), color, 1.15));
  }
  return { shell: merge(shell, EMPTY()), glow: merge(glow, EMPTY()) };
}

// Rame de métro aérien : caisse, bandeau de fenêtres, bogies, phare.
export function buildTrain(): Built {
  const shell: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const L = 5.4;
  for (let c = 0; c < 3; c++) {
    const z = (c - 1) * (L + 0.3);
    shell.push(box(2.0, 1.9, L, 0, 0, z));
    shell.push(box(2.1, 0.14, L * 0.98, 0, 1.9, z)); // toit
    for (const sx of [1, -1]) {
      glow.push(paint(box(0.05, 0.62, L * 0.82, (sx * 2.0) / 2 + sx * 0.02, 0.85, z), "#ffeccc", 0.95));
    }
    for (const bz of [-L / 3, L / 3]) {
      shell.push(box(1.6, 0.3, 0.9, 0, -0.02, z + bz));
    }
  }
  glow.push(paint(box(0.7, 0.22, 0.06, 0, 1.0, 1.6 * (L + 0.3) + 0.2), "#fff6e2", 1));
  return { shell: merge(shell, EMPTY()), glow: merge(glow, EMPTY()) };
}