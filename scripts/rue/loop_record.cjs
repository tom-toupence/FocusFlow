// Capture image par image d une rue (moteur lib/rue, horloge manuelle) pour la boucle vidéo.
// Usage : node loop_record.cjs <dossier> <scène> <secondes> [largeur] [hauteur]
// Serveur requis sur :3100 avec /lab accessible (NEXT_PUBLIC_LAB=1 au build).
const { chromium } = require("playwright");
(async () => {
  const [out, scene, T, W, H] = [process.argv[2], process.argv[3], +process.argv[4], +(process.argv[5]||1280), +(process.argv[6]||720)];
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await b.newPage({ viewport: { width: W, height: H } });
  await page.addInitScript(() => { localStorage.setItem("focusflow-force-webgl", "1"); localStorage.setItem("focusflow-splash", "off"); });
  await page.goto(`http://localhost:3100/lab/rue?record&every=100000&only=${scene}`);
  await page.waitForFunction(() => !!window.__rue, null, { timeout: 180000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important} main > :not(canvas){display:none!important}" });
  await page.waitForTimeout(2000);
  const FPS = 24;
  // chauffe : laisse la scène s'allumer
  for (let i = 0; i < 48; i++) await page.evaluate(() => window.__rue.step(1 / 24));
  const t0 = Date.now();
  for (let f = 0; f < FPS * T; f++) {
    const t = f / FPS;
    await page.evaluate((t) => { const s = window.__rue; s.pointer(Math.sin(t * 0.35) * 0.6, Math.cos(t * 0.27) * 0.35); s.step(1 / 24); }, t);
    await page.screenshot({ path: `${out}/f${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 90 });
  }
  console.log(scene, "s/frame", ((Date.now() - t0) / 1000 / (FPS * T)).toFixed(2));
  await b.close();
})();
