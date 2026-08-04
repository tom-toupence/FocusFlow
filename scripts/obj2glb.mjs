// OBJ (+ MTL) → GLB, en pur Node (aucune dépendance).
//
// Spécificités du pack de voitures :
//  • pas d'UV : les couleurs des matériaux (Kd) sont CUITES EN VERTEX COLORS,
//    donc une seule matière suffit pour toute la carrosserie ;
//  • les matériaux « *Lights* » partent dans un mesh séparé `lights` pour être
//    rendus émissifs la nuit ;
//  • chaque objet « *Wheel* » devient un nœud `wheel-*` recentré sur son moyeu,
//    ce qui permet de les faire tourner ;
//  • le modèle est réorienté (avant vers +Z) et mis à l'échelle (longueur cible).
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const DIR = process.argv[2];
const TARGET_LENGTH = 4.2; // longueur voulue en unités monde (≈ une vraie voiture)

function parseMtl(file) {
  const mats = new Map();
  let cur = null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p[0] === "newmtl") mats.set((cur = p[1]), { color: [1, 1, 1], emissive: /light/i.test(p[1]) });
    else if (p[0] === "Kd" && cur) mats.get(cur).color = [+p[1], +p[2], +p[3]];
  }
  return mats;
}

function parseObj(file, mats) {
  const V = [], N = [];
  const parts = new Map(); // nom → { positions, normals, colors, indices, cache }
  let objectName = "body";
  let color = [1, 1, 1];
  let emissive = false;

  const partFor = (name) => {
    let p = parts.get(name);
    if (!p) parts.set(name, (p = { positions: [], normals: [], colors: [], indices: [], cache: new Map() }));
    return p;
  };
  const vertex = (part, spec) => {
    const key = spec + "|" + color.join(",");
    const hit = part.cache.get(key);
    if (hit !== undefined) return hit;
    const [vi, , ni] = spec.split("/");
    const v = V[+vi - 1];
    const n = ni ? N[+ni - 1] : [0, 1, 0];
    const idx = part.positions.length / 3;
    part.positions.push(v[0], v[1], v[2]);
    part.normals.push(n[0], n[1], n[2]);
    part.colors.push(color[0], color[1], color[2]);
    part.cache.set(key, idx);
    return idx;
  };

  for (const line of readFileSync(file, "utf8").split("\n")) {
    const p = line.trim().split(/\s+/);
    switch (p[0]) {
      case "v": V.push([+p[1], +p[2], +p[3]]); break;
      case "vn": N.push([+p[1], +p[2], +p[3]]); break;
      case "o": {
        const raw = p.slice(1).join(" ");
        objectName = /wheel/i.test(raw)
          ? "wheel-" + raw.replace(/^.*?_/, "").replace(/_.*$/, "").toLowerCase()
          : "body";
        break;
      }
      case "usemtl": {
        const m = mats.get(p[1]);
        color = m?.color ?? [1, 1, 1];
        emissive = !!m?.emissive;
        break;
      }
      case "f": {
        // Les feux d'une carrosserie partent dans le mesh `lights`.
        const target = partFor(emissive && objectName === "body" ? "lights" : objectName);
        const idx = p.slice(1).map((s) => vertex(target, s));
        for (let i = 1; i + 1 < idx.length; i++) target.indices.push(idx[0], idx[i], idx[i + 1]); // triangulation en éventail
        break;
      }
    }
  }
  return parts;
}

// ── Écriture GLB ─────────────────────────────────────────────────────────────

