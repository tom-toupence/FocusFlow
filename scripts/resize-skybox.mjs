// Réduit un PNG indexé (colorType 3) de moitié, en pur Node (zlib), et échantillonne
// la couleur d'horizon (pour caler le brouillard de la scène sur le ciel).
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const SRC = process.argv[2];
const DST = process.argv[3];

function readChunks(buf) {
  const out = [];
  let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.slice(o + 4, o + 8).toString("latin1");
    out.push({ type, data: buf.slice(o + 8, o + 8 + len) });
    o += 12 + len;
  }
  return out;
}

const src = readFileSync(SRC);
const chunks = readChunks(src);
const ihdr = chunks.find((c) => c.type === "IHDR").data;
const W = ihdr.readUInt32BE(0), H = ihdr.readUInt32BE(4);
const bitDepth = ihdr[8], colorType = ihdr[9];
if (bitDepth !== 8 || colorType !== 3) throw new Error(`format non géré: depth=${bitDepth} type=${colorType}`);
const plte = chunks.find((c) => c.type === "PLTE").data;
const idat = inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));

// — Défiltrage (bpp = 1 octet pour l'indexé 8 bits) —
const raw = Buffer.alloc(W * H);
let p = 0;
for (let y = 0; y < H; y++) {
  const filter = idat[p++];
  const row = raw.subarray(y * W, (y + 1) * W);
  const prev = y > 0 ? raw.subarray((y - 1) * W, y * W) : null;
  for (let x = 0; x < W; x++) {
    const v = idat[p++];
    const a = x > 0 ? row[x - 1] : 0;
    const b = prev ? prev[x] : 0;
    const c = x > 0 && prev ? prev[x - 1] : 0;
    let out;
    if (filter === 0) out = v;
    else if (filter === 1) out = v + a;
    else if (filter === 2) out = v + b;
    else if (filter === 3) out = v + ((a + b) >> 1);
    else {
      const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
      out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
    }
    row[x] = out & 0xff;
  }
}

// — Sous-échantillonnage 2×2 en RGB, puis retour vers la palette d'origine —
const W2 = W >> 1, H2 = H >> 1;
const dst = Buffer.alloc(W2 * H2);
const cache = new Map();
const nearest = (r, g, b) => {
  const key = (r << 16) | (g << 8) | b;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < 256; i++) {
    const dr = r - plte[i * 3], dg = g - plte[i * 3 + 1], db = b - plte[i * 3 + 2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  cache.set(key, best);
  return best;
};

let horizonR = 0, horizonG = 0, horizonB = 0, horizonN = 0;
for (let y = 0; y < H2; y++) {
  for (let x = 0; x < W2; x++) {
    let r = 0, g = 0, b = 0;
    for (const [dy, dx] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const i = raw[(y * 2 + dy) * W + (x * 2 + dx)];
      r += plte[i * 3]; g += plte[i * 3 + 1]; b += plte[i * 3 + 2];
    }
    r = Math.round(r / 4); g = Math.round(g / 4); b = Math.round(b / 4);
    dst[y * W2 + x] = nearest(r, g, b);
    // bande d'horizon d'une équirectangulaire : au milieu en hauteur
    if (y > H2 * 0.49 && y < H2 * 0.53) { horizonR += r; horizonG += g; horizonB += b; horizonN++; }
  }
}

// — Ré-encodage indexé, même palette —
const filtered = Buffer.alloc(H2 * (W2 + 1));
for (let y = 0; y < H2; y++) {
  filtered[y * (W2 + 1)] = 0;
  dst.copy(filtered, y * (W2 + 1) + 1, y * W2, (y + 1) * W2);
}
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};
const newIhdr = Buffer.alloc(13);
newIhdr.writeUInt32BE(W2, 0);
newIhdr.writeUInt32BE(H2, 4);
newIhdr[8] = 8; newIhdr[9] = 3; newIhdr[10] = 0; newIhdr[11] = 0; newIhdr[12] = 0;
const out = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", newIhdr),
  chunk("PLTE", plte),
  chunk("IDAT", deflateSync(filtered, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(DST, out);

const hex = (v) => Math.round(v / horizonN).toString(16).padStart(2, "0");
console.log(`${W}x${H} (${(statSync(SRC).size / 1024).toFixed(0)}k) → ${W2}x${H2} (${(statSync(DST).size / 1024).toFixed(0)}k)`);
console.log("couleur d'horizon:", "#" + hex(horizonR) + hex(horizonG) + hex(horizonB));
