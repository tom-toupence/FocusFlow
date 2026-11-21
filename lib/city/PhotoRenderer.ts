// La ruelle en 2.5D photographique (lab 3, docs/redesign/LAB.md).
//
// Une vraie photo de nuit (licence libre, docs/redesign/ASSETS.md) + sa carte
// de profondeur (Depth Anything V2, calculée hors ligne par
// scripts/city/prep_photo.py). Tout le reste est un seul passage de shader
// WebGL2, sans librairie 3D :
//   . parallaxe par la profondeur, caméra chorégraphiée (travelling d'entrée,
//     respiration très lente, recul pendant la halte) ;
//   . pluie en couches, masquée par la profondeur, visible seulement là où il y
//     a de la lumière derrière (comme une vraie pluie la nuit), avec réfraction ;
//   . sol mouillé : assombri, traînées verticales des sources, impacts et ondes ;
//   . brume légère qui prend la couleur des sources ;
//   . chaque enseigne réelle détectée est pilotable : extinction du fond vers
//     nous (la halte), grésillement (distraction), allumage (playlist
//     prolongée) ; phares qui passent au bout de la ruelle (objectif atteint) ;
//   . le panneau à LED (temps restant) est projeté en perspective sur une
//     vraie enseigne de la photo ;
//   . étalonnage nuit / heure bleue (thème clair), grain, vignette, aberration.
// Même interface que la scène 3D (CityRenderer) : CityScene ne change pas.
import { tween as clockTween } from "@/lib/city/tween";
import type { CityOptions, CityPhase, CityRenderer } from "@/lib/city/types";

export interface PhotoSceneDef {
  /** Dossier public : photo.jpg, photo-m.jpg, data.png, glow.jpg, blobs.json */
  base: string;
  /** Coins du panneau LED dans l'image (normalisés, sens horaire depuis haut-gauche). */
  board?: [number, number][];
  /** Profondeur de mise au point (0 loin … 1 proche) : le plan qui ne bouge pas. */
  focus?: number;
  /** Bout de la ruelle (point de fuite), pour les phares de l'objectif. */
  vanish?: [number, number];
  /** Point horizontal à garder dans le cadre quand l'écran est étroit (0..1). */
  frameX?: number;
  /** Quantité de pluie 0..1 et de sol mouillé 0..1. */
  rain?: number;
  wet?: number;
}

interface Blob { x: number; y: number; r: number; depth: number; color: string }