function buildGlb(parts) {
  const bin = [];
  let offset = 0;
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  const nodes = [];

  const pushView = (buf, target) => {
    const pad = (4 - (buf.length % 4)) % 4;
    bin.push(buf, Buffer.alloc(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, ...(target ? { target } : {}) });
    offset += buf.length + pad;
    return bufferViews.length - 1;
  };
  const pushFloats = (arr, type) => {
    const buf = Buffer.alloc(arr.length * 4);
    arr.forEach((v, i) => buf.writeFloatLE(v, i * 4));
    const view = pushView(buf, 34962);
    const comps = type === "VEC3" ? 3 : 1;
    const min = new Array(comps).fill(Infinity);
    const max = new Array(comps).fill(-Infinity);
    for (let i = 0; i < arr.length; i++) {
      const c = i % comps;
      min[c] = Math.min(min[c], arr[i]);
      max[c] = Math.max(max[c], arr[i]);
    }
    accessors.push({ bufferView: view, componentType: 5126, count: arr.length / comps, type, min, max });
    return accessors.length - 1;
  };
  // Couleurs en octets normalisés (3 o/sommet au lieu de 12) : invisible à l'œil,
  // et ça divise le poids du fichier par deux.
  const pushColors = (arr) => {
    const buf = Buffer.alloc(arr.length);
    arr.forEach((v, i) => (buf[i] = Math.round(Math.min(1, Math.max(0, v)) * 255)));
    const view = pushView(buf, 34962);
    accessors.push({ bufferView: view, componentType: 5121, normalized: true, count: arr.length / 3, type: "VEC3" });
    return accessors.length - 1;
  };
  const pushIndices = (arr) => {
    const short = arr.length === 0 || Math.max(...arr) < 65536;
    const buf = Buffer.alloc(arr.length * (short ? 2 : 4));
    arr.forEach((v, i) => (short ? buf.writeUInt16LE(v, i * 2) : buf.writeUInt32LE(v, i * 4)));
    const view = pushView(buf, 34963);
    accessors.push({ bufferView: view, componentType: short ? 5123 : 5125, count: arr.length, type: "SCALAR" });
    return accessors.length - 1;
  };

  for (const [name, part] of parts) {
    if (part.indices.length === 0) continue;
    let translation = [0, 0, 0];
    if (name.startsWith("wheel")) {
      // Le moyeu devient l'origine du nœud : la roue peut alors tourner sur elle-même.
      const c = [0, 1, 2].map((k) => {
        let lo = Infinity, hi = -Infinity;
        for (let i = k; i < part.positions.length; i += 3) { lo = Math.min(lo, part.positions[i]); hi = Math.max(hi, part.positions[i]); }
        return (lo + hi) / 2;
      });
      for (let i = 0; i < part.positions.length; i += 3) {
        part.positions[i] -= c[0];
        part.positions[i + 1] -= c[1];
        part.positions[i + 2] -= c[2];
      }
      translation = c;
    }
    const attributes = {
      POSITION: pushFloats(part.positions, "VEC3"),
      NORMAL: pushFloats(part.normals, "VEC3"),
      COLOR_0: pushColors(part.colors),
    };
    meshes.push({ name, primitives: [{ attributes, indices: pushIndices(part.indices), material: 0 }] });
    nodes.push({ name, mesh: meshes.length - 1, ...(translation.some((v) => v !== 0) ? { translation } : {}) });
  }

  const json = {
    asset: { version: "2.0", generator: "focusflow obj2glb" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials: [{ name: "vertexColor", pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0.1, roughnessFactor: 0.75 } }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };
  const binChunk = Buffer.concat(bin);
  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binChunk.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binChunk]);
}

// ── Normalisation : orientation (avant vers +Z) puis échelle ─────────────────

function normalize(parts) {
  const all = [...parts.values()];
  const bounds = [0, 1, 2].map((k) => {
    let lo = Infinity, hi = -Infinity;
    for (const p of all) for (let i = k; i < p.positions.length; i += 3) { lo = Math.min(lo, p.positions[i]); hi = Math.max(hi, p.positions[i]); }
    return [lo, hi];
  });
  const dim = bounds.map(([lo, hi]) => hi - lo);
  // L'axe le plus long est la longueur du véhicule ; on veut qu'il soit sur Z.
  const longest = dim[0] > dim[2] ? "x" : "z";
  // Avant = côté des roues avant (si le pack les nomme), sinon on garde tel quel.
  const front = [...parts.keys()].find((n) => /front/i.test(n));
  let flip = false;
  if (front) {
    const p = parts.get(front);
    let sum = 0;
    for (let i = 2; i < p.positions.length; i += 3) sum += p.positions[i];
    flip = sum / (p.positions.length / 3) < 0; // roues avant côté -Z → demi-tour
  }
  const scale = TARGET_LENGTH / Math.max(dim[0], dim[2]);
  const groundY = bounds[1][0];

  for (const p of all) {
    for (let i = 0; i < p.positions.length; i += 3) {
      let x = p.positions[i], y = p.positions[i + 1], z = p.positions[i + 2];
      if (longest === "x") { const t = x; x = -z; z = t; }
      if (flip) { x = -x; z = -z; }
      p.positions[i] = x * scale;
      p.positions[i + 1] = (y - groundY) * scale; // roues au sol (y = 0)
      p.positions[i + 2] = z * scale;
    }
    for (let i = 0; i < p.normals.length; i += 3) {
      let x = p.normals[i], z = p.normals[i + 2];
      if (longest === "x") { const t = x; x = -z; z = t; }
      if (flip) { x = -x; z = -z; }
      p.normals[i] = x;
      p.normals[i + 2] = z;
    }
  }
  return { dim, longest, flip, scale };
}

for (const f of readdirSync(DIR).filter((f) => f.endsWith(".obj"))) {
  const obj = join(DIR, f);
  const mtl = obj.replace(/\.obj$/, ".mtl");
  const mats = parseMtl(mtl);
  const parts = parseObj(obj, mats);
  const info = normalize(parts);
  const out = join(DIR, basename(f, ".obj").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() + ".glb");
  writeFileSync(out, buildGlb(parts));
  console.log(
    basename(out).padEnd(18),
    (statSync(out).size / 1024).toFixed(0).padStart(4) + "k",
    "parts=" + [...parts.keys()].join(","),
    "| dim=" + info.dim.map((v) => v.toFixed(2)).join("×"),
    "axe=" + info.longest,
    info.flip ? "(demi-tour)" : ""
  );
}
