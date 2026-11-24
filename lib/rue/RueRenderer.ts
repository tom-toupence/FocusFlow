// Rue de nuit en vraie projection caméra. WebGL2 brut, sans dépendance.
// Chaque plan (public/rue/layerK.webp) est une grille de sommets
// poussés à leur profondeur (depth.webp) : vue depuis la position d'origine,
// la scène redonne exactement la photo ; dès que la caméra avance ou tourne,
// la perspective est vraie (le proche grossit et glisse plus que le loin).
import { MESH_FRAG, MESH_VERT, POST, QUAD_VERT } from "./shaders";
import { MAX_FRIEND_WINDOWS, scanWindowIds, type FriendWindow, type RueWindow } from "./friendWindows";

export type RueMode = "work" | "break";

/** Une photo préparée (public/rue/<id>/) et ses réglages. */
export interface RueScene {
  base: string;
  /** Dosage de l'étalonnage néon (0..1). */
  style?: number;
  /** Décentrement vertical du cadre (1 = garder le bas, le sol). */
  frameY?: number;
  /** Intensité de la pluie (0 = temps sec, photo de jour ; défaut 0,55). */
  rain?: number;
}

export interface RueOptions {
  /** Plusieurs scènes : elles se relaient (voir `interval`). */
  scenes?: RueScene[];
  /** Durée d'une scène, en secondes : tirée entre ces deux bornes. */
  interval?: [number, number];
  /** Appelé quand une nouvelle scène s'allume (son index). */
  onScene?: (index: number) => void;
  base?: string;
  reducedMotion?: boolean;
  /** Horloge pilotée par `step()` (captures vidéo image par image), sans boucle. */
  manualClock?: boolean;
  /** Décentrement vertical du cadre (-1..1 de la marge disponible) : 1 = garder le bas de la photo (le sol). */
  frameY?: number;
}

export interface RueRenderer {
  setNight(v: number): void;
  setMode(m: RueMode): void;
  pomodoroDone(): void;
  goal(): void;
  /** Réaction au pointeur, en -1..1. */
  pointer(x: number, y: number): void;
  step(dt: number): void;
  /** 0 = couleurs de la photo, 1 = étalonnage néon. */
  setStyle(v: number): void;
  /** Passe tout de suite à la scène suivante (ou à `index`). */
  nextScene(index?: number): void;
  /** Avancée de la caméra pilotée de l'extérieur (défilement de la page), 0..1. */
  setScroll(v: number): void;
  /** Suspend le rendu (vidéo par-dessus, section hors écran). */
  setPaused(v: boolean): void;
  /** Les fenêtres de la scène courante (lues une fois dans ids.webp, puis en cache). */
  windows(): Promise<{ base: string; windows: RueWindow[] }>;
  /** Fenêtres des amis (16 au plus). Vidé à chaque changement de scène. */
  setFriendWindows(list: FriendWindow[]): void;
  /** Fait pulser une fenêtre (survol de la liste des amis) ; `null` arrête. */
  highlightWindow(id: number | null): void;
  /** Position à l'écran (px CSS, relatifs au canvas) des fenêtres des amis. */
  locateFriendWindows(): { id: number; x: number; y: number; r: number }[];
  dispose(): void;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** WebGL2 avec accélération matérielle (rendu logiciel = image fixe). */
export function supportsRue(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    let force = false;
    try { force = localStorage.getItem("focusflow-force-webgl") === "1"; } catch { /* stockage indisponible */ }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return force || !SOFTWARE.test(name);
  } catch {
    return false;
  }
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
}

