import { NextRequest, NextResponse } from "next/server";
import { VIDEO_ID_RE, YT_FETCH_HEADERS, makeTtlCache } from "@/lib/ytParse";
import { scheduleFromWatchHtml, type WatchSchedule } from "@/lib/ytSchedule";

// « Calé sur la vidéo » : chapitres (structurés, sinon ceux de la description)
// et durée d'une vidéo, lus dans sa page watch. Aucune clé API. Le client en
// déduit le rythme travail/pause (lib/videoSchedule.ts).
// Dépend du markup de YouTube : tout échec rend { chapters: [] } (minuteur normal).

const cache = makeTtlCache<WatchSchedule>(6 * 60 * 60 * 1000);
// Les chapitres d'une vidéo publiée bougent rarement : 6 h en CDN, puis revalidation.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };

export async function GET(request: NextRequest) {
  const v = request.nextUrl.searchParams.get("v") ?? "";
  if (!VIDEO_ID_RE.test(v)) {
    return NextResponse.json({ error: "invalid_video", chapters: [], durationSec: 0 }, { status: 400 });
  }
  const hit = cache.get(v);
  if (hit) return NextResponse.json({ ...hit, cached: true }, { headers: CACHE_HEADERS });

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${v}&hl=en&gl=US`, { headers: YT_FETCH_HEADERS, cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "fetch_failed", chapters: [], durationSec: 0 });
    const result = scheduleFromWatchHtml(await res.text());
    // Une page sans durée est une page mal servie (consentement, blocage) : pas de cache.
    if (result.durationSec > 0) cache.set(v, result);
    return NextResponse.json(result, result.durationSec > 0 ? { headers: CACHE_HEADERS } : undefined);
  } catch {
    return NextResponse.json({ error: "exception", chapters: [], durationSec: 0 });
  }
}
