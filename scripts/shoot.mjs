// Captures Playwright de tous les écrans de FocusFlow (outil de la refonte).
// Usage : node scripts/shoot.mjs <outDir> [baseUrl] [--theme=dark|light|both] [--only=a,b]
//   - attente explicite (réseau calme + délai) : les captures de l'extension
//     Chrome sont en retard sur le DOM, Playwright headless est la référence.
//   - deux profils de données : "empty" (premier lancement) et "full" (données
//     de démonstration semées dans les stores persistés `focusflow-*`).
import { createRequire } from "node:module";
// Playwright est pré-installé globalement (NODE_PATH) : on le charge via require
// pour ne pas réinstaller un navigateur incompatible.
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const outDir = args[0] ?? "shots";
const base = (args[1] && !args[1].startsWith("--") ? args[1] : "http://localhost:3000").replace(/\/$/, "");
const themeArg = (args.find((a) => a.startsWith("--theme=")) ?? "--theme=dark").split("=")[1];
const only = (args.find((a) => a.startsWith("--only=")) ?? "").split("=")[1]?.split(",").filter(Boolean) ?? [];
const themes = themeArg === "both" ? ["dark", "light"] : [themeArg];
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORTS = { d: { width: 1440, height: 900 }, m: { width: 390, height: 844 } };

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function seedFull() {
  const days = {};
  for (let i = 0; i < 90; i++) {
    if ((i * 7) % 5 === 0 && i > 2) continue;
    const s = 1 + ((i * 13) % 6);
    days[day(i)] = { date: day(i), sessions: s, minutesWorked: s * 25 };
  }
  const entries = Array.from({ length: 24 }, (_, i) => ({
    id: `p${i}`, type: "youtube", title: ["Study With Me · Rainy crossing at night", "Study With Me · Midnight canal (4h)", "Dawn drive · Ambient lofi"][i % 3],
    subtitle: ["Abao in Tokyo", "study with japan", "Abao Vision"][i % 3], mediaKey: ["86CFyZDqiAI", "gHmq9Xd6qMQ", "z-j6jsLtgjs"][i % 3],
    thumbnailUrl: `https://img.youtube.com/vi/${["86CFyZDqiAI", "gHmq9Xd6qMQ", "z-j6jsLtgjs"][i % 3]}/mqdefault.jpg`,
    timestamp: Date.now() - i * 3600e3 * 7, date: day(Math.floor(i / 3)), minutes: 25,
  }));
  const todos = [
    { id: "t1", text: "Relire le chapitre 4 du mémoire", status: "in-progress", priority: "urgent", pomodoroEstimate: 3, pomodorosUsed: 1, createdAt: day(1) },
    { id: "t2", text: "Exercices de probabilités, série 6", status: "todo", priority: "normal", pomodoroEstimate: 2, pomodorosUsed: 0, createdAt: day(0) },
    { id: "t3", text: "Préparer les slides de soutenance", status: "todo", priority: "low", pomodoroEstimate: 4, pomodorosUsed: 0, createdAt: day(0) },
    { id: "t4", text: "Envoyer le plan au directeur", status: "done", priority: "normal", pomodoroEstimate: 1, pomodorosUsed: 1, createdAt: day(2), completedAt: day(0) },
  ];
  const st = (state) => JSON.stringify({ state, version: 0 });
  return {
    "focusflow-prefs": st({ breathingEnabled: true, onboarded: true }),
    "focusflow-stats": st({ days }),
    "focusflow-play-history": st({ entries }),
    "focusflow-session": st({ selectedVideoId: "abao-01", selectedPlaylistId: null, playQueue: false, customVideos: [], todos }),
    "focusflow-projects": st({ projects: [
      { id: "pr1", name: "Mémoire de master", color: "#0ea5e9", deadline: day(-21), pomodoroBudget: 60, pomodorosDone: 23, createdAt: day(30) },
      { id: "pr2", name: "Partiels de janvier", color: "#f59e0b", deadline: day(-45), pomodoroBudget: 40, pomodorosDone: 6, createdAt: day(10) },
    ], activeProjectId: "pr1" }),
    "focusflow-goal": st({ unit: "minutes", target: 120 }),
    "focusflow-queue": st({ items: [
      { id: "q1", youtubeId: "86CFyZDqiAI", title: "Study With Me · Rainy crossing at night", channelName: "Abao in Tokyo", thumbnailUrl: "https://img.youtube.com/vi/86CFyZDqiAI/mqdefault.jpg" },
      { id: "q2", youtubeId: "gHmq9Xd6qMQ", title: "Study With Me · Midnight canal (4h)", channelName: "study with japan", thumbnailUrl: "https://img.youtube.com/vi/gHmq9Xd6qMQ/mqdefault.jpg" },
    ] }),
  };
}

function seedEmpty() {
  return {};
}