const MAX_BLOBS = 24;

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = (low: boolean) => `#version 300 es
precision highp float;
${low ? "#define LOW 1" : ""}
uniform sampler2D uPhoto, uData, uGlow, uBoard;
uniform vec2 uRes, uImg;          // taille du canvas, taille de l'image
uniform float uTime, uRain, uWet, uFocus, uSigns, uDawn, uFog, uSpill;
uniform vec3 uCam;                // décalage x, y, travelling (dolly)
uniform vec4 uBlob[${MAX_BLOBS}]; // x, y, rayon, allumage
uniform int uBlobN;
uniform vec2 uQuad[4];            // panneau LED : coins dans l'image
uniform float uBoardOn, uBoardAspect;
uniform vec3 uCar;                // phares : progression 0..1, intensité, côté
uniform vec2 uVanish;
uniform float uFrameX;
out vec4 outColor;

float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }

// Couverture « object-fit: cover » avec une marge pour la parallaxe.
vec2 coverUv(vec2 frag) {
  vec2 uv = frag / uRes; // y vers le haut, comme les textures (FLIP_Y)
  float ar = uRes.x / uRes.y, ai = uImg.x / uImg.y;
  vec2 s = ar > ai ? vec2(1.0, ai / ar) : vec2(ar / ai, 1.0);
  // Cadrage : en portrait on glisse vers le point d'intérêt (uFrameX).
  vec2 c = vec2(0.5 + (uFrameX - 0.5) * (1.0 - s.x), 0.5);
  return c + (uv - 0.5) * s / 1.06;
}

// Profondeur LISSÉE (mip) pour le déplacement : un champ continu ne se
// déchire pas aux bords des objets (pas de bandes répétées).
float depthAt(vec2 uv) { return textureLod(uData, uv, 3.5).r; }

// Parallaxe : on cherche le point de la photo qui, déplacé selon SA profondeur,
// tombe sous ce pixel (point fixe, trois itérations suffisent).
vec2 parallax(vec2 uv) {
  vec2 c = vec2(0.5, 0.45);
  vec2 q = uv;
  for (int i = 0; i < 3; i++) {
    float d = depthAt(q);
    q = c + (uv - c) / (1.0 + uCam.z * d) - uCam.xy * (d - uFocus);
  }
  return q;
}

// Inverse d'un quadrilatère (bilinéaire) : coordonnées locales du panneau.
vec2 invBilinear(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  vec2 e = b - a, f = d - a, g = a - b + c - d, hh = p - a;
  float k2 = g.x * f.y - g.y * f.x;
  float k1 = e.x * f.y - e.y * f.x + hh.x * g.y - hh.y * g.x;
  float k0 = hh.x * e.y - hh.y * e.x;
  float v;
  if (abs(k2) < 1e-5) v = -k0 / k1;
  else { float w = k1 * k1 - 4.0 * k0 * k2; if (w < 0.0) return vec2(-1.0); w = sqrt(w); v = (-k1 - w) / (2.0 * k2); if (v < 0.0 || v > 1.0) v = (-k1 + w) / (2.0 * k2); }
  float u = (hh.x - f.x * v) / (e.x + g.x * v);
  return vec2(u, v);
}

// Allumage des enseignes à cet endroit (1 = allumée).
float signsAt(vec2 uv) {
  float m = uSigns;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    if (i >= uBlobN) break;
    vec4 b = uBlob[i];
    vec2 dd = (uv - b.xy) * vec2(uImg.x / uImg.y, 1.0);
    float w = 1.0 - smoothstep(b.z * 0.7, b.z, length(dd));
    m = mix(m, b.w, w);
  }
  return m;
}

vec3 photo(vec2 uv) { return texture(uPhoto, uv).rgb; }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv0 = coverUv(frag);
  vec2 uv = parallax(uv0);
  vec4 data = textureLod(uData, uv, 0.0);
  float d = data.r, ground = data.g * uWet, em = data.b;

  // Aberration très discrète, seulement vers les bords.
  vec2 fromC = uv0 - 0.5;
  float ca = dot(fromC, fromC) * 0.0035;
  vec3 col = vec3(photo(uv + fromC * ca).r, photo(uv).g, photo(uv - fromC * ca).b);

  // Enseignes : éteintes, elles tombent à 10 % ; la lumière qu'elles
  // jetaient sur les murs (glow) s'éteint avec elles.
  float on = signsAt(uv);
  col *= 1.0 - em * (1.0 - on) * 0.9;
  vec3 glow = texture(uGlow, uv).rgb;
  // Ce que les enseignes éclairaient (murs, auvents) s'assombrit avec elles.
  float signLight = clamp(dot(texture(uGlow, uv, 2.0).rgb, vec3(0.33)) * 6.0, 0.0, 1.0);
  col *= 1.0 - signLight * (1.0 - uSigns) * 0.55;
  col += glow * glow * uSpill * mix(0.25, 1.0, on) * (1.0 - uDawn);

  // Sol mouillé : plus sombre, plus lisse, traînées des sources au-dessus.
  if (ground > 0.01) {
    float rip = (n2(vec2(uv.x * 140.0, uv.y * 30.0 - uTime * 2.0)) - 0.5) * 0.006 * uRain;
    vec3 refl = vec3(0.0);
    float wsum = 0.0;
    #ifdef LOW
    const int N = 8;
    #else
    const int N = 16;
    #endif
    for (int k = 1; k <= N; k++) {
      // Pas tramé par pixel : des traînées continues, pas des copies espacées.
      float t = (float(k) - h1(frag + float(k) * 7.3)) / float(N);
      vec2 s = vec2(uv.x + rip * (1.0 + t * 3.0), uv.y + t * t * 0.55);
      // Seules les SOURCES se reflètent nettement ; le reste n'est qu'un
      // lustre flou (copier la photo entière dupliquerait les objets).
      float e = textureLod(uData, s, 0.0).b; e = e * e * signsAt(s);
      vec3 src = textureLod(uPhoto, s, 1.5).rgb * e * 3.0;
      vec3 sheen = texture(uGlow, s, 1.5).rgb * 1.3 + photo(s) * 0.02;
      float w = (1.0 - t) * (0.35 + 0.65 * t);
      refl += (src + sheen) * w;
      wsum += w;
    }
    refl /= wsum;
    // Impacts : petites ondes dans des cellules, dont la taille suit la perspective.
    vec2 gp = vec2(uv.x * 90.0, uv.y * 90.0 / max(0.25, 1.0 - d * 0.6));
    vec2 cell = floor(gp), f = fract(gp) - 0.5;
    float ph = fract(uTime * 1.3 + h1(cell));
    float ring = smoothstep(0.05, 0.0, abs(length(f) - ph * 0.45)) * (1.0 - ph) * step(0.55, h1(cell + 3.1));
    col = mix(col, col * 0.6 + refl * 1.6, ground * 0.9);
    col += refl * ring * ground * uRain * 1.6;
  }

  // Panneau à LED projeté sur une vraie enseigne.
  if (uBoardOn > 0.0) {
    vec2 lp = invBilinear(uv, uQuad[0], uQuad[1], uQuad[2], uQuad[3]);
    if (lp.x > 0.0 && lp.x < 1.0 && lp.y > 0.0 && lp.y < 1.0) {
      lp.y = 1.0 - lp.y; // le canvas est retourné par FLIP_Y
      vec3 led = texture(uBoard, lp).rgb;
      // Plaque sombre, points de LED visibles, lueur qui bave un peu.
      vec2 cells = fract(lp * vec2(56.0, 56.0 * uBoardAspect));
      float dotm = smoothstep(0.5, 0.28, length(cells - 0.5));
      vec3 halo = texture(uBoard, lp, 3.0).rgb;
      col = mix(col, vec3(0.01, 0.009, 0.008), 0.97 * uBoardOn) + (led * dotm * 1.5 + halo * 0.5) * uBoardOn * (1.0 - uDawn * 0.6);
    }
  }

  // Phares qui traversent au bout de la ruelle (objectif atteint).
  if (uCar.y > 0.0) {
    vec2 hp = uVanish + vec2(mix(-0.07, 0.07, uCar.x) * uCar.z, -0.01);
    float ar = uImg.x / uImg.y;
    // Deux phares (écart réel ~1,4 m, minuscule au bout de la ruelle) et un halo court.
    vec2 d1 = (uv - hp - vec2(0.004, 0.0)) * vec2(ar, 1.0), d2 = (uv - hp + vec2(0.004, 0.0)) * vec2(ar, 1.0);
    float beam = (exp(-dot(d1, d1) * 60000.0) + exp(-dot(d2, d2) * 60000.0)) * 3.0
               + exp(-dot(d1 + d2, d1 + d2) * 0.25 * 1500.0) * 0.5;
    float far = smoothstep(0.35, 0.05, d);              // n'éclaire que le fond
    col += vec3(1.0, 0.93, 0.8) * beam * uCar.y * far;
    // Leur reflet file sur le sol mouillé jusqu'à nous.
    col += vec3(1.0, 0.9, 0.7) * exp(-pow((uv.x - hp.x) * 60.0, 2.0)) * ground * uCar.y * 0.5 * smoothstep(hp.y + 0.02, 0.0, uv.y);
  }

  // Brume : prend la couleur des sources, plus dense au loin, lente.
  float haze = pow(1.0 - d, 2.2) * uFog * (0.7 + 0.6 * n2(uv * vec2(3.0, 5.0) + vec2(uTime * 0.02, 0.0)));
  vec3 hazeCol = texture(uGlow, uv, 3.0).rgb * 0.9 + vec3(0.02, 0.025, 0.035);
  col = mix(col, hazeCol, clamp(haze * (1.0 - uDawn * 0.6), 0.0, 0.6));

  // Pluie : trois couches à trois profondeurs, cachées par ce qui est devant.
  #ifndef LOW
  const int L = 3;
  #else
  const int L = 2;
  #endif
  float light = dot(texture(uGlow, uv0, 2.0).rgb, vec3(0.33)) * 3.0 + 0.04;
  for (int l = 0; l < L; l++) {
    float fl = float(l);
    float ld = 0.85 - fl * 0.28;                       // profondeur de la couche
    if (d > ld + 0.02) continue;                       // un objet plus proche la masque
    float scale = 1.0 + fl * 1.7;
    vec2 rp = frag / uRes.y * vec2(55.0, 3.2) * scale;
    rp.x += rp.y * 0.08;                               // légère obliquité
    rp.y += uTime * (9.0 - fl * 2.0);
    vec2 rc = floor(rp), rf = fract(rp);
    float rnd = h1(rc + fl * 17.0);
    float drop = step(0.82 - uRain * 0.12, rnd);
    float x = abs(rf.x - 0.5 - (rnd - 0.5) * 0.6);
    float streak = smoothstep(0.06, 0.0, x) * smoothstep(0.0, 0.25, rf.y) * smoothstep(1.0, 0.5, rf.y);
    float a = drop * streak * uRain * (0.5 - fl * 0.12);
    // Réfraction : la goutte décale et éclaircit ce qu'il y a derrière.
    vec3 behind = photo(uv + vec2(0.003, 0.0) * a);
    col = mix(col, behind * 1.4 + vec3(0.55, 0.6, 0.7) * light, a * min(1.0, light * 1.5));
  }

  // Étalonnage : nuit (noirs bleutés, hautes lumières chaudes) / heure bleue.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 night = col + vec3(0.004, 0.006, 0.012) * (1.0 - lum);
  vec3 blue = mix(vec3(lum), col, 0.5) * vec3(0.82, 0.94, 1.12) * 1.45 + vec3(0.03, 0.042, 0.06);
  col = mix(night, blue, uDawn);

  // Tone mapping (ACES ajusté), vignette, grain, encodage sRGB.
  col *= 1.15;
  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
  float vig = smoothstep(1.15, 0.35, length((frag / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0)));
  col *= mix(0.72, 1.0, vig);
  col = pow(col, vec3(1.0 / 2.2));
  col += (h1(frag + fract(uTime) * 91.0) - 0.5) * 0.022;
  outColor = vec4(col, 1.0);
}`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error(`image ${src}`));
    im.src = src;
  });
}

