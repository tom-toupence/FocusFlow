"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Écran d'arrivée : le wordmark « FocusFlow » repose sous une surface d'eau
// (shader WebGL maison, zéro dépendance) — vagues ambiantes, la déformation
// SUIT LA SOURIS, et chaque clic déclenche une ONDE DE CHOC puis le fondu vers
// le site. Joué à chaque chargement complet de la page (monté dans le layout
// racine → pas rejoué lors des navigations SPA).
// Replis : prefers-reduced-motion ou WebGL2 absent → wordmark statique + fondu.

const IDLE_MS = 3500;      // auto-fondu si aucune interaction
const CLICK_FADE_MS = 750; // délai après clic pour laisser voir l'onde de choc
const FADE_MS = 700;       // durée du fondu de sortie
const MAX_RIPPLES = 8;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec4 u_ripples[${MAX_RIPPLES}]; // xy = centre (px), z = temps de départ (<0 = inactif)
out vec4 outColor;

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 uv = p / u_res;
  vec2 disp = vec2(0.0);

  // Vagues ambiantes douces
  disp += 0.0035 * vec2(
    sin(uv.y * 14.0 + u_time * 0.9) + 0.6 * sin(uv.y * 31.0 - u_time * 0.5),
    cos(uv.x * 11.0 - u_time * 0.7) + 0.6 * cos(uv.x * 27.0 + u_time * 0.4)
  );

  // La vague suit la souris : bosse radiale ondulante autour du curseur (qui est
  // masqué — c'est cette déformation qui matérialise la position du pointeur).
  float md = distance(p, u_mouse);
  float sigma = u_res.y * 0.17;
  float infl = exp(-md * md / (2.0 * sigma * sigma));
  vec2 mdir = md > 0.5 ? (p - u_mouse) / md : vec2(0.0);
  disp += mdir * infl * 0.020 * sin(md * 0.042 - u_time * 3.0);

  // Ondes de choc des clics : anneau amorti qui s'élargit
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = u_ripples[i];
    if (r.z < 0.0) continue;
    float t = u_time - r.z;
    float d = distance(p, r.xy);
    float x = d - t * 620.0;                       // front d'onde (px/s)
    float ring = exp(-x * x / (2.0 * 55.0 * 55.0)); // épaisseur de l'anneau
    float amp = exp(-t * 1.7) * ring;               // amortissement temporel
    vec2 dir = d > 0.5 ? (p - r.xy) / d : vec2(0.0);
    disp += dir * amp * 0.05 * sin(x * 0.09);
  }

  vec3 col = texture(u_tex, clamp(uv + disp, 0.0, 1.0)).rgb;
  // Reflets « caustiques » là où l'eau bouge
  float glint = min((abs(disp.x) + abs(disp.y)) * 5.5, 0.35);
  col += vec3(0.30, 0.50, 0.72) * glint;
  outColor = vec4(col, 1.0);
}`;

const VERT = `#version 300 es
void main() {
  // Triangle plein écran sans buffer
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

// Dessine le wordmark sur un canvas 2D aux dimensions de l'écran → texture.
function drawWordmark(width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, width, height);
  const base = Math.min(width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f3f4f6";
  ctx.font = `600 ${Math.round(base * 0.16)}px Geist, 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText("FocusFlow", width / 2, height / 2 - base * 0.02);
  ctx.fillStyle = "rgba(243,244,246,0.35)";
  ctx.font = `400 ${Math.round(base * 0.035)}px Geist, 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText("Respire. Focus. Flow.", width / 2, height / 2 + base * 0.12);
  return canvas;
}

export default function SplashIntro() {
  const [phase, setPhase] = useState<"show" | "fading" | "done">("show");
  // null = évaluation en cours (SSR + 1er paint : wordmark statique).
  const [canShader, setCanShader] = useState<boolean | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  // Timer d'auto-fondu, réarmé à chaque interaction.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ondes de choc actives : [x, y, startTime, 0] × MAX_RIPPLES (pixels canvas).
  const ripplesRef = useRef(new Float32Array(MAX_RIPPLES * 4).fill(-1));
  const rippleCursorRef = useRef(0);
  // Position lissée du pointeur (x/y suivent tx/ty avec un léger retard).
  const mouseRef = useRef({ x: -9999, y: -9999, tx: -9999, ty: -9999 });

  const armIdle = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (phaseRef.current === "show") setPhase("fading");
    }, IDLE_MS);
  };

  // Capacités + boucle de rendu WebGL.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    const gl = !reduced && canvas ? canvas.getContext("webgl2") : null;
    setCanShader(!!gl);
    armIdle();
    if (!gl || !canvas) {
      // Repli statique : fondu automatique seulement.
      return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;

    // Compilation du programme
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { setCanShader(false); return; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setCanShader(false); return; }
    gl.useProgram(prog);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uRipples = gl.getUniformLocation(prog, "u_ripples");
    gl.uniform2f(uRes, w, h);

    // Texture du wordmark (redessinée après chargement des polices)
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const upload = () => {
      const source = drawWordmark(w, h);
      if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    };
    upload();
    document.fonts?.ready.then(() => { try { upload(); } catch { /* contexte perdu */ } });

    gl.viewport(0, 0, w, h);

    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      // La vague suit la souris avec un léger retard (lerp) → elle « traîne ».
      const m = mouseRef.current;
      m.x += (m.tx - m.x) * 0.12;
      m.y += (m.ty - m.y) * 0.12;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, m.x * dpr, (window.innerHeight - m.y) * dpr);
      gl.uniform4fv(uRipples, ripplesRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Interactions (attachées à window : l'overlay couvre tout l'écran)
    const onMove = (e: PointerEvent) => {
      const m = mouseRef.current;
      if (m.tx < -999) { m.x = e.clientX; m.y = e.clientY; } // 1er mouvement : pas de saut
      m.tx = e.clientX;
      m.ty = e.clientY;
      armIdle();
    };
    const onClick = (e: PointerEvent) => {
      if (phaseRef.current !== "show") return;
      const i = rippleCursorRef.current % MAX_RIPPLES;
      ripplesRef.current[i * 4] = e.clientX * dpr;
      ripplesRef.current[i * 4 + 1] = (window.innerHeight - e.clientY) * dpr;
      ripplesRef.current[i * 4 + 2] = (performance.now() - start) / 1000;
      ripplesRef.current[i * 4 + 3] = 0;
      rippleCursorRef.current++;
      // On laisse l'onde de choc se propager, puis fondu vers le site.
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setTimeout(() => { if (phaseRef.current === "show") setPhase("fading"); }, CLICK_FADE_MS);
    };
    const onKey = () => { if (phaseRef.current === "show") setPhase("fading"); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onClick);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onClick);
      window.removeEventListener("keydown", onKey);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  // Fondu → démontage.
  useEffect(() => {
    if (phase !== "fading") return;
    const t = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden
      className={cn(
        // `cursor-none` : le pointeur système est masqué — c'est la déformation
        // de l'eau qui matérialise sa position.
        "fixed inset-0 z-[200] bg-[#0a0a0c] flex items-center justify-center select-none cursor-none transition-opacity ease-out",
        phase === "fading" ? "opacity-0 duration-700 pointer-events-none" : "opacity-100 duration-300"
      )}
    >
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0 w-full h-full", canShader === false && "hidden")}
      />
      {canShader === false && (
        // Repli statique (reduced motion / pas de WebGL2 / compilation échouée)
        <div className="flex flex-col items-center gap-4 anim-ambient-in">
          <h1 className="text-5xl sm:text-7xl font-semibold text-white tracking-tight">FocusFlow</h1>
          <p className="text-white/35 text-sm sm:text-base">Respire. Focus. Flow.</p>
        </div>
      )}
    </div>
  );
}