// Chaque plan : nom, chemin, profil, actions (clics sur des libellés visibles).
const PLANS = [
  { name: "onboarding", path: "/", profile: "empty", steps: [] },
  { name: "home-today-empty", path: "/", profile: "emptyOnboarded", steps: [] },
  { name: "home-today", path: "/", profile: "full", steps: [] },
  { name: "listen-catalogue", path: "/", profile: "full", steps: ["Écouter"] },
  { name: "listen-discover", path: "/", profile: "full", steps: ["Écouter", "Découvrir"] },
  { name: "listen-library", path: "/", profile: "full", steps: ["Écouter", "Ma bibliothèque"] },
  { name: "listen-spotify", path: "/", profile: "full", steps: ["Écouter", "Spotify"] },
  { name: "listen-twitch", path: "/", profile: "full", steps: ["Écouter", "Twitch"] },
  { name: "org-projets", path: "/", profile: "full", steps: ["Organisation"] },
  { name: "org-planning", path: "/", profile: "full", steps: ["Organisation", "Planning"] },
  { name: "org-sprint", path: "/", profile: "full", steps: ["Organisation", "Sprint"] },
  { name: "org-routines", path: "/", profile: "full", steps: ["Organisation", "Routines"] },
  { name: "org-journal", path: "/", profile: "full", steps: ["Organisation", "Journal"] },
  { name: "act-apercu", path: "/", profile: "full", steps: ["Activité"] },
  { name: "act-stats", path: "/", profile: "full", steps: ["Activité", "Statistiques"] },
  { name: "act-wrapped", path: "/", profile: "full", steps: ["Activité", "Wrapped"] },
  { name: "cmdk", path: "/", profile: "full", steps: ["key:Control+k"] },
  { name: "settings", path: "/settings", profile: "full", steps: [] },
  { name: "summary", path: "/summary", profile: "full", steps: [] },
  { name: "insights", path: "/insights", profile: "full", steps: [] },
  { name: "wrapped", path: "/wrapped", profile: "full", steps: [] },
  { name: "session", path: "/session", profile: "full", steps: [], wait: 4000 },
  { name: "design", path: "/_design", profile: "full", steps: [] },
  { name: "notfound", path: "/nope-404", profile: "full", steps: [] },
];

const PLACEHOLDERS = ["still.jpg", "still-dawn.jpg"].map((f) => fs.readFileSync(path.join("public/city/tokyo", f)));
const browser = await chromium.launch();
let n = 0;
for (const theme of themes) {
  for (const [vk, vp] of Object.entries(VIEWPORTS)) {
    for (const plan of PLANS) {
      if (only.length && !only.includes(plan.name)) continue;
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: "no-preference" });
      const seed = plan.profile === "full" ? seedFull()
        : plan.profile === "emptyOnboarded" ? { "focusflow-prefs": JSON.stringify({ state: { breathingEnabled: true, onboarded: true }, version: 0 }) }
        : seedEmpty();
      seed["focusflow-theme"] = JSON.stringify({ state: { theme }, version: 0 });
      await ctx.addInitScript((s) => {
        if (sessionStorage.getItem("__seeded")) return;
        for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
        sessionStorage.setItem("__seeded", "1");
      }, seed);
      // YouTube/Spotify/Twitch sont souvent injoignables depuis un conteneur :
      // miniatures remplacées par les photos de nuit locales (déterministe),
      // scripts tiers coupés pour ne pas bloquer la capture.
      await ctx.route(/(ytimg|img\.youtube)\.com/, (r) => {
        const id = r.request().url().split("/vi/")[1] ?? "x";
        const h = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PLACEHOLDERS.length;
        r.fulfill({ body: PLACEHOLDERS[h], contentType: "image/jpeg" });
      });
      await ctx.route(/^https?:\/\/(www\.)?youtube\.com|scdn\.co|spotify\.com|twitch\.tv/, (r) => r.abort());
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log(`  [pageerror ${plan.name}] ${e.message.slice(0, 160)}`));
      try {
        await page.goto(base + plan.path, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(1200);
        // Le splash ne se lève que sur geste : touche Échap.
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1100);
        for (const step of plan.steps) {
          if (step.startsWith("key:")) { await page.keyboard.press(step.slice(4)); }
          else {
            const loc = page.getByRole("button", { name: step, exact: false }).filter({ visible: true }).first();
            await loc.click({ timeout: 8000 });
          }
          await page.waitForTimeout(700);
        }
        // Parcourt la page pour déclencher les images lazy, puis revient en haut.
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(plan.wait ?? 900);
        const file = path.join(outDir, `${plan.name}-${vk}-${theme}.jpg`);
        await page.screenshot({ path: file, type: "jpeg", quality: 72, timeout: 120000, fullPage: plan.name !== "session" && plan.name !== "cmdk" && plan.name !== "onboarding" });
        n++;
        console.log("ok", file);
      } catch (e) {
        console.log("FAIL", plan.name, vk, theme, e.message.split("\n")[0]);
      }
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`${n} captures`);
