import { defineConfig } from "@playwright/test";

// e2e : démarre le serveur de dev s'il ne tourne pas déjà (ou E2E_BASE_URL
// pointe vers un build). YouTube, Spotify et Twitch sont simulés (réseau coupé dans
// les tests) : on vérifie NOTRE logique, pas leurs services.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
    trace: "off",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 180_000 },
});
