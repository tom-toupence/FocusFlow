// Moteur WebGL2 de l'eau (sans dépendance). Responsabilités :
//  . compiler le shader, dessiner un quad plein écran ;
//  . budget de perf : DPR plafonné, résolution interne adaptative (si une
//    image prend > 20 ms en moyenne, on baisse l'échelle), boucle arrêtée
//    quand l'onglet est caché ou la scène hors écran ;
//  . reduced-motion : une seule image, puis plus rien ne bouge ;
//  . événements : goutte, caillou, débordement, niveau, houle, reflet.
import { FRAG, MAX_RIPPLES, VERT } from "./shader";

export interface WaterOptions {
  level?: number;
  swell?: number;
  reflet?: string;
  pole?: boolean;
  poleX?: number;
  /** Plafond de DPR (défaut 1.5 ; 1 sur mobile). */
  maxDpr?: number;
  reducedMotion?: boolean;
}

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0.25, 0.27, 0.33];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export class WaterRenderer {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private raf = 0;
  private start = performance.now();
  private running = false;
  private visible = true;
  private onScreen = true;
  private ripples = new Float32Array(MAX_RIPPLES * 4).fill(-1);
  private nextRipple = 0;
  private scale = 1;
  private frameTimes: number[] = [];
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private onVis = () => { this.visible = !document.hidden; this.sync(); };

  // État animé côté CPU : on interpole vers les cibles (l'eau se pose).
  private level = 0.4;
  private levelTarget = 0.4;
  private levelVel = 0;
  private swell = 0;
  private swellTarget = 0;
  private reflet: RGB = [0.24, 0.3, 0.42];
  private refletTarget: RGB = [0.24, 0.3, 0.42];
  private pole = 1;
  private poleX = -0.55;
  private maxDpr: number;
  private reduced: boolean;

  constructor(private canvas: HTMLCanvasElement, opts: WaterOptions = {}) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!gl) throw new Error("WebGL2 indisponible");
    this.gl = gl;
    this.prog = this.compile();
    this.maxDpr = opts.maxDpr ?? (matchMedia("(pointer: coarse)").matches ? 1 : 1.5);
    this.reduced = !!opts.reducedMotion;
    this.level = this.levelTarget = opts.level ?? 0.4;
    this.swell = this.swellTarget = opts.swell ?? 0;
    if (opts.reflet) this.reflet = this.refletTarget = hexToRgb(opts.reflet);
    this.pole = opts.pole === false ? 0 : 1;
    if (opts.poleX !== undefined) this.poleX = opts.poleX;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => { this.onScreen = e.isIntersecting; this.sync(); });
    this.io.observe(canvas);
    document.addEventListener("visibilitychange", this.onVis);
    this.resize();
    this.running = true;
    this.sync();
  }

  private compile(): WebGLProgram {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["u_res", "u_time", "u_level", "u_swell", "u_reflet", "u_sodium", "u_deep", "u_sky", "u_pole", "u_poleX", "u_paper", "u_ripples"]) {
      this.u[n] = gl.getUniformLocation(p, n);
    }
    gl.uniform3f(this.u.u_sodium, 0.96, 0.66, 0.32);
    gl.uniform3f(this.u.u_deep, 0.02, 0.035, 0.06);
    gl.uniform3f(this.u.u_sky, 0.035, 0.045, 0.075);
    gl.uniform1f(this.u.u_paper, 0);
    return p;
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr) * this.scale;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
    if (this.reduced) this.draw(performance.now());
  }

  /** Démarre ou arrête la boucle selon visibilité, écran et reduced-motion. */
  private sync() {
    const should = this.running && this.visible && this.onScreen && !this.reduced;
    if (should && !this.raf) this.raf = requestAnimationFrame(this.loop);
    if (!should && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (this.reduced) this.draw(performance.now());
  }

  private loop = (now: number) => {
    this.raf = 0;
    const t0 = performance.now();
    this.step(1 / 60);
    this.draw(now);
    this.adapt(performance.now() - t0, now);
    this.sync();
  };

  private lastAdapt = 0;
  private prevNow = 0;
  /** Résolution adaptative : mesure l'intervalle réel entre images. */
  private adapt(_cpu: number, now: number) {
    if (this.prevNow) this.frameTimes.push(now - this.prevNow);
    this.prevNow = now;
    if (this.frameTimes.length < 45 || now - this.lastAdapt < 1500) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    this.lastAdapt = now;
    if (avg > 20 && this.scale > 0.5) { this.scale = Math.max(0.5, this.scale - 0.15); this.resize(); }
    else if (avg < 14 && this.scale < 1) { this.scale = Math.min(1, this.scale + 0.1); this.resize(); }
  }

  /** Ressort amorti : l'eau monte, dépasse un peu, se pose. */
  private step(dt: number) {
    const k = 18, c = 7.5;
    const a = k * (this.levelTarget - this.level) - c * this.levelVel;
    this.levelVel += a * dt;
    this.level += this.levelVel * dt;
    this.swell += (this.swellTarget - this.swell) * Math.min(1, dt * 1.2);
    for (let i = 0; i < 3; i++) this.reflet[i] += (this.refletTarget[i] - this.reflet[i]) * Math.min(1, dt * 1.5);
  }

  private draw(now: number) {
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.u_time, (now - this.start) / 1000);
    gl.uniform1f(this.u.u_level, this.reduced ? this.levelTarget : this.level);
    gl.uniform1f(this.u.u_swell, this.reduced ? 0 : this.swell);
    gl.uniform3fv(this.u.u_reflet, this.reduced ? this.refletTarget : this.reflet);
    gl.uniform1f(this.u.u_pole, this.pole);
    gl.uniform1f(this.u.u_poleX, this.poleX);
    gl.uniform4fv(this.u.u_ripples, this.ripples);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ── API publique ───────────────────────────────────────────────────────

  setLevel(v: number, instant = false) {
    this.levelTarget = Math.max(0, Math.min(1.1, v));
    if (instant || this.reduced) { this.level = this.levelTarget; this.levelVel = 0; }
    if (this.reduced) this.draw(performance.now());
  }

  setSwell(v: number) { this.swellTarget = Math.max(0, Math.min(1, v)); }

  setReflet(hex: string) {
    this.refletTarget = hexToRgb(hex);
    if (this.reduced) { this.reflet = this.refletTarget; this.draw(performance.now()); }
  }

  setPole(on: boolean, x?: number) {
    this.pole = on ? 1 : 0;
    if (x !== undefined) this.poleX = x;
  }

  /** Convertit un point écran (px CSS, relatif au canvas) en point du plan d'eau. */
  private screenToWater(px: number, py: number): [number, number] | null {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const ux = (px - w / 2) / h, uy = (h / 2 - py) / h;
    const dir = [ux * 1.15, (uy - 0.06) * 1.15, -1];
    const len = Math.hypot(dir[0], dir[1], dir[2]);
    const dy = dir[1] / len;
    if (dy > -1e-3) return null;
    const waterY = -0.6 + this.level * 1.6;
    const t = (waterY - 1.25) / dy;
    return [(dir[0] / len) * t, (dir[2] / len) * t];
  }

  private pushRipple(x: number, z: number, strength: number) {
    if (this.reduced) return;
    const i = this.nextRipple * 4;
    this.ripples[i] = x;
    this.ripples[i + 1] = z;
    this.ripples[i + 2] = (performance.now() - this.start) / 1000;
    this.ripples[i + 3] = strength;
    this.nextRipple = (this.nextRipple + 1) % MAX_RIPPLES;
  }

  /** Goutte (changement de piste, ami qui passe en focus). Coordonnées CSS, ou au hasard au loin. */
  drop(px?: number, py?: number, strength = 1) {
    const hit = px !== undefined && py !== undefined ? this.screenToWater(px, py) : null;
    const [x, z] = hit ?? [(Math.random() - 0.5) * 3, -3 - Math.random() * 4];
    this.pushRipple(x, z, strength);
  }

  /** Caillou au bord (distraction) : onde plus serrée, depuis le premier plan. */
  stone() {
    this.pushRipple((Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.6), -2.2, -1.1);
  }

  /** Débordement (fin de pomodoro) : l'eau monte au-dessus de la cible puis redescend. */
  overflow(settleTo: number) {
    this.levelVel += 1.6;
    this.levelTarget = Math.max(0, Math.min(1.1, settleTo));
    this.pushRipple(0, -2.6, 1.4);
  }

  dispose() {
    this.running = false;
    this.sync();
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    // Pas de loseContext() : le même <canvas> peut être remonté (StrictMode,
    // navigation) et getContext() renverrait le contexte perdu. On libère
    // seulement nos ressources ; le contexte part avec le canvas.
    this.gl.deleteProgram(this.prog);
  }
}
