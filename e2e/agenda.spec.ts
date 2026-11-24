import { test, expect, prepare, open } from "./fixtures";
import type { Page } from "@playwright/test";

// « Le minuteur qui connaît ton agenda » : la route serveur est interceptée
// (jamais de vrai agenda), l'horloge du navigateur est figée à 14:20.

const NOW = new Date(2026, 0, 15, 14, 20, 0).getTime();
const MIN = 60_000;
const URL_ICAL = "webcal://calendar.example.com/private/abc123/basic.ics";

async function mockAgenda(page: Page, events: { start: number; end: number; title?: string }[]) {
  const calls: { method: string; body: unknown }[] = [];
  await page.route("**/api/calendar/import", async (route) => {
    const req = route.request();
    calls.push({ method: req.method(), body: req.postDataJSON() });
    await route.fulfill({ contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ events }) });
  });
  return calls;
}

async function seedIcal(page: Page, url: string) {
  await page.addInitScript((u) => {
    const raw = localStorage.getItem("focusflow-prefs");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...parsed.state, icalUrl: u };
    localStorage.setItem("focusflow-prefs", JSON.stringify(parsed));
  }, url);
}

test("réunion à +20 min : pomodoro raccourci par défaut, « Garder 25 min » rétablit 25:00", async ({ page }) => {
  await prepare(page);
  await seedIcal(page, "https://calendar.example.com/private/abc123/basic.ics");
  const calls = await mockAgenda(page, [{ start: NOW + 20 * MIN, end: NOW + 50 * MIN, title: "Réunion d'équipe" }]);
  await page.clock.setFixedTime(NOW);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Démarrer la session" }).click();
  await page.waitForURL("**/session");

  const line = page.getByTestId("agenda-line");
  await expect(line).toContainText("Réunion d'équipe à 14:40. Fin à 14:35.");
  await expect(page.getByRole("timer").first()).toHaveText("15:00");
  expect(calls[0].method).toBe("POST");
  expect((calls[0].body as { url: string }).url).toContain("calendar.example.com");

  await line.getByRole("button", { name: "Garder 25 min" }).click();
  await expect(page.getByRole("timer").first()).toHaveText("25:00");
  await expect(page.getByTestId("agenda-line")).toHaveCount(0);
});

test("réunion dans 8 min : pas de pomodoro, « Attendre » passe en pause jusqu'à la fin", async ({ page }) => {
  await prepare(page);
  await seedIcal(page, "https://calendar.example.com/private/abc123/basic.ics");
  await mockAgenda(page, [{ start: NOW + 8 * MIN, end: NOW + 38 * MIN, title: "Point client" }]);
  await page.clock.setFixedTime(NOW);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Démarrer la session" }).click();
  await page.waitForURL("**/session");

  const line = page.getByTestId("agenda-line");
  await expect(line).toContainText("Point client dans 8 min. Pas assez pour un pomodoro.");
  await line.getByRole("button", { name: "Attendre" }).click();
  await expect(page.getByTestId("agenda-meeting")).toContainText("Point client jusqu'à 14:58.");
});

test("profil : adresse iCal, Tester (événements du jour), Retirer", async ({ page }) => {
  await prepare(page);
  await page.clock.setFixedTime(NOW);
  const calls = await mockAgenda(page, [
    { start: NOW + 40 * MIN, end: NOW + 70 * MIN, title: "Réunion d'équipe" },
    { start: NOW + 24 * 60 * MIN, end: NOW + 25 * 60 * MIN, title: "Demain" },
  ]);
  await open(page, "/");
  await page.getByTitle("Mon profil").click();
  const section = page.getByTestId("agenda-settings");
  await expect(section).toBeVisible();

  // Adresse invalide : refusée sans appel au serveur.
  await section.getByLabel("Adresse iCal privée").fill("http://calendar.example.com/a.ics");
  await section.getByRole("button", { name: "Tester" }).click();
  await expect(section.getByRole("status")).toContainText("Adresse invalide");
  expect(calls).toHaveLength(0);

  await section.getByLabel("Adresse iCal privée").fill(URL_ICAL);
  await section.getByRole("button", { name: "Tester" }).click();
  await expect(section.getByTestId("agenda-events")).toContainText("15:00 à 15:30");
  await expect(section.getByTestId("agenda-events")).toContainText("Réunion d'équipe");
  await expect(section.getByTestId("agenda-events")).not.toContainText("Demain");
  await expect(section.getByTestId("agenda-saved")).toHaveText("calendar.example.com/…");
  expect(calls[0].method).toBe("POST");
  expect((calls[0].body as { url: string }).url).toBe("https://calendar.example.com/private/abc123/basic.ics");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("focusflow-prefs") ?? "{}").state?.icalUrl);
  expect(saved).toBe("https://calendar.example.com/private/abc123/basic.ics");

  await section.getByRole("button", { name: "Retirer" }).click();
  await expect(section.getByLabel("Adresse iCal privée")).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("focusflow-prefs") ?? "{}").state?.icalUrl);
  expect(after).toBeNull();
});
