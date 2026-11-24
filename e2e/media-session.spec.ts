import { test, expect, prepare, open } from "./fixtures";

// FocusFlow dans le système (lot 1) : pendant la session, l'onglet affiche le
// temps restant et la Media Session (écran verrouillé, touches média) annonce
// le pomodoro. Lecteur YouTube simulé (fixtures), aucune dépendance au vrai YouTube.

const QUEUE = [
  { youtubeId: "aaaaaaaaaa1", title: "Premier titre" },
  { youtubeId: "bbbbbbbbbb2", title: "Deuxième titre" },
];

type W = { __yt?: { playing: boolean } };

test("session : temps restant dans l'onglet et métadonnées média", async ({ page }) => {
  await prepare(page, { queue: QUEUE, loop: true });
  await open(page, "/session");
  await page.waitForFunction(() => (window as unknown as W).__yt?.playing === true);

  // Titre d'onglet « mm:ss · Focus » (preset classique : 25 min).
  await expect(page).toHaveTitle(/^(2[0-5]|1\d):\d\d · Focus$/);

  // Media Session : titre « Focus · mm:ss restantes », le morceau en artiste.
  await page.waitForFunction(() => navigator.mediaSession?.metadata?.title?.includes("Focus"));
  const meta = await page.evaluate(() => {
    const m = navigator.mediaSession.metadata!;
    return { title: m.title, artist: m.artist, album: m.album, art: m.artwork.map((a) => a.src), state: navigator.mediaSession.playbackState };
  });
  expect(meta.title).toMatch(/^Focus · \d\d:\d\d restantes$/);
  expect(meta.artist).toContain("Premier titre");
  expect(meta.album).toBe("FocusFlow");
  expect(meta.art.some((s) => s.includes("i.ytimg.com/vi/aaaaaaaaaa1/hqdefault.jpg"))).toBe(true);
  expect(meta.state).toBe("playing");

  // Pause : l'onglet et l'état média suivent, la musique aussi.
  await page.getByRole("button", { name: /Pause/ }).first().click();
  await expect(page).toHaveTitle(/^En pause · \d\d:\d\d$/);
  await page.waitForFunction(() => navigator.mediaSession.playbackState === "paused");
  await page.waitForFunction(() => (window as unknown as W).__yt?.playing === false);
});
