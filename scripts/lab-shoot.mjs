// Capture d'un prototype du lab : vidéo de la séquence + images à des instants
// clés + mesure des images par seconde. Usage :
//   node scripts/lab-shoot.mjs <slug> <outDir> [baseUrl] [--mobile]
// Séquence jouée (horloge simulée ×60) : entrée, 6 s de travail, distraction,
// fin de phase (fin de pomodoro), 4 s de pause, fin de phase (reprise).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const { chromium } = createRequire(import.meta.url)("playwright");

const [slug, outDir, baseArg] = process.argv.slice(2);
const base = baseArg && !baseArg.startsWith("--") ? baseArg : "http://localhost:3000";
const mobile = process.argv.includes("--mobile");
const vp = mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 };
fs.mkdirSync(outDir, { recursive: true });
const vidDir = path.join(outDir, "_video");
fs.mkdirSync(vidDir, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: vp, recordVideo: { dir: vidDir, size: vp } });
await ctx.route(/youtube|ytimg|spotify|twitch/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const t0 = Date.now();
await page.goto(`${base}/lab/${slug}`, { waitUntil: "domcontentloaded", timeout: 120000 });
const tag = mobile ? "m" : "d";
const shot = async (name) => page.screenshot({ path: path.join(outDir, `${slug}-${tag}-${name}.jpg`), type: "jpeg", quality: 82, timeout: 120000 });
const fps = async () => page.evaluate(() => ({ fps: window.__labFps ?? 0, ...(window.__labInfo ?? {}) }));
const click = async (label) => page.locator("[data-lab-controls] button", { hasText: label }).first().click().catch(() => {});
const samples = [];

await page.waitForTimeout(2500); await shot("01-entree");
await page.waitForTimeout(3500); samples.push(await fps()); await shot("02-travail");
await click("distraction"); await page.waitForTimeout(500); await shot("03-distraction");
await page.waitForTimeout(2000); samples.push(await fps());
await click("fin de phase"); await page.waitForTimeout(900); await shot("04-fin-pomodoro");
await page.waitForTimeout(2500); samples.push(await fps()); await shot("05-pause");
await click("fin de phase"); await page.waitForTimeout(2000); await shot("06-reprise");
samples.push(await fps());

const video = page.video();
await ctx.close();
await browser.close();
const webm = await video.path();
const mp4 = path.join(outDir, `${slug}-${tag}.mp4`);
try {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-vf", "scale=960:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", "-preset", "veryfast", mp4]);
  fs.rmSync(vidDir, { recursive: true, force: true });
} catch (e) { console.log("ffmpeg:", e.message); }
console.log(JSON.stringify({ slug, tag, fps: samples, errors: [...new Set(errors.filter((e) => !e.includes("eval()") && !e.includes("hydrated")).map((e) => e.slice(0, 160)))].slice(0, 4), seconds: Math.round((Date.now() - t0) / 1000) }));
