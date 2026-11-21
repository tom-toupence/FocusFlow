// LAB 2·3 · Tour de bureaux (gpu-curtains : WebGPU, plans synchronisés au DOM)
//
// Direction : l'interface elle-même devient une façade. Chaque vignette du
// catalogue est une FENÊTRE d'une tour la nuit : cadre, store à lamelles,
// reflet du ciel et du sodium sur la vitre, lumière intérieure. Le DOM reste
// la source (accessibilité, liens, clavier) ; WebGPU ne fait que l'habiller.
//
// Le temps : chaque minute de travail allume une fenêtre de plus ; les
// fenêtres vertes sont les amis en focus ; survoler une fenêtre lève son store.
// Fin de pomodoro : des fenêtres s'éteignent par étages (la halte).
// Distraction : une fenêtre clignote. Repli sans WebGPU : les vignettes HTML seules.
import { GPUCurtains, Plane } from "gpu-curtains";
import { reportInfo } from "@/lib/lab/LabShell";

const FRAG = /* wgsl */ `
struct VSOutput { @builtin(position) position: vec4f, @location(0) uv: vec2f };
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
@fragment fn main(fsInput: VSOutput) -> @location(0) vec4f {
  let uv = fsInput.uv;
  let img = textureSample(windowTexture, defaultSampler, getUVCover(uv, texturesMatrices.windowTexture.matrix)).rgb;
  // Cadre et meneaux
  let frame = step(uv.x, 0.03) + step(0.97, uv.x) + step(uv.y, 0.04) + step(0.96, uv.y) + step(abs(uv.x - 0.5), 0.008);
  // Store à lamelles : il se lève avec params.open (survol)
  let slat = smoothstep(0.42, 0.5, fract(uv.y * 14.0));
  let blindLine = 1.0 - params.open;
  let blind = step(uv.y, blindLine) * (0.55 + 0.45 * slat);
  // Intérieur : l'image, éclairée selon params.light, teintée si ami
  let warm = mix(vec3f(1.0, 0.78, 0.52), vec3f(0.42, 0.95, 0.68), params.friend);
  var interior = img * (0.12 + params.light * 0.95) * mix(vec3f(1.0), warm, 0.35 * params.light);
  interior = mix(interior, warm * params.light * 0.55 + vec3f(0.02), blind);
  // Reflet sur la vitre : ciel bleu nuit en haut, sodium en bas, bande diagonale
  let refl = mix(vec3f(1.0, 0.6, 0.24) * 0.18, vec3f(0.08, 0.11, 0.16), uv.y) + vec3f(0.06) * smoothstep(0.02, 0.0, abs(uv.x - uv.y * 0.6 - 0.25));
  var col = interior + refl * (1.0 - params.light * 0.7);
  // Clignotement (distraction)
  col *= 1.0 - params.flicker * step(0.5, fract(params.time * 23.0 + hash(uv * 3.0)));
  col = mix(col, vec3f(0.035, 0.038, 0.045), clamp(frame, 0.0, 1.0));
  return vec4f(col, 1.0);
}`;

export interface TourScene {
  setLit: (n: number) => void;
  halt: (on: boolean) => void;
  flicker: () => void;
  dispose: () => void;
}

export async function createTour(container: HTMLElement, items: HTMLElement[], friends: number[]): Promise<TourScene> {
  const curtains = new GPUCurtains({ container, pixelRatio: Math.min(window.devicePixelRatio, 1.5), watchScroll: true });
  await curtains.setDevice();
  const planes: { plane: Plane; light: number; target: number; open: number; openT: number; flicker: number }[] = [];
  items.forEach((el, i) => {
    const plane = new Plane(curtains, el, {
      label: `fenêtre ${i}`,
      shaders: { fragment: { code: FRAG } },
      uniforms: {
        params: {
          struct: {
            light: { type: "f32", value: 0 },
            open: { type: "f32", value: 0 },
            friend: { type: "f32", value: friends.includes(i) ? 1 : 0 },
            flicker: { type: "f32", value: 0 },
            time: { type: "f32", value: 0 },
          },
        },
      },
    });
    const st = { plane, light: 0, target: friends.includes(i) ? 1 : 0, open: 0, openT: 0, flicker: 0 };
    el.addEventListener("pointerenter", () => (st.openT = 1));
    el.addEventListener("pointerleave", () => (st.openT = 0));
    el.addEventListener("focus", () => (st.openT = 1));
    el.addEventListener("blur", () => (st.openT = 0));
    planes.push(st);
  });
  let last = performance.now(), frame = 0;
  curtains.onBeforeRender(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const p of planes) {
      p.light += (p.target - p.light) * (1 - Math.exp(-dt * 4));
      p.open += (p.openT - p.open) * (1 - Math.exp(-dt * 6));
      p.flicker = Math.max(0, p.flicker - dt);
      const u = p.plane.uniforms.params;
      u.light.value = p.light;
      u.open.value = p.open;
      u.flicker.value = p.flicker > 0 ? 1 : 0;
      u.time.value = now / 1000;
    }
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - now).toFixed(2), calls: planes.length });
  });
  const order = planes.map((_, i) => i).sort((a, b) => ((a * 7919) % 31) - ((b * 7919) % 31));
  return {
    setLit: (n) => order.forEach((idx, k) => { if (!friends.includes(idx)) planes[idx].target = k < n ? 1 : 0; }),
    halt: (on) => {
      if (!on) return;
      // Extinction par étages, du haut vers le bas : la tour se met en veille.
      const rows = new Map<number, number[]>();
      items.forEach((el, i) => { const y = Math.round(el.getBoundingClientRect().top); rows.set(y, [...(rows.get(y) ?? []), i]); });
      [...rows.keys()].sort((a, b) => a - b).forEach((y, k) => setTimeout(() => rows.get(y)!.forEach((i) => { if (!friends.includes(i)) planes[i].target = 0.08; }), k * 260));
    },
    flicker: () => { const lit = planes.filter((p) => p.light > 0.5); const p = lit[Math.floor(Math.random() * lit.length)]; if (p) p.flicker = 0.9; },
    dispose: () => curtains.destroy(),
  };
}
