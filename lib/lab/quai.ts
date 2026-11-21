// LAB 2·4 · Le dernier métro (PixiJS v8, 2D WebGL)
//
// Direction : graphique, signalétique de quai, perspective centrale tenue par
// des lignes (quai, rails, tubes au plafond), aplats et lueurs additives. Au
// premier plan, le PANNEAU D'AFFICHAGE à LED (police à points) annonce le
// prochain train : c'est le temps restant du pomodoro.
//
// Plans : pendant le travail, les phares du train grandissent au fond du
// tunnel à mesure que l'échéance approche ; distraction = « RETARD +1 » qui
// clignote ; fin de pomodoro = le train entre (flash, ralentissement amorti),
// les portes s'ouvrent, la pause se passe dans sa lumière blanche ; reprise =
// les portes se ferment, le train repart, feux rouges qui s'éloignent.
import { Application, Assets, BlurFilter, Container, Graphics, Text } from "pixi.js";
// CSP sans unsafe-eval : Pixi fournit des chemins de rendu précompilés.
import "pixi.js/unsafe-eval";
import { animate } from "motion";
import { reportInfo } from "@/lib/lab/LabShell";

const C = { amber: 0xffb547, neon: 0xe9f2ff, sodium: 0xff9a3c, tail: 0xff3b2b, konbini: 0x53e0a1, ink: 0x0a0d11, tile: 0x1a1e24 };

export interface QuaiScene {
  set: (remainingSec: number, progress: number) => void;
  arrive: () => void;
  depart: () => void;
  delay: () => void;
  dispose: () => void;
}

