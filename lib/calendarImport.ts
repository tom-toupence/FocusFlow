// Lecture serveur d'un flux iCal privé, protégée contre le SSRF.
// Utilisé par app/api/calendar/import uniquement (modules Node). Les règles
// (adresses, hôtes, redirections) sont des fonctions pures, testées ; le
// transport est injectable pour les tests.
//
// Garanties : https seulement, port 443, hôte avec un point et hors noms
// locaux, toutes les adresses DNS publiques, connexion épinglée sur l'adresse
// vérifiée (pas de re-résolution, donc pas de DNS rebinding), au plus 3
// redirections revérifiées, 8 s au total, 2 Mo au plus. Jamais de journal de
// l'adresse.

import { isIP } from "node:net";
import { normalizeIcalUrl } from "./icalUrl";

export const IMPORT_TIMEOUT_MS = 8_000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_REDIRECTS = 3;

export type ImportErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "dns"
  | "refused"
  | "upstream"
  | "timeout"
  | "too_big"
  | "too_many_redirects"
  | "not_ics"
  | "network";

const MESSAGES: Record<ImportErrorCode, string> = {
  invalid_url: "Adresse invalide. Elle commence par https:// ou webcal://.",
  blocked_host: "Cette adresse n'est pas autorisée.",
  dns: "Agenda introuvable. Vérifie l'adresse.",
  refused: "Adresse refusée par l'agenda.",
  upstream: "L'agenda a répondu par une erreur.",
  timeout: "L'agenda met trop de temps à répondre.",
  too_big: "Agenda trop volumineux (2 Mo au plus).",
  too_many_redirects: "Trop de redirections.",
  not_ics: "Ce n'est pas un agenda iCal.",
  network: "Agenda injoignable.",
};

const STATUS: Record<ImportErrorCode, number> = {
  invalid_url: 400,
  blocked_host: 400,
  dns: 502,
  refused: 502,
  upstream: 502,
  timeout: 504,
  too_big: 502,
  too_many_redirects: 502,
  not_ics: 502,
  network: 502,
};

export class ImportError extends Error {
  code: ImportErrorCode;
  status: number;
  constructor(code: ImportErrorCode, message?: string) {
    super(message ?? MESSAGES[code]);
    this.code = code;
    this.status = STATUS[code];
  }
}

// ── Adresses IP ─────────────────────────────────────────────────────────────

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], // « ce réseau »
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // lien local, métadonnées cloud
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // réservé + diffusion
];

function v4Blocked(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n == null) return true;
  return V4_BLOCKED.some(([base, bits]) => {
    const b = v4ToInt(base)!;
    const size = 2 ** (32 - bits);
    return n >= b && n < b + size;
  });
}

/** IPv6 -> 8 mots de 16 bits (null si invalide). Gère « :: » et la forme IPv4 finale. */
export function expandIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  if (s.slice(lastColon + 1).includes(".")) {
    const n = v4ToInt(s.slice(lastColon + 1));
    if (n == null) return null;
    tail = [Math.floor(n / 65536), n % 65536];
    s = s.slice(0, lastColon + 1) + "0:0";
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const parse = (h: string) => (h ? h.split(":") : []);
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const words = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  const out: number[] = [];
  for (const w of words) {
    if (!/^[0-9a-f]{1,4}$/.test(w)) return null;
    out.push(parseInt(w, 16));
  }
  if (tail.length) {
    out[6] = tail[0];
    out[7] = tail[1];
  }
  return out.length === 8 ? out : null;
}

