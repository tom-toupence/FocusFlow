import { test, expect, prepare } from "./fixtures";

// « Dernier train » : heure d'arrêt choisie dans /settings, durée du 1er cycle
// tirée du plan, ligne « Arrêt à … » en session, puis écran de fin de plan.
// L'horloge du navigateur est figée à 14:20 (les minuteurs restent réels).

const NOW = new Date(2026, 0, 15, 14, 20, 0).getTime();

test("heure d'arrêt : plan dans /settings, 1er cycle étiré, ligne d'arrêt, puis fin de plan", async ({ page }) => {
  await prepare(page);
  await page.clock.setFixedTime(NOW);
  await page.goto("/settings");

  const picker = page.getByTestId("stop-at");
  await expect(picker.getByRole("button", { name: "Pas d'heure" })).toHaveAttribute("aria-pressed", "true");
  await expect(picker.getByRole("button", { name: "15:00" })).toBeVisible();

  await picker.getByLabel("Heure d'arrêt libre").fill("14:50");
  await expect(page.getByTestId("stop-sentence")).toContainText("1 pomodoro possible. Le dernier dure 30 min pour finir pile à 14:50.");
  await expect(page.getByTestId("stop-goal")).toContainText("Objectif du jour");

  await page.getByRole("button", { name: "Démarrer la session" }).click();
  await page.waitForURL("**/session");
  await expect(page.getByRole("timer").first()).toHaveText("30:00");
  await expect(page.getByTestId("stop-line")).toHaveText("Arrêt à 14:50 · 1 pomodoro restant");

  // Le temps passe : le pomodoro de 30 min se termine, le plan est épuisé.
  await page.clock.setFixedTime(NOW + 30 * 60_000);
  await expect(page.getByText("Heure d'arrêt atteinte")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Terminer" })).toBeVisible();

  await page.getByRole("button", { name: "Encore un pomodoro" }).click();
  await expect(page.getByRole("timer").first()).toHaveText("25:00");
  await expect(page.getByTestId("stop-line")).toHaveCount(0);
});

test("Pas d'heure : aucune ligne d'arrêt, cycle normal", async ({ page }) => {
  await prepare(page);
  await page.clock.setFixedTime(NOW);
  await page.goto("/settings");
  await expect(page.getByTestId("stop-sentence")).toHaveCount(0);
  await page.getByRole("button", { name: "Démarrer la session" }).click();
  await page.waitForURL("**/session");
  await expect(page.getByRole("timer").first()).toHaveText("25:00");
  await expect(page.getByTestId("stop-line")).toHaveCount(0);
});
