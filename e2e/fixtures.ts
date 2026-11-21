import { test as base, type Page } from "@playwright/test";

/**
 * Faux lecteur YouTube IFrame : remplace https://www.youtube.com/iframe_api.
 * Il enregistre ce que l'app lui demande (vidéos chargées, lecture/pause) dans
 * `window.__yt` et laisse le test simuler la fin d'un titre (`__yt.end()`).
 */
const FAKE_YT = `
window.__yt = { loaded: [], playing: false, players: 0, end() { this.onState && this.onState({ data: 0 }); } };
window.YT = { Player: function (id, cfg) {
  var y = window.__yt; y.players++;
  if (cfg.videoId) y.loaded.push(cfg.videoId);
  y.onState = cfg.events && cfg.events.onStateChange;
  var p = {
    playVideo: function () { y.playing = true; }, pauseVideo: function () { y.playing = false; },
    destroy: function () {}, setPlaybackQuality: function () {}, setVolume: function (v) { y.volume = v; },
    nextVideo: function () {}, previousVideo: function () {}, setLoop: function () {},
    loadVideoById: function (vid) { y.loaded.push(vid); }, loadPlaylist: function () {}
  };
  setTimeout(function () { cfg.events && cfg.events.onReady && cfg.events.onReady({ target: p }); }, 50);
  return p;
} };
setTimeout(function () { window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); }, 0);
`;

export interface Seed {
  queue?: { youtubeId: string; title: string }[];
  loop?: boolean;
  shuffle?: boolean;
  theme?: "dark" | "light";
}

const st = (state: object) => JSON.stringify({ state, version: 0 });

export async function prepare(page: Page, seed: Seed = {}) {
  await page.addInitScript(({ seed, st0 }) => {
    const st = (s: object) => JSON.stringify({ state: s, version: 0 });
    void st0;
    localStorage.setItem("focusflow-prefs", st({ onboarded: true, breathingEnabled: true, sceneEffects: false }));
    localStorage.setItem("focusflow-theme", st({ theme: seed.theme ?? "dark" }));
    if (seed.queue) {
      localStorage.setItem("focusflow-queue", st({ items: seed.queue.map((q, i) => ({ id: `q${i}`, ...q })) }));
      localStorage.setItem("focusflow-session", st({ selectedVideoId: null, selectedPlaylistId: null, playQueue: true, customVideos: [], todos: [] }));
    }
    localStorage.setItem("focusflow-playback", st({ loop: seed.loop ?? true, shuffle: seed.shuffle ?? false }));
  }, { seed, st0: st({}) });
  await page.route("**/www.youtube.com/iframe_api", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_YT }));
  await page.route(/img\.youtube\.com|i\.ytimg\.com/, (r) => r.fulfill({ status: 204 }));
  await page.route(/scdn\.co|spotify\.com|twitch\.tv|supabase\.co/, (r) => r.abort());
}

/** Ouvre une page et lève le splash d'arrivée (il ne part que sur un geste). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
}

export const test = base;
export { expect } from "@playwright/test";
