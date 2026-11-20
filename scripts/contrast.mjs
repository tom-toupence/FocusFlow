// Vérifie les contrastes WCAG 2.1 des tokens de couleur déclarés dans
// app/globals.css (blocs `:root` = papier/clair et `.dark` = eau de nuit).
// Usage : node scripts/contrast.mjs   → sort en erreur si une paire échoue.
//
// Seules les couleurs oklch() opaques sont lues. Les paires à vérifier sont
// listées dans PAIRS avec leur seuil (4.5 = texte courant, 3 = grand texte,
// éléments graphiques et bords de contrôles).
import fs from "node:fs";

const css = fs.readFileSync("app/globals.css", "utf8");

function block(selector) {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "m");
  const m = css.match(re);
  if (!m) throw new Error(`bloc ${selector} introuvable`);
  const out = {};
  for (const line of m[1].split(";")) {
    const mm = line.match(/--([\w-]+)\s*:\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
    if (mm) out[mm[1]] = [+mm[2], +mm[3], +mm[4]];
  }
  return out;
}

function oklchToLinearSrgb([L, C, h]) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

const lum = (c) => {
  const [r, g, b] = oklchToLinearSrgb(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const PAIRS = [
  ["text", "bg", 4.5], ["text", "surface", 4.5], ["text", "surface-2", 4.5],
  ["text-2", "bg", 4.5], ["text-2", "surface", 4.5], ["text-2", "surface-2", 4.5],
  ["text-3", "bg", 4.5], ["text-3", "surface", 4.5], ["text-3", "surface-2", 4.5],
  ["sodium", "bg", 3], ["sodium", "surface", 3],
  ["sodium-text", "bg", 4.5], ["sodium-text", "surface", 4.5],
  ["on-sodium", "sodium", 4.5],
  ["danger", "bg", 4.5], ["danger", "surface", 4.5],
  ["line-strong", "bg", 3], ["line-strong", "surface", 3],
  ["on-text", "text", 4.5],
];

let fail = 0;
for (const [name, sel] of [["papier (clair)", ":root"], ["eau de nuit (sombre)", ".dark"]]) {
  const t = block(sel);
  console.log(`\n${name}`);
  for (const [fg, bg, min] of PAIRS) {
    if (!t[fg] || !t[bg]) { console.log(`  ?  ${fg} / ${bg} manquant`); fail++; continue; }
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) fail++;
    console.log(`  ${ok ? "ok" : "KO"} ${fg.padEnd(12)} sur ${bg.padEnd(10)} ${r.toFixed(2)} (min ${min})`);
  }
}
console.log(fail ? `\n${fail} paire(s) en échec` : "\nToutes les paires passent WCAG AA");
process.exit(fail ? 1 : 0);
