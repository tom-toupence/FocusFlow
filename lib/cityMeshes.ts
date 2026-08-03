import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Modélisation procédurale de la ville de nuit du landing (`NightCityScene`).
// Pur three.js, aucune dépendance ni asset externe (règle « tout doit rester
// gratuit / local »). Chaque constructeur renvoie des BufferGeometry FUSIONNÉES
// par matériau : une seule géométrie par bucket → une seule instancedMesh par
// bucket, donc très peu de draw calls même avec des modèles détaillés.
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
// IMMEUBLE : socle commerçant (vitrine + store + enseigne), étages à corniches,
// fenêtres encadrées, balcons, acrotère de toit, château d'eau, clim, antenne.
// ─────────────────────────────────────────────────────────────────────────────

export interface Building extends Built {
  height: number; // hauteur totale (pour poser la balise de toit)
  width: number;
  depth: number;
  hasBeacon: boolean;
}

const WINDOW_TONES = ["#ffcf94", "#ffb267", "#ffe0b0", "#a9d4ff", "#cfe4ff"];

export function buildBuilding(seed: number): Building {
  const rnd = mulberry32(seed);
  const shell: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];

  const floors = 3 + Math.floor(rnd() * 9);
  const floorH = 1.05;
  const w = 2.8 + rnd() * 1.8;
  const d = 2.8 + rnd() * 1.8;
  const groundH = 1.5;
  const bodyH = floors * floorH;

  // — Socle commerçant —
  shell.push(box(w, groundH, d, 0, 0, 0));
  // Vitrine lumineuse sur les 2 faces longues (z) et la face rue (x)
  const shopTone = ["#ffd9a0", "#ffe9c9", "#bfe9ff"][Math.floor(rnd() * 3)];
  glow.push(paint(box(w * 0.82, 0.75, 0.06, 0, 0.42, d / 2 + 0.01), shopTone, 0.9));
  glow.push(paint(box(w * 0.82, 0.75, 0.06, 0, 0.42, -d / 2 - 0.01), shopTone, 0.9));
  glow.push(paint(box(0.06, 0.75, d * 0.82, w / 2 + 0.01, 0.42, 0), shopTone, 0.9));
  glow.push(paint(box(0.06, 0.75, d * 0.82, -w / 2 - 0.01, 0.42, 0), shopTone, 0.9));
  // Store/banne incliné au-dessus de la vitrine
  const awning = new THREE.BoxGeometry(w * 0.86, 0.05, 0.62);
  awning.rotateX(-0.42);
  awning.translate(0, groundH - 0.18, d / 2 + 0.26);
  shell.push(awning);
  const awning2 = awning.clone();
  awning2.rotateY(Math.PI);
  shell.push(awning2);

  // — Étages : murs, corniches, encadrements, fenêtres —
  shell.push(box(w, bodyH, d, 0, groundH, 0));
  const cols = Math.max(2, Math.round(w / 1.05));
  const colsZ = Math.max(2, Math.round(d / 1.05));
  const winW = (w / cols) * 0.52;
  const winWz = (d / colsZ) * 0.52;
  const winH = floorH * 0.5;

  for (let f = 0; f < floors; f++) {
    const y = groundH + f * floorH;
    // corniche filante entre chaque étage
    shell.push(box(w + 0.16, 0.09, d + 0.16, 0, y, 0));

    // fenêtres des faces ±Z
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + (w / cols) * (i + 0.5);
      for (const sz of [1, -1]) {
        const lit = rnd();
        const tone = lit > 0.42 ? WINDOW_TONES[Math.floor(rnd() * WINDOW_TONES.length)] : "#0d1220";
        const z = (sz * d) / 2;
        shell.push(box(winW + 0.14, winH + 0.14, 0.05, x, y + 0.3, z + sz * 0.02)); // encadrement
        glow.push(paint(box(winW, winH, 0.05, x, y + 0.3, z + sz * 0.05), tone, lit > 0.42 ? 0.55 + rnd() * 0.75 : 1));
      }
    }
    // fenêtres des faces ±X
    for (let i = 0; i < colsZ; i++) {
      const z = -d / 2 + (d / colsZ) * (i + 0.5);
      for (const sx of [1, -1]) {
        const lit = rnd();
        const tone = lit > 0.45 ? WINDOW_TONES[Math.floor(rnd() * WINDOW_TONES.length)] : "#0d1220";
        const x = (sx * w) / 2;
        shell.push(box(0.05, winH + 0.14, winWz + 0.14, x + sx * 0.02, y + 0.3, z));
        glow.push(paint(box(0.05, winH, winWz, x + sx * 0.05, y + 0.3, z), tone, lit > 0.45 ? 0.55 + rnd() * 0.75 : 1));
      }
    }
    // balcon occasionnel (dalle + barreaux)
    if (rnd() > 0.72) {
      const by = y + 0.22;
      shell.push(box(w * 0.7, 0.07, 0.5, 0, by, d / 2 + 0.25));
      shell.push(box(w * 0.7, 0.04, 0.04, 0, by + 0.36, d / 2 + 0.48));
      const bars = 6;
      for (let b = 0; b < bars; b++) {
        shell.push(box(0.035, 0.36, 0.035, -w * 0.35 + (w * 0.7 * b) / (bars - 1), by + 0.05, d / 2 + 0.48));
      }
    }
  }

  // — Toit : acrotère, château d'eau, groupes de clim, antenne —
  const roof = groundH + bodyH;
  shell.push(box(w + 0.2, 0.28, 0.16, 0, roof, d / 2 + 0.02));
  shell.push(box(w + 0.2, 0.28, 0.16, 0, roof, -d / 2 - 0.02));
  shell.push(box(0.16, 0.28, d + 0.2, w / 2 + 0.02, roof, 0));
  shell.push(box(0.16, 0.28, d + 0.2, -w / 2 - 0.02, roof, 0));

  if (rnd() > 0.4) {
    // château d'eau sur pilotis
    const legY = roof;
    for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      shell.push(box(0.07, 0.45, 0.07, lx, legY, lz));
    }
    const tank = new THREE.CylinderGeometry(0.42, 0.42, 0.6, 12).translate(0, roof + 0.75, 0);
    shell.push(tank);
    const cap = new THREE.ConeGeometry(0.46, 0.26, 12).translate(0, roof + 1.18, 0);
    shell.push(cap);
  }
  if (rnd() > 0.45) {
    const ax = (rnd() - 0.5) * (w - 1);
    shell.push(box(0.6, 0.32, 0.5, ax, roof, -d / 4));
    shell.push(box(0.5, 0.04, 0.4, ax, roof + 0.34, -d / 4));
  }
  const hasBeacon = floors > 7;
  let height = roof + 0.28;
  if (rnd() > 0.5) {
    const antH = 0.9 + rnd() * 1.8;
    shell.push(new THREE.CylinderGeometry(0.035, 0.05, antH, 6).translate(0, roof + antH / 2, 0));
    height = roof + antH;
  }

  return {
    shell: merge(shell, EMPTY()),
    glow: merge(glow, EMPTY()),
    height,
    width: w,
    depth: d,
    hasBeacon,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VOITURE : silhouette extrudée (vrai profil de carrosserie), vitrage, 4 roues
// avec jantes, pare-chocs, phares/feux. Longueur orientée sur l'axe Z.
// ─────────────────────────────────────────────────────────────────────────────

export type CarKind = "sedan" | "van" | "coupe";

export interface Car extends Built {
  glass: THREE.BufferGeometry;
  wheels: THREE.BufferGeometry;
  head: THREE.BufferGeometry; // phares blancs
  tail: THREE.BufferGeometry; // feux rouges
}

const PROFILES: Record<CarKind, [number, number][]> = {
  // (x = longueur, y = hauteur) — profil vu de côté, capot à droite (+x)
  sedan: [
    [-2.05, 0.3], [-2.08, 0.72], [-1.95, 0.92], [-1.25, 1.0],
    [-0.85, 1.42], [0.45, 1.44], [0.95, 1.0], [1.95, 0.92], [2.05, 0.72], [2.05, 0.3],
  ],
  coupe: [
    [-1.85, 0.28], [-1.9, 0.66], [-1.55, 0.9], [-0.95, 0.98],
    [-0.45, 1.3], [0.55, 1.28], [1.3, 0.92], [1.85, 0.84], [1.9, 0.62], [1.9, 0.28],
  ],
  van: [
    [-2.2, 0.32], [-2.25, 1.75], [-1.6, 1.85], [0.9, 1.85],
    [1.35, 1.35], [2.1, 1.15], [2.15, 0.8], [2.15, 0.32],
  ],
};

export function buildCar(kind: CarKind, seed: number): Car {
  const rnd = mulberry32(seed);
  const pts = PROFILES[kind];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [px, py] = pts[i - 1];
    // léger arrondi entre les segments : donne une carrosserie galbée
    shape.quadraticCurveTo((px + x) / 2, (py + y) / 2 + 0.03, x, y);
  }
  shape.lineTo(pts[0][0], pts[0][1]);

  const width = kind === "van" ? 1.55 : 1.6;
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelSize: 0.07,
    bevelThickness: 0.06,
    bevelSegments: 2,
    steps: 1,
  });
  body.translate(0, 0, -width / 2);
  body.rotateY(Math.PI / 2); // longueur → axe Z

  const shell: THREE.BufferGeometry[] = [body];
  // pare-chocs
  shell.push(box(width * 0.98, 0.16, 0.22, 0, 0.34, kind === "van" ? 2.16 : 2.0));
  shell.push(box(width * 0.98, 0.16, 0.22, 0, 0.34, kind === "van" ? -2.26 : -2.1));
  // rétroviseurs
  shell.push(box(0.18, 0.09, 0.09, width / 2 + 0.06, 0.98, 0.6));
  shell.push(box(0.18, 0.09, 0.09, -width / 2 - 0.06, 0.98, 0.6));
  if (kind === "van") {
    // galerie de toit
    shell.push(box(width * 0.8, 0.05, 2.4, 0, 1.86, -0.2));
  }

  // — Vitrage : bandeau de custodes + pare-brise incliné —
  const glass: THREE.BufferGeometry[] = [];
  const cabZ = kind === "van" ? 0.1 : -0.1;
  const cabLen = kind === "van" ? 2.2 : 1.3;
  const cabY = kind === "van" ? 1.45 : 1.16;
  glass.push(box(width + 0.04, kind === "van" ? 0.55 : 0.36, cabLen, 0, cabY, cabZ));
  const windshield = box(width * 0.92, 0.5, 0.06, 0, cabY - 0.1, cabZ + cabLen / 2 + 0.12);
  windshield.rotateX(-0.5);
  windshield.translate(0, 0.06, 0.06);
  glass.push(windshield);

  // — Roues : pneu (torus aplati) + jante —
  const wheels: THREE.BufferGeometry[] = [];
  const r = kind === "van" ? 0.4 : 0.36;
  const axles = kind === "van" ? [1.45, -1.5] : [1.35, -1.4];
  for (const z of axles) {
    for (const sx of [1, -1]) {
      const tyre = new THREE.CylinderGeometry(r, r, 0.24, 14);
      tyre.rotateZ(Math.PI / 2);
      tyre.translate((sx * width) / 2, r, z);
      wheels.push(tyre);
      const rim = new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.26, 10);
      rim.rotateZ(Math.PI / 2);
      rim.translate((sx * width) / 2 + sx * 0.01, r, z);
      wheels.push(rim);
    }
  }

  // — Feux —
  const noseZ = kind === "van" ? 2.2 : 2.05;
  const tailZ = kind === "van" ? -2.3 : -2.15;
  const headY = kind === "van" ? 1.0 : 0.75;
  const head = [
    paint(box(0.34, 0.14, 0.08, width / 2 - 0.28, headY, noseZ), "#fff6e2", 1),
    paint(box(0.34, 0.14, 0.08, -width / 2 + 0.28, headY, noseZ), "#fff6e2", 1),
  ];
  const tail = [
    paint(box(0.3, 0.12, 0.08, width / 2 - 0.26, headY - 0.05, tailZ), "#ff3b52", 1),
    paint(box(0.3, 0.12, 0.08, -width / 2 + 0.26, headY - 0.05, tailZ), "#ff3b52", 1),
  ];

  // Toit de taxi occasionnel (petit dôme lumineux)
  const glow: THREE.BufferGeometry[] = [];
  if (kind === "sedan" && rnd() > 0.55) {
    glow.push(paint(box(0.5, 0.16, 0.22, 0, 1.45, -0.2), "#ffd166", 1));
  }

  return {
    shell: merge(shell, EMPTY()),
    glass: merge(glass, EMPTY()),
    wheels: merge(wheels, EMPTY()),
    head: merge(head, EMPTY()),
    tail: merge(tail, EMPTY()),
    glow: merge(glow, EMPTY()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILIER URBAIN
// ─────────────────────────────────────────────────────────────────────────────

// Lampadaire à col de cygne (mât + bras courbe + luminaire).
export function buildStreetLamp(mirrored: boolean): Built {
  const shell: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const s = mirrored ? -1 : 1;

  shell.push(new THREE.CylinderGeometry(0.13, 0.17, 0.22, 10).translate(0, 0.11, 0));
  shell.push(new THREE.CylinderGeometry(0.06, 0.08, 3.1, 10).translate(0, 1.65, 0));
  // bras : quart de tore
  const arm = new THREE.TorusGeometry(0.62, 0.05, 6, 12, Math.PI / 2);
  arm.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
  arm.translate(0, 3.2, 0);
  shell.push(arm);
  // luminaire
  const head = new THREE.BoxGeometry(0.46, 0.12, 0.3);
  head.translate(s * 0.62, 3.76, 0);
  shell.push(head);
  glow.push(paint(box(0.38, 0.05, 0.24, s * 0.62, 3.64, 0), "#ffc27a", 1));

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

// Trottoir : bordure + dalles (une section, répétée par instanciation).
export function buildSidewalk(len: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(1.5, 0.16, len, 0, 0, 0));
  parts.push(box(0.12, 0.22, len, -0.68, 0, 0)); // bordure côté rue
  return merge(parts, EMPTY());
}
