// Rendu 2.5D d'une vraie photo de rue de nuit (projection caméra, comme en
// motion design). WebGL2 brut, sans dépendance. Textures : public/lab/seoul/,
// produites par scripts/seoul/.
import { POST, SCENE, VERT } from "./shaders";

export type SeoulMode = "work" | "break";

export interface SeoulOptions {
  base?: string;
  reducedMotion?: boolean;
  /** Horloge pilotée par `step()` (captures vidéo image par image), sans boucle. */
  manualClock?: boolean;
}

export interface SeoulRenderer {
  /** Avancée de la nuit (0 début de session, 1 fin). */
  setNight(v: number): void;
  setMode(m: SeoulMode): void;
  /** Fin de pomodoro : une vague de coupures traverse la rue. */
  pomodoroDone(): void;
  /** Objectif atteint : les fenêtres se rallument, une onde monte. */
  goal(): void;
  /** Réaction au pointeur, en -1..1. */
  pointer(x: number, y: number): void;
  /** Horloge manuelle : avance de `dt` secondes et dessine une image. */
  step(dt: number): void;
  dispose(): void;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** WebGL2 avec accélération matérielle (rendu logiciel = image fixe). */
export function supportsSeoul(): boolean {
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

export async function createSeoul(canvas: HTMLCanvasElement, opts: SeoulOptions = {}): Promise<SeoulRenderer> {
  const base = opts.base ?? "/lab/seoul";
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL2 indisponible");
  gl.getExtension("EXT_color_buffer_float");

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const program = (fs: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    return p;
  };
  const scene = program(SCENE);
  const post = program(POST);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Textures de la photo.
  const names = ["layer0", "layer1", "layer2", "layer3", "depth", "masks", "ids"] as const;
  const bitmaps = await Promise.all(names.map((n) => loadBitmap(`${base}/${n}.webp`)));
  const textures = bitmaps.map((bmp, i) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    const isIds = names[i] === "ids";
    const mip = names[i] === "layer0";
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, isIds ? gl.NEAREST : mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, isIds ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    bmp.close();
    return t;
  });
  const imgAspect = bitmaps[0].width / bitmaps[0].height || 1.5;

  // Cible de la passe 1 : couleur + part lumineuse (avec mipmaps pour le bloom).
  let fbo: WebGLFramebuffer | null = null;
  let tColor: WebGLTexture | null = null;
  let tBright: WebGLTexture | null = null;
  let W = 0, H = 0;
  const makeTarget = (w: number, h: number) => {
    if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(tColor); gl.deleteTexture(tBright); }
    const tex = (mips: boolean) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, mips ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1, gl.RGBA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    tColor = tex(false);
    tBright = tex(true);
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tColor, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tBright, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w === W && h === H) return;
    W = w; H = h;
    canvas.width = w; canvas.height = h;
    makeTarget(w, h);
  };
  resize();

  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
  const su = Object.fromEntries(
    ["uL0", "uL1", "uL2", "uL3", "uDepth", "uMasks", "uIds", "uRes", "uImgAspect", "uTime", "uCam", "uZoom", "uFocus", "uNight", "uBreak", "uRain", "uEvent", "uMotion"].map((n) => [n, U(scene, n)]),
  );
  const pu = { uScene: U(post, "uScene"), uBright: U(post, "uBright"), uBloom: U(post, "uBloom") };

  // État animé (lissé vers les cibles à l'horloge, pas à l'image).
  const reduce = !!opts.reducedMotion;
  const state = { night: 0, brk: 0, rain: 0.55, px: 0, py: 0 };
  const target = { night: 0, brk: 0, rain: 0.55, px: 0, py: 0 };
  let event: [number, number] = [0, -100];
  let virtual = 0;
  const clock = () => (opts.manualClock ? virtual : performance.now());
  const start = clock();
  let last = start;
  let raf = 0;
  let disposed = false;
  let visible = true;

  const draw = (now: number) => {
    const t = (now - start) / 1000;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const k = (rate: number) => 1 - Math.exp(-dt * rate);
    state.night += (target.night - state.night) * k(0.8);
    state.brk += (target.brk - state.brk) * k(0.6);          // la pause s'installe en ~4 s
    state.rain += (target.rain - state.rain) * k(0.5);
    state.px += (target.px - state.px) * k(2.0);
    state.py += (target.py - state.py) * k(2.0);
    resize();

    // Caméra : un travelling très lent (courbe de Lissajous de ~70 s), une
    // respiration (zoom) de 14 s, et le pointeur, le tout borné.
    const m = reduce ? 0 : 1;
    const cx = (Math.sin(t * 0.09) * 0.012 + state.px * 0.008) * m;
    const cy = (Math.sin(t * 0.063 + 1.3) * 0.005 + state.py * 0.004) * m;
    const zoom = 1.07 + (reduce ? 0 : Math.sin(t * 0.45) * 0.006);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(scene);
    textures.forEach((tex, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); });
    ["uL0", "uL1", "uL2", "uL3", "uDepth", "uMasks", "uIds"].forEach((n, i) => gl.uniform1i(su[n], i));
    gl.uniform2f(su.uRes, W, H);
    gl.uniform1f(su.uImgAspect, imgAspect);
    gl.uniform1f(su.uTime, t);
    gl.uniform2f(su.uCam, cx, cy);
    gl.uniform1f(su.uZoom, zoom);
    gl.uniform1f(su.uFocus, 0.3);
    gl.uniform1f(su.uNight, state.night);
    gl.uniform1f(su.uBreak, state.brk);
    gl.uniform1f(su.uRain, state.rain);
    gl.uniform3f(su.uEvent, event[0], event[1], 0);
    gl.uniform1f(su.uMotion, m);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0 + 8);
    gl.bindTexture(gl.TEXTURE_2D, tBright);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.viewport(0, 0, W, H);
    gl.useProgram(post);
    gl.activeTexture(gl.TEXTURE0 + 7);
    gl.bindTexture(gl.TEXTURE_2D, tColor);
    gl.uniform1i(pu.uScene, 7);
    gl.uniform1i(pu.uBright, 8);
    gl.uniform1f(pu.uBloom, 0.9);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    if (disposed) return;
    if (visible && !document.hidden) draw(now);
    raf = requestAnimationFrame(loop);
  };
  // Mouvement réduit : une image recalculée à chaque changement d'état.
  const redraw = () => { if (reduce) { last = clock() - 5000; for (let i = 0; i < 40; i++) draw(clock()); } };
  if (reduce) redraw(); else if (!opts.manualClock) raf = requestAnimationFrame(loop);

  // Pause hors écran.
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);

  return {
    setNight(v) { target.night = Math.min(1, Math.max(0, v)); redraw(); },
    setMode(mode) {
      target.brk = mode === "break" ? 1 : 0;
      target.rain = mode === "break" ? 0.9 : 0.55;
      redraw();
    },
    pomodoroDone() { event = [1, (clock() - start) / 1000]; },
    goal() { event = [2, (clock() - start) / 1000]; },
    step(dt) { virtual += dt * 1000; draw(virtual); },
    pointer(x, y) { target.px = x; target.py = y; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      textures.forEach((t) => gl.deleteTexture(t));
      if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(tColor); gl.deleteTexture(tBright); }
      gl.deleteProgram(scene); gl.deleteProgram(post);
      gl.deleteBuffer(buf); gl.deleteVertexArray(vao);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
