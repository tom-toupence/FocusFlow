"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Fond génératif « flow » du hero (WebGL2 maison, ZÉRO dépendance — même approche
// que SplashIntro). Champ fluide indigo/violet en domain-warping, teinté, qui
// ondule lentement, suit légèrement la souris et se CALME quand on scrolle
// (uniform u_scroll). Replis : prefers-reduced-motion ou pas de WebGL2 → on ne
// rend rien (les halos statiques du hero prennent le relais). Le rAF se met en
// pause quand le hero sort du viewport (IntersectionObserver) ou que l'onglet est
// caché (data-tab-hidden) — pas de GPU gaspillé.

const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;    // pixels (origine bas-gauche)
uniform float u_scroll;  // 0..1 progression de scroll du hero
out vec4 outColor;

float hash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0,0.0)), c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = uv; p.x *= aspect;
  float t = u_time * 0.05;

  // Bosse douce autour de la souris
  vec2 m = u_mouse / u_res; m.x *= aspect;
  float md = distance(p, m);
  float mouseWarp = exp(-md * md * 6.0) * 0.30;

  // Domain warping → aspect « fluide »
  vec2 q = vec2(fbm(p * 1.7 + t), fbm(p * 1.7 + vec2(5.2, 1.3) - t));
  float flow = fbm(p * 1.7 + 2.4 * q + mouseWarp);

  // Veines « caustiques »
  float veins = pow(max(1.0 - abs(flow - 0.5) * 2.0, 0.0), 3.0);

  // Palette : quasi-noir → indigo → violet
  vec3 c1 = vec3(0.045, 0.05, 0.09);
  vec3 c2 = vec3(0.26, 0.22, 0.72);
  vec3 c3 = vec3(0.62, 0.34, 0.95);
  vec3 col = mix(c1, c2, smoothstep(0.30, 0.72, flow));
  col = mix(col, c3, veins * 0.45);
  col += vec3(0.35, 0.45, 0.85) * veins * 0.22;

  // Vignette + apaisement au scroll
  float vig = smoothstep(1.25, 0.15, length(uv - 0.5));
  col *= vig;
  col *= 1.0 - u_scroll * 0.8;

  col = max(col, vec3(0.02));
  outColor = vec4(col, 1.0);
}`;

const VERT = `#version 300 es
void main(){
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

export default function HeroFlowShader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // null = évaluation en cours (SSR + 1er paint) ; false = repli statique.
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    const gl = !reduced && canvas ? canvas.getContext("webgl2", { alpha: false, antialias: false }) : null;
    if (!gl || !canvas) { setEnabled(false); return; }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { setEnabled(false); return; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setEnabled(false); return; }
    gl.useProgram(prog);
    setEnabled(true);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uScroll = gl.getUniformLocation(prog, "u_scroll");

    // DPR plafonné à 1.5 (fond persistant → moins gourmand que le splash).
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = e.clientX - r.left;
      mouse.ty = e.clientY - r.top;
      if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    };
    window.addEventListener("pointermove", onMove);

    const start = performance.now();
    let raf = 0;
    let visible = true;
    const frame = (now: number) => {
      const hidden = document.documentElement.hasAttribute("data-tab-hidden");
      if (visible && !hidden) {
        mouse.x += (mouse.tx - mouse.x) * 0.08;
        mouse.y += (mouse.ty - mouse.y) * 0.08;
        // Progression de scroll du hero (0 en haut → 1 après une hauteur d'écran).
        const scroll = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
        gl.uniform1f(uTime, (now - start) / 1000);
        gl.uniform2f(uMouse, mouse.x * dpr, canvas.height - mouse.y * dpr);
        gl.uniform1f(uScroll, scroll);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Ne dessine que si le hero est visible (économie GPU au scroll).
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  // Repli (reduced-motion / pas de WebGL2) : rien — les halos statiques du hero
  // restent visibles derrière.
  if (enabled === false) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("absolute inset-0 w-full h-full", enabled === null && "opacity-0", "transition-opacity duration-700", className)}
    />
  );
}
