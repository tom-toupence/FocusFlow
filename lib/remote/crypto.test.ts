import { describe, it, expect } from "vitest";
import { buildLink, channelName, MAX_SEALED, newSecret, parseLink, seal, sealKey, unseal } from "./crypto";
import { makeMessage } from "./protocol";

const SECRET = "AbCdEfGhIjKlMnOpQrStUv";

describe("secret et lien", () => {
  it("secret de 128 bits en base64url (22 caractères)", () => {
    const s = newSecret();
    expect(s).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newSecret()).not.toBe(s);
  });

  it("code et secret dans le fragment, jamais dans le chemin", () => {
    const url = buildLink("https://ff.app", "/remote", "ABC234", SECRET);
    expect(url).toBe(`https://ff.app/remote#c=ABC234&k=${SECRET}`);
    expect(new URL(url).pathname).toBe("/remote");
    expect(parseLink(new URL(url).hash)).toEqual({ code: "ABC234", secret: SECRET });
    expect(parseLink("#c=ABC234")).toBeNull();
    expect(parseLink("#c=ABC234&k=court")).toBeNull();
    expect(parseLink("#c=ABC2&k=" + SECRET)).toBeNull();
  });

  it("nom de canal dérivé du code ET du secret, sans les révéler", async () => {
    const a = await channelName("ABC234", SECRET);
    expect(a).toMatch(/^ff-remote-[0-9a-f]{32}$/);
    expect(a).not.toContain("ABC234");
    expect(await channelName("ABC234", SECRET)).toBe(a);
    expect(await channelName("ABC234", "AbCdEfGhIjKlMnOpQrStUw")).not.toBe(a);
  });
});

describe("scellement AES-GCM", () => {
  it("chiffré et authentifié : altéré, non scellé ou d'une autre clé = ignoré", async () => {
    const key = await sealKey("ABC234", SECRET);
    const msg = makeMessage({ type: "bye", reason: "ended" }, 1_000_000);
    const sealed = (await seal(key, msg))!;
    expect(sealed.iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(sealed.c).not.toContain("ended"); // le relais ne lit rien
    expect(await unseal(key, sealed)).toEqual(msg);
    // IV aléatoire : deux scellements du même message diffèrent.
    expect((await seal(key, msg))!.c).not.toBe(sealed.c);
    const flipped = sealed.c.slice(0, 5) + (sealed.c[5] === "A" ? "B" : "A") + sealed.c.slice(6);
    expect(await unseal(key, { ...sealed, c: flipped })).toBeNull();
    expect(await unseal(key, msg)).toBeNull(); // en clair
    expect(await unseal(key, { iv: sealed.iv })).toBeNull();
    expect(await unseal(key, { ...sealed, extra: 1 })).toBeNull();
    expect(await unseal(await sealKey("ABC234", "AbCdEfGhIjKlMnOpQrStUw"), sealed)).toBeNull();
    expect(await unseal(await sealKey("ABC235", SECRET), sealed)).toBeNull(); // autre code (sel HKDF)
  });

  it("taille : au-delà de 160 Ko, rien n'est scellé (l'appelant réduit)", async () => {
    const key = await sealKey("ABC234", SECRET);
    expect(await seal(key, { big: "x".repeat(130 * 1024) })).toBeNull();
    expect(await seal(key, { big: "x".repeat(100 * 1024) })).not.toBeNull();
    expect(await unseal(key, { iv: "AAAAAAAAAAAAAAAA", c: "A".repeat(MAX_SEALED + 1) })).toBeNull();
  });
});
