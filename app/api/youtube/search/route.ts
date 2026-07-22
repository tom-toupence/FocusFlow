import { NextRequest, NextResponse } from "next/server";
import {
  YT_FETCH_HEADERS,
  extractYtInitialData,
  collectRenderers,
  makeTtlCache,
  ytText,
} from "@/lib/ytParse";

// Recherche YouTube sans clé API : parse la page de résultats (`videoRenderer`
// dans ytInitialData). Sert les recommandations « Découvrir » (requêtes dérivées
// des thèmes écoutés). On filtre les formats courts (< 10 min) : la musique de
// focus est du format long.
//
// ⚠️ Robuste aux échecs : retourne { videos: [] } → état vide côté client.

export interface SearchVideo {
  id: string;
  title: string;
  channel: string;
  lengthSeconds: number | null;
}

const cache = makeTtlCache<SearchVideo[]>(15 * 60 * 1000);
// Durée minimale PAR DÉFAUT (recos = formats longs) ; la recherche directe
// passe min=0 pour trouver aussi des morceaux de 3-4 min.
const DEFAULT_MIN_LENGTH_SECONDS = 10 * 60;

// "1:23:45" / "12:34" → secondes ; null si non parsable (ex. live).
function parseLength(text: string): number | null {
  if (!/^[\d:]+$/.test(text)) return null;
  const parts = text.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) {
    return NextResponse.json({ error: "invalid_query", videos: [] }, { status: 400 });
  }
  const minParam = Number(request.nextUrl.searchParams.get("min"));
  const minLength = Number.isFinite(minParam)
    ? Math.max(0, Math.min(3600, Math.round(minParam)))
    : DEFAULT_MIN_LENGTH_SECONDS;

  const cacheKey = `${q.toLowerCase()}|${minLength}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json({ videos: cached, cached: true });
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en&gl=US`;
    const res = await fetch(url, { headers: YT_FETCH_HEADERS, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "fetch_failed", videos: [] }, { status: 200 });
    }
    const html = await res.text();
    const data = extractYtInitialData(html);
    if (!data) {
      return NextResponse.json({ error: "parse_failed", videos: [] }, { status: 200 });
    }
    const renderers: Record<string, unknown>[] = [];
    collectRenderers(data, "videoRenderer", renderers, new Set<string>());
    const videos: SearchVideo[] = [];
    for (const r of renderers) {
      const title = ytText(r.title);
      if (!title) continue;
      const lengthSeconds = parseLength(ytText((r.lengthText as unknown) ?? {}));
      // Filtre de durée (les lives — sans durée — sont acceptés).
      if (lengthSeconds !== null && lengthSeconds < minLength) continue;
      videos.push({
        id: r.videoId as string,
        title,
        channel: ytText((r.ownerText as unknown) ?? {}) || ytText((r.longBylineText as unknown) ?? {}),
        lengthSeconds,
      });
      if (videos.length >= 12) break;
    }
    cache.set(cacheKey, videos);
    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ error: "exception", videos: [] }, { status: 200 });
  }
}
