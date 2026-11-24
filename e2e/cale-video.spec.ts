import { test, expect, prepare, open } from "./fixtures";
import type { Page } from "@playwright/test";

// « Calé sur la vidéo » : le minuteur suit le rythme d'une vidéo Study With Me
// (chapitres 50/10 renvoyés par la route schedule, interceptée). Le faux lecteur
// fait avancer currentTime en temps réel pendant la lecture.

const CHAPTERS_50_10 = [
  { startSec: 0, title: "Focus 1" }, { startSec: 3000, title: "Break" },
  { startSec: 3600, title: "Focus 2" }, { startSec: 6600, title: "Break" },
  { startSec: 7200, title: "Focus 3" }, { startSec: 10200, title: "Break" },
];

type YT = { playing: boolean; time(): number; setTime(t: number): void; seeks: number[] };

async function setup(page: Page, videoStart: number, chapters = CHAPTERS_50_10) {
  await prepare(page, { videoStart, videoDuration: 10800 });
  await page.route("**/api/youtube/schedule**", (r) => r.fulfill({ json: { chapters, durationSec: 10800 } }));
  await open(page, "/session");
}

const timer = (page: Page) => page.getByRole("timer").first();
const label = (page: Page) => page.getByTestId("timer-label");
const isPlaying = (page: Page) => page.evaluate(() => (window as unknown as { __yt: YT }).__yt.playing);

test("ouverture en plein bloc : le minuteur affiche le reste du bloc, choix de prise en route", async ({ page }) => {
  await setup(page, 1200);
  await expect(label(page)).toHaveText("Calé sur la vidéo · bloc 1 / 3");
  // 3000 − 1200 = 30 min (moins les quelques secondes déjà jouées).
  await expect(timer(page)).toHaveText(/^(30:00|29:[45]\d)$/);
  await expect(page.getByRole("button", { name: "Calé sur la vidéo" })).toHaveAttribute("aria-pressed", "true");
  const dialog = page.getByRole("dialog", { name: "Arrivée en plein bloc" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Début du bloc suivant" })).toBeVisible();
  await dialog.getByRole("button", { name: "Prendre en route" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await isPlaying(page)).toBe(true);
});

test("début du bloc suivant : la vidéo saute au prochain bloc de travail", async ({ page }) => {
  await setup(page, 2500);
  const dialog = page.getByRole("dialog", { name: "Arrivée en plein bloc" });
  await dialog.getByRole("button", { name: "Début du bloc suivant" }).click();
  await expect(label(page)).toHaveText("Calé sur la vidéo · bloc 2 / 3");
  await expect(timer(page)).toHaveText(/^(50:00|49:[45]\d)$/);
  const seeks = await page.evaluate(() => (window as unknown as { __yt: YT }).__yt.seeks);
  expect(seeks).toContain(3600);
});

test("fin du bloc : pause au bon moment, la vidéo continue", async ({ page }) => {
  await setup(page, 2990);
  await expect(label(page)).toHaveText("Calé sur la vidéo · bloc 1 / 3");
  await expect(label(page)).toHaveText("Calé sur la vidéo · pause", { timeout: 15_000 });
  await expect(timer(page)).toHaveText(/^(10:00|09:[45]\d)$/);
  // Pas de halte : la pause est celle du créateur, la vidéo joue toujours.
  await expect(page.getByText("Lève les yeux")).toHaveCount(0);
  expect(await isPlaying(page)).toBe(true);
  // Pause manuelle = pause de la vidéo.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { __yt: YT }).__yt.playing === false);
});

test("désactivation : retour au minuteur normal, qui continue le décompte", async ({ page }) => {
  await setup(page, 600);
  await expect(label(page)).toHaveText("Calé sur la vidéo · bloc 1 / 3");
  await page.getByRole("button", { name: "Calé sur la vidéo" }).click();
  await expect(page.getByRole("button", { name: "Calé sur la vidéo" })).toHaveAttribute("aria-pressed", "false");
  await expect(label(page)).toHaveText(/^Pomodoro \d+$/);
  const before = await timer(page).textContent();
  expect(before).toMatch(/^(40:00|39:[45]\d)$/);
  // Le décompte continue à l'horloge, même si la vidéo est ramenée en arrière.
  await page.evaluate(() => (window as unknown as { __yt: YT }).__yt.setTime(0));
  await page.waitForTimeout(2200);
  const after = await timer(page).textContent();
  expect(after).not.toBe(before);
  expect(after).toMatch(/^39:[345]\d$/);
});

test("vidéo sans rythme (tracklist) : pas de bouton, minuteur normal", async ({ page }) => {
  await setup(page, 0, [{ startSec: 0, title: "Track one" }, { startSec: 192, title: "Track two" }]);
  await expect(label(page)).toHaveText(/^Pomodoro \d+$/);
  await expect(page.getByRole("button", { name: "Calé sur la vidéo" })).toHaveCount(0);
});

test("rechargement en plein bloc : le minuteur attend la vidéo puis se recale", async ({ page }) => {
  await setup(page, 1200);
  await expect(label(page)).toHaveText("Calé sur la vidéo · bloc 1 / 3");
  const active = await page.evaluate(() => JSON.parse(localStorage.getItem("focusflow-timer")!).state.videoSyncActive);
  expect(active).toMatchObject({ videoId: expect.any(String) });
  // Au rechargement, le faux lecteur repart à 20 min (même position que la vidéo).
  await page.reload();
  await expect(label(page)).toHaveText("Calé sur la vidéo · bloc 1 / 3");
  await expect(timer(page)).toHaveText(/^(30:00|29:[345]\d)$/);
});
