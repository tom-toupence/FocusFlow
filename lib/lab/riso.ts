// LAB 4 · Riso (Paper.js, vectoriel génératif)
//
// Direction : impression risographique deux encres (rose fluo, bleu fédéral)
// en surimpression (multiply) sur papier crème, léger défaut de repérage.
// Un TRACEUR dessine une courbe de niveau par minute autour d'un centre : à
// 25:00, la carte topographique de la session est complète. Distraction : la
// plume tremble et griffonne. Fin de pomodoro : la carte est « tirée », se
// réduit en vignette et rejoint la frise des tirages du jour ; la pause se
// remplit d'un hachurage rose qui monte lentement.
// Paper.js est chargé en UMD navigateur depuis /lab/vendor : le bundler serveur
// de Next suit sinon la branche Node de la lib (jsdom, canvas). Import de types seul.
import type paperNS from "paper/dist/paper-core";

type PaperCore = typeof paperNS;
async function loadPaper(): Promise<PaperCore> {
  const w = window as unknown as { paper?: PaperCore };
  if (w.paper) return w.paper;
  await new Promise<void>((ok, ko) => {
    const s = document.createElement("script");
    s.src = "/lab/vendor/paper-core.min.js";
    s.onload = () => ok();
    s.onerror = () => ko(new Error("paper-core introuvable"));
    document.head.appendChild(s);
  });
  return w.paper!;
}
import { reportInfo } from "@/lib/lab/LabShell";

const PINK = "#ff4fa3";
const BLUE = "#2f56a8";

export interface RisoScene {
  set: (progress: number, phase: string) => void;
  jitter: () => void;
  print: () => void;
  dispose: () => void;
}

export async function createRiso(canvas: HTMLCanvasElement): Promise<RisoScene> {
  const paper = await loadPaper();
  const scope = new paper.PaperScope();
  scope.setup(canvas);
  const { Path, Point, Group, Color } = scope;
  const view = scope.view;

  const ink = (c: string, w: number) => ({ strokeColor: new Color(c), strokeWidth: w, blendMode: "multiply" as const, strokeCap: "round" as const });
  const center = () => new Point(view.size.width * 0.58, view.size.height * 0.48);

  let map = new Group();
  const stamps = new Group();
  let hatch = new Group();
  let seed = Math.random() * 10;
  let drawnMinute = -1;
  let pen: InstanceType<PaperCore["Path"]> | null = null;
  let jitterT = 0;
  let state = { progress: 0, phase: "work" };

  /** Courbe de niveau organique n° k (rayon croissant, ondulations lentes). */
  const contourPoint = (k: number, theta: number) => {
    const R = 22 + k * (Math.min(view.size.width, view.size.height) * 0.0155);
    const r = R * (1 + 0.12 * Math.sin(3 * theta + seed + k * 0.21) + 0.06 * Math.sin(7 * theta - seed * 0.5 + k * 0.13) + 0.03 * Math.sin(13 * theta + k));
    const c = center();
    return new Point(c.x + Math.cos(theta) * r, c.y + Math.sin(theta) * r * 0.82);
  };

  const step = () => {
    const t0 = performance.now();
    if (state.phase === "work") {
      const total = state.progress * 25;
      const minute = Math.floor(total);
      const frac = total - minute;
      if (minute !== drawnMinute) {
        // Minute terminée : la courbe précédente se ferme, une nouvelle commence.
        if (pen) pen.closed = true;
        drawnMinute = minute;
        pen = new Path(ink(minute % 5 === 4 ? PINK : BLUE, minute % 5 === 4 ? 2.4 : 1.1));
        map.addChild(pen);
      }
      if (pen) {
        const target = Math.floor(frac * 180);
        while (pen.segments.length < target) {
          const i = pen.segments.length;
          let p = contourPoint(minute, (i / 180) * Math.PI * 2);
          if (jitterT > 0) p = p.add(new Point((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14));
          pen.add(p);
        }
        pen.smooth({ type: "continuous" });
      }
      if (jitterT > 0) jitterT--;
    } else if (state.phase === "break") {
      // Hachurage rose qui monte (la pause se remplit).
      const h = view.size.height;
      const top = h - state.progress * h * 0.92;
      const want = Math.floor(((h - top) / 9));
      while (hatch.children.length < want) {
        const y = h - hatch.children.length * 9;
        const l = new Path.Line(new Point(-20, y + 30), new Point(view.size.width + 20, y - 30));
        l.set(ink(PINK, 1.4));
        l.opacity = 0.55;
        hatch.addChild(l);
      }
    }
    if (Math.random() < 0.02) reportInfo({ cpuMs: +(performance.now() - t0).toFixed(2), segments: map.children.reduce((a, c) => a + ((c as InstanceType<PaperCore["Path"]>).segments?.length ?? 0), 0) } as never);
  };
  view.onFrame = step;

  return {
    set: (progress, phase) => {
      if (phase !== state.phase) {
        if (phase === "work") { hatch.remove(); hatch = new Group(); }
      }
      state = { progress, phase };
    },
    jitter: () => { jitterT = 40; },
    print: () => {
      // Tirage : la carte se fige avec un défaut de repérage, puis rejoint la frise.
      if (pen) pen.closed = true;
      const done = map;
      const ghost = done.clone();
      ghost.strokeColor = new Color(PINK);
      ghost.position = ghost.position.add(new Point(3, -2));
      const sheet = new Group([done, ghost]);
      const n = stamps.children.length;
      const target = new Point(70 + n * 92, view.size.height - 70);
      const from = sheet.position.clone();
      const fromScale = 1;
      let t = 0;
      const anim = () => {
        t = Math.min(1, t + 1 / 50);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const s = fromScale + (0.14 - fromScale) * e;
        sheet.scaling = new Point(s, s);
        sheet.position = from.add(target.subtract(from).multiply(e));
        if (t < 1) requestAnimationFrame(anim); else stamps.addChild(sheet);
      };
      requestAnimationFrame(anim);
      map = new Group();
      drawnMinute = -1;
      pen = null;
      seed = Math.random() * 10;
    },
    dispose: () => { view.onFrame = null; scope.project.clear(); scope.remove(); },
  };
}
