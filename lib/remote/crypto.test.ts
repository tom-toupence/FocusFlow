import { describe, it, expect } from "vitest";
import { buildLink, channelName, hmacKey, newSecret, parseLink, seal, unseal } from "./crypto";
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

describe("signature HMAC", () => {
  it("un message signé passe, altéré ou non signé ou d'une autre clé est ignoré", async () => {
    const key = await hmacKey("ABC234", SECRET);
    const msg = makeMessage({ type: "cmd", id: "device1234", cmd: "pause" }, 1_000_000);
    const sealed = await seal(key, msg);
    expect(await unseal(key, sealed)).toEqual(msg);
    expect(await unseal(key, { ...sealed, d: sealed.d.replace("pause", "next") })).toBeNull();
    expect(await unseal(key, msg)).toBeNull(); // non signé
    expect(await unseal(key, { d: sealed.d })).toBeNull();
    expect(await unseal(key, { ...sealed, extra: 1 })).toBeNull();
    const other = await hmacKey("ABC234", "AbCdEfGhIjKlMnOpQrStUw");
    expect(await unseal(other, sealed)).toBeNull();
    expect(await unseal(key, { d: "x".repeat(70_000), s: sealed.s })).toBeNull();
  });
});