// Fenêtres d'une scène : lues une seule fois par scène (et par page), avec la
// disparité à leur centre (pour les placer à l'écran au survol).
const windowCache = new Map<string, Promise<RueWindow[]>>();
function sceneWindows(base: string): Promise<RueWindow[]> {
  let p = windowCache.get(base);
  if (!p) {
    p = (async () => {
      const [ids, depth] = await Promise.all([loadBitmap(`${base}/ids.webp`), loadBitmap(`${base}/depth.webp`)]);
      const c = document.createElement("canvas");
      c.width = ids.width; c.height = ids.height;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(ids, 0, 0);
      const list = scanWindowIds(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      ctx.drawImage(depth, 0, 0, c.width, c.height);
      for (const w of list) {
        const d = ctx.getImageData(Math.min(c.width - 1, Math.floor(w.cx * c.width)), Math.min(c.height - 1, Math.floor(w.cy * c.height)), 1, 1).data;
        w.depth = Math.max(d[0], d[1], d[2], d[3]) / 255;
      }
      ids.close(); depth.close();
      return list;
    })();
    p.catch(() => windowCache.delete(base));
    windowCache.set(base, p);
  }
  return p;
}

// ── Matrices (colonnes, comme WebGL) ─────────────────────────────────────────
type M4 = Float32Array;
const mul = (a: M4, b: M4): M4 => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
};
/** Perspective avec décentrement vertical de l'objectif (sy, en unités NDC), comme un objectif à bascule. */
const projection = (tx: number, ty: number, n: number, f: number, sy = 0): M4 =>
  new Float32Array([1 / tx, 0, 0, 0, 0, 1 / ty, 0, 0, 0, sy, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
/** Vue d'une caméra placée en `p`, tournée de `yaw` (autour de y) puis `pitch` (autour de x). */
const view = (p: [number, number, number], yaw: number, pitch: number): M4 => {
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw), cp = Math.cos(-pitch), sp = Math.sin(-pitch);
  const ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
  const rx = new Float32Array([1, 0, 0, 0, 0, cp, sp, 0, 0, -sp, cp, 0, 0, 0, 0, 1]);
  const t = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1]);
  return mul(rx, mul(ry, t));
};

