import { describe, expect, it } from "vitest";
import {
  assignStreet, blindOf, coverLayout, lightOf, pauseZones, quadBox, usableWindows, windowRect, type FacadeWindow,
} from "./friendStreet";
import { FACADES } from "./facades";

const facade = FACADES[0];

describe("façade annotée", () => {
  it("24 à 40 fenêtres, dans la photo, pas trop petites, sans chevauchement", () => {
    expect(facade.windows.length).toBeGreaterThanOrEqual(24);
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

  it("fenêtres utilisables : hors du texte de la pause et de la liste", () => {
    for (const [w, h] of [[1440, 900], [390, 844], [1280, 800]]) {
      const img = coverLayout(w, h, facade.width, facade.height, facade.focusX);
      const { zone, avoid } = pauseZones(w, h, w >= 768);
      const ids = usableWindows(facade.windows, img, zone, avoid);
      expect(ids.length).toBeGreaterThanOrEqual(8);
      for (const id of ids) {
        const r = windowRect(facade.windows.find((x) => x.id === id)!, img);
        if (w >= 768) expect(r.x).toBeGreaterThanOrEqual(w * 0.5);
        else expect(r.y + r.h).toBeLessThanOrEqual(h * 0.5);
      }
    }
  });
});

describe("attribution", () => {
  const pool = Array.from({ length: 20 }, (_, i) => i + 1);
  it("ta fenêtre d'abord, puis une par ami, sans doublon, stable", () => {
    const a = assignStreet("me", ["lea", "tom", "zoe"], pool, "facade");
    const b = assignStreet("me", ["zoe", "lea", "tom"], pool, "facade");
    expect(a.me).not.toBeNull();
    expect([...a.friends.entries()].sort()).toEqual([...b.friends.entries()].sort());
    const all = [a.me, ...a.friends.values()];
    expect(new Set(all).size).toBe(4);
  });

  it("plus d'amis que de fenêtres : les suivants n'en ont pas", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `ami-${i}`);
    const r = assignStreet("me", ids, pool, "facade");
    expect(r.friends.size).toBe(19);
    expect(assignStreet(null, ids, [], "facade").friends.size).toBe(0);
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
