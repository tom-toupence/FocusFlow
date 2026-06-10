"use client";

import { WrappedData, formatWrappedMinutes, wrappedWeekLabel } from "@/lib/wrapped";

// Draws the shareable 1080×1350 recap card with the native Canvas 2D API
// (no dependency) and triggers a PNG download.

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCard(data: WrappedData): HTMLCanvasElement {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#13102b");
  bg.addColorStop(0.55, "#0c1322");
  bg.addColorStop(1, "#071a14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft glow accents
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, 500);
  glow.addColorStop(0, "rgba(139, 92, 246, 0.25)");
  glow.addColorStop(1, "rgba(139, 92, 246, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(W * 0.1, H * 0.9, 0, W * 0.1, H * 0.9, 600);
  glow2.addColorStop(0, "rgba(16, 185, 129, 0.18)");
  glow2.addColorStop(1, "rgba(16, 185, 129, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  const sans = "'Segoe UI', system-ui, sans-serif";

  // Header
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `600 34px ${sans}`;
  ctx.fillText("FOCUSFLOW · MA SEMAINE", 80, 120);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `300 64px ${sans}`;
  ctx.fillText(wrappedWeekLabel(data), 80, 205);

  // Hero: total focus time
  ctx.fillStyle = "#ffffff";
  ctx.font = `200 200px ${sans}`;
  ctx.fillText(formatWrappedMinutes(data.minutes), 80, 440);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `400 40px ${sans}`;
  let heroSub = "de focus cette semaine";
  if (data.deltaPct !== null) {
    heroSub += data.deltaPct >= 0 ? `  ·  +${data.deltaPct}% vs S-1` : `  ·  ${data.deltaPct}% vs S-1`;
  }
  ctx.fillText(heroSub, 80, 510);

  // Stat tiles
  const tiles: { label: string; value: string }[] = [
    { label: "SESSIONS", value: String(data.sessions) },
    { label: "JOURS ACTIFS", value: `${data.activeDays}/7` },
    { label: "MEILLEUR JOUR", value: data.bestDay ? data.bestDay.label : "—" },
    { label: "HEURE DE POINTE", value: data.peakHour !== null ? `${data.peakHour}h` : "—" },
  ];
  const tileW = (W - 160 - 3 * 30) / 4;
  tiles.forEach((t, i) => {
    const x = 80 + i * (tileW + 30);
    const y = 580;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, x, y, tileW, 190, 24);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `600 22px ${sans}`;
    ctx.fillText(t.label, x + 26, y + 56);
    ctx.fillStyle = "#ffffff";
    ctx.font = `300 60px ${sans}`;
    ctx.fillText(t.value, x + 26, y + 140);
  });

  // Top play
  let y = 850;
  if (data.topPlay) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 80, y, W - 160, 150, 24);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `600 22px ${sans}`;
    ctx.fillText("AMBIANCE PRÉFÉRÉE", 110, y + 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = `400 42px ${sans}`;
    const title = data.topPlay.title.length > 38 ? data.topPlay.title.slice(0, 37) + "…" : data.topPlay.title;
    ctx.fillText(title, 110, y + 110);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `400 30px ${sans}`;
    ctx.textAlign = "right";
    ctx.fillText(formatWrappedMinutes(data.topPlay.totalMinutes), W - 110, y + 110);
    ctx.textAlign = "left";
    y += 190;
  }

  // Badges
  if (data.badges.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `600 22px ${sans}`;
    ctx.fillText("BADGES DÉBLOQUÉS", 80, y + 30);
    ctx.font = `400 56px ${sans}`;
    ctx.fillStyle = "#ffffff";
    const line = data.badges.map((b) => `${b.emoji} ${b.title}`).join("   ");
    ctx.fillText(line.length > 50 ? line.slice(0, 49) + "…" : line, 80, y + 105);
    y += 160;
  }

  // Mood
  if (data.avgMood !== null) {
    const moodEmoji = ["😞", "😕", "😐", "🙂", "😄"][Math.min(4, Math.max(0, Math.round(data.avgMood) - 1))];
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `600 22px ${sans}`;
    ctx.fillText("HUMEUR MOYENNE", 80, y + 30);
    ctx.font = `400 56px ${sans}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${moodEmoji}  ${data.avgMood.toFixed(1)} / 5`, 80, y + 105);
  }

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = `500 30px ${sans}`;
  ctx.fillText("focusflow — pomodoro & ambiances de focus", 80, H - 70);

  return canvas;
}

export default function WrappedShareCard({ data }: { data: WrappedData }) {
  const handleDownload = () => {
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
      className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all shadow-lg shadow-black/20"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Télécharger la carte à partager
    </button>
  );
}
