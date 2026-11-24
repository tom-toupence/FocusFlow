import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRadio, RADIO_EPOCH, type RadioTrack } from "@/lib/radio";
import { newCursor, RADIO_NAME } from "@/lib/radioProgram";

// Faux lecteur IFrame : enregistre chargements (avec seconde de départ),
// recherches et lecture ; expose fin de titre et erreurs.
type Ev = { onReady?: (e: { target: FakePlayer }) => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void };
class FakePlayer {
  loads: { id: string; at: number }[] = [];
  seeks: number[] = [];
  playing = false;
  constructor(public id: string, public cfg: { videoId?: string; events: Ev }) {
    FakePlayer.last = this;
    queueMicrotask(() => cfg.events.onReady?.({ target: this }));
  }
  static last: FakePlayer;
  playVideo() { this.playing = true; }
  pauseVideo() { this.playing = false; }
  destroy() {}
  setPlaybackQuality() {}
  setVolume() {}
  nextVideo() { throw new Error("pas de suivant natif"); }
  previousVideo() { throw new Error("pas de précédent natif"); }
  loadVideoById(o: string | { videoId: string; startSeconds?: number }) {
    if (typeof o === "string") throw new Error("la radio doit donner la seconde de départ");
    this.loads.push({ id: o.videoId, at: o.startSeconds ?? 0 });
    this.current = o.videoId;
    this.playing = true;
  }
  cues: { id: string; at: number }[] = [];
  current: string | undefined;
  cueVideoById(o: { videoId: string; startSeconds?: number }) { this.cues.push({ id: o.videoId, at: o.startSeconds ?? 0 }); this.current = o.videoId; }
  getVideoData() { return { video_id: this.current }; }
  loadPlaylist() {}
  setLoop() {}
  seekTo(s: number) { this.seeks.push(s); }
  end() { this.cfg.events.onStateChange?.({ data: 0 }); }
  error(code: number) { this.cfg.events.onError?.({ data: code }); }
}

vi.mock("@/store/playlistStore", () => ({ fetchMixVideos: vi.fn(async () => ({ ids: [], titles: {} })) }));

const mk = (id: string): RadioTrack => ({ id, youtubeId: id.padEnd(11, "0"), title: `Titre ${id}`, channel: "C", durationSec: 1800 });
const radio = createRadio([mk("a"), mk("b"), mk("c"), mk("d"), mk("e")], { maxSegmentSec: 1800 });
const T0 = RADIO_EPOCH + 40 * 86400_000 + 3 * 3600_000;
const slot0 = radio.nowPlaying(T0)!;
/** 10 min dans le créneau courant. */
const START = slot0.startsAt + 600_000;

const flush = () => new Promise<void>((r) => queueMicrotask(r));

beforeEach(() => {
  // L'horloge avance avec les minuteurs (comme Date.now dans le navigateur).
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(START);
  (globalThis as unknown as { window: unknown }).window = { YT: { Player: FakePlayer } };
});
afterEach(() => vi.useRealTimers());

