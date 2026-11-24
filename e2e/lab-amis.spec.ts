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

test("Ta rue : même fenêtre sur tous les écrans, sinon « hors cadre », bulle au clavier", async ({ page }) => {
  await prepare(page);
  const res = await page.goto("/lab/amis");
  test.skip(res?.status() === 404, "Banc d'essai désactivé (build sans NEXT_PUBLIC_LAB=1).");
  const winOf = async (name: string) => {
    const w = page.getByTestId("ff-win").filter({ has: page.getByTestId("ff-plate").getByText(name, { exact: true }) });
    return (await w.count()) ? w.getAttribute("data-window") : null;
  };
  await expect(page.getByTestId("ff-plate")).toHaveCount(9);
  const names = ["Léa", "Tom", "Inès", "Hugo", "Maya", "Noé", "Sacha", "Jade"];
  const before = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await winOf(n)])));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const list = page.getByRole("region", { name: "Amis" });
  await list.getByRole("button").click(); // repliée sur téléphone
  for (const n of names) {
    const now = await winOf(n);
    if (now && before[n]) expect(now).toBe(before[n]);
    else await expect(list.getByRole("listitem").filter({ hasText: n })).toContainText("hors cadre");
  }
  // Clavier : une fenêtre prend le focus et montre sa bulle.
  await page.getByTestId("ff-win").first().focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
});
