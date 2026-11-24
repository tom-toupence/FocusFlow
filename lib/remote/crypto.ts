// Sécurité du canal télécommande (lot 7) : WebCrypto seulement.
//   . un secret de 128 bits, tiré à l'ouverture, voyage dans le FRAGMENT de l'URL
//     du QR (`/remote#c=<code>&k=<secret>`) : jamais envoyé à un serveur, jamais
//     dans un journal d'accès (et retiré de la barre d'adresse à l'ouverture) ;
//   . le nom du canal est dérivé du code ET du secret (SHA-256 tronqué) ;
//   . chaque message est SCELLÉ en AES-GCM 256 (clé dérivée du secret par HKDF,
//     IV aléatoire de 96 bits) : chiffré ET authentifié. Le relais (Supabase
//     Realtime) ne voit que du bruit ; un message altéré, d'une autre clé ou non
//     scellé est ignoré.
//   . chaque téléphone a sa paire ECDSA P-256 (deviceKey.ts) : ses commandes et
//     son accusé sont signés par lui, l'ordinateur sait QUI il a autorisé.

import { cryptoBytes, normalizeCode, type RandomBytes } from "./protocol";

export const SECRET_RE = /^[A-Za-z0-9_-]{22}$/;
const IV_RE = /^[A-Za-z0-9_-]{16}$/;
const B64_RE = /^[A-Za-z0-9_-]+$/;
/** Taille max d'un message scellé (base64url). Le handoff est réduit à l'envoi pour y tenir. */
export const MAX_SEALED = 160 * 1024;

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
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

const AAD = enc.encode("ff-remote v1");

/** Clé AES-GCM 256 dérivée du secret (HKDF-SHA-256, sel = code). Non extractible. */
export async function sealKey(code: string, secret: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", fromB64url(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(`ff-remote|${code}`), info: enc.encode("ff-remote aes-gcm v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface Sealed { iv: string; c: string }

/** Scelle un message ; null s'il dépasse la taille admise (l'appelant doit réduire). */
export async function seal(key: CryptoKey, msg: unknown): Promise<Sealed | null> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AAD }, key, enc.encode(JSON.stringify(msg))));
  const c = b64url(ct);
  return c.length > MAX_SEALED ? null : { iv: b64url(iv), c };
}

/** Message déchiffré et authentifié (objet JSON) ou null : forme, taille, tag GCM. */
export async function unseal(key: CryptoKey, raw: unknown): Promise<unknown | null> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const { iv, c } = raw as Record<string, unknown>;
  if (Object.keys(raw).length !== 2 || typeof iv !== "string" || typeof c !== "string") return null;
  if (!IV_RE.test(iv) || c.length > MAX_SEALED || !B64_RE.test(c)) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv), additionalData: AAD }, key, fromB64url(c));
    return JSON.parse(new TextDecoder().decode(pt));
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
