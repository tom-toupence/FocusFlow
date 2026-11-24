import { test, expect, prepare, open } from "./fixtures";
import type { BrowserContext, Page } from "@playwright/test";

// Téléphone télécommande et « Emporter la session » (lot 7). Les deux « appareils »
// sont deux pages du même navigateur reliées par le transport BroadcastChannel,
// forcé par la clé de lab `focusflow-remote-transport` (permise en dev ou dans un
// build NEXT_PUBLIC_LAB=1 ; en production, Supabase Realtime prend le relais).

const QUEUE = [
  { youtubeId: "aaaaaaaaaa1", title: "Premier titre" },
  { youtubeId: "bbbbbbbbbb2", title: "Deuxième titre" },
];

type W = { __yt?: { playing: boolean; loaded: string[]; seeks: number[]; time(): number } };
const yt = (p: Page) => p.evaluate(() => {
  const y = (window as unknown as W).__yt!;
  return { playing: y.playing, loaded: [...y.loaded], seeks: [...y.seeks], time: y.time() };
});

async function forceLocal(p: Page) {
  await p.addInitScript(() => localStorage.setItem("focusflow-remote-transport", "local"));
}

/** mm:ss → secondes. */
const secs = (t: string) => { const [m, s] = t.trim().split(":").map(Number); return m * 60 + s; };