export function supportsPhotoCity(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

/** Texte du panneau (police d'afficheur à points). Un panneau plus haut que
 *  large passe le texte sur deux lignes (« 12 » / « MIN »). */
function drawBoard(ctx: CanvasRenderingContext2D, text: string, color: string, font: string) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = H > W * 0.8 ? text.split(" ") : [text];
  const longest = Math.max(3, ...lines.map((l) => l.length));
  const size = Math.min((H * 0.8) / lines.length, (W * 1.55) / longest);
  ctx.font = `800 ${size}px ${font}`;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.02 + size * 0.04));
}

export async function createPhotoCity(canvas: HTMLCanvasElement, def: PhotoSceneDef, opts: CityOptions = {}): Promise<CityRenderer> {
  const reduce = !!opts.reducedMotion;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 600;
  const low = narrow || (navigator.hardwareConcurrency ?? 8) <= 4;
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL2 indisponible");

  const [photoIm, dataIm, glowIm, blobsJson] = await Promise.all([
    loadImage(`${def.base}/${low ? "photo-m" : "photo"}.jpg`),
    loadImage(`${def.base}/data.png`),
    loadImage(`${def.base}/glow.jpg`),
    fetch(`${def.base}/blobs.json`).then((r) => r.json() as Promise<{ w: number; h: number; blobs: Blob[] }>),
  ]);

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG(low)));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  gl.useProgram(prog);
  const U = (n: string) => gl.getUniformLocation(prog, n);

  const tex = (unit: number, src: TexImageSource, srgb: boolean, mips = false) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const textures = [tex(0, photoIm, true, true), tex(1, dataIm, false, true), tex(2, glowIm, true, true)];
  // Panneau LED : canvas 2D redessiné quand le texte change.
  const boardCanvas = document.createElement("canvas");
  // Proportions du panneau réel (en pixels de la photo).
  const q = def.board;
  const qa = q ? Math.hypot((q[1][0] - q[0][0]) * photoIm.width, (q[1][1] - q[0][1]) * photoIm.height) / Math.max(1, Math.hypot((q[3][0] - q[0][0]) * photoIm.width, (q[3][1] - q[0][1]) * photoIm.height)) : 4;
  boardCanvas.width = 384; boardCanvas.height = Math.round(384 / qa);
  const bctx = boardCanvas.getContext("2d")!;
  const ledFont = getComputedStyle(document.documentElement).getPropertyValue("--font-doto").trim() || "monospace";
  drawBoard(bctx, opts.board ?? "", "#ffc21a", ledFont);
  textures.push(tex(3, boardCanvas, true, true));
  gl.uniform1f(U("uBoardAspect"), boardCanvas.height / boardCanvas.width);
  gl.uniform1i(U("uPhoto"), 0); gl.uniform1i(U("uData"), 1); gl.uniform1i(U("uGlow"), 2); gl.uniform1i(U("uBoard"), 3);
  gl.uniform2f(U("uImg"), photoIm.width, photoIm.height);
  gl.uniform1f(U("uFocus"), def.focus ?? 0.35);
  gl.uniform1f(U("uFrameX"), def.frameX ?? 0.5);
  gl.uniform2f(U("uVanish"), def.vanish?.[0] ?? 0.5, 1 - (def.vanish?.[1] ?? 0.6));

  // Les coordonnées image ont l'origine en haut ; la texture est retournée (FLIP_Y).
  const quad = def.board;
  if (quad) gl.uniform2fv(U("uQuad"), quad.flatMap(([x, y]) => [x, 1 - y]));
  const blobs = blobsJson.blobs.slice(0, MAX_BLOBS);
  gl.uniform1i(U("uBlobN"), blobs.length);
  const blobOn = blobs.map(() => ({ v: 1 }));
  const blobArr = new Float32Array(MAX_BLOBS * 4);

  // État animé (les tweens écrivent ici, le rendu lit).
  const st = {
    camX: 0, camY: 0, dolly: 0.05, signs: 1, rain: def.rain ?? 0.8, wet: def.wet ?? 1,
    dawn: opts.dawn ?? 0, fog: 0.5, spill: 0.55, board: quad && opts.board ? 1 : 0,
    carT: 0, carI: 0, carSide: 1,
  };
  let phase: CityPhase = opts.phase ?? "work";
  // L'enseigne neuve (playlist prolongée) : la plus proche, éteinte au départ.
  const lateIdx = blobs.length ? blobs.length - 1 : -1;
  if (lateIdx >= 0) blobOn[lateIdx].v = 0;
  if (phase === "break") { blobOn.forEach((b, i) => { if (i !== lateIdx) b.v = 0.08; }); st.signs = 0.15; st.rain *= 0.4; }

  // Pointeur : parallaxe douce (MotionValue-like : lissage dans la boucle, pas d'état React).
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPtr = (e: PointerEvent) => { ptr.tx = (e.clientX / window.innerWidth - 0.5) * 2; ptr.ty = (e.clientY / window.innerHeight - 0.5) * 2; };
  if (!reduce && !narrow) window.addEventListener("pointermove", onPtr, { passive: true });

  let dirty = true;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio, low ? 1 : 1.5);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U("uRes"), canvas.width, canvas.height);
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true, tabVisible = !document.hidden;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; dirty = true; });
  io.observe(canvas);
  const onVis = () => { tabVisible = !document.hidden; dirty = true; };
  document.addEventListener("visibilitychange", onVis);

  let animating = 0;
  const run = (a: unknown) => {
    animating++;
    (a as Promise<unknown>).finally(() => { animating--; dirty = true; });
  };
  const tween = <T extends object>(target: T, to: Record<string, number | number[]>, o: Record<string, unknown> = {}) => {
    if (reduce) {
      for (const k in to) { const v = to[k]; (target as Record<string, number>)[k] = Array.isArray(v) ? v[v.length - 1] : v; }
      dirty = true;
      return;
    }
    run(clockTween(target, to as never, o as never));
  };

  const t0 = performance.now();
  let raf = 0, last = t0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!visible || !tabVisible) return;
    if (reduce && !dirty && animating === 0) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    // Respiration : une très lente oscillation verticale (période 9 s), plus la main.
    const k = 1 - Math.exp(-dt * 2.5);
    ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
    const breathe = reduce ? 0 : Math.sin(t * 0.7) * 0.0016;
    gl.uniform3f(U("uCam"), st.camX + ptr.x * 0.006, st.camY + breathe + ptr.y * 0.003, st.dolly);
    gl.uniform1f(U("uTime"), reduce ? 0 : t);
    gl.uniform1f(U("uRain"), reduce ? 0 : st.rain);
    gl.uniform1f(U("uWet"), st.wet);
    gl.uniform1f(U("uSigns"), st.signs);
    gl.uniform1f(U("uDawn"), st.dawn);
    gl.uniform1f(U("uFog"), st.fog);
    gl.uniform1f(U("uSpill"), st.spill);
    gl.uniform1f(U("uBoardOn"), st.board);
    gl.uniform3f(U("uCar"), st.carT, st.carI, st.carSide);
    blobs.forEach((b, i) => blobArr.set([b.x, 1 - b.y, b.r, blobOn[i].v], i * 4));
    gl.uniform4fv(U("uBlob"), blobArr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    dirty = false;
  };
  raf = requestAnimationFrame(frame);

  // Entrée : travelling avant lent qui se pose (8 s), jamais de boucle.
  tween(st, { dolly: [0.05, 0] }, { duration: 8, ease: [0.22, 1, 0.36, 1] });

  const EASE_TIDE = [0.45, 0, 0.55, 1];
  const halt = (on: boolean) => {
    // Du fond vers nous : les blobs sont triés par profondeur croissante.
    blobs.forEach((_, i) => {
      if (i === lateIdx && blobOn[i].v < 0.5) return;
      const delay = (i / Math.max(1, blobs.length)) * 2;
      if (on) tween(blobOn[i], { v: [blobOn[i].v, 0.3, 0.85, 0.08] }, { duration: 0.5, delay: 0.2 + delay, times: [0, 0.3, 0.45, 1], ease: [0.4, 0, 1, 1] });
      else tween(blobOn[i], { v: [0.08, 0.8, 0.1, 0.6, 0.05, 1] }, { duration: 0.9, delay: 1.6 - delay * 0.8, times: [0, 0.12, 0.2, 0.45, 0.55, 1], ease: [0.2, 0.8, 0.2, 1] });
    });
    tween(st, { signs: on ? 0.15 : 1, spill: on ? 0.25 : 0.55, rain: on ? (def.rain ?? 0.8) * 0.4 : def.rain ?? 0.8, dolly: on ? -0.03 : 0 }, { duration: on ? 3 : 2.2, ease: EASE_TIDE });
  };

  let boardText = opts.board ?? "";
  return {
    setPhase: (p) => {
      if (p === phase) return;
      const wasBreak = phase === "break";
      phase = p;
      if (p === "break") halt(true);
      else if (wasBreak) halt(false);
    },
    setBoard: (text) => {
      if (text === boardText) return;
      boardText = text;
      drawBoard(bctx, text, "#ffc21a", ledFont);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, textures[3]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, boardCanvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      st.board = quad && text ? 1 : 0;
      dirty = true;
    },
    setFriends: () => { /* pas de fenêtres pilotables dans une photo : géré par l'UI */ },
    setDawn: (v) => tween(st, { dawn: v }, { duration: 1.2, ease: EASE_TIDE }),
    flicker: () => {
      const lit = blobOn.map((b, i) => ({ b, i })).filter(({ b, i }) => b.v > 0.5 && i !== lateIdx);
      const pick = lit[Math.floor(Math.random() * lit.length)];
      if (pick) tween(pick.b, { v: [1, 0.15, 0.9, 0.05, 0.7, 0.2, 1] }, { duration: 1.1, times: [0, 0.1, 0.18, 0.32, 0.5, 0.62, 1], ease: [0.2, 0.8, 0.2, 1] });
    },
    extend: () => {
      if (lateIdx < 0) return;
      const b = blobOn[lateIdx];
      if (b.v > 0.5) tween(b, { v: [1, 0.2, 1, 0.3, 1] }, { duration: 0.8, times: [0, 0.2, 0.4, 0.6, 1], ease: [0.2, 0.8, 0.2, 1] });
      else tween(b, { v: [0, 0.8, 0.1, 0.6, 0.05, 1] }, { duration: 0.9, delay: 0.1, times: [0, 0.12, 0.2, 0.45, 0.55, 1], ease: [0.2, 0.8, 0.2, 1] });
    },
    goal: () => {
      if (reduce || st.carI > 0) return;
      // Une voiture passe au bout de la ruelle : phares qui traversent, reflet au sol.
      st.carSide = Math.random() > 0.5 ? 1 : -1;
      st.carT = 0;
      tween(st, { carI: [0, 1, 1, 0] }, { duration: 4.2, times: [0, 0.15, 0.8, 1], ease: EASE_TIDE });
      tween(st, { carT: [0, 1] }, { duration: 4.2, ease: [0.3, 0.1, 0.6, 0.95] });
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPtr);
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteProgram(prog);
    },
  };
}

