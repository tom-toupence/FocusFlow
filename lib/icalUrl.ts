// Adresse iCal privée de l'agenda : validation partagée (profil et route serveur).
// Logique pure. L'adresse donne accès à tout l'agenda : elle reste sur
// l'appareil (prefsStore) et ne transite que par POST vers notre route.

export const ICAL_URL_MAX = 2048;

export type IcalUrlResult = { ok: true; url: string } | { ok: false; error: string };

export const ICAL_URL_ERROR = "Adresse invalide. Elle commence par https:// ou webcal://.";

/**
 * Normalise une adresse saisie : espaces retirés, webcal:// -> https://.
 * Refuse tout ce qui n'est pas https, les identifiants dans l'adresse, les
 * ports autres que 443 et les adresses trop longues.
 */
export function normalizeIcalUrl(raw: string): IcalUrlResult {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: ICAL_URL_ERROR };
  if (value.length > ICAL_URL_MAX) return { ok: false, error: "Adresse trop longue." };
  const converted = /^webcals?:\/\//i.test(value) ? value.replace(/^webcals?:\/\//i, "https://") : value;
  let u: URL;
  try {
    u = new URL(converted);
  } catch {
    return { ok: false, error: ICAL_URL_ERROR };
  }
  if (u.protocol !== "https:") return { ok: false, error: ICAL_URL_ERROR };
  if (u.username || u.password) return { ok: false, error: "Adresse invalide : pas d'identifiants dans l'adresse." };
  if (u.port && u.port !== "443") return { ok: false, error: "Adresse invalide : port non autorisé." };
  if (!u.hostname) return { ok: false, error: ICAL_URL_ERROR };
  u.hash = "";
  return { ok: true, url: u.toString() };
}