/** Ouvre le panneau et rend le lien du QR (code et secret dans le fragment). */
async function openPanel(pc: Page) {
  const button = pc.getByRole("button", { name: "Télécommande" });
  // Build de production sans Supabase ni NEXT_PUBLIC_LAB=1 : pas de transport, pas de bouton.
  test.skip((await button.count()) === 0, "transport local absent (build sans NEXT_PUBLIC_LAB=1)");
  await button.click();
  const code = (await pc.getByTestId("remote-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  return linkOf(pc, code);
}

async function linkOf(pc: Page, code: string) {
  const url = (await pc.getByTestId("remote-qr").getAttribute("data-url"))!;
  const u = new URL(url);
  expect(u.pathname === "/remote" || u.pathname === "/handoff").toBe(true);
  expect(u.hash).toMatch(new RegExp(`^#c=${code}&k=[A-Za-z0-9_-]{22}$`));
  return url;
}

/** « Autoriser » sur l'ordinateur, après avoir vérifié le même code de confirmation des deux côtés. */
async function allow(pc: Page, phone: Page, text: RegExp) {
  const ask = pc.getByTestId("remote-ask");
  await expect(ask).toContainText(text);
  const hostCode = (await pc.getByTestId("remote-ask-code").textContent())!.trim();
  expect(hostCode).toMatch(/^\d{4}$/);
  await expect(phone.getByTestId("confirm-code")).toContainText(hostCode);
  await ask.getByRole("button", { name: "Autoriser" }).click();
  await expect(ask).toHaveCount(0);
}

async function phonePage(context: BrowserContext) {
  const phone = await context.newPage();
  await prepare(phone);
  await forceLocal(phone);
  return phone;
}

test("télécommande : temps et titre de l'ordinateur, pause, distraction, suivant", async ({ page: pc, context }) => {
  await prepare(pc, { queue: QUEUE, loop: true });
  await forceLocal(pc);
  await open(pc, "/session");
  await pc.waitForFunction(() => (window as unknown as W).__yt?.playing === true);
  const link = await openPanel(pc);

  const phone = await phonePage(context);
  await phone.goto(link);
  // Rien sans « Autoriser » sur l'ordinateur.
  await expect(phone.getByTestId("remote-status")).toHaveText("Autorise ce téléphone");
  await expect(pc.getByTestId("remote-panel").getByRole("status")).toHaveText("En attente du téléphone");
  await allow(pc, phone, /veut se connecter/);
  await expect(phone.getByTestId("remote-title")).toHaveText("Premier titre");
  const hostTime = secs((await pc.getByRole("timer").first().textContent())!);
  const phoneTime = secs((await phone.getByTestId("remote-time").textContent())!);
  expect(Math.abs(hostTime - phoneTime)).toBeLessThanOrEqual(2);
  await expect(pc.getByTestId("remote-panel").getByRole("status")).toHaveText("Téléphone connecté");

  // Pause sur le téléphone : l'ordinateur se met en pause (minuteur et musique).
  await phone.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(pc).toHaveTitle(/^En pause · /);
  await pc.waitForFunction(() => (window as unknown as W).__yt?.playing === false);
  await expect(phone.getByRole("button", { name: "Reprendre", exact: true })).toBeVisible();
  await phone.getByRole("button", { name: "Reprendre", exact: true }).click();
  await pc.waitForFunction(() => (window as unknown as W).__yt?.playing === true);

  // Distraction : même chemin que la touche D.
  await phone.getByRole("button", { name: /Distraction/ }).click();
  await expect(pc.getByTitle("Marquer une distraction · touche D")).toContainText("1");
  await expect(phone.getByTestId("remote-distractions")).toHaveText("1");

  // Suivant.
  await phone.getByRole("button", { name: "Suivant", exact: true }).click();
  await expect(pc.getByText("Deuxième titre").first()).toBeVisible();
  await expect(phone.getByTestId("remote-title")).toHaveText("Deuxième titre");

  // Fermer le panneau ne coupe pas la télécommande ; « Déconnecter » la coupe.
  await pc.getByRole("button", { name: "Fermer" }).click();
  await phone.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(pc).toHaveTitle(/^En pause · /);
  await pc.getByRole("button", { name: "Télécommande" }).click();
  await pc.getByRole("button", { name: "Déconnecter" }).click();
  await expect(phone.getByTestId("remote-status")).toHaveText("Télécommande déconnectée");
});

/**
 * Côté téléphone : perd le premier message qui suit la réception du handoff
 * (le gros message), c'est-à-dire le « bye handed-off ». Les messages sont
 * chiffrés : on ne peut les reconnaître qu'à leur taille et leur ordre.
 */
const DROP_FIRST_BYE = () => {
  const Orig = window.BroadcastChannel;
  class Lossy extends Orig {
    set onmessage(fn: ((e: MessageEvent) => void) | null) {
      let sawHandoff = false;
      let dropped = false;
      super.onmessage = (e: MessageEvent) => {
        if (sawHandoff && !dropped) {
          dropped = true;
          (window as unknown as { __dropped: number }).__dropped = 1;
          return;
        }
        if (JSON.stringify(e.data).length > 600) sawHandoff = true;
        fn?.(e);
      };
    }
    get onmessage() { return super.onmessage; }
  }
  window.BroadcastChannel = Lossy;
};

for (const lostBye of [false, true]) test(`emporter la session${lostBye ? " (bye perdu : l'accusé répété le fait redire)" : ""} : même temps restant, même titre, l'ordinateur s'arrête sans double crédit`, async ({ page: pc, context }) => {
  // Pomodoro classique commencé il y a 3 min : 22 min restantes.
  const endsAt = Date.now() + 22 * 60_000;
  await prepare(pc, { queue: QUEUE, loop: true });
  await forceLocal(pc);
  await pc.addInitScript((endsAt) => {
    localStorage.setItem("focusflow-timer", JSON.stringify({
      version: 2,
      state: {
        settings: { preset: "classic", workDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
        mode: "work", secondsLeft: 1320, endsAt, isRunning: true, sessionsCompleted: 0, flowSeconds: 0, flowStartedAt: null,
        flowMinutesTotal: 0, flowBreakTotal: 0, active: true, updatedAt: Date.now(), stopAt: null, cycleSeconds: 1500,
        stopReached: false, videoSyncActive: null, agendaMeeting: null,
      },
    }));
    localStorage.removeItem("focusflow-stats");
  }, endsAt);
  await open(pc, "/session");
  await pc.waitForFunction(() => (window as unknown as W).__yt?.playing === true);
  // On passe au 2e titre : le téléphone doit reprendre celui-là.
  await pc.getByTitle("Titre suivant").click();
  await expect(pc.getByText("Deuxième titre").first()).toBeVisible();

  await openPanel(pc);
  await pc.getByRole("tab", { name: "Continuer sur le téléphone" }).click();
  await expect(pc.getByRole("img", { name: "QR code pour continuer sur le téléphone" })).toBeVisible();
  const link = await linkOf(pc, (await pc.getByTestId("remote-code").textContent())!.trim());

  const phone = await phonePage(context);
  if (lostBye) await phone.addInitScript(DROP_FIRST_BYE);
  await phone.goto(link);
  // Le fragment (code et secret) est retiré de la barre d'adresse.
  await expect.poll(() => new URL(phone.url()).hash).toBe("");
  await expect(phone.getByTestId("handoff-status")).toHaveText("Autorise sur l'ordinateur");
  // Avant Autoriser, la session tourne toujours sur l'ordinateur.
  expect(new URL(pc.url()).pathname).toBe("/session");
  await allow(pc, phone, /demande la session/);
  await phone.waitForURL(/\/session$/);
  if (lostBye) expect(await phone.evaluate(() => (window as unknown as { __dropped?: number }).__dropped)).toBe(1);

  // L'ordinateur s'arrête, prévient, et ne compte que ses 3 min.
  await pc.waitForURL((u) => !u.pathname.startsWith("/session"));
  await expect(pc.getByText("Session continuée sur le téléphone")).toBeVisible();
  const stats = async () => pc.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("focusflow-stats") || "{}");
    const days = raw.state?.days ?? {};
    return Object.values(days).reduce((a: number, d) => a + ((d as { minutesWorked: number }).minutesWorked ?? 0), 0);
  });
  expect(await stats()).toBe(3);

  // Le téléphone : même temps restant (±2 s), même titre, « Toucher pour reprendre ».
  const expected = Math.ceil((endsAt - Date.now()) / 1000);
  const shown = secs((await phone.getByRole("timer").first().textContent())!);
  expect(Math.abs(shown - expected)).toBeLessThanOrEqual(2);
  await expect(phone.getByText("Deuxième titre").first()).toBeAttached();
  await phone.waitForFunction(() => (window as unknown as W).__yt?.loaded.length);
  const before = await yt(phone);
  expect(before.loaded[0]).toBe("bbbbbbbbbb2");
  await phone.getByTestId("resume-gate").click();
  await expect(phone.getByTestId("resume-gate")).toHaveCount(0);
  const after = await yt(phone);
  expect(after.seeks.length).toBeGreaterThan(0);
  expect(after.seeks[after.seeks.length - 1]).toBeGreaterThan(0);

  // Toujours 3 min : aucun double crédit après coup.
  await phone.waitForTimeout(1500);
  expect(await stats()).toBe(3);
});

