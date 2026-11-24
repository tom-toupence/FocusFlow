import { describe, expect, it } from "vitest";
import type { FriendStats } from "@/lib/friends";
import {
  assignFriendWindows, friendActivityLine, friendWindowState, firstName, hashString,
  MAX_FRIEND_WINDOWS, scanWindowIds, sortByWindowState, type RueWindow,
} from "./friendWindows";

const NOW = 1_800_000_000_000;
const stats = (o: Partial<FriendStats>): FriendStats => ({
  weekMinutes: 0, weekSessions: 0, streak: 0, level: 1, xp: 0, badges: 0,
  inFocus: false, focusStartedAt: 0, focusHeartbeat: 0, online: false, onlineHeartbeat: 0, activity: null, ...o,
});
const win = (id: number, area = 200): RueWindow => ({ id, area, cx: 0.5, cy: 0.5 });
const scene = Array.from({ length: 40 }, (_, i) => win(i + 1, i % 5 === 0 ? 20 : 300));

describe("scanWindowIds", () => {
  it("regroupe les pixels par numéro de fenêtre (canal G)", () => {
    // 4 x 2 pixels : fenêtre 3 sur (0,0) et (1,0), fenêtre 7 sur (3,1).
    const px = new Uint8ClampedArray(4 * 2 * 4);
    const set = (x: number, y: number, g: number) => { px[(y * 4 + x) * 4 + 1] = g; };
    set(0, 0, 3); set(1, 0, 3); set(3, 1, 7);
    px[(1 * 4 + 3) * 4 + 2] = 255; // ciel sous la fenêtre 7
    const w = scanWindowIds(px, 4, 2);
    expect(w.map((x) => [x.id, x.area])).toEqual([[3, 2], [7, 1]]);
    expect(w[0].cx).toBeCloseTo(1 / 4);
    expect(w[0].cy).toBeCloseTo(0.25);
    expect(w[1].cx).toBeCloseTo(3.5 / 4);
    expect(w[0].sky).toBe(0);
    expect(w[1].sky).toBe(1);
  });

  it("ramène la surface à la photo quand on lit une version réduite", () => {
    const px = new Uint8ClampedArray(2 * 2 * 4);
    px[1] = 9; px[5] = 9;
    expect(scanWindowIds(px, 2, 2, 16)[0].area).toBe(32);
  });
});

describe("assignFriendWindows", () => {
  it("donne toujours la même fenêtre au même ami dans une scène", () => {
    const a = assignFriendWindows(["lea", "tom", "zoe"], scene, "pont");
    const b = assignFriendWindows(["zoe", "lea", "tom"], [...scene].reverse(), "pont");
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it("ne donne jamais la même fenêtre à deux amis", () => {
    const ids = Array.from({ length: 16 }, (_, i) => `ami-${i}`);
    const m = assignFriendWindows(ids, scene, "carrefour");
    expect(m.size).toBe(16);
    expect(new Set(m.values()).size).toBe(16);
  });

  it("évite les fenêtres trop petites quand il y en a assez", () => {
    const m = assignFriendWindows(["a", "b", "c", "d"], scene, "pont");
    for (const id of m.values()) expect(id % 5).not.toBe(1);
  });

  it("préfère les fenêtres du centre de la photo", () => {
    const edge = Array.from({ length: 20 }, (_, i) => ({ ...win(i + 1), cx: 0.02 }));
    const mid = Array.from({ length: 20 }, (_, i) => ({ ...win(i + 21), cy: 0.5 }));
    const m = assignFriendWindows(["a", "b", "c"], [...edge, ...mid], "ruelle");
    for (const id of m.values()) expect(id).toBeGreaterThan(20);
  });

  it("écarte les « fenêtres » dans le ciel (nuages éclairés)", () => {
    const sky = Array.from({ length: 20 }, (_, i) => ({ ...win(i + 1), sky: 0.6 }));
    const m = assignFriendWindows(["a", "b"], [...sky, win(30), win(31)], "seattle");
    expect([...m.values()].sort()).toEqual([30, 31]);
  });

  it("s'arrête à 16 amis et au nombre de fenêtres", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `ami-${i}`);
    expect(assignFriendWindows(ids, scene, "pont").size).toBe(MAX_FRIEND_WINDOWS);
    expect(assignFriendWindows(ids, [win(1), win(2), win(3)], "avenue").size).toBe(3);
    expect(assignFriendWindows(ids, [], "jour").size).toBe(0);
    expect(assignFriendWindows([], scene, "pont").size).toBe(0);
  });

  it("change d'une scène à l'autre", () => {
    const ids = Array.from({ length: 8 }, (_, i) => `ami-${i}`);
    const a = assignFriendWindows(ids, scene, "pont");
    const b = assignFriendWindows(ids, scene, "carrefour");
    expect([...a.values()]).not.toEqual([...b.values()]);
  });

  it("hash stable", () => {
    expect(hashString("pont:lea")).toBe(hashString("pont:lea"));
    expect(hashString("")).toBe(0x811c9dc5);
  });
});

describe("friendWindowState", () => {
  it("focus, en ligne, hors ligne", () => {
    expect(friendWindowState(stats({ inFocus: true, focusHeartbeat: NOW - 30_000 }), NOW)).toBe("focus");
    expect(friendWindowState(stats({ online: true, onlineHeartbeat: NOW - 30_000 }), NOW)).toBe("on");
    expect(friendWindowState(stats({ online: true, onlineHeartbeat: NOW - 10 * 60_000 }), NOW)).toBe("off");
    expect(friendWindowState(stats({ inFocus: true, focusHeartbeat: NOW - 10 * 60_000 }), NOW)).toBe("off");
    expect(friendWindowState(null, NOW)).toBe("off");
  });

  it("ligne d'activité et prénom", () => {
    expect(friendActivityLine(stats({ online: true, onlineHeartbeat: NOW, activity: "En pause" }), NOW)).toBe("En pause");
    expect(friendActivityLine(stats({ inFocus: true, focusHeartbeat: NOW }), NOW)).toBe("En focus");
    expect(friendActivityLine(stats({ activity: "En focus · vieux titre" }), NOW)).toBe("Hors ligne");
    expect(firstName("  Léa Martin ")).toBe("Léa");
  });

  it("trie en focus, puis en ligne, puis hors ligne", () => {
    const list = [
      { displayName: "Off", stats: null },
      { displayName: "On", stats: stats({ online: true, onlineHeartbeat: NOW }) },
      { displayName: "Focus", stats: stats({ inFocus: true, focusHeartbeat: NOW }) },
    ];
    expect(sortByWindowState(list, NOW).map((f) => f.displayName)).toEqual(["Focus", "On", "Off"]);
  });
});
