// LAB 3 · Presse (textmode.js, WebGL2)
//
// Direction : éditoriale, papier journal, tout l'écran est une grille de
// caractères. Le pomodoro IMPRIME la ville : ligne après ligne, la photo de
// Séoul apparaît en glyphes à mesure que le temps passe, sous une tête
// d'impression qui crépite. Les minutes restantes sont composées en gros
// caractères bloc. Distraction : une ligne mal imprimée (décalage). Fin de
// pomodoro : la page s'inverse (l'encre devient le fond) pendant la pause.
import { textmode } from "textmode.js";
import { reportInfo } from "@/lib/lab/LabShell";

const DIGITS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
  ":": ["0", "1", "0", "1", "0"],
};

export interface PressScene {
  set: (progress: number, remaining: number, phase: string) => void;
  misprint: () => void;
  dispose: () => void;
}

export async function createPress(canvas: HTMLCanvasElement): Promise<PressScene> {
  const t = textmode.create({ canvas, fontSize: 14, frameRate: 60, pixelDensity: Math.min(window.devicePixelRatio, 1.5) });
  const state = { progress: 0, remaining: 1500, phase: "work", glitch: 0 };
  let img: Awaited<ReturnType<typeof t.loadImage>> | null = null;

  t.setup(async () => {
    img = await t.loadImage("/seoul/02-skyline-nuit.jpg");
    // Rampe inversée : la nuit (sombre) devient de l'encre dense sur le papier.
    img.characters("@%#*+=-:. ").charColorMode("fixed").cellColorMode("fixed").brightnessRange(0, 110);
  });

  let frame = 0;
  t.draw(() => {
    const t0 = performance.now();
    const g = t.grid;
    if (!g || !img) return;
    const cols = g.cols, rows = g.rows;
    const inverted = state.phase === "break";
    const paper = inverted ? "#141414" : "#ebe5d6";
    const ink = inverted ? "#ebe5d6" : "#141414";
    t.background(paper);
    // Sur papier, la nuit doit être de l'encre dense : on inverse la luminance.
    img.charColor(ink).cellColor(paper);

    // Zone imprimée : la photo, rognée jusqu'à la ligne de la tête d'impression.
    const printed = Math.floor(rows * (inverted ? 1 : state.progress));
    if (printed > 0) t.image(img, cols, rows); // dessinée entière, masquée ensuite
    // Masque : le papier vierge sous la tête d'impression.
    t.push();
    t.char(" ");
    t.cellColor(paper);
    t.translate(0, printed / 2, 0);
    t.rect(cols, rows - printed);
    t.pop();
    // Tête d'impression : une ligne qui crépite.
    if (!inverted && printed < rows) {
      t.push();
      t.translate(0, -rows / 2 + printed + 0.5, 0);
      t.charColor("#d2381e");
      t.cellColor(paper);
      t.char("=-:."[frame % 4]);
      t.rect(cols, 1);
      t.pop();
    }
    // Ligne mal imprimée (distraction)
    if (state.glitch > 0) {
      state.glitch--;
      t.push();
      t.translate(((frame * 7) % 9) - 4, -rows / 2 + Math.max(2, printed - 3), 0);
      t.charColor("#d2381e");
      t.cellColor(paper);
      t.char("/");
      t.rect(cols, 2);
      t.pop();
    }
    // Minutes en caractères bloc, en haut à gauche, sur un cartouche papier.
    const mm = String(Math.ceil(state.remaining / 60)).padStart(2, "0");
    const scale = 2;
    const text = mm.split("");
    const w = text.length * 4 * scale + 4, h = 5 * scale + 4;
    t.push();
    t.translate(-cols / 2 + w / 2 + 2, -rows / 2 + h / 2 + 2, 0);
    t.char(" "); t.cellColor(paper); t.rect(w, h);
    t.pop();
    text.forEach((d, i) => {
      DIGITS[d].forEach((row, y) => row.split("").forEach((bit, x) => {
        if (bit !== "1") return;
        t.push();
        t.translate(-cols / 2 + 4 + (i * 4 + x) * scale + scale / 2, -rows / 2 + 4 + y * scale + scale / 2, 0);
        t.char("#"); t.charColor(ink); t.cellColor(paper);
        t.rect(scale, scale);
        t.pop();
      }));
    });
    frame++;
    if (frame % 30 === 0) reportInfo({ cpuMs: +(performance.now() - t0).toFixed(2), cells: cols * rows } as never);
  });

  return {
    set: (progress, remaining, phase) => { state.progress = progress; state.remaining = remaining; state.phase = phase; },
    misprint: () => { state.glitch = 24; },
    dispose: () => t.destroy(),
  };
}