test("refuser un téléphone : il ne commande rien", async ({ page: pc, context }) => {
  await prepare(pc, { queue: QUEUE, loop: true });
  await forceLocal(pc);
  await open(pc, "/session");
  const link = await openPanel(pc);
  const phone = await phonePage(context);
  await phone.goto(link);
  const ask = pc.getByTestId("remote-ask");
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Refuser" }).click();
  await expect(phone.getByTestId("remote-status")).toHaveText("Connexion refusée");
  await expect(pc).toHaveTitle(/ · Focus$/);
});

test("lien invalide, puis ordinateur introuvable", async ({ context }) => {
  const phone = await phonePage(context);
  await phone.goto("/remote");
  await expect(phone.getByTestId("remote-status")).toHaveText("Lien invalide");
  // Une page neuve : le lien est lu une seule fois (puis retiré de la barre d'adresse).
  await phone.close();
  const phone2 = await phonePage(context);
  await phone2.goto("/remote#c=ZZZZ22&k=AAAAAAAAAAAAAAAAAAAAAA");
  await testLost(phone2);
});

async function testLost(phone: Page) {
  await expect(phone.getByTestId("remote-status")).not.toHaveText("Lien invalide");
  test.skip((await phone.getByTestId("remote-status").textContent()) === "Télécommande indisponible", "transport local absent (build sans NEXT_PUBLIC_LAB=1)");
  await expect(phone.getByTestId("remote-status")).toHaveText("Connexion à l'ordinateur…");
  await expect(phone.getByTestId("remote-status")).toHaveText("Ordinateur introuvable", { timeout: 15_000 });
}
