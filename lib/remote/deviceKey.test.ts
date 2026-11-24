import { describe, it, expect } from "vitest";
import { deviceIdentity, deviceSigner, deviceSigningInput, deviceVerify, fingerprint, identityOf, importDeviceKey, newDeviceKeys } from "./deviceKey";
import { makeMessage, type RemoteMessage } from "./protocol";

describe("identité de l'appareil (ECDSA P-256)", () => {
  it("id = empreinte de la clé publique, code de confirmation à 4 chiffres", async () => {
    const me = await identityOf(await newDeviceKeys());
    expect(me.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(me.code).toMatch(/^\d{4}$/);
    expect(await fingerprint(me.pub)).toEqual({ id: me.id, code: me.code });
    expect(me.privateKey.extractable).toBe(false);
  });

  it("le hello n'est accepté que si l'id est bien l'empreinte de la clé", async () => {
    const a = await identityOf(await newDeviceKeys());
    const b = await identityOf(await newDeviceKeys());
    expect(await importDeviceKey(a.id, a.pub)).toMatchObject({ code: a.code });
    expect(await importDeviceKey(b.id, a.pub)).toBeNull(); // id d'un autre : pas un jeton copiable
  });

  it("commande signée par l'appareil : vérifiée ; altérée ou d'un autre appareil : refusée", async () => {
    const a = await identityOf(await newDeviceKeys());
    const b = await identityOf(await newDeviceKeys());
    const keyA = (await importDeviceKey(a.id, a.pub))!.key;
    const signed = (await deviceSigner(a)(makeMessage({ type: "cmd", id: a.id, cmd: "pause", sig: "" }) as RemoteMessage)) as Extract<RemoteMessage, { type: "cmd" }>;
    expect(await deviceVerify(keyA, signed.sig, deviceSigningInput(signed))).toBe(true);
    expect(await deviceVerify(keyA, signed.sig, deviceSigningInput({ ...signed, cmd: "next" }))).toBe(false);
    expect(await deviceVerify(keyA, signed.sig, deviceSigningInput({ ...signed, n: "autreNonce12" }))).toBe(false);
    const byB = (await deviceSigner(b)({ ...signed, id: a.id })) as Extract<RemoteMessage, { type: "cmd" }>;
    expect(await deviceVerify(keyA, byB.sig, deviceSigningInput(byB))).toBe(false);
  });

  it("sans IndexedDB : une identité de passage, stable pour la page", async () => {
    const x = await deviceIdentity();
    expect((await deviceIdentity()).id).toBe(x.id);
  });
});