describe("YouTubeAdapter : source radio", async () => {
  const { YouTubeAdapter } = await import("./youtube");
  const make = (playing = true) =>
    new YouTubeAdapter("el", { type: "radio" }, { volume: 1, shuffle: false, loop: true, playing, radio, now: () => Date.now(), radioCursor: newCursor() });
  const advance = (ms: number) => vi.advanceTimersByTime(ms);
  const clockAt = (ms: number) => vi.setSystemTime(ms);

  it("charge la piste du programme à la bonne seconde ; pas de suivant, programme dans « À venir »", async () => {
    const a = make();
    expect(a.getState().track).toMatchObject({ id: slot0.track.youtubeId, subtitle: RADIO_NAME });
    await flush();
    expect(FakePlayer.last.loads).toEqual([{ id: slot0.track.youtubeId, at: 600 }]);
    const st = a.getState();
    expect(st.caps).toMatchObject({ skip: false, seek: false, suggestions: false, shuffle: false });
    expect(st.upcoming.map((t) => t.id).slice(0, 3)).toEqual([1, 2, 3].map((k) => radio.slotAt(slot0.index + k)!.track.youtubeId));
    a.next(); a.previous(); a.seek(10);
    expect(FakePlayer.last.loads).toHaveLength(1);
    expect(FakePlayer.last.seeks).toEqual([]);
    a.destroy();
  });

  it("fin du créneau : recalcule et charge la suivante à son offset (resynchro)", async () => {
    const a = make();
    await flush();
    advance(slot0.endsAt - START + 2000);
    const next = radio.slotAt(slot0.index + 1)!;
    expect(FakePlayer.last.loads.at(-1)!.id).toBe(next.track.youtubeId);
    // Calculé à l'heure de fin du créneau : début de l'extrait.
    expect(FakePlayer.last.loads.at(-1)!.at).toBe(next.segmentStartSec);
    expect(a.getState().track?.id).toBe(next.track.youtubeId);
    a.destroy();
  });

  it("ENDED normal juste avant la fin du créneau : la suivante, pas un rechargement de la même", async () => {
    const a = make();
    await flush();
    clockAt(slot0.endsAt - 1000);
    FakePlayer.last.end();
    expect(FakePlayer.last.loads.at(-1)).toEqual({ id: radio.slotAt(slot0.index + 1)!.track.youtubeId, at: 0 });
    a.destroy();
  });

  it("ENDED prématuré (vidéo plus courte que prévu) : la suivante depuis son début, retour au direct ensuite", async () => {
    const a = make();
    await flush();
    FakePlayer.last.end();
    const next = radio.slotAt(slot0.index + 1)!;
    expect(FakePlayer.last.loads.at(-1)).toEqual({ id: next.track.youtubeId, at: 0 });
    advance(next.endsAt - Date.now() + 100);
    const third = radio.slotAt(slot0.index + 2)!;
    expect(FakePlayer.last.loads.at(-1)).toEqual({ id: third.track.youtubeId, at: 0 });
    a.destroy();
  });

  it("erreur 150 : vidéo marquée morte pour la session, passe à la suivante", async () => {
    const cursor = newCursor();
    const a = new YouTubeAdapter("el", { type: "radio" }, { volume: 1, shuffle: false, loop: true, playing: true, radio, now: () => Date.now(), radioCursor: cursor });
    await flush();
    FakePlayer.last.error(150);
    expect(cursor.dead.has(slot0.track.youtubeId)).toBe(true);
    expect(FakePlayer.last.loads.at(-1)!.id).toBe(radio.slotAt(slot0.index + 1)!.track.youtubeId);
    expect(a.getState().error).toBeNull();
    a.destroy();
  });

  it("pause puis reprise : se recale sur le direct (seek à la seconde du programme)", async () => {
    const a = make();
    await flush();
    a.pause();
    expect(FakePlayer.last.playing).toBe(false);
    advance(120_000);
    expect(FakePlayer.last.loads).toHaveLength(1); // en pause, on ne touche pas au lecteur
    a.play();
    expect(FakePlayer.last.seeks.at(-1)).toBe(720);
    expect(FakePlayer.last.playing).toBe(true);
    a.destroy();
  });

  it("pause longue qui dépasse le créneau : la reprise charge la piste en cours à sa seconde", async () => {
    const a = make();
    await flush();
    a.pause();
    advance(slot0.endsAt - START + 5 * 60_000);
    a.play();
    const cur = radio.nowPlaying(Date.now())!;
    expect(FakePlayer.last.loads.at(-1)).toEqual({ id: cur.track.youtubeId, at: cur.offsetSec });
    expect(cur.offsetSec).toBe(300);
    a.destroy();
  });

  it("session ouverte minuteur arrêté : la vidéo est préparée (cue), jamais lancée ; « Reprendre » la lance au direct", async () => {
    const a = make(false);
    await flush();
    const p = FakePlayer.last;
    expect(p.loads).toEqual([]);
    expect(p.cues).toEqual([{ id: slot0.track.youtubeId, at: 600 }]);
    expect(p.playing).toBe(false);
    advance(30_000);
    a.play();
    expect(p.loads).toEqual([]);
    expect(p.seeks.at(-1)).toBe(630);
    expect(p.playing).toBe(true);
    a.destroy();
  });

  it("erreur tardive d'une vidéo déjà quittée : ignorée", async () => {
    const cursor = newCursor();
    const a = new YouTubeAdapter("el", { type: "radio" }, { volume: 1, shuffle: false, loop: true, playing: true, radio, now: () => Date.now(), radioCursor: cursor });
    await flush();
    const p = FakePlayer.last;
    p.current = "autre000000"; // le lecteur signale une autre vidéo que la piste en cours
    p.error(150);
    expect(cursor.dead.size).toBe(0);
    expect(p.loads).toHaveLength(1);
    a.destroy();
  });

  it("deux lecteurs au même instant : même vidéo, même seconde", async () => {
    const a = make();
    await flush();
    const p1 = FakePlayer.last;
    const b = make();
    await flush();
    const p2 = FakePlayer.last;
    expect(p1).not.toBe(p2);
    expect(p2.loads).toEqual(p1.loads);
    a.destroy(); b.destroy();
  });
});
