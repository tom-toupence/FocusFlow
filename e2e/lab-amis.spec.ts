import { test, expect, prepare } from "./fixtures";

// « Ta rue » (banc d'essai /lab/amis, amis simulés, sans Supabase) : une plaque
// par fenêtre attribuée (toi + 8 amis), états allumée / éteinte, bascule.
test("Ta rue : plaques, états des fenêtres et ami qui s'allume", async ({ page }) => {
  await prepare(page);
  const res = await page.goto("/lab/amis");
  test.skip(res?.status() === 404, "Banc d'essai désactivé (build sans NEXT_PUBLIC_LAB=1).");
  const plates = page.getByTestId("ff-plate");
  await expect(plates).toHaveCount(9);
  await expect(plates.filter({ hasText: "Toi" })).toHaveCount(1);
  const wins = page.getByTestId("ff-win");
  await expect(wins.and(page.locator('[data-state="focus"]'))).toHaveCount(3);
  await expect(wins.and(page.locator('[data-state="on"]'))).toHaveCount(3); // 2 amis en ligne + toi
  await expect(wins.and(page.locator('[data-lit="0"]'))).toHaveCount(3);
  // Noé (hors ligne) passe en focus : sa fenêtre s'allume.
  await page.getByTestId("toggle-lab-ami-5").click();
  await expect(wins.and(page.locator('[data-lit="0"]'))).toHaveCount(2);
  await expect(wins.and(page.locator('[data-state="focus"]'))).toHaveCount(4);
  // La liste reste à côté, avec tout le monde.
  await expect(page.getByRole("region", { name: "Amis" }).getByRole("listitem")).toHaveCount(8);
});
