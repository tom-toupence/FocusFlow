"use client";

import { WrappedData, formatWrappedMinutes, wrappedWeekLabel } from "@/lib/wrapped";

// Draws the shareable 1080×1350 recap card with the native Canvas 2D API
// (no dependency) and triggers a PNG download.

// Palette de la nuit (globals.css, `.dark`) en valeurs fixes : le PNG ne
// dépend pas du thème affiché.
const C = {
  bg: "#0b1016", bg2: "#121a23", line: "rgba(235,240,245,0.12)",
  text: "#eef2f5", text2: "rgba(238,242,245,0.72)", text3: "rgba(238,242,245,0.5)",
  sodium: "#ff9a3c", konbini: "#5fd38d", taxi: "#f5c542", unlit: "rgba(238,242,245,0.07)", tail: "#ff6b5c",
};

/** Famille réelle d'une police next/font, lue sur sa variable CSS. */
function fontVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

function drawCard(data: WrappedData): HTMLCanvasElement {
  const W = 1080, H = 1350, M = 80;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const sign = fontVar("--font-signage", "Impact, sans-serif");
  const led = fontVar("--font-doto", "ui-monospace, monospace");
  const sans = fontVar("--font-atkinson", "system-ui, sans-serif");

  // Asphalte, puis un halo sodium très bas (l'éclairage de rue, pas un dégradé décoratif).
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const street = ctx.createRadialGradient(W * 0.5, H + 200, 0, W * 0.5, H + 200, 900);
  street.addColorStop(0, "rgba(255,154,60,0.16)");
  street.addColorStop(1, "rgba(255,154,60,0)");
  ctx.fillStyle = street;
  ctx.fillRect(0, 0, W, H);

  // Enseigne : la marque (petite tour) + la semaine.
  const mark = (x: number, y: number) => {
    ctx.fillStyle = C.text;
    ctx.fillRect(x, y, 26, 44);
    ctx.fillStyle = C.bg;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) ctx.fillRect(x + 5 + c * 10, y + 6 + r * 9, 6, 5);
    ctx.fillStyle = C.sodium;
    ctx.fillRect(x + 15, y + 6, 6, 5);
  };
  mark(M, 84);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.text;
  ctx.font = `800 40px ${sign}`;
  ctx.fillText("FOCUSFLOW", M + 44, 124);
  ctx.fillStyle = C.text3;
  ctx.font = `700 24px ${sans}`;
  ctx.fillText("MA SEMAINE", M, 196);
  ctx.fillStyle = C.text2;
  ctx.font = `650 52px ${sign}`;
  ctx.fillText(wrappedWeekLabel(data).toUpperCase(), M, 252);

  // Le temps de focus sur le panneau à points (Doto, sodium).
  ctx.fillStyle = "#05070a";
  ctx.fillRect(M, 300, W - 2 * M, 230);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(M + 1, 301, W - 2 * M - 2, 228);
  ctx.save();
  ctx.shadowColor = "rgba(255,154,60,0.5)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = C.sodium;
  ctx.font = `800 150px ${led}`;
  ctx.fillText(formatWrappedMinutes(data.minutes), M + 40, 470);
  ctx.restore();
  ctx.fillStyle = C.text2;
  ctx.font = `400 34px ${sans}`;
  let sub = "de focus cette semaine";
  if (data.deltaPct !== null) sub += data.deltaPct >= 0 ? `, +${data.deltaPct} % sur la semaine d'avant` : `, ${data.deltaPct} % sur la semaine d'avant`;
  ctx.fillText(sub, M, 586);

  // Les soirs allumés : une tour par jour, un étage par tranche de 25 min.
  const max = Math.max(1, ...data.perDay);
  // Meilleur soir (un seul, le premier) : le taxi, l'événement rare.
  const best = data.perDay.some((m) => m > 0) ? data.perDay.indexOf(Math.max(...data.perDay)) : -1;
  const floors = 12;
  const baseY = 1000, towerW = 92, gap = (W - 2 * M - 7 * towerW) / 6, fh = 22, fg = 6;
  data.perDay.forEach((m, d) => {
    const x = M + d * (towerW + gap);
    const lit = m > 0 ? Math.max(1, Math.round((m / max) * floors)) : 0;
    for (let f = 0; f < floors; f++) {
      const y = baseY - (f + 1) * (fh + fg);
      ctx.fillStyle = f < lit ? (d === best && f === lit - 1 ? C.taxi : C.konbini) : C.unlit;
      ctx.fillRect(x, y, towerW, fh);
    }
    ctx.fillStyle = C.text3;
    ctx.font = `700 26px ${sans}`;
    ctx.textAlign = "center";
    ctx.fillText(DAYS[d], x + towerW / 2, baseY + 44);
    ctx.textAlign = "left";
  });
  ctx.fillStyle = C.line;
  ctx.fillRect(M, baseY + 4, W - 2 * M, 2);

  // Trois relevés sous filet, chiffres en Atkinson (pas de faux afficheur).
  const stats: [string, string][] = [
    ["SESSIONS", String(data.sessions)],
    ["SOIRS ACTIFS", `${data.activeDays} / 7`],
    ["HEURE DE POINTE", data.peakHour !== null ? `${data.peakHour} h` : "aucune"],
  ];
  const colW = (W - 2 * M) / 3;
  stats.forEach(([label, value], i) => {
    const x = M + i * colW;
    ctx.fillStyle = C.text3;
    ctx.font = `700 22px ${sans}`;
    ctx.fillText(label, x, 1112);
    ctx.fillStyle = C.text;
    ctx.font = `700 54px ${sign}`;
    ctx.fillText(value, x, 1172);
  });

  // Ambiance préférée, une ligne.
  if (data.topPlay) {
    const t = data.topPlay.title.length > 44 ? data.topPlay.title.slice(0, 43) + "…" : data.topPlay.title;
    ctx.fillStyle = C.text3;
    ctx.font = `700 22px ${sans}`;
    ctx.fillText("CE QUI JOUAIT DERRIÈRE", M, 1232);
    ctx.fillStyle = C.text2;
    ctx.font = `400 30px ${sans}`;
    ctx.fillText(t, M, 1272);
  }

  // Pied : la ville qui ne dort pas.
  ctx.fillStyle = C.text3;
  ctx.font = `400 22px ${sans}`;
  ctx.textAlign = "right";
  ctx.fillText("focusflow, la ville qui ne dort pas", W - M, H - 44);
  ctx.textAlign = "left";
  return canvas;
}

/** Pour l'aperçu et les tests visuels. */
export { drawCard };

export default function WrappedShareCard({ data }: { data: WrappedData }) {
  const handleDownload = async () => {
    // Un canvas ne charge pas les polices : on attend celles de la carte.
    const fams = ["--font-signage", "--font-doto", "--font-atkinson"].map((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()).filter(Boolean);
    await Promise.all(fams.map((f) => document.fonts.load(`700 40px ${f}`).catch(() => [])));
    const canvas = drawCard(data);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `focusflow-semaine-${data.weekStart}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center justify-center gap-2 px-5 py-3 rounded-[6px] bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Télécharger la carte à partager
    </button>
  );
}