function v6Blocked(ip: string): boolean {
  const w = expandIPv6(ip);
  if (!w) return true;
  const zeros = (from: number, to: number) => w.slice(from, to).every((x) => x === 0);
  if (zeros(0, 8)) return true; // ::
  if (zeros(0, 7) && w[7] === 1) return true; // ::1
  // IPv4 mappée (::ffff:a.b.c.d) ou compatible (::a.b.c.d) : on juge l'IPv4.
  // Idem pour la forme traduite SIIT (::ffff:0:a.b.c.d, RFC 2765).
  if ((zeros(0, 5) && (w[5] === 0xffff || w[5] === 0)) || (zeros(0, 4) && w[4] === 0xffff && w[5] === 0)) {
    return v4Blocked(`${w[6] >> 8}.${w[6] & 255}.${w[7] >> 8}.${w[7] & 255}`);
  }
  if (w[0] === 0x64 && w[1] === 0xff9b) return true; // NAT64
  if (w[0] === 0x100 && zeros(1, 4)) return true; // 100::/64 (rejet)
  if ((w[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (privé)
  if ((w[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (lien local)
  if ((w[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 (site local)
  if ((w[0] & 0xff00) === 0xff00) return true; // multicast
  if (w[0] === 0x2001 && w[1] === 0x0db8) return true; // documentation
  if (w[0] === 0x2002) return true; // 6to4 (IPv4 embarquée)
  if (w[0] === 0x2001 && w[1] === 0) return true; // Teredo
  return false;
}

/** Vrai si l'adresse IP est privée, locale, réservée ou invalide (refusée). */
export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Blocked(ip);
  if (kind === 6) return v6Blocked(ip);
  return true;
}

// ── Hôtes et adresses ───────────────────────────────────────────────────────

const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"];

/** Raison du refus d'un hôte (avant DNS), ou null s'il est acceptable. */
export function hostProblem(hostname: string): ImportErrorCode | null {
  let h = hostname.toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (h.endsWith(".")) h = h.slice(0, -1);
  if (!h) return "invalid_url";
  if (isIP(h)) return isBlockedAddress(h) ? "blocked_host" : null;
  if (!h.includes(".")) return "blocked_host";
  if (h === "localhost" || LOCAL_SUFFIXES.some((s) => h.endsWith(s))) return "blocked_host";
  if (!/^[a-z0-9.-]+$/.test(h)) return "invalid_url"; // les noms IDN arrivent en punycode via URL
  return null;
}

/** Adresse à utiliser : la première, à condition que TOUTES soient publiques. */
export function pickPublicAddress(addresses: { address: string; family: number }[]): { address: string; family: number } {
  if (addresses.length === 0) throw new ImportError("dns");
  if (addresses.some((a) => isBlockedAddress(a.address))) throw new ImportError("blocked_host");
  return addresses[0];
}

/** Cible d'une redirection, validée comme une adresse saisie (https, port, hôte). */
export function redirectTarget(base: string, location: string | undefined): string {
  if (!location) throw new ImportError("upstream");
  let next: string;
  try {
    next = new URL(location, base).toString();
  } catch {
    throw new ImportError("invalid_url");
  }
  const n = normalizeIcalUrl(next);
  if (!n.ok) throw new ImportError("blocked_host");
  return n.url;
}

// ── Garde-fous de la route ──────────────────────────────────────────────────

/** Fenêtre glissante simple en mémoire : `max` appels par `windowMs` et par clé. */
export function rateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k);
    }
    return true;
  };
}

/**
 * Même origine : Origin (ou à défaut Referer), quand l'en-tête est présent,
 * doit désigner notre hôte. Sans en-tête (outils, anciens navigateurs) : accepté.
 */
export function sameOrigin(origin: string | null, referer: string | null, selfOrigin: string, host: string | null): boolean {
  const claimed = origin && origin !== "null" ? origin : referer;
  if (origin === "null") return false;
  if (!claimed) return true;
  try {
    const u = new URL(claimed);
    if (u.origin === selfOrigin) return true;
    return host != null && u.host === host;
  } catch {
    return false;
  }
}

// ── Transport ───────────────────────────────────────────────────────────────

export interface RawResponse {
  status: number;
  location?: string;
  body?: string;
}

export interface FetchDeps {
  /** Résolution DNS de toutes les adresses d'un hôte. */
  resolve: (hostname: string) => Promise<{ address: string; family: number }[]>;
  /** Une requête GET sur `url`, connectée à `address` (déjà vérifiée), sans suivre les redirections. */
  requestOnce: (
    url: string,
    address: { address: string; family: number },
    opts: { signal: AbortSignal; maxBytes: number },
  ) => Promise<RawResponse>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

/** Lit le flux (texte) en suivant au plus N redirections, chaque saut revérifié. */
export async function fetchIcsText(rawUrl: string, deps: FetchDeps): Promise<string> {
  const first = normalizeIcalUrl(rawUrl);
  if (!first.ok) throw new ImportError("invalid_url", first.error);
  const timeoutMs = deps.timeoutMs ?? IMPORT_TIMEOUT_MS;
  const maxBytes = deps.maxBytes ?? IMPORT_MAX_BYTES;
  const maxRedirects = deps.maxRedirects ?? IMPORT_MAX_REDIRECTS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const timeout = new Promise<never>((_, reject) => {
    ctrl.signal.addEventListener("abort", () => reject(new ImportError("timeout")), { once: true });
  });
  const guard = <T>(p: Promise<T>) => Promise.race([p, timeout]);
  try {
    let url = first.url;
    for (let hop = 0; ; hop++) {
      const host = new URL(url).hostname;
      const problem = hostProblem(host);
      if (problem) throw new ImportError(problem);
      const bare = host.replace(/^\[|\]$/g, "");
      let addresses: { address: string; family: number }[];
      if (isIP(bare)) addresses = [{ address: bare, family: isIP(bare) }];
      else {
        try {
          addresses = await guard(deps.resolve(bare));
        } catch (e) {
          if (e instanceof ImportError) throw e;
          throw new ImportError("dns");
        }
      }
      const address = pickPublicAddress(addresses);
      let res: RawResponse;
      try {
        res = await guard(deps.requestOnce(url, address, { signal: ctrl.signal, maxBytes }));
      } catch (e) {
        if (e instanceof ImportError) throw e;
        if (ctrl.signal.aborted) throw new ImportError("timeout");
        throw new ImportError("network");
      }
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        if (hop >= maxRedirects) throw new ImportError("too_many_redirects");
        url = redirectTarget(url, res.location);
        continue;
      }
      if ([401, 403, 404, 410].includes(res.status)) throw new ImportError("refused");
      if (res.status < 200 || res.status >= 300) throw new ImportError("upstream", `L'agenda a répondu par une erreur (code ${res.status}).`);
      const body = res.body ?? "";
      if (!/BEGIN:VCALENDAR/i.test(body.slice(0, 4096))) throw new ImportError("not_ics");
      return body;
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Transport Node réel ─────────────────────────────────────────────────────

/** Dépendances réelles : DNS système, https épinglé sur l'adresse vérifiée. */
export async function nodeFetchDeps(): Promise<FetchDeps> {
  const dns = await import("node:dns/promises");
  const https = await import("node:https");
  return {
    resolve: (hostname) => dns.lookup(hostname, { all: true, verbatim: true }),
    requestOnce: (url, address, { signal, maxBytes }) =>
      new Promise<RawResponse>((resolve, reject) => {
        const u = new URL(url);
        const req = https.request(
          {
            protocol: "https:",
            hostname: u.hostname.replace(/^\[|\]$/g, ""),
            port: 443,
            path: `${u.pathname}${u.search}`,
            method: "GET",
            servername: isIP(u.hostname.replace(/^\[|\]$/g, "")) ? undefined : u.hostname,
            headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.1", "User-Agent": "FocusFlow-Calendar/1.0" },
            // Connexion forcée sur l'adresse déjà vérifiée : aucune seconde résolution.
            lookup: ((_h: string, opts: { all?: boolean }, cb: (...args: unknown[]) => void) => {
              if (opts?.all) cb(null, [{ address: address.address, family: address.family }]);
              else cb(null, address.address, address.family);
            }) as unknown as import("node:net").LookupFunction,
            signal,
          },
          (res) => {
            const status = res.statusCode ?? 0;
            if (status >= 300 && status < 400) {
              res.resume();
              resolve({ status, location: typeof res.headers.location === "string" ? res.headers.location : undefined });
              return;
            }
            const declared = Number(res.headers["content-length"] ?? 0);
            if (declared > maxBytes) {
              res.destroy();
              reject(new ImportError("too_big"));
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            res.on("data", (c: Buffer) => {
              size += c.length;
              if (size > maxBytes) {
                res.destroy();
                reject(new ImportError("too_big"));
                return;
              }
              chunks.push(c);
            });
            res.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
            res.on("error", reject);
          },
        );
        req.on("error", reject);
        req.end();
      }),
  };
}
