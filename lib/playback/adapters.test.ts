import { describe, expect, it, vi } from "vitest";
import { SpotifyAdapter, type SpotifyBridge } from "./spotify";
import { TwitchAdapter, type TwitchEmbedPlayer } from "./twitch";
import type { PlayerAdapter } from "./types";

const bridge = (): SpotifyBridge & Record<string, ReturnType<typeof vi.fn>> => ({
  play: vi.fn(), pause: vi.fn(), next: vi.fn(), previous: vi.fn(), volume: vi.fn(),
  shuffle: vi.fn(), repeat: vi.fn(), seek: vi.fn(),
  suggest: vi.fn(async () => [{ id: "t1", title: "Proche", source: "spotify" as const, suggested: true }]),
  enqueue: vi.fn(async () => true),
});

describe("SpotifyAdapter", () => {
  it("déclare ce que Spotify sait faire, et pas le retrait d'un titre de la file", () => {
    const a = new SpotifyAdapter(bridge(), { shuffle: false, loop: true });
    expect(a.getState().caps).toMatchObject({ skip: true, shuffle: true, loop: true, seek: true, suggestions: true, removeUpcoming: false });
  });
  it("relaie les commandes au pont, sans appel redondant pour shuffle et boucle", async () => {
    const b = bridge();
    const a = new SpotifyAdapter(b, { shuffle: false, loop: true });
    a.play(); a.next(); a.seek(42); a.setVolume(0.3);
    a.setShuffle(false); a.setShuffle(true);
    a.setLoop(true); a.setLoop(false);
    expect(b.play).toHaveBeenCalledOnce();
    expect(b.next).toHaveBeenCalledOnce();
    expect(b.seek).toHaveBeenCalledWith(42);
    expect(b.volume).toHaveBeenCalledWith(0.3);
    expect(b.shuffle).toHaveBeenCalledTimes(1);
    expect(b.repeat).toHaveBeenCalledTimes(1);
    expect(a.getState()).toMatchObject({ playing: true, shuffle: true, loop: false });
    expect(await a.getSuggestions(undefined, 5)).toHaveLength(1);
    expect(b.suggest).toHaveBeenCalledWith(undefined, 5);
    expect(await a.enqueue({ id: "t1", title: "Proche", source: "spotify" })).toBe(true);
  });
  it("retirer un titre est sans effet (aucun endpoint Spotify)", () => {
    const b = bridge();
    const a = new SpotifyAdapter(b, { shuffle: false, loop: true });
    a.patch({ upcoming: [{ id: "x", title: "X", source: "spotify" }] });
    (a as PlayerAdapter).removeUpcoming("x");
    expect(a.getState().upcoming).toHaveLength(1);
  });
});

const fakeTwitch = () => {
  const p: TwitchEmbedPlayer & { playing: boolean; seeks: number[] } = {
    playing: true, seeks: [],
    setQuality() {}, setVolume() {},
    play() { p.playing = true; }, pause() { p.playing = false; }, seek(s) { p.seeks.push(s); },
  };
  return p;
};

describe("TwitchAdapter", () => {
  it("live : volume seulement, ni seek ni suggestions", async () => {
    const a = new TwitchAdapter(() => fakeTwitch(), { id: "live:x", title: "x", subtitle: "Live Twitch", vod: false });
    expect(a.getState().caps).toMatchObject({ volume: true, seek: false, skip: false, suggestions: false });
    expect(await a.getSuggestions()).toEqual([]);
  });
  it("rediffusion : seek autorisé", () => {
    const p = fakeTwitch();
    const a = new TwitchAdapter(() => p, { id: "vod:1", title: "VOD", subtitle: "Twitch", vod: true });
    a.seek(90);
    expect(p.seeks).toEqual([90]);
  });
  it("une pause demandée avant que le flux soit prêt est réappliquée à VIDEO_READY", () => {
    let p: ReturnType<typeof fakeTwitch> | null = null;
    const a = new TwitchAdapter(() => p, { id: "live:x", title: "x", subtitle: "Live", vod: false });
    a.pause(); // lecteur pas encore là
    p = fakeTwitch(); // l'embed démarre en autoplay
    a.markReady();
    expect(p.playing).toBe(false);
  });
});
