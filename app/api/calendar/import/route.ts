import { NextRequest, NextResponse } from "next/server";
import { fetchIcsText, ImportError, nodeFetchDeps, rateLimiter, sameOrigin } from "@/lib/calendarImport";
import { parseIcsBusy } from "@/lib/icsRead";

// Lecture de l'agenda privé de l'utilisateur (adresse iCal) pour le minuteur.
// POST seulement : l'adresse est un secret, elle ne doit pas finir dans les
// journaux d'accès (une URL de GET y finirait). Rien n'est stocké ni journalisé ;
// la réponse ne contient que les événements occupés des 36 prochaines heures.

export const runtime = "nodejs";

const HORIZON_MS = 36 * 3600_000;
const MAX_BODY = 4096;

// Limite simple, en mémoire, par IP : 20 lectures par minute (par instance).
const limit = rateLimiter(20, 60_000);

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

function validTimeZone(tz: unknown): string | undefined {
  if (typeof tz !== "string" || tz.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  // Appel depuis une autre origine (en-tête présent et différent) : refusé.
  if (!sameOrigin(request.headers.get("origin"), request.headers.get("referer"), request.nextUrl.origin, request.headers.get("host"))) {
    return fail(403, "Requête refusée.");
  }
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "inconnue";
  if (!limit(ip)) return fail(429, "Trop de lectures de l'agenda. Réessaie dans une minute.");
  let body: { url?: unknown; timeZone?: unknown };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return fail(413, "Requête trop longue.");
    body = JSON.parse(text);
  } catch {
    return fail(400, "Requête invalide.");
  }
  if (typeof body?.url !== "string") return fail(400, "Adresse manquante.");

  try {
    const text = await fetchIcsText(body.url, await nodeFetchDeps());
    const now = Date.now();
    const events = parseIcsBusy(text, now, now + HORIZON_MS, { timeZone: validTimeZone(body.timeZone) });
    return NextResponse.json({ events }, { headers: NO_STORE });
  } catch (e) {
    // Jamais l'adresse dans les journaux : seulement le code d'erreur.
    if (e instanceof ImportError) return fail(e.status, e.message);
    console.warn("calendar import: parse failure");
    return fail(502, "Agenda illisible.");
  }
}

export function GET() {
  return fail(405, "Méthode non autorisée.");
}
