import { beforeEach, describe, expect, it, vi } from "vitest";

// Faux lecteur IFrame : enregistre les vidéos chargées, expose ses callbacks.
type Ev = { onReady?: (e: { target: FakePlayer }) => void; onStateChange?: (e: { data: number }) => void };
class FakePlayer {
  loaded: string[] = [];
  playing = false;
  constructor(public id: string, public cfg: { videoId?: string; events: Ev }) {
    FakePlayer.last = this;
    if (cfg.videoId) this.loaded.push(cfg.videoId);
    queueMicrotask(() => cfg.events.onReady?.({ target: this }));
  }
  static last: FakePlayer;
  playVideo() { this.playing = true; }
  pauseVideo() { this.playing = false; }
  destroy() {}
  setPlaybackQuality() {}
  setVolume() {}
  nextVideo() {}
  previousVideo() {}
  loadVideoById(id: string) { this.loaded.push(id); }
  loadPlaylist() {}
  setLoop() {}
  end() { this.cfg.events.onStateChange?.({ data: 0 }); }
}

vi.mock("@/store/playlistStore", () => ({ fetchMixVideos: vi.fn(async () => ({ ids: [], titles: {} })) }));

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { YT: { Player: FakePlayer } };
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const tracks = (...ids: string[]) => ids.map((id) => ({ id, title: id.toUpperCase() }));

describe("YouTubeAdapter", async () => {
  const { YouTubeAdapter } = await import("./youtube");

  it("enchaîne la file maison et affiche le titre avant que le lecteur soit prêt", async () => {
    const a = new YouTubeAdapter("el", { type: "queue", tracks: tracks("a", "b") }, { volume: 1, shuffle: false, loop: true, playing: true });
    expect(a.getState().track?.title).toBe("A");
    await tick();
    FakePlayer.last.end();
    expect(FakePlayer.last.loaded).toEqual(["a", "b"]);
    expect(a.getState().track).toMatchObject({ id: "b", index: 1, total: 2 });
    a.destroy();
  });

  it("boucle activée : reprend en tête à la fin", async () => {
    const a = new YouTubeAdapter("el", { type: "queue", tracks: tracks("a", "b") }, { volume: 1, shuffle: false, loop: true, playing: true });
    await tick();
    FakePlayer.last.end();
    FakePlayer.last.end();
    expect(FakePlayer.last.loaded).toEqual(["a", "b", "a"]);
    a.destroy();
  });

  it("boucle coupée : prolonge avec des titres de toute la playlist, ignore les fins redondantes", async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => (resolve = r));
    const seeds: string[] = [];
    const recommend = vi.fn(async (seed: string) => { seeds.push(seed); await gate; return [{ id: `r-${seed}`, title: `R ${seed}` }]; });
    const onExtended = vi.fn();
    const a = new YouTubeAdapter("el", { type: "queue", tracks: tracks("a", "b", "c") }, { volume: 1, shuffle: false, loop: false, playing: true, recommend, onExtended });
    await tick();
    FakePlayer.last.end(); // b
    FakePlayer.last.end(); // c
    FakePlayer.last.end(); // fin → prolongation
    FakePlayer.last.end(); // ENDED redondant pendant la requête : ignoré
    expect(a.getState().extending).toBe(true);
    resolve();
    await tick(); await tick();
    expect(new Set(seeds)).toEqual(new Set(["c", "a", "b"])); // dernière + reste de la liste
    expect(FakePlayer.last.loaded).toEqual(["a", "b", "c", "r-c"]);
    expect(onExtended).toHaveBeenCalledWith(expect.objectContaining({ added: 3 }));
    expect(a.getState().extending).toBe(false);
    a.destroy();
  });

  it("rien de neuf à proposer : reboucle au lieu de s'arrêter", async () => {
    const a = new YouTubeAdapter("el", { type: "queue", tracks: tracks("a", "b") }, { volume: 1, shuffle: false, loop: false, playing: true, recommend: async () => [{ id: "a", title: "A" }] });
    await tick();
    FakePlayer.last.end(); FakePlayer.last.end();
    await tick(); await tick();
    expect(FakePlayer.last.loaded).toEqual(["a", "b", "a"]);
    a.destroy();
  });

  it("un passage manuel au titre suivant au bout de la file déclenche aussi la prolongation", async () => {
    const recommend = vi.fn(async () => [{ id: "x", title: "X" }]);
    const a = new YouTubeAdapter("el", { type: "queue", tracks: tracks("a") }, { volume: 1, shuffle: false, loop: false, playing: true, recommend });
    await tick();
    a.next();
    await tick(); await tick();
    expect(FakePlayer.last.loaded).toEqual(["a", "x"]);
    a.destroy();
  });

  it("pause et lecture passent au lecteur ; la vidéo unique ne déclare ni saut ni aléatoire", async () => {
    const a = new YouTubeAdapter("el", { type: "video", id: "v", title: "V" }, { volume: 1, shuffle: false, loop: true, playing: false });
    await tick();
    expect(a.getState().caps).toMatchObject({ skip: false, shuffle: false });
    a.play();
    expect(FakePlayer.last.playing).toBe(true);
    a.pause();
    expect(FakePlayer.last.playing).toBe(false);
    a.destroy();
  });
});
