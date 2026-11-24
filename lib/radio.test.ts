import { describe, expect, it } from "vitest";
import { createRadio, mulberry32, nowPlaying, RADIO_EPOCH, upcoming, type RadioTrack } from "./radio";

const mk = (id: string, min: number): RadioTrack => ({
  id,
  youtubeId: id.padEnd(11, "x"),
  title: `Titre ${id}`,
  channel: "Chaine",
  durationSec: min * 60,
});
const tracks = [mk("a", 60), mk("b", 30), mk("c", 120), mk("d", 20), mk("e", 180), mk("f", 45)];
const radio = createRadio(tracks);
const T = RADIO_EPOCH + 5 * 3600_000 + 12_345;

describe("radio", () => {
  it("PRNG déterministe", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("même résultat pour deux appels au même instant, quel que soit l'ordre d'entrée", () => {
    const r2 = createRadio([...tracks].reverse());
    expect(radio.nowPlaying(T)).toEqual(radio.nowPlaying(T));
    expect(radio.nowPlaying(T)).toEqual(r2.nowPlaying(T));
    expect(nowPlaying(tracks, T)).toEqual(radio.nowPlaying(T));
  });

  it("plafonne les longues pistes à 45 min, offset de départ valide", () => {
    expect(radio.cycleSec).toBe((45 + 30 + 45 + 20 + 45 + 45) * 60);
    for (let i = 0; i < 18; i++) {
      const s = radio.slotAt(i)!;
      expect(s.segmentSec).toBeLessThanOrEqual(45 * 60);
      expect(s.segmentStartSec + s.segmentSec).toBeLessThanOrEqual(s.track.durationSec);
      expect(s.endsAt - s.startsAt).toBe(s.segmentSec * 1000);
      if (s.track.durationSec <= 45 * 60) expect(s.segmentStartSec).toBe(0);
    }
  });

  it("maxSegmentSec configurable", () => {
    const r = createRadio(tracks, { maxSegmentSec: 600 });
    expect(r.cycleSec).toBe(6 * 600);
  });

  it("offset croissant dans une piste, borné par le segment", () => {
    const s0 = radio.nowPlaying(T)!;
    let prev = s0.offsetSec;
    for (let k = 1; k <= 5; k++) {
      const t = T + k * 10_000;
      if (t >= s0.endsAt) break;
      const s = radio.nowPlaying(t)!;
      expect(s.index).toBe(s0.index);
      expect(s.offsetSec).toBeGreaterThan(prev);
      prev = s.offsetSec;
    }
    expect(s0.startsAt).toBeLessThanOrEqual(T);
    expect(s0.endsAt).toBeGreaterThan(T);
    expect(s0.offsetSec - s0.segmentStartSec).toBe(Math.floor((T - s0.startsAt) / 1000));
  });

  it("continuité aux frontières de pistes", () => {
    for (let i = 0; i < 20; i++) {
      const s = radio.slotAt(i)!;
      const next = radio.slotAt(i + 1)!;
      expect(next.startsAt).toBe(s.endsAt);
      expect(radio.nowPlaying(s.endsAt - 1)!.index).toBe(i);
      const at = radio.nowPlaying(s.endsAt)!;
      expect(at.index).toBe(i + 1);
      expect(at.offsetSec).toBe(next.segmentStartSec);
    }
  });

  it("continuité à la frontière de cycle et de jour", () => {
    const edge = RADIO_EPOCH + radio.cycleSec * 1000;
    expect(radio.nowPlaying(edge - 1)!.cycle).toBe(0);
    expect(radio.nowPlaying(edge)!.cycle).toBe(1);
    expect(radio.nowPlaying(edge)!.startsAt).toBe(edge);
    const midnight = RADIO_EPOCH + 86400_000 * 3;
    const before = radio.nowPlaying(midnight - 1)!;
    const after = radio.nowPlaying(midnight)!;
    expect(after.index - before.index).toBeLessThanOrEqual(1);
    expect(before.endsAt).toBeGreaterThanOrEqual(midnight);
  });

  it("chaque cycle joue toutes les pistes, remélangées", () => {
    const ids = (c: number) => Array.from({ length: 6 }, (_, i) => radio.slotAt(c * 6 + i)!.track.id);
    expect([...ids(0)].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect([...ids(3)].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
    const orders = new Set([0, 1, 2, 3, 4, 5].map((c) => ids(c).join("")));
    expect(orders.size).toBeGreaterThan(1);
    // pas de répétition immédiate à la jonction de cycles
    for (let c = 0; c < 30; c++) expect(radio.slotAt(c * 6)!.track.id).not.toBe(radio.slotAt(c * 6 - 1)!.track.id);
  });

  it("upcoming : pistes suivantes, heures de début chaînées", () => {
    const cur = radio.nowPlaying(T)!;
    const up = radio.upcoming(T, 4);
    expect(up).toHaveLength(4);
    expect(up[0].index).toBe(cur.index + 1);
    expect(up[0].startsAt).toBe(cur.endsAt);
    expect(up[1].startsAt).toBe(up[0].endsAt);
    expect(upcoming(tracks, T, 4)).toEqual(up);
  });

  it("skipUnavailable passe à la suivante, de façon déterministe", () => {
    const cur = radio.nowPlaying(T)!;
    const next = radio.skipUnavailable(cur.index)!;
    expect(next.index).toBe(cur.index + 1);
    const dead = new Set([next.track.id]);
    const skipped = radio.skipUnavailable(cur.index, dead)!;
    expect(skipped.index).toBe(cur.index + 2);
    expect(radio.skipUnavailable(cur.index, dead)).toEqual(skipped);
    expect(radio.skipUnavailable(cur.index, new Set(tracks.map((t) => t.id)))).toBeNull();
  });

  it("avant l'époque et liste vide", () => {
    expect(radio.nowPlaying(RADIO_EPOCH - 3600_000)).not.toBeNull();
    const empty = createRadio([]);
    expect(empty.nowPlaying(T)).toBeNull();
    expect(empty.upcoming(T, 3)).toEqual([]);
  });

  it("ignore les pistes de durée invalide", () => {
    const r = createRadio([mk("a", 10), { ...mk("z", 0) }, { ...mk("y", 10), durationSec: NaN }]);
    expect(r.size).toBe(1);
  });
});