export async function createRue(canvas: HTMLCanvasElement, opts: RueOptions = {}): Promise<RueRenderer> {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL2 indisponible");

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const program = (vs: string, fs: string, attr: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, attr);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    return p;
  };
  const meshProg = program(MESH_VERT, MESH_FRAG, "aUv");
  const postProg = program(QUAD_VERT, POST, "aPos");

  // ── Une scène = 7 textures + une grille au format de la photo ──────────
  const names = ["layer0", "layer1", "layer2", "layer3", "depth", "masks", "ids"] as const;
  interface Loaded { tex: Record<string, WebGLTexture>; aspect: number; texW: number; vao: WebGLVertexArrayObject; vb: WebGLBuffer; ib: WebGLBuffer; count: number; spec: RueScene }
  const loadScene = async (spec: RueScene): Promise<Loaded> => {
    const bitmaps = await Promise.all(names.map((n) => loadBitmap(`${spec.base}/${n}.webp`)));
    const tex: Record<string, WebGLTexture> = {};
    bitmaps.forEach((bmp, i) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      const nearest = names[i] === "ids";
      const mip = names[i].startsWith("layer");
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      tex[names[i]] = t;
    });
    const aspect = bitmaps[0].width / bitmaps[0].height || 1.5;
    const texW = bitmaps[0].width || 1920;
    bitmaps.forEach((b) => b.close());
    // Grille commune aux 4 plans (le relief vient de la texture de profondeur).
    const GX = 320, GY = Math.round(320 / aspect);
    const uvs = new Float32Array((GX + 1) * (GY + 1) * 2);
    for (let y = 0, k = 0; y <= GY; y++) for (let x = 0; x <= GX; x++) { uvs[k++] = x / GX; uvs[k++] = y / GY; }
    const idx = new Uint32Array(GX * GY * 6);
    for (let y = 0, k = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
      const a = y * (GX + 1) + x, b = a + 1, c = a + GX + 1, d = c + 1;
      idx.set([a, c, b, b, c, d], k); k += 6;
    }
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { tex, aspect, texW, vao, vb, ib, count: idx.length, spec };
  };
  const freeScene = (sc: Loaded) => {
    Object.values(sc.tex).forEach((t) => gl.deleteTexture(t));
    gl.deleteBuffer(sc.vb); gl.deleteBuffer(sc.ib); gl.deleteVertexArray(sc.vao);
  };

  const specs: RueScene[] = opts.scenes?.length ? opts.scenes : [{ base: opts.base ?? "/rue", style: 1, frameY: opts.frameY }];
  let curIndex = 0;
  let cur = await loadScene(specs[0]);
  let pending: Loaded | null = null;
  let pendingIndex = -1;
  let loading = false;

  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Cible de la passe 1 : couleur (mips pour la brume), part lumineuse (mips
  // pour le bloom), profondeur relative ; tampon de profondeur.
  let fbo: WebGLFramebuffer | null = null;
  let rb: WebGLRenderbuffer | null = null;
  const tgt: WebGLTexture[] = [];
  let W = 0, H = 0;
  const makeTarget = (w: number, h: number) => {
    if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteRenderbuffer(rb); tgt.forEach((t) => gl.deleteTexture(t)); tgt.length = 0; }
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    for (let i = 0; i < 3; i++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      const mips = i < 2;
      gl.texStorage2D(gl.TEXTURE_2D, mips ? levels : 1, gl.RGBA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      tgt.push(t);
    }
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    tgt.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w === W && h === H) return;
    W = w; H = h; canvas.width = w; canvas.height = h;
    makeTarget(w, h);
  };
  resize();

  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
  const mu = Object.fromEntries(["uDepth", "uLayer", "uProj", "uView", "uTan", "uZ", "uColor", "uMasks", "uIds", "uTime", "uNight", "uBreak", "uRain", "uMotion", "uEvent", "uTexW", "uFriendWin", "uFriendN", "uFriendHi"].map((n) => [n, U(meshProg, n)]));
  const pu = Object.fromEntries(["uScene", "uBright", "uDepthTex", "uRes", "uTime", "uNight", "uBreak", "uRain", "uMotion", "uRainDrift", "uStyle", "uFade"].map((n) => [n, U(postProg, n)]));

  // Optique de la photo : champ vertical supposé de 50 degrés.
  const TAN_Y = Math.tan((50 * Math.PI) / 180 / 2);
  const Z_NEAR = 1.0, Z_FAR = 9.0;

  const reduce = !!opts.reducedMotion;
  const RAIN = 0.55;
  /** En pause, la pluie redouble (multiplicateur de la pluie de la scène). */
  const BREAK_RAIN = 1.65;
  const state = { night: 0, brk: 0, rain: specs[0].rain ?? RAIN, px: 0, py: 0, scroll: 0 };
  const target = { night: 0, brk: 0, rain: specs[0].rain ?? RAIN, px: 0, py: 0, scroll: 0 };
  let paused = false;
  let event: [number, number] = [0, -100];
  // Fenêtres des amis : mises à jour seulement quand leur état change.
  const friendWin = new Float32Array(MAX_FRIEND_WINDOWS * 4);
  let friendN = 0;
  let friendHi: [number, number] = [0, 0];
  let friendIds: number[] = [];
  const now = () => (clock() - start) / 1000;
  // Dernière caméra dessinée (pour placer les fenêtres au survol).
  let lastProj: M4 | null = null, lastView: M4 | null = null, lastTanX = 1;
  let known: { base: string; windows: RueWindow[] } | null = null;
  let style = specs[0].style ?? 1;
  // Relais des scènes : `fade` = lumière de la rue (0 = éteinte), `phase` =
  // « off » (on éteint), « swap » (dans le noir), « on » (on rallume).
  let fade = 1;
  let phase: "idle" | "off" | "on" = "idle";
  let phaseT = 0;
  const [imin, imax] = opts.interval ?? [15, 20];
  const pickInterval = () => imin + Math.random() * Math.max(0, imax - imin);
  let nextAt = pickInterval();
  const prepareNext = (index?: number) => {
    if (specs.length < 2 || loading) return;
    const target = index ?? (curIndex + 1) % specs.length;
    if (pending && pendingIndex === target) return;
    loading = true;
    loadScene(specs[target]).then((sc) => {
      loading = false;
      if (disposed) { freeScene(sc); return; }
      if (pending) freeScene(pending);
      pending = sc; pendingIndex = target;
    }).catch(() => { loading = false; });
  };
  let virtual = 0;
  const clock = () => (opts.manualClock ? virtual : performance.now());
  const start = clock();
  let last = start, raf = 0, disposed = false, visible = true;
  prepareNext();

  const draw = (now: number) => {
    const t = (now - start) / 1000;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const k = (rate: number) => 1 - Math.exp(-dt * rate);
    state.night += (target.night - state.night) * k(0.8);
    state.brk += (target.brk - state.brk) * k(0.6);
    state.rain += (target.rain - state.rain) * k(0.5);
    state.px += (target.px - state.px) * k(1.6);
    state.py += (target.py - state.py) * k(1.6);
    state.scroll += (target.scroll - state.scroll) * k(3);
    resize();

    // Relais : à l'heure dite (et si la suivante est prête), la rue s'éteint
    // en 0,8 s, on change d'image dans le noir, la nouvelle se rallume en
    // 1,6 s avec la vague de rallumage des enseignes.
    if (phase === "idle" && specs.length > 1 && t >= nextAt && pending) { phase = "off"; phaseT = t; }
    if (phase === "off") {
      fade = Math.max(0, 1 - (t - phaseT) / 0.8);
      if (fade <= 0 && pending) {
        freeScene(cur);
        cur = pending; curIndex = pendingIndex; pending = null; pendingIndex = -1;
        style = cur.spec.style ?? 1;
        state.rain = target.rain = (cur.spec.rain ?? RAIN) * (target.brk > 0.5 ? BREAK_RAIN : 1);   // changé dans le noir
        friendN = 0; friendIds = []; friendHi = [0, 0];   // autres fenêtres : RueScene réattribue
        opts.onScene?.(curIndex);
        phase = "on"; phaseT = t;
        event = [1, t - 0.6];            // les enseignes se rallument en vague
        prepareNext();
      }
    } else if (phase === "on") {
      const u = Math.min(1, (t - phaseT) / 1.6);
      fade = u * u * (3 - 2 * u);
      if (u >= 1) { phase = "idle"; fade = 1; nextAt = t + pickInterval(); }
    }
    const imgAspect = cur.aspect;
    const TAN_X = TAN_Y * imgAspect;

    // Caméra : on avance lentement dans la rue puis on recule (60 s), on
    // dérive de côté, on tourne et bascule à peine ; le pointeur incline le
    // regard. Amplitudes bornées par la bande reconstituée derrière les plans.
    const m = reduce ? 0 : 1;
    // Le défilement pousse la caméra dans la rue (en plus de la respiration
    // lente) et la fait légèrement monter : c'est la parallaxe de la landing.
    const dolly = ((0.5 - 0.5 * Math.cos(t * 0.105)) * 0.11 * (1 - 0.5 * state.scroll) + state.scroll * 0.12) * m;
    const pos: [number, number, number] = [
      (Math.sin(t * 0.07) * 0.05 + state.px * 0.035) * m,
      (Math.sin(t * 0.053 + 1.1) * 0.018 - state.py * 0.018 + state.scroll * 0.02) * m,
      -dolly,
    ];
    const yaw = (Math.sin(t * 0.061 + 0.4) * 0.014 - state.px * 0.022) * m;
    const pitch = (Math.sin(t * 0.047) * 0.006 - state.py * 0.011) * m;

    // Couverture du canvas, avec une marge pour que les bords ne se voient jamais.
    const A = W / H, margin = 0.9;
    let tx: number, ty: number;
    if (A > imgAspect) { tx = TAN_X * margin; ty = tx / A; } else { ty = TAN_Y * margin; tx = ty * A; }
    // Décentrement : la part de photo hors cadre en haut et en bas peut être
    // répartie (frameY > 0 garde le bas, donc le sol). Bornée à la marge.
    const spareY = Math.max(0, TAN_Y - ty) / ty;                 // en unités NDC
    const proj = projection(tx, ty, 0.05, 50, -spareY * Math.min(1, Math.max(-1, cur.spec.frameY ?? 0)) * 0.85);
    const vw = view(pos, yaw, pitch);
    lastProj = proj; lastView = vw; lastTanX = TAN_X;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(meshProg);
    gl.bindVertexArray(cur.vao);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cur.tex.depth);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, cur.tex.masks);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, cur.tex.ids);
    gl.uniform1i(mu.uDepth, 1); gl.uniform1i(mu.uMasks, 2); gl.uniform1i(mu.uIds, 3); gl.uniform1i(mu.uColor, 0);
    gl.uniformMatrix4fv(mu.uProj, false, proj);
    gl.uniformMatrix4fv(mu.uView, false, vw);
    gl.uniform2f(mu.uTan, TAN_X, TAN_Y);
    gl.uniform2f(mu.uZ, Z_NEAR, Z_FAR);
    gl.uniform1f(mu.uTime, t);
    gl.uniform1f(mu.uNight, state.night);
    gl.uniform1f(mu.uBreak, state.brk);
    gl.uniform1f(mu.uRain, state.rain);
    gl.uniform1f(mu.uMotion, m);
    gl.uniform3f(mu.uEvent, event[0], event[1], 0);
    gl.uniform1f(mu.uTexW, cur.texW);
    gl.uniform4fv(mu.uFriendWin, friendWin);
    gl.uniform1i(mu.uFriendN, friendN);
    gl.uniform2f(mu.uFriendHi, friendHi[0], friendHi[1]);
    // Du fond vers l'avant, chaque plan PAR-DESSUS le précédent : le tampon
    // de profondeur est vidé entre deux plans (il ne sert qu'à l'intérieur
    // d'un plan). Sinon un plan arrière, qui garde loin des silhouettes la
    // profondeur d'origine de ce qu'il cache, masquerait le vrai premier plan.
    for (let l = 0; l < 4; l++) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cur.tex[`layer${l}`]);
      gl.uniform1i(mu.uLayer, l);
      gl.drawElements(gl.TRIANGLES, cur.count, gl.UNSIGNED_INT, 0);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (let i = 0; i < 2; i++) { gl.bindTexture(gl.TEXTURE_2D, tgt[i]); gl.generateMipmap(gl.TEXTURE_2D); }

    gl.viewport(0, 0, W, H);
    gl.useProgram(postProg);
    gl.bindVertexArray(quadVao);
    tgt.forEach((tt, i) => { gl.activeTexture(gl.TEXTURE4 + i); gl.bindTexture(gl.TEXTURE_2D, tt); });
    gl.uniform1i(pu.uScene, 4); gl.uniform1i(pu.uBright, 5); gl.uniform1i(pu.uDepthTex, 6);
    gl.uniform2f(pu.uRes, W, H);
    gl.uniform1f(pu.uTime, t);
    gl.uniform1f(pu.uNight, state.night);
    gl.uniform1f(pu.uBreak, state.brk);
    gl.uniform1f(pu.uRain, state.rain);
    gl.uniform1f(pu.uMotion, m);
    gl.uniform2f(pu.uRainDrift, pos[0] + yaw, -pos[1] - pitch);
    gl.uniform1f(pu.uStyle, style);
    gl.uniform1f(pu.uFade, fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    if (disposed) return;
    if (visible && !paused && !document.hidden) draw(now);
    raf = requestAnimationFrame(loop);
  };
  const redraw = () => { if (reduce) { last = clock() - 5000; for (let i = 0; i < 40; i++) draw(clock()); } };
  if (reduce) redraw(); else if (!opts.manualClock) raf = requestAnimationFrame(loop);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);

  return {
    setNight(v) { target.night = Math.min(1, Math.max(0, v)); redraw(); },
    setMode(mode) { target.brk = mode === "break" ? 1 : 0; target.rain = (cur.spec.rain ?? RAIN) * (mode === "break" ? BREAK_RAIN : 1); redraw(); },
    pomodoroDone() { event = [1, (clock() - start) / 1000]; },
    goal() { event = [2, (clock() - start) / 1000]; },
    pointer(x, y) { target.px = x; target.py = y; },
    setScroll(v) { target.scroll = Math.min(1, Math.max(0, v)); },
    setPaused(v) { paused = v; },
    async windows() {
      const base = cur.spec.base;
      const res = { base, windows: await sceneWindows(base) };
      known = res;
      return res;
    },
    setFriendWindows(list) {
      friendWin.fill(0);
      const t = now(), wall = Date.now();
      const kept = list.slice(0, MAX_FRIEND_WINDOWS);
      kept.forEach((f, i) => {
        friendWin[i * 4] = f.windowId;
        friendWin[i * 4 + 1] = f.state === "focus" ? 2 : f.state === "on" ? 1 : 0;
        friendWin[i * 4 + 2] = f.flickerAt ? t + (f.flickerAt - wall) / 1000 : -100;
      });
      friendN = kept.length;
      friendIds = kept.map((f) => f.windowId);
      redraw();
    },
    highlightWindow(id) {
      friendHi = id ? [id, now()] : [0, 0];
      redraw();
    },
    locateFriendWindows() {
      if (!lastProj || !lastView || !friendIds.length) return [];
      if (!known || known.base !== cur.spec.base) return [];
      const m = mul(lastProj, lastView);
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      return known.windows.filter((w) => friendIds.includes(w.id)).map((w) => {
        const z = 1 / ((1 / Z_FAR) + (1 / Z_NEAR - 1 / Z_FAR) * (w.depth ?? 0.3));
        const p = [(w.cx - 0.5) * 2 * lastTanX * z, -(w.cy - 0.5) * 2 * TAN_Y * z, -z, 1];
        const c = [0, 1, 2, 3].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r] * p[3]);
        const x = (c[0] / c[3] * 0.5 + 0.5) * cw, y = (0.5 - c[1] / c[3] * 0.5) * ch;
        // Rayon : la taille de la fenêtre ramenée à l'écran (grossièrement).
        const r = Math.sqrt(w.area / Math.PI) * (cw / cur.texW) / 0.9;
        return { id: w.id, x, y, r };
      });
    },
    step(dt) { virtual += dt * 1000; draw(virtual); },
    setStyle(v) { style = Math.min(1, Math.max(0, v)); redraw(); },
    nextScene(index) {
      if (specs.length < 2) return;
      if (index !== undefined && index !== pendingIndex) { if (pending) { freeScene(pending); pending = null; pendingIndex = -1; } prepareNext(index); }
      nextAt = 0;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      freeScene(cur);
      if (pending) freeScene(pending);
      if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteRenderbuffer(rb); tgt.forEach((t) => gl.deleteTexture(t)); }
      gl.deleteProgram(meshProg); gl.deleteProgram(postProg);
      gl.deleteBuffer(qb);
      gl.deleteVertexArray(quadVao);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
