import type { Page } from "@playwright/test";
import { test, expect, prepare, open } from "./fixtures";
import { catalogueRadio, newCursor, radioTarget } from "../lib/radioProgram";

// Radio FocusFlow (lot 6) : programme commun calculé depuis l'heure. Horloge
// du navigateur contrôlée par page.clock ; lecteur YouTube simulé (fixtures).

type YT = { loaded: string[]; starts: (number | null)[]; seeks: number[]; playing: boolean; error(c: number): void };
const yt = (page: Page) => page.evaluate(() => (window as unknown as { __yt: YT }).__yt);
const loadedCount = (page: Page, n: number) =>
  page.waitForFunction((n) => ((window as unknown as { __yt?: YT }).__yt?.loaded.length ?? 0) >= n, n);

const radio = catalogueRadio();
const base = radio.nowPlaying(Date.UTC(2026, 10, 24, 19, 0, 0))!;
/** 10 min après le début d'un créneau. */
const T = base.startsAt + 600_000;
const slot = radio.nowPlaying(T)!;

test("onglet Radio : titre en cours, programme, « Rejoindre » ouvre /session sur la bonne vidéo à la bonne seconde", async ({ page }) => {
  await prepare(page);
  await page.clock.setFixedTime(T);
  await open(page, "/");
  await page.getByRole("navigation", { name: "Navigation principale" }).first().getByRole("button", { name: /Écouter/ }).click();
  const tabs = page.getByRole("tablist", { name: "Sources" });
  await expect(tabs.getByRole("tab").first()).toHaveText(/Radio/);
  await tabs.getByRole("tab", { name: /Radio/ }).click();

  await expect(page.getByTestId("radio-now-title")).toHaveText(slot.track.title);
  await expect(page.getByText("En direct · Radio FocusFlow")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progression du titre" })).toHaveAttribute("aria-valuenow", "600");
  const programme = page.getByTestId("radio-programme");
  const items = programme.getByRole("listitem");
  await expect(items).toHaveCount(5);
  const up = radio.upcoming(T, 4);
  for (let i = 0; i < 4; i++) {
    await expect(items.nth(i + 1)).toContainText(up[i].track.title);
    await expect(items.nth(i + 1)).toContainText(/\d\d:\d\d/);
  }
  // Sans Supabase : rien sur les amis.
  await expect(page.getByTestId("radio-friends")).toHaveCount(0);

  await page.getByRole("button", { name: "Rejoindre et lancer un focus" }).click();
  await page.waitForURL("**/session");
  await loadedCount(page, 1);
  const s = await yt(page);
  expect(s.loaded[0]).toBe(slot.track.youtubeId);
  expect(s.starts[0]).toBe(600);
  // Badge « En cours » et « À venir » = le programme ; pas de « Suivant ».
  await expect(page.getByText("Radio FocusFlow").first()).toBeVisible();
  await expect(page.getByText(up[0].track.title).first()).toBeVisible();
  await expect(page.getByTitle("Titre suivant")).toHaveCount(0);
  await expect(page.getByTitle("Titre précédent")).toHaveCount(0);
});

test("fin du créneau : la piste suivante est chargée à son offset", async ({ page }) => {
  const join = slot.endsAt - 30_000;
  await prepare(page, { radio: true });
  await page.clock.install({ time: join });
  await open(page, "/session");
  await loadedCount(page, 1);
  let s = await yt(page);
  expect(s.loaded[0]).toBe(slot.track.youtubeId);
  expect(s.starts[0]).toBeGreaterThanOrEqual(slot.segmentSec - 30);
  expect(s.starts[0]).toBeLessThan(slot.segmentSec);

  await page.clock.runFor(40_000);
  await loadedCount(page, 2);
  s = await yt(page);
  const next = radio.slotAt(slot.index + 1)!;
  expect(s.loaded[1]).toBe(next.track.youtubeId);
  expect(s.starts[1]).toBe(next.segmentStartSec); // recalculé à l'heure de fin du créneau
});

test("erreur 150 (vidéo non embarquable) : passe à la suivante du programme", async ({ page }) => {
  await prepare(page, { radio: true });
  await page.clock.setFixedTime(T);
  await open(page, "/session");
  await loadedCount(page, 1);
  await page.evaluate(() => (window as unknown as { __yt: YT }).__yt.error(150));
  await loadedCount(page, 2);
  const cursor = newCursor();
  cursor.dead.add(slot.track.youtubeId);
  const expected = radioTarget(radio, T, cursor)!;
  const s = await yt(page);
  expect(s.loaded[1]).toBe(expected.slot.track.youtubeId);
  expect(s.loaded[1]).not.toBe(slot.track.youtubeId);
  expect(s.starts[1]).toBe(expected.offsetSec);
});

test("pause puis reprise : se recale sur le direct", async ({ page }) => {
  await prepare(page, { radio: true });
  await page.clock.install({ time: T });
  await open(page, "/session");
  await loadedCount(page, 1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { __yt: YT }).__yt.playing === false);
  const before = await page.evaluate(() => Date.now());
  await page.clock.fastForward(120_000);
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { __yt: YT }).__yt.seeks.length > 0);
  const s = await yt(page);
  const expected = Math.floor((before + 120_000 - slot.startsAt) / 1000);
  const last = s.seeks.at(-1)!;
  expect(last).toBeGreaterThanOrEqual(expected);
  expect(last).toBeLessThan(expected + 10);
  expect(s.loaded).toEqual([slot.track.youtubeId]); // même vidéo : simple recalage
  expect(s.playing).toBe(true);
});

test("deux appareils au même instant : même vidéo, même seconde", async ({ browser }) => {
  const at = T + 1234_567 % (slot.endsAt - T);
  const expected = radio.nowPlaying(at)!;
  const runs = await Promise.all([0, 1].map(async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await prepare(page, { radio: true });
    await page.clock.setFixedTime(at);
    await open(page, "/session");
    await loadedCount(page, 1);
    const s = await yt(page);
    await ctx.close();
    return { id: s.loaded[0], start: s.starts[0] };
  }));
  expect(runs[0]).toEqual(runs[1]);
  expect(runs[0]).toEqual({ id: expected.track.youtubeId, start: expected.offsetSec });
});
