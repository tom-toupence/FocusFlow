import { describe, expect, it } from "vitest";
import { TrackQueue } from "./queue";

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

describe("TrackQueue", () => {
  it("avance dans l'ordre puis signale la fin sans boucle", () => {
    const q = new TrackQueue(["a", "b", "c"]);
    expect(q.current).toBe("a");
    expect(q.next(false)).toEqual({ kind: "track", id: "b", index: 1 });
    expect(q.next(false)).toEqual({ kind: "track", id: "c", index: 2 });
    expect(q.next(false)).toEqual({ kind: "end" });
    expect(q.current).toBe("c");
  });

  it("reboucle en tête avec la boucle", () => {
    const q = new TrackQueue(["a", "b"]);
    q.next(true);
    expect(q.next(true)).toEqual({ kind: "track", id: "a", index: 0 });
  });

  it("précédent bloque sur la première piste", () => {
    const q = new TrackQueue(["a", "b"]);
    expect(q.previous()).toEqual({ kind: "track", id: "a", index: 0 });
  });

  it("dédoublonne à la construction", () => {
    expect(new TrackQueue(["a", "a", "b", ""]).order).toEqual(["a", "b"]);
  });

  it("mélange en gardant la piste courante en tête, puis revient à l'ordre d'origine", () => {
    const q = new TrackQueue(["a", "b", "c", "d"], { random: seq(0, 0, 0) });
    q.next(false); // b
    q.setShuffle(true);
    expect(q.current).toBe("b");
    expect(q.index).toBe(0);
    expect([...q.order].sort()).toEqual(["a", "b", "c", "d"]);
    q.setShuffle(false);
    expect(q.order).toEqual(["a", "b", "c", "d"]);
    expect(q.current).toBe("b");
  });

  it("prolonge sans doublons et reprend après la fin", () => {
    const q = new TrackQueue(["a", "b"]);
    q.next(false);
    expect(q.next(false)).toEqual({ kind: "end" });
    expect(q.append(["b", "c", "c", "d"])).toEqual(["c", "d"]);
    expect(q.next(false)).toEqual({ kind: "track", id: "c", index: 2 });
  });

  it("file vide : fin immédiate, rien ne plante", () => {
    const q = new TrackQueue([]);
    expect(q.current).toBeNull();
    expect(q.next(true)).toEqual({ kind: "end" });
    expect(q.previous()).toEqual({ kind: "end" });
  });
});

describe("TrackQueue.remove / upcoming", () => {
  it("retire un titre à venir, jamais la piste en cours ni une piste jouée", () => {
    const q = new TrackQueue(["a", "b", "c", "d"]);
    q.next(false); // b
    expect(q.remove("a")).toBe(false);
    expect(q.remove("b")).toBe(false);
    expect(q.remove("c")).toBe(true);
    expect(q.upcoming()).toEqual(["d"]);
    expect(q.next(false)).toMatchObject({ id: "d" });
  });
  it("un titre retiré ne revient pas en dé-mélangeant", () => {
    const q = new TrackQueue(["a", "b", "c"], { shuffle: true, random: () => 0 });
    const later = q.upcoming()[0];
    q.remove(later);
    q.setShuffle(false);
    expect(q.order).not.toContain(later);
  });
});

describe("TrackQueue : titres retirés", () => {
  it("un titre retiré n'est pas réintroduit par une prolongation, sauf ajout explicite", () => {
    const q = new TrackQueue(["a", "b", "c"]);
    q.remove("b");
    expect(q.excluded.has("b")).toBe(true);
    expect(q.append(["b", "d"])).toEqual(["d"]);
    expect(q.append(["b"], true)).toEqual(["b"]);
  });
});
