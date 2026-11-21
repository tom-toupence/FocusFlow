import { describe, expect, it } from "vitest";
import { continuePlaylist, interleave, pickSeeds } from "./continuation";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

describe("pickSeeds", () => {
  it("couvre toute la playlist et commence par la dernière piste jouée", () => {
    const s = pickSeeds(ids(10), "t7", 3);
    expect(s[0]).toBe("t7");
    expect(s).toHaveLength(3);
    expect(s).toContain("t0"); // début
    expect(s.some((x) => x === "t9" || x === "t5")).toBe(true); // reste de la liste
  });

  it("répartit sur les quantiles quand rien n'a encore été joué", () => {
    expect(pickSeeds(ids(9), null, 3)).toEqual(["t0", "t4", "t8"]);
  });

  it("petite playlist : autant de graines que de pistes, sans doublon", () => {
    expect(pickSeeds(["a"], "a", 3)).toEqual(["a"]);
    expect(new Set(pickSeeds(["a", "b"], null, 3)).size).toBe(2);
  });

  it("playlist vide : la dernière piste seule, ou rien", () => {
    expect(pickSeeds([], "x")).toEqual(["x"]);
    expect(pickSeeds([], null)).toEqual([]);
  });
});

describe("interleave", () => {
  it("alterne les listes, retire doublons et exclus, respecte la limite", () => {
    const a = [{ id: "1" }, { id: "2" }, { id: "x" }];
    const b = [{ id: "2" }, { id: "3" }];
    expect(interleave([a, b], new Set(["x"]), 10).map((t) => t.id)).toEqual(["1", "2", "3"]);
    expect(interleave([a, b], new Set(), 2).map((t) => t.id)).toEqual(["1", "2"]);
  });
});

describe("continuePlaylist", () => {
  const rec = (map: Record<string, string[]>) => async (seed: string) => (map[seed] ?? []).map((id) => ({ id, title: id }));

  it("prolonge avec des titres de plusieurs graines, jamais déjà dans la playlist", async () => {
    const r = await continuePlaylist(["a", "b", "c"], "c", rec({ c: ["c", "x1", "x2"], a: ["a", "y1", "b"], b: ["z1"] }));
    expect(r.kind).toBe("extend");
    if (r.kind === "extend") {
      expect(r.tracks.map((t) => t.id)).toEqual(expect.arrayContaining(["x1", "y1", "z1"]));
      expect(r.tracks.map((t) => t.id)).not.toContain("a");
    }
  });

  it("une graine qui échoue n'empêche pas les autres", async () => {
    const r = await continuePlaylist(["a", "b"], "b", async (s) => { if (s === "b") throw new Error("réseau"); return [{ id: "n1", title: "n1" }]; });
    expect(r).toEqual({ kind: "extend", tracks: [{ id: "n1", title: "n1" }] });
  });

  it("rien de neuf : demande de reboucler plutôt que de s'arrêter", async () => {
    expect(await continuePlaylist(["a"], "a", rec({ a: ["a"] }))).toEqual({ kind: "loop" });
    expect(await continuePlaylist([], null, rec({}))).toEqual({ kind: "loop" });
  });
});
