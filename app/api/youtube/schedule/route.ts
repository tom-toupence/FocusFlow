import { NextRequest, NextResponse } from "next/server";
import { VIDEO_ID_RE, YT_FETCH_HEADERS, makeTtlCache, readTextLimited } from "@/lib/ytParse";
import { scheduleFromWatchHtml, type WatchSchedule } from "@/lib/ytSchedule";

// « Calé sur la vidéo » : chapitres (structurés, sinon ceux de la description)
// et durée d'une vidéo, lus dans sa page watch. Aucune clé API. Le client en
// déduit le rythme travail/pause (lib/videoSchedule.ts).
// Dépend du markup de YouTube : tout échec rend { chapters: [] } (minuteur normal).

const cache = makeTtlCache<WatchSchedule>(6 * 60 * 60 * 1000, 500);
// Cache négatif : un échec (page mal servie, réseau) n'est pas redemandé avant 2 min.
const failures = makeTtlCache<string>(2 * 60 * 1000, 500);
// Les chapitres d'une vidéo publiée bougent rarement : 6 h en CDN, puis revalidation.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
const NO_STORE = { "Cache-Control": "no-store" };
const FETCH_TIMEOUT_MS = 8000;
// Une page watch fait 1 à 2 Mo ; au-delà, on abandonne.
const MAX_PAGE_BYTES = 4 * 1024 * 1024;

const fail = (error: string, status = 200) =>
  NextResponse.json({ error, chapters: [], durationSec: 0 }, { status, headers: NO_STORE });

export async function GET(request: NextRequest) {
  const v = request.nextUrl.searchParams.get("v") ?? "";
  if (!VIDEO_ID_RE.test(v)) return fail("invalid_video", 400);
  const hit = cache.get(v);
  if (hit) return NextResponse.json({ ...hit, cached: true }, { headers: CACHE_HEADERS });
  const failed = failures.get(v);
  if (failed) return fail(failed);

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${v}&hl=en&gl=US`, {
      headers: YT_FETCH_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) { failures.set(v, "fetch_failed"); return fail("fetch_failed"); }
    const html = await readTextLimited(res, MAX_PAGE_BYTES);
    if (html == null) { failures.set(v, "too_large"); return fail("too_large"); }
    const result = scheduleFromWatchHtml(html);
    // Une page sans durée est une page mal servie (consentement, blocage) : échec.
    if (result.durationSec <= 0) { failures.set(v, "parse_failed"); return fail("parse_failed"); }
    cache.set(v, result);
    return NextResponse.json(result, { headers: CACHE_HEADERS });
  } catch {
    failures.set(v, "exception");
    return fail("exception");
  }
}
