// Sécurité du canal télécommande (lot 7, après relecture) : WebCrypto seulement.
//   . un secret de 128 bits, tiré à l'ouverture, voyage dans le FRAGMENT de l'URL
//     du QR (`/remote#c=<code>&k=<secret>`) : jamais envoyé à un serveur, jamais
//     dans un journal d'accès ;
//   . le nom du canal est dérivé du code ET du secret (SHA-256 tronqué) ;
//   . chaque message est signé en HMAC-SHA256 avec une clé dérivée du secret.
//     Un message non signé, mal signé ou malformé est ignoré.
// Le message signé voyage en texte (`d`) : la signature porte sur ces octets
// exacts, quel que soit l'ordre des clés que le transport rendrait.

import { cryptoBytes, normalizeCode, type RandomBytes } from "./protocol";

export const SECRET_RE = /^[A-Za-z0-9_-]{22}$/;
const SIG_RE = /^[A-Za-z0-9_-]{43}$/;
/** Taille max d'un message signé (le handoff, le plus gros, reste sous 64 Ko). */
export const MAX_SEALED = 64 * 1024;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Secret de 128 bits, en base64url (22 caractères). */
export function newSecret(rand: RandomBytes = cryptoBytes): string {
  return b64url(rand(16));
}

/** WebCrypto disponible (contexte sécurisé : https ou localhost). */
export const cryptoReady = () => typeof crypto !== "undefined" && !!crypto.subtle;

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

/** Nom du canal : ne révèle ni le code ni le secret. */
export async function channelName(code: string, secret: string): Promise<string> {
  const h = await sha256(`ff-remote|channel|${code}|${secret}`);
  return "ff-remote-" + Array.from(h.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacKey(code: string, secret: string): Promise<CryptoKey> {
  const raw = await sha256(`ff-remote|hmac|${code}|${secret}`);
  return crypto.subtle.importKey("raw", raw as Uint8Array<ArrayBuffer>, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export interface Sealed { d: string; s: string }

export async function seal(key: CryptoKey, msg: unknown): Promise<Sealed> {
  const d = JSON.stringify(msg);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(d)));
  return { d, s: b64url(sig) };
}

/** Message vérifié (objet JSON) ou null : forme, taille, signature (comparaison en temps constant). */
export async function unseal(key: CryptoKey, raw: unknown): Promise<unknown | null> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const { d, s } = raw as Record<string, unknown>;
  if (Object.keys(raw).length !== 2 || typeof d !== "string" || typeof s !== "string") return null;
  if (d.length > MAX_SEALED || !SIG_RE.test(s)) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", key, fromB64url(s), enc.encode(d));
    return ok ? JSON.parse(d) : null;
  } catch {
    return null;
  }
}

/** Lien du QR : le code et le secret dans le fragment. */
export function buildLink(origin: string, path: "/remote" | "/handoff", code: string, secret: string): string {
  return `${origin}${path}#c=${code}&k=${secret}`;
}

/** Lit `#c=<code>&k=<secret>` ; null si absent ou invalide. */
export function parseLink(hash: string): { code: string; secret: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const code = normalizeCode(params.get("c"));
  const secret = params.get("k");
  if (!code || !secret || !SECRET_RE.test(secret)) return null;
  return { code, secret };
}
