// Audit d'accessibilité (axe-core, WCAG 2.1 AA) des écrans principaux, nuit et
// petit matin. Usage : node scripts/a11y.mjs [baseUrl] > rapport
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2] ?? "http://localhost:3000";
const axe = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const PAGES = (process.env.PAGES ?? "/,/settings,/session,/summary,/insights,/wrapped,/lab/landing").split(",");
const b = await chromium.launch();
const out = [];
for (const theme of ["dark", "light"]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => {
    localStorage.setItem("focusflow-theme", JSON.stringify({ state: { theme: t }, version: 0 }));
    localStorage.setItem("focusflow-prefs", JSON.stringify({ state: { onboarded: true, breathingEnabled: true, sceneEffects: false }, version: 0 }));
    sessionStorage.setItem("ff-splash-seen", "1");
  }, theme);
  await ctx.route(/youtube\.com|ytimg|scdn\.co|spotify\.com|twitch\.tv/, (r) => r.abort());
  for (const path of PAGES) {
    const p = await ctx.newPage();
    await p.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()));
    await p.addScriptTag({ content: axe });
    const res = await p.evaluate(async () => {
      // Le splash couvre la page au chargement : on l'ignore s'il est encore là.
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
    });
    out.push({ theme, path, violations: res });
    await p.close();
  }
  await ctx.close();
}
await b.close();
for (const r of out) {
  console.log(`\n## ${r.path} (${r.theme}) : ${r.violations.length} règle(s) en défaut`);
  for (const v of r.violations) console.log(`- [${v.impact}] ${v.id} × ${v.n} : ${v.help}\n    ${v.sample.join("\n    ")}`);
}
