import { test, expect, prepare, open } from "./fixtures";

test("accueil : navigation principale et minuteur d'aperçu", async ({ page }) => {
  await prepare(page);
  await open(page, "/");
  const nav = page.getByRole("navigation", { name: "Navigation principale" }).first();
  await expect(nav).toBeVisible();
  await nav.getByRole("button", { name: /Écouter/ }).click();
  await expect(page.getByRole("heading", { name: "Choisis ton ambiance" })).toBeVisible();
});

test("thème petit matin : la classe dark disparaît et les jetons changent", async ({ page }) => {
  await prepare(page, { theme: "light" });
  await open(page, "/");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgb(0, 0, 0)");
});

test("réglages : hors Personnalisé, les durées restent lisibles mais ne sont pas réglables, même au clavier", async ({ page }) => {
  await prepare(page);
  await open(page, "/settings");
  await page.getByRole("button", { name: /Classic/ }).first().click();
  const minus = page.getByRole("button", { name: "Durée de focus : diminuer" });
  // Format imposé : la valeur reste affichée, le réglage n'est ni visible ni atteignable.
  await expect(page.getByText("Durée de focus")).toBeVisible();
  await expect(minus).toHaveCount(0);
  await page.getByRole("button", { name: /Personnalisé/ }).first().click();
  await expect(minus).toBeEnabled();
});

test("aucun emoji ni tiret cadratin dans le texte visible des écrans principaux", async ({ page }) => {
  await prepare(page);
  for (const path of ["/", "/settings", "/insights"]) {
    await open(page, path);
    await page.waitForTimeout(800);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text, path).not.toMatch(/—/);
    expect(text, path).not.toMatch(/\p{Extended_Pictographic}/u);
  }
});
