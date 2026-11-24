import { test, expect, prepare, open } from "./fixtures";

// « Lancer en une phrase » (⌘K) : la phrase est comprise, montrée, puis la
// session démarre directement, sans passer par le catalogue ni /settings.

type W = { __yt?: { loaded: string[] } };

test("⌘K « 50 min osaka midnight » : Entrée lance /session à 50:00 avec la bonne vidéo", async ({ page }) => {
  await prepare(page);
  await open(page, "/");
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: /Rechercher une action/ });
  await input.fill("50 min osaka midnight");

  const compris = page.getByRole("region", { name: "Compris" });
  await expect(compris).toBeVisible();
  await expect(compris.getByText("50 min", { exact: true })).toBeVisible();
  await expect(compris.getByText("Study With Me · Osaka Midnight (4h)").first()).toBeVisible();
  await expect(compris.getByText(/dans le catalogue/)).toBeVisible();
  // Combobox : l'option active est annoncée.
  await expect(input).toHaveAttribute("aria-expanded", "true");
  const active = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${active}"]`)).toHaveText("Démarrer");

  await input.press("Enter");
  await page.waitForURL("**/session");
  await page.waitForFunction(() => ((window as unknown as W).__yt?.loaded.length ?? 0) > 0);
  const loaded = await page.evaluate(() => (window as unknown as W).__yt!.loaded);
  expect(loaded[0]).toBe("gHmq9Xd6qMQ");
  await expect(page.getByText(/^(50:00|49:5\d)$/).first()).toBeVisible();
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem("focusflow-timer") ?? "{}").state?.settings);
  expect(settings).toMatchObject({ preset: "custom", workDuration: 50, shortBreakDuration: 5 });

  // Session en cours : relancer depuis ⌘K le dit avant de la remplacer.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Rechercher une action/ }).fill("25 min osaka midnight");
  await expect(page.getByText("Remplace la session en cours")).toBeVisible();
});

test("⌘K ambigu : Entrée choisit d'abord, ne lance jamais un média au hasard", async ({ page }) => {
  await prepare(page);
  await open(page, "/");
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: /Rechercher une action/ });
  await input.fill("25 min osaka");
  const compris = page.getByRole("region", { name: "Compris" });
  await expect(compris.getByText("Quelle musique ?")).toBeVisible();
  await expect(compris.getByRole("option", { name: "Démarrer" })).toHaveCount(0);

  await input.press("ArrowDown");
  await input.press("Enter"); // choisit la 2e correspondance
  await expect(page).toHaveURL(/\/$/);
  await expect(compris.getByRole("option", { name: "Démarrer" })).toBeVisible();
  await input.press("Enter");
  await page.waitForURL("**/session");
});
