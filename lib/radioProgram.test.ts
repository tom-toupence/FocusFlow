import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultVideos, type Video } from "@/data/videos";
import { createRadio, RADIO_EPOCH, type RadioTrack } from "./radio";
import {
  buildRadio, catalogueRadio, clockLabel, durationLabel, isListeningToRadio, isRadioActivity, newCursor, radioTarget, radioTracksFrom, radioUpcoming,
  RADIO_NAME, RADIO_SAFE_SEGMENT_SEC,
} from "./radioProgram";

const T = RADIO_EPOCH + 300 * 86400_000 + 7 * 3600_000 + 123_456;

afterEach(() => vi.restoreAllMocks());

describe("programme de la radio : données statiques seulement", () => {
  it("sans durée connue, chaque vidéo du catalogue est un extrait sûr depuis 0", () => {
    const tracks = radioTracksFrom(defaultVideos);
    expect(tracks).toHaveLength(defaultVideos.length);
    const r = catalogueRadio();
    for (let i = 0; i < r.size * 2; i++) {
      const s = r.slotAt(i)!;
      expect(s.segmentSec).toBeLessThanOrEqual(RADIO_SAFE_SEGMENT_SEC);
      if (!defaultVideos.find((v) => v.id === s.track.id)!.durationSec) {
        expect(s.segmentStartSec).toBe(0);
        expect(s.segmentSec).toBe(RADIO_SAFE_SEGMENT_SEC);
      }
    }
  });

  it("identique pour tous : ni hasard, ni horloge, ni données locales", async () => {
    const reference = JSON.stringify([catalogueRadio().nowPlaying(T), catalogueRadio().upcoming(T, 6)]);
    // Un autre appareil : module rechargé, catalogue dans un autre ordre, vidéos perso en plus.
    vi.resetModules();
    const fresh = await import("./radioProgram");
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Math.random interdit"); });
    const clock = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("Date.now interdit"); });
    const custom: Video = { id: "custom-1", title: "Perso", channel: "Moi", youtubeId: "zzzzzzzzzzz", mood: "lofi", custom: true };
    const other = fresh.buildRadio([...defaultVideos].reverse().concat(custom));
    expect(JSON.stringify([other.nowPlaying(T), other.upcoming(T, 6)])).toBe(reference);
    expect(JSON.stringify([fresh.catalogueRadio().nowPlaying(T), fresh.catalogueRadio().upcoming(T, 6)])).toBe(reference);
    expect(random).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
  });

  it("une durée renseignée dans le catalogue est prise en compte", () => {
    const v = defaultVideos.slice(0, 3).map((x, i) => (i === 0 ? { ...x, durationSec: 600 } : x));
    const r = buildRadio(v);
    expect(r.cycleSec).toBe(600 + 2 * RADIO_SAFE_SEGMENT_SEC);
  });
});

const mk = (id: string, min = 30): RadioTrack => ({ id, youtubeId: id.padEnd(11, "0"), title: id.toUpperCase(), channel: "C", durationSec: min * 60 });
const radio = createRadio([mk("a"), mk("b"), mk("c"), mk("d")], { maxSegmentSec: 1800 });

