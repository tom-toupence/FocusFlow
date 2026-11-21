import { test as base, type Page } from "@playwright/test";

/**
 * Faux lecteur YouTube IFrame : remplace https://www.youtube.com/iframe_api.
 * Il enregistre ce que l'app lui demande (vidéos chargées, lecture/pause) dans
 * `window.__yt` et laisse le test simuler la fin d'un titre (`__yt.end()`).
 */
const FAKE_YT = `
window.__yt = { loaded: [], lists: [], seeks: [], playing: false, players: 0, end() { this.onState && this.onState({ data: 0 }); } };
window.YT = { Player: function (id, cfg) {
  var y = window.__yt; y.players++;
  if (cfg.videoId) y.loaded.push(cfg.videoId);
  y.onState = cfg.events && cfg.events.onStateChange;
  var p = {
    playVideo: function () { y.playing = true; }, pauseVideo: function () { y.playing = false; },
    destroy: function () {}, setPlaybackQuality: function () {}, setVolume: function (v) { y.volume = v; },
    nextVideo: function () {}, previousVideo: function () {}, setLoop: function () {},
    loadVideoById: function (vid) { y.loaded.push(vid); },
    loadPlaylist: function (o) { y.lists.push(o && o.list ? o.list : o); },
    seekTo: function (s) { y.seeks.push(s); }
  };
  setTimeout(function () { cfg.events && cfg.events.onReady && cfg.events.onReady({ target: p }); }, 50);
  return p;
} };
setTimeout(function () { window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); }, 0);
`;

/** Faux embed Twitch : enregistre lecture, pause et volume dans `window.__tw`. */
const FAKE_TWITCH = `
window.__tw = { playing: true, volume: null, created: 0, opts: null };
(function () {
  function Embed(id, opts) {
    var t = window.__tw; t.created++; t.opts = opts; var ls = {};
    var player = { setQuality: function () {}, setVolume: function (v) { t.volume = v; },
      play: function () { t.playing = true; }, pause: function () { t.playing = false; }, seek: function () {} };
    setTimeout(function () { (ls[Embed.VIDEO_READY] || []).forEach(function (f) { f(); }); }, 50);
    return { destroy: function () {}, getPlayer: function () { return player; },
      addEventListener: function (e, f) { (ls[e] = ls[e] || []).push(f); } };
  }
  Embed.VIDEO_READY = "video.ready";
  window.Twitch = { Embed: Embed };
})();
`;

export interface Seed {
  queue?: { youtubeId: string; title: string }[];
  loop?: boolean;
  shuffle?: boolean;
  theme?: "dark" | "light";
  /** Playlist YouTube enregistrée, sélectionnée pour la session. */
  playlist?: { playlistId: string; startVideoId?: string; title: string; extraVideos?: { id: string; title: string }[] };
  /** Playlists locales (Ma bibliothèque). */
  localPlaylists?: { id: string; name: string; tracks: { youtubeId: string; title: string }[] }[];
  /** Live Twitch sélectionné. */
  twitchChannel?: string;
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
    if (seed.playlist) {
      localStorage.setItem("focusflow-playlists", st({ playlists: [{ id: "pl1", ...seed.playlist }] }));
      localStorage.setItem("focusflow-session", st({ selectedVideoId: null, selectedPlaylistId: "pl1", playQueue: false, customVideos: [], todos: [] }));
    }
    if (seed.localPlaylists) {
      localStorage.setItem("focusflow-local-playlists", st({ playlists: seed.localPlaylists.map((p) => ({ ...p, createdAt: 1, updatedAt: 1 })) }));
    }
    if (seed.twitchChannel) {
      localStorage.setItem("focusflow-twitch", st({ selectedChannel: seed.twitchChannel, selectedVodId: null }));
    }
    localStorage.setItem("focusflow-playback", st({ loop: seed.loop ?? true, shuffle: seed.shuffle ?? false }));
  }, { seed, st0: st({}) });
  await page.route("**/www.youtube.com/iframe_api", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_YT }));
  await page.route(/img\.youtube\.com|i\.ytimg\.com/, (r) => r.fulfill({ status: 204 }));
  await page.route("**/embed.twitch.tv/embed/v1.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_TWITCH }));
  await page.route(/scdn\.co|spotify\.com|player\.twitch\.tv|www\.twitch\.tv|supabase\.co/, (r) => r.abort());
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
