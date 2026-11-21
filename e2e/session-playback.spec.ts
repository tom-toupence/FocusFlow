import { test, expect, prepare, open } from "./fixtures";

// Lecture continue (phase 9) : quand la file se termine pendant la session et
// que la boucle est coupée, elle se prolonge avec des titres proches de TOUTE
// la file ; avec la boucle, elle reprend en tête.

const QUEUE = [
  { youtubeId: "aaaaaaaaaa1", title: "Premier titre" },
  { youtubeId: "bbbbbbbbbb2", title: "Deuxième titre" },
  { youtubeId: "cccccccccc3", title: "Troisième titre" },
];

test("fin de file sans boucle : prolongation à partir de toute la file", async ({ page }) => {
  await prepare(page, { queue: QUEUE, loop: false });
  const seeds: string[] = [];
  await page.route("**/api/youtube/mix**", async (r) => {
    const seed = new URL(r.request().url()).searchParams.get("seed") ?? "";
    seeds.push(seed);
    await r.fulfill({ json: { videoIds: [seed, `rec-${seed.slice(0, 4)}`], titles: { [`rec-${seed.slice(0, 4)}`]: `Proche de ${seed.slice(0, 4)}` } } });
  });
  await open(page, "/session");
  await page.waitForFunction(() => (window as unknown as { __yt?: { loaded: string[] } }).__yt?.loaded.length === 1);
  await expect(page.getByText("Premier titre")).toBeVisible();

  const end = () => page.evaluate(() => (window as unknown as { __yt: { end(): void } }).__yt.end());
  await end(); // 2
  await end(); // 3
  await expect(page.getByText("Troisième titre")).toBeVisible();
  await end(); // fin : prolongation
  await expect(page.getByText("Fin de la liste")).toBeVisible();

  const loaded = await page.evaluate(() => (window as unknown as { __yt: { loaded: string[] } }).__yt.loaded);
  expect(loaded.slice(0, 3)).toEqual(QUEUE.map((q) => q.youtubeId));
  expect(loaded[3]).toMatch(/^rec-/);
  // Graines réparties : la dernière piste ET le reste de la file, pas seulement la dernière.
  expect(new Set(seeds)).toEqual(new Set(QUEUE.map((q) => q.youtubeId)));
  // Le titre de la piste ajoutée s'affiche.
  await expect(page.getByText(/^Proche de/)).toBeVisible();
});

test("fin de file avec boucle : reprise en tête, aucune requête de recommandations", async ({ page }) => {
  await prepare(page, { queue: QUEUE.slice(0, 2), loop: true });
  let called = 0;
  await page.route("**/api/youtube/mix**", (r) => { called++; return r.fulfill({ json: { videoIds: [], titles: {} } }); });
  await open(page, "/session");
  await page.waitForFunction(() => (window as unknown as { __yt?: { loaded: string[] } }).__yt?.loaded.length === 1);
  const end = () => page.evaluate(() => (window as unknown as { __yt: { end(): void } }).__yt.end());
  await end();
  await end();
  const loaded = await page.evaluate(() => (window as unknown as { __yt: { loaded: string[] } }).__yt.loaded);
  expect(loaded).toEqual(["aaaaaaaaaa1", "bbbbbbbbbb2", "aaaaaaaaaa1"]);
  expect(called).toBe(0);
});

test("contrôles unifiés : titre suivant, pause du minuteur = pause de la musique", async ({ page }) => {
  await prepare(page, { queue: QUEUE, loop: true });
  await open(page, "/session");
  await page.waitForFunction(() => (window as unknown as { __yt?: { playing: boolean } }).__yt?.playing === true);
  await page.getByTitle("Titre suivant").click();
  await expect(page.getByText("Deuxième titre")).toBeVisible();
  await page.getByRole("button", { name: /Pause/ }).first().click();
  await page.waitForFunction(() => (window as unknown as { __yt: { playing: boolean } }).__yt.playing === false);
});
