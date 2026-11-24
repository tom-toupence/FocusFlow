import { test, expect, prepare } from "./fixtures";

// « Ta rue » (banc d'essai /lab/amis, amis simulés, sans Supabase) : une plaque
// par fenêtre attribuée (toi + 8 amis), états allumée / éteinte, bascule.
test("Ta rue : plaques, états des fenêtres et ami qui s'allume", async ({ page }) => {
  await prepare(page);
  const res = await page.goto("/lab/amis");
  test.skip(res?.status() === 404, "Banc d'essai désactivé (build sans NEXT_PUBLIC_LAB=1).");
  const expected: Record<string, string> = {
    Toi: "on", Léa: "focus", Tom: "focus", Inès: "focus", Hugo: "on", Maya: "on", Noé: "off", Sacha: "off", Jade: "off",
  };
  const wins = page.getByTestId("ff-win");
  await expect(wins.first()).toBeVisible();
  const list = page.getByRole("region", { name: "Amis" });
  await expect(list.getByRole("listitem")).toHaveCount(8);
  // Chaque fenêtre visible a la plaque et l'état de son ami ; les autres sont « hors cadre ».
  const shown = await wins.evaluateAll((els) => els.map((e) => [e.querySelector('[data-testid="ff-plate"]')!.textContent!, (e as HTMLElement).dataset.state!]));
  for (const [name, st] of shown) expect(st).toBe(expected[name]);
  const friendsShown = shown.filter(([n]) => n !== "Toi").length;
  await expect(list.getByRole("listitem").filter({ hasText: "hors cadre" })).toHaveCount(8 - friendsShown);
  expect(friendsShown).toBeGreaterThanOrEqual(3);
  // Noé (hors ligne) passe en focus : sa fenêtre s'allume (ou sa ligne le dit s'il est hors cadre).
  await page.getByTestId("toggle-lab-ami-5").click();
  const noe = wins.filter({ has: page.getByTestId("ff-plate").filter({ hasText: /^Noé$/ }) });
  if (await noe.count()) await expect(noe).toHaveAttribute("data-state", "focus");
  await expect(list.getByRole("listitem").filter({ hasText: "Noé" })).toContainText("En focus");
});

test("Ta rue : même fenêtre sur tous les écrans, sinon « hors cadre », bulle au clavier", async ({ page }) => {
  await prepare(page);
  const res = await page.goto("/lab/amis");
  test.skip(res?.status() === 404, "Banc d'essai désactivé (build sans NEXT_PUBLIC_LAB=1).");
  const winOf = async (name: string) => {
    const w = page.getByTestId("ff-win").filter({ has: page.getByTestId("ff-plate").filter({ hasText: new RegExp(`^${name}$`) }) });
    return (await w.count()) ? w.getAttribute("data-window") : null;
  };
  await expect(page.getByTestId("ff-win").first()).toBeVisible();
  const names = ["Léa", "Tom", "Inès", "Hugo", "Maya", "Noé", "Sacha", "Jade"];
  const before = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await winOf(n)])));
  expect(Object.values(before).filter(Boolean).length).toBeGreaterThanOrEqual(3);
  await page.setViewportSize({ width: 390, height: 844 });
  // La façade se recadre (redimensionnement regroupé par image) : on attend que Maya
  // (masquée sur grand écran, visible sur téléphone à ce cadrage) ait sa fenêtre.
  await expect(page.getByTestId("ff-win").filter({ hasText: "Maya" })).toHaveCount(1);
  const list = page.getByRole("region", { name: "Amis" });
  await page.getByRole("button", { name: "Masquer les réglages" }).click();
  const toggle = list.getByRole("button");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  for (const n of names) {
    const now = await winOf(n);
    if (!now) await expect(list.getByRole("listitem").filter({ hasText: n })).toContainText("hors cadre");
    else if (before[n]) expect(now).toBe(before[n]);
  }
  // Clavier : une fenêtre prend le focus et montre sa bulle.
  await page.getByTestId("ff-win").first().focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
});
