import { defineConfig } from "@playwright/test";

// e2e : le serveur de dev doit tourner (npm run dev) ou E2E_BASE_URL pointer
// vers un build. YouTube, Spotify et Twitch sont simulés (réseau coupé dans
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
});
