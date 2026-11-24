// Identité d'un téléphone (lot 7) : une paire ECDSA P-256 par appareil.
//   . clé privée NON extractible, gardée dans IndexedDB (régénérée si le
//     stockage est indisponible : l'appareil devra alors être réautorisé) ;
//   . l'id de l'appareil est l'empreinte de sa clé publique (SHA-256 de la SPKI),
//     pas un jeton : le copier ne permet pas de signer à sa place ;
//   . le code de confirmation (4 chiffres) est dérivé de la même empreinte, et
//     affiché sur le téléphone ET sur l'ordinateur avant « Autoriser ».
// Commandes et accusé sont signés par l'appareil (`deviceSigningInput`).
import { b64url, fromB64url } from "./crypto";
import type { RemoteMessage } from "./protocol";

export const PUB_RE = /^[A-Za-z0-9_-]{100,140}$/;
export const DEVICE_SIG_RE = /^[A-Za-z0-9_-]{86}$/;
const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN = { name: "ECDSA", hash: "SHA-256" } as const;

export interface DeviceIdentity {
  id: string;
  /** Clé publique SPKI en base64url (envoyée dans le hello). */
  pub: string;
  code: string;
  privateKey: CryptoKey;
}

/** Empreinte d'une clé publique : id de l'appareil et code de confirmation. */
export async function fingerprint(pub: string): Promise<{ id: string; code: string }> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", fromB64url(pub)));
  const n = ((h[16] << 24) | (h[17] << 16) | (h[18] << 8) | h[19]) >>> 0;
  return { id: b64url(h.slice(0, 16)), code: String(n % 10_000).padStart(4, "0") };
}

/** Clé publique d'un hello, importée pour vérifier ; null si elle ne correspond pas à l'id annoncé. */
export async function importDeviceKey(id: string, pub: string): Promise<{ key: CryptoKey; code: string } | null> {
  if (!PUB_RE.test(pub)) return null;
  try {
    const fp = await fingerprint(pub);
    if (fp.id !== id) return null;
    const key = await crypto.subtle.importKey("spki", fromB64url(pub), ECDSA, false, ["verify"]);
    return { key, code: fp.code };
  } catch {
    return null;
  }
}

/** Ce que l'appareil signe : type, appareil, nonce, horodatage et contenu. */
export function deviceSigningInput(m: { type: string; id: string; n: string; t: number; cmd?: string; ack?: string }): Uint8Array<ArrayBuffer> {
  const text = JSON.stringify(["ff-remote-device-v1", m.type, m.id, m.n, m.t, m.cmd ?? m.ack ?? ""]);
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

export async function deviceSign(key: CryptoKey, input: Uint8Array<ArrayBuffer>): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.sign(SIGN, key, input)));
}

export async function deviceVerify(key: CryptoKey, sig: string, input: Uint8Array<ArrayBuffer>): Promise<boolean> {
  if (!DEVICE_SIG_RE.test(sig)) return false;
  try { return await crypto.subtle.verify(SIGN, key, fromB64url(sig), input); } catch { return false; }
}

export async function newDeviceKeys(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDSA, false, ["sign", "verify"]);
}

export async function identityOf(pair: CryptoKeyPair): Promise<DeviceIdentity> {
  const pub = b64url(new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey)));
  const { id, code } = await fingerprint(pub);
  return { id, pub, code, privateKey: pair.privateKey };
}

// ─── Stockage (IndexedDB : une CryptoKey non extractible s'y range telle quelle) ──

const DB = "focusflow-remote";
const STORE = "keys";
const KEY = "device";

function idb<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}

let cached: Promise<DeviceIdentity> | null = null;

/** Identité de cet appareil : relue d'IndexedDB, sinon créée (et rangée si possible). */
export function deviceIdentity(): Promise<DeviceIdentity> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const saved = await idb<CryptoKeyPair | undefined>("readonly", (s) => s.get(KEY));
      if (saved?.privateKey && saved.publicKey) return identityOf(saved);
    } catch { /* IndexedDB indisponible : clé de passage */ }
    const pair = await newDeviceKeys();
    try { await idb("readwrite", (s) => s.put(pair, KEY)); } catch { /* non rangée : régénérée au prochain chargement */ }
    return identityOf(pair);
  })();
  return cached;
}

/** Complète un message de l'appareil (cmd, ack) avec sa signature. */
export function deviceSigner(identity: DeviceIdentity) {
  return async (m: RemoteMessage): Promise<RemoteMessage> =>
    m.type === "cmd" || m.type === "ack" ? { ...m, sig: await deviceSign(identity.privateKey, deviceSigningInput(m)) } : m;
}
