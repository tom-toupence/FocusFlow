import type { Page } from "@playwright/test";
import { test, expect, prepare, open } from "./fixtures";

// Non-régression par source (partie B) : mix radio RD, vraie playlist PL et son
// repli natif, playlist locale, Twitch, et le panneau « À venir ».

type YT = { loaded: string[]; lists: unknown[]; playing: boolean; end(): void };
const yt = (page: Page) => page.evaluate(() => (window as unknown as { __yt: YT }).__yt);
const end = (page: Page) => page.evaluate(() => (window as unknown as { __yt: YT }).__yt.end());
const loadedCount = (page: Page, n: number) =>
  page.waitForFunction((n) => ((window as unknown as { __yt?: YT }).__yt?.loaded.length ?? 0) >= n, n);

test("mix radio RD : résolu en file maison, enchaîné par nous, jamais en liste native", async ({ page }) => {
  await prepare(page, { playlist: { playlistId: "RDseed0000001", startVideoId: "seed0000001", title: "Mix du soir" } });
  await page.route("**/api/youtube/mix**", (r) =>
    r.fulfill({ json: { videoIds: ["mix00000001", "mix00000002", "mix00000003"], titles: { mix00000001: "Mix un", mix00000002: "Mix deux", mix00000003: "Mix trois" } } }));
  await open(page, "/session");
  await loadedCount(page, 1);
  await expect(page.getByText("Mix un")).toBeVisible();
  await end(page);
  await expect(page.getByText("Mix deux")).toBeVisible();
  const s = await yt(page);
  expect(s.loaded).toEqual(["mix00000001", "mix00000002"]);
  expect(s.lists).toEqual([]); // pas de loadPlaylist({list:"RD…"}) : autoplay hors liste
});

test("playlist PL : titres résolus puis extras ajoutés par l'utilisateur, dans l'ordre", async ({ page }) => {
  await prepare(page, {
    playlist: { playlistId: "PLtest", title: "Ma playlist", extraVideos: [{ id: "extra000001", title: "Extra" }] },
  });
  await page.route("**/api/youtube/playlist**", (r) =>
    r.fulfill({ json: { videos: [{ id: "plv00000001", title: "PL un" }, { id: "plv00000002", title: "PL deux" }] } }));
  await open(page, "/session");
  await loadedCount(page, 1);
  await end(page);
  await end(page);
  await expect(page.getByText("Extra", { exact: true })).toBeVisible();
  expect((await yt(page)).loaded).toEqual(["plv00000001", "plv00000002", "extra000001"]);
});

test("playlist PL non résolue : repli sur le lecteur natif (loadPlaylist dans onReady)", async ({ page }) => {
  await prepare(page, { playlist: { playlistId: "PLfail", title: "Playlist muette" } });
  await page.route("**/api/youtube/playlist**", (r) => r.fulfill({ status: 502, json: {} }));
  await open(page, "/session");
  await page.waitForFunction(() => ((window as unknown as { __yt?: YT }).__yt?.lists.length ?? 0) > 0);
  const s = await yt(page);
  expect(s.lists).toEqual(["PLfail"]);
  expect(s.loaded).toEqual([]); // jamais videoId + list ensemble
});

test("playlist locale : « Lire » remplit la File d'attente, la session la joue", async ({ page }) => {
  await prepare(page, {
    localPlaylists: [{ id: "lp1", name: "Nuit blanche", tracks: [{ youtubeId: "loc00000001", title: "Local un" }, { youtubeId: "loc00000002", title: "Local deux" }] }],
  });
  await open(page, "/");
  await page.getByRole("navigation", { name: "Navigation principale" }).first().getByRole("button", { name: /Écouter/ }).click();
  await page.getByRole("tab", { name: /Ma bibliothèque/ }).first().click();
  await page.getByTitle("Lire").first().click({ force: true });
  await page.waitForURL("**/settings");
  await open(page, "/session");
  await loadedCount(page, 1);
  await expect(page.getByText("Local un")).toBeVisible();
  expect((await yt(page)).loaded[0]).toBe("loc00000001");
});

test("Twitch : pas de piste suivante, lien vers la source, pause pendant la halte", async ({ page }) => {
  await prepare(page, { twitchChannel: "chaine_test" });
  await open(page, "/session");
  await page.waitForFunction(() => ((window as unknown as { __tw?: { created: number } }).__tw?.created ?? 0) > 0);
  await expect(page.getByRole("link", { name: "Ouvrir sur Twitch" }).first()).toBeVisible();
  await expect(page.getByTitle("Titre suivant")).toHaveCount(0);
  await expect(page.getByTitle("À venir")).toHaveCount(0); // ni file ni suggestions pour un live
  // Pause du minuteur : le flux se met en pause aussi (manquait avant la refonte).
  await page.keyboard.press("Space");
  await page.waitForFunction(() => (window as unknown as { __tw: { playing: boolean } }).__tw.playing === false);
});

test("À venir : titres suivants, suggestion ajoutée marquée, titre retiré", async ({ page }) => {
  await prepare(page, {
    queue: [
      { youtubeId: "aaaaaaaaaa1", title: "Premier titre" },
      { youtubeId: "bbbbbbbbbb2", title: "Deuxième titre" },
      { youtubeId: "cccccccccc3", title: "Troisième titre" },
    ],
  });
  await page.route("**/api/youtube/mix**", (r) => {
    const seed = new URL(r.request().url()).searchParams.get("seed") ?? "x";
    return r.fulfill({ json: { videoIds: [`sg-${seed.slice(0, 4)}`], titles: { [`sg-${seed.slice(0, 4)}`]: `Proche ${seed.slice(0, 4)}` } } });
  });
  await open(page, "/session");
  await loadedCount(page, 1);
  await page.getByTitle("À venir").click();
  const panel = page.getByRole("dialog", { name: "À venir" });
  await expect(panel.getByText("Deuxième titre")).toBeVisible();
  await expect(panel.getByText("Troisième titre")).toBeVisible();

  await panel.getByRole("button", { name: "Retirer Deuxième titre" }).click();
  await expect(panel.getByText("Deuxième titre")).toHaveCount(0);

  await panel.getByRole("button", { name: "Trouver des titres proches" }).click();
  const add = panel.getByRole("button", { name: /^Ajouter .* à la suite$/ }).first();
  await expect(add).toBeVisible();
  await add.click();
  await expect(panel.getByText("Suggestion ·").first()).toBeVisible();

  // Le titre retiré n'est pas joué : on passe directement au troisième.
  await end(page);
  expect((await yt(page)).loaded[1]).toBe("cccccccccc3");
});