describe("radioTarget : resynchro sur le programme", () => {
  it("cas normal : la piste du programme, à la bonne seconde, jusqu'à la fin du créneau", () => {
    const s = radio.nowPlaying(T)!;
    const t = radioTarget(radio, T, newCursor())!;
    expect(t.slot.index).toBe(s.index);
    expect(t.offsetSec).toBe(Math.floor((T - s.startsAt) / 1000));
    expect(t.switchAt).toBe(s.endsAt);
    expect(t.ahead).toBe(false);
  });

  it("à la fin du créneau, recalcul : la suivante à son début, puis à la bonne seconde après une pause", () => {
    const s = radio.nowPlaying(T)!;
    const c = newCursor();
    const at = radioTarget(radio, s.endsAt, c)!;
    expect(at.slot.index).toBe(s.index + 1);
    expect(at.offsetSec).toBe(0);
    // Reprise 5 min après : on rejoint le direct, pas le début.
    const later = radioTarget(radio, s.endsAt + 300_000, c)!;
    expect(later.slot.index).toBe(s.index + 1);
    expect(later.offsetSec).toBe(300);
  });

  it("vidéo morte : la suivante disponible, jouée en avance, poursuivie (pas recommencée) à la reprise", () => {
    const s = radio.nowPlaying(T)!;
    const c = newCursor();
    c.dead.add(s.track.youtubeId);
    const t = radioTarget(radio, T, c)!;
    expect(t.slot.index).toBe(s.index + 1);
    expect(t.ahead).toBe(true);
    expect(t.offsetSec).toBe(0);
    expect(t.switchAt).toBe(t.slot.endsAt);
    const resumed = radioTarget(radio, T + 90_000, c)!;
    expect(resumed.slot.index).toBe(s.index + 1);
    expect(resumed.offsetSec).toBe(90);
    // À la fin de la piste jouée en avance : retour au direct.
    const back = radioTarget(radio, t.switchAt, c)!;
    let expected = s.index + 2;
    while (c.dead.has(radio.slotAt(expected)!.track.youtubeId)) expected++;
    expect(back.slot.index).toBe(expected);
    expect(back.ahead).toBe(expected !== s.index + 2);
  });

  it("créneau sauté (fin prématurée) puis la suivante morte aussi : on saute les deux", () => {
    const s = radio.nowPlaying(T)!;
    const c = newCursor();
    c.skipped.add(s.index);
    c.dead.add(radio.slotAt(s.index + 1)!.track.youtubeId);
    expect(radioTarget(radio, T, c)!.slot.index).toBe(s.index + 2);
  });

  it("tout est mort : rien à jouer (pas de boucle infinie)", () => {
    const c = newCursor(new Set(["a", "b", "c", "d"].map((x) => x.padEnd(11, "0"))));
    expect(radioTarget(radio, T, c)).toBeNull();
  });

  it("programme affiché sans les vidéos mortes", () => {
    const s = radio.nowPlaying(T)!;
    const dead = new Set([radio.slotAt(s.index + 1)!.track.youtubeId]);
    const up = radioUpcoming(radio, s.index, 4, dead);
    expect(up).toHaveLength(4);
    expect(up.every((u) => !dead.has(u.track.youtubeId))).toBe(true);
    expect(up[0].index).toBe(s.index + 2);
  });
});

describe("présentation", () => {
  it("activité « radio » reconnue, sauf en pause", () => {
    expect(isRadioActivity(`En focus · ${RADIO_NAME} · Titre`)).toBe(true);
    expect(isRadioActivity(`Flowtime · ${RADIO_NAME} · Titre`)).toBe(true);
    expect(isRadioActivity(`En pause · ${RADIO_NAME} · Titre`)).toBe(false);
    expect(isRadioActivity("En focus · Titre")).toBe(false);
    expect(isRadioActivity(null)).toBe(false);
  });
  it("ami qui écoute : activité radio ET heartbeat de focus frais (pas une activité restée après fermeture)", () => {
    const now = T;
    const base = { weekMinutes: 0, weekSessions: 0, streak: 0, level: 1, xp: 0, badges: 0, focusStartedAt: now - 600_000, online: true, onlineHeartbeat: now };
    const activity = `En focus · ${RADIO_NAME} · Titre`;
    expect(isListeningToRadio({ ...base, inFocus: true, focusHeartbeat: now - 30_000, activity }, now)).toBe(true);
    // Onglet fermé brutalement : activité encore là, heartbeat périmé.
    expect(isListeningToRadio({ ...base, inFocus: true, focusHeartbeat: now - 10 * 60_000, activity }, now)).toBe(false);
    expect(isListeningToRadio({ ...base, inFocus: false, focusHeartbeat: now, activity }, now)).toBe(false);
    expect(isListeningToRadio({ ...base, inFocus: true, focusHeartbeat: now, activity: "En focus · Autre" }, now)).toBe(false);
    expect(isListeningToRadio(null, now)).toBe(false);
  });
  it("libellés", () => {
    expect(durationLabel(1082)).toBe("18:02");
    expect(durationLabel(3725)).toBe("1:02:05");
    expect(clockLabel(new Date(2026, 0, 1, 21, 5).getTime())).toBe("21:05");
  });
});
