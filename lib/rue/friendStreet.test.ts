import { describe, expect, it } from "vitest";
import {
  assignStreet, blindOf, coverLayout, frameFacade, framePause, fullZone, lightOf, MAX_STREET_FRIENDS, POSTIT_PHONE, quadBox, usableWindows, windowRect,
  type FacadeWindow, type Rect,
} from "./friendStreet";
import { FACADES } from "./facades";

const facade = FACADES[0];

describe("façade annotée", () => {
  it("24 à 40 fenêtres, dans la photo, pas trop petites, sans chevauchement", () => {
    expect(facade.windows.length).toBeGreaterThanOrEqual(MAX_STREET_FRIENDS + 1);
    expect(facade.windows.length).toBeLessThanOrEqual(40);
    const boxes = facade.windows.map((w) => quadBox(w.quad));
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(1);
      expect(b.y + b.h).toBeLessThanOrEqual(1);
      expect(b.w * facade.width).toBeGreaterThan(60);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
    }
  });
});

describe("cadrage", () => {
  it("cover : remplit le conteneur, garde le point focal", () => {
    const r = coverLayout(390, 844, 2400, 1500, 0.75);
    expect(r.h).toBeCloseTo(844);
    expect(r.x).toBeCloseTo((390 - r.w) * 0.75);
    const d = coverLayout(1440, 900, 2400, 1500);
    expect(d).toEqual({ x: 0, y: 0, w: 1440, h: 900 });
  });

  // Bloc de texte de la pause, comme dans la page (mesuré en vrai dans le navigateur).
  const textOf = (w: number, h: number): Rect =>
    w >= 768 ? { x: w >= 1024 ? 64 : 40, y: h / 2 - 180, w: 448, h: 360 } : { x: 20, y: h - 400, w: w - 40, h: 368 };
  it("toutes les fenêtres tiennent dans la zone libre, sur tous les écrans", () => {
    for (const [w, h] of [[1440, 900], [1280, 720], [390, 844], [844, 390], [1920, 1080], [360, 640]]) {
      const { zone, img } = framePause(w, h, textOf(w, h), facade);
      const ids = usableWindows(facade.windows, img, zone, w < 768 ? [POSTIT_PHONE] : []);
      expect(ids.length, `${w}x${h}`).toBe(facade.windows.length);
      const min = w >= 380 && h >= 380 ? 30 : 18;
      for (const win of facade.windows) expect(windowRect(win, img).w, `${w}x${h}`).toBeGreaterThanOrEqual(min);
    }
  });

  it("la photo couvre l'écran quand c'est possible, sinon le bloc reste prioritaire", () => {
    const { img } = framePause(1440, 900, textOf(1440, 900), facade);
    expect(img.x).toBeLessThanOrEqual(0);
    expect(img.y).toBeLessThanOrEqual(0);
    expect(img.x + img.w).toBeGreaterThanOrEqual(1440);
    expect(img.y + img.h).toBeGreaterThanOrEqual(900);
    const lab = frameFacade(1440, 900, fullZone(1440, 900), facade);
    expect(usableWindows(facade.windows, lab, fullZone(1440, 900)).length).toBe(facade.windows.length);
  });
});

describe("attribution", () => {
  const pool = Array.from({ length: 20 }, (_, i) => i + 1);
  const f = (id: string, rank = 1) => ({ id, rank });
  it("ta fenêtre d'abord, puis une par ami, sans doublon, stable", () => {
    const a = assignStreet("me", [f("lea"), f("tom"), f("zoe")], pool, "facade");
    const b = assignStreet("me", [f("zoe"), f("lea", 0), f("tom", 2)], [...pool].reverse(), "facade");
    expect(a.me).not.toBeNull();
    expect([...a.friends.entries()].sort()).toEqual([...b.friends.entries()].sort());
    expect(new Set([a.me, ...a.friends.values()]).size).toBe(4);
  });

  it("même fenêtre quelle que soit la taille de l'écran (attribution sur toute la façade)", () => {
    const ids = facade.windows.map((x) => x.id);
    const amis = Array.from({ length: 8 }, (_, i) => f(`ami-${i}`));
    const ref = assignStreet("me", amis, ids, facade.id);
    for (const [w, h] of [[1440, 900], [390, 844], [1280, 800], [2560, 1080]]) {
      const { zone, img } = framePause(w, h, null, facade);
      const visible = new Set(usableWindows(facade.windows, img, zone));
      expect(visible.size).toBe(facade.windows.length);
      // L'écran ne change que ce qui est masqué, jamais l'attribution.
      expect(assignStreet("me", amis, ids, facade.id)).toEqual(ref);
    }
  });

  it("plus d'amis que de fenêtres : les allumés d'abord", () => {
    const amis = [
      ...Array.from({ length: 25 }, (_, i) => f(`off-${i}`, 2)),
      ...Array.from({ length: 3 }, (_, i) => f(`focus-${i}`, 0)),
      ...Array.from({ length: 2 }, (_, i) => f(`on-${i}`, 1)),
    ];
    const r = assignStreet("me", amis, pool, "facade");
    expect(r.friends.size).toBe(19);
    const big = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(assignStreet("me", amis, big, "facade").friends.size).toBe(MAX_STREET_FRIENDS);
    for (const id of ["focus-0", "focus-1", "focus-2", "on-0", "on-1"]) expect(r.friends.has(id)).toBe(true);
    expect(assignStreet(null, amis, [], "facade").friends.size).toBe(0);
  });

  it("lumière et store stables par ami, et variés", () => {
    expect(lightOf("lea")).toBe(lightOf("lea"));
    const lights = new Set(Array.from({ length: 30 }, (_, i) => lightOf(`ami-${i}`)));
    const blinds = new Set(Array.from({ length: 30 }, (_, i) => blindOf(`ami-${i}`)));
    expect(lights.size).toBe(3);
    expect(blinds.size).toBe(3);
  });
});

const w = (id: number, x: number, y: number): FacadeWindow => ({ id, quad: [[x, y], [x + 0.05, y], [x + 0.05, y + 0.04], [x, y + 0.04]] });
describe("usableWindows", () => {
  it("écarte les fenêtres coupées par le bord ou sous la liste", () => {
    const img = { x: 0, y: 0, w: 1000, h: 1000 };
    const ids = usableWindows([w(1, 0.1, 0.1), w(2, 0.97, 0.5), w(3, 0.8, 0.05)], img, { x: 0, y: 0, w: 1000, h: 1000 }, [{ x: 700, y: 0, w: 300, h: 200 }]);
    expect(ids).toEqual([1]);
  });
});