export async function createQuai(host: HTMLElement): Promise<QuaiScene> {
  await Assets.load([
    { alias: "doto", src: "/lab/fonts/Doto.ttf", data: { family: "Doto" } },
    { alias: "sign", src: "/lab/fonts/BigShoulders.ttf", data: { family: "Big Shoulders" } },
  ]);
  const app = new Application();
  await app.init({ resizeTo: host, background: C.ink, antialias: true, preference: "webgl", resolution: Math.min(window.devicePixelRatio, 1.5), autoDensity: true });
  host.appendChild(app.canvas);

  const world = new Container();
  const glow = new Container();
  glow.blendMode = "add";
  glow.filters = [new BlurFilter({ strength: 14, quality: 3 })];
  const crisp = new Container();
  app.stage.addChild(world, glow, crisp);

  const st = { approach: 0, train: 0, doors: 0, flash: 0, delay: 0, remaining: 1500 };

  // Panneau d'affichage
  const board = new Container();
  const boardBg = new Graphics();
  const l1 = new Text({ text: "PROCHAIN TRAIN", style: { fontFamily: "Doto", fontSize: 26, fill: C.amber, fontWeight: "700", letterSpacing: 2 } });
  const big = new Text({ text: "25 MIN", style: { fontFamily: "Doto", fontSize: 92, fill: C.amber, fontWeight: "700" } });
  const l3 = new Text({ text: "DERNIER TRAIN 01:12", style: { fontFamily: "Doto", fontSize: 22, fill: C.neon, fontWeight: "700", letterSpacing: 1 } });
  const late = new Text({ text: "RETARD +1", style: { fontFamily: "Doto", fontSize: 26, fill: C.tail, fontWeight: "700" } });
  board.addChild(boardBg, l1, big, l3, late);
  crisp.addChild(board);

  const g = new Graphics();
  world.addChild(g);
  const gl = new Graphics();
  glow.addChild(gl);

  let frame = 0;
  const draw = () => {
    const t0 = performance.now();
    const W = app.screen.width, H = app.screen.height;
    const vx = W * 0.66, vy = H * 0.44;
    const P = (x: number, y: number, k: number) => [vx + (x - vx) * k, vy + (y - vy) * k] as const;
    g.clear(); gl.clear();
    // Plafond, murs, sol : trois aplats qui convergent
    g.poly([0, 0, W, 0, vx + 60, vy - 40, vx - 60, vy - 40]).fill({ color: 0x0e1116 });
    g.poly([0, H, W * 0.48, H, vx - 8, vy + 30, vx - 60, vy + 30]).fill({ color: 0x23272d }); // quai
    g.poly([W * 0.48, H, W, H, vx + 60, vy + 30, vx - 8, vy + 30]).fill({ color: 0x0b0d10 }); // voies
    // Bande podotactile jaune au bord du quai
    for (let i = 0; i < 26; i++) {
      const k1 = 1 - i / 26, k2 = 1 - (i + 0.55) / 26;
      const [ax, ay] = P(W * 0.48, H, k1), [bx, by] = P(W * 0.48, H, k2);
      const [cx, cy] = P(W * 0.45, H, k2), [dx, dy] = P(W * 0.45, H, k1);
      g.poly([ax, ay, bx, by, cx, cy, dx, dy]).fill({ color: 0xd9a21b, alpha: 0.85 });
    }
    // Rails
    for (const x of [W * 0.62, W * 0.84]) {
      const [ex, ey] = P(x, H, 0.02);
      g.moveTo(x, H).lineTo(ex, ey).stroke({ width: 3, color: 0x5d636b });
    }
    // Piliers
    for (let i = 0; i < 7; i++) {
      const k = Math.pow(0.72, i);
      const [x0, y0] = P(W * 0.44, 0, k), [, y1] = P(W * 0.44, H, k);
      g.rect(x0 - 10 * k, y0, 22 * k, y1 - y0).fill({ color: 0x15181d });
    }
    // Tubes au plafond (néon blanc froid) : lueurs additives
    for (let i = 0; i < 9; i++) {
      const k = Math.pow(0.78, i);
      const [x0, y0] = P(W * 0.18, 26, k), [x1] = P(W * 0.42, 26, k);
      g.rect(x0, y0, x1 - x0, Math.max(2, 7 * k)).fill({ color: C.neon });
      gl.rect(x0, y0, x1 - x0, Math.max(4, 16 * k)).fill({ color: C.neon, alpha: 0.35 });
    }
    // Tunnel et phares qui approchent
    g.ellipse(vx + 30, vy + 8, 70, 58).fill({ color: 0x050607 });
    const a = st.approach * (1 - st.train);
    for (const dx of [-14, 14]) {
      g.circle(vx + 30 + dx, vy + 30, 2 + a * 4).fill({ color: C.neon });
      gl.circle(vx + 30 + dx, vy + 30, 8 + a * 40).fill({ color: C.neon, alpha: 0.15 + a * 0.5 });
    }
    // Le train : une face avant en perspective qui grandit jusqu'au quai
    if (st.train > 0.001) {
      const k = 0.05 + st.train * 0.95;
      const [x0, y0] = P(W * 0.5, H * 0.22, k), [x1, y1] = P(W * 0.98, H * 0.98, k);
      g.rect(x0, y0, x1 - x0, y1 - y0).fill({ color: 0xb9bec4 });
      g.rect(x0, y0 + (y1 - y0) * 0.86, x1 - x0, (y1 - y0) * 0.06).fill({ color: 0x2f9e6b });
      // Baie vitrée et portes (elles s'écartent)
      const wy0 = y0 + (y1 - y0) * 0.18, wy1 = y0 + (y1 - y0) * 0.78;
      const midx = (x0 + x1) / 2, dw = (x1 - x0) * 0.22;
      g.rect(x0 + (x1 - x0) * 0.06, wy0, (x1 - x0) * 0.88, wy1 - wy0).fill({ color: 0xdfeaf5 });
      const open = st.doors * dw * 0.9;
      g.rect(midx - dw - open, wy0, dw, wy1 - wy0).fill({ color: 0x9aa3ac });
      g.rect(midx + open, wy0, dw, wy1 - wy0).fill({ color: 0x9aa3ac });
      gl.rect(x0, wy0, x1 - x0, wy1 - wy0).fill({ color: C.neon, alpha: 0.25 + st.doors * 0.35 });
      // Feux arrière quand il repart
      if (st.doors < 0.05 && st.train < 0.98) {
        for (const fx of [x0 + (x1 - x0) * 0.1, x1 - (x1 - x0) * 0.1]) gl.circle(fx, y1 - (y1 - y0) * 0.1, 30 * k).fill({ color: C.tail, alpha: 0.6 });
      }
    }
    // Flash d'arrivée
    if (st.flash > 0.001) gl.rect(0, 0, W, H).fill({ color: C.neon, alpha: st.flash * 0.35 });

    // Panneau : en haut à gauche, grand, lisible
    const bw = Math.min(W * 0.42, 560), bh = 220;
    board.position.set(W * 0.05, H * 0.08);
    boardBg.clear().roundRect(0, 0, bw, bh, 6).fill({ color: 0x050607 }).stroke({ width: 3, color: 0x2a2e33 });
    l1.position.set(28, 22);
    big.position.set(24, 52);
    l3.position.set(28, 168);
    late.position.set(bw - late.width - 28, 22);
    late.alpha = st.delay > 0 ? (Math.floor(performance.now() / 160) % 2 ? 1 : 0.15) : 0;
    const m = Math.ceil(st.remaining / 60);
    big.text = st.doors > 0.5 ? "À QUAI" : `${m} MIN`;
    if (++frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - t0).toFixed(2) });
  };
  app.ticker.add(draw);

  return {
    set: (rem, p) => { st.remaining = rem; st.approach = Math.pow(p, 3); },
    arrive: () => {
      // Le train entre : rapide puis long freinage, flash bref, portes après un temps.
      animate(st, { train: [0, 0.82, 1] }, { duration: 2.4, times: [0, 0.45, 1], ease: [0.15, 0.85, 0.25, 1] });
      animate(st, { flash: [0, 1, 0] }, { duration: 0.7, times: [0, 0.2, 1], ease: [0.2, 0.8, 0.2, 1] });
      animate(st, { doors: 1 }, { duration: 1.1, delay: 2.6, ease: [0.3, 0.9, 0.3, 1] });
    },
    depart: () => {
      animate(st, { doors: 0 }, { duration: 0.9, ease: [0.4, 0, 0.6, 1] });
      animate(st, { train: 0 }, { duration: 3, delay: 1.1, ease: [0.55, 0, 0.9, 0.4] });
    },
    delay: () => { st.delay = 1; setTimeout(() => (st.delay = 0), 2200); },
    dispose: () => { app.ticker.remove(draw); app.destroy(true, { children: true }); },
  };
}
