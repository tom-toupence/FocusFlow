import { NextRequest, NextResponse } from "next/server";
import {
  VIDEO_ID_RE,
  LIST_ID_RE,
  YT_FETCH_HEADERS,
  extractYtInitialData,
  collectRenderers,
  makeTtlCache,
  ytText,
} from "@/lib/ytParse";

// Résout un « mix radio » YouTube (list=RD…) en une liste ordonnée de videoIds
// (+ titres quand disponibles). Les radios sont des playlists infinies
// personnalisées : l'API IFrame ne sait pas les rejouer en embed. On récupère ici
// la version publique du mix en parsant la page watch de YouTube (`ytInitialData`).
// Aucune clé API requise.
//
// ⚠️ Dépend du markup de YouTube : robuste aux échecs (retourne [] → repli côté client).

const cache = makeTtlCache<{ ids: string[]; titles: Record<string, string> }>(15 * 60 * 1000);

export async function GET(request: NextRequest) {
  const list = request.nextUrl.searchParams.get("list") ?? "";
  const seed = request.nextUrl.searchParams.get("seed") ?? "";

  if (!LIST_ID_RE.test(list)) {
    return NextResponse.json({ error: "invalid_list", videoIds: [] }, { status: 400 });
  }
  const seedOk = VIDEO_ID_RE.test(seed);

  const cached = cache.get(list);
  if (cached) {
    return NextResponse.json({ videoIds: cached.ids, titles: cached.titles, cached: true });
  }

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${seedOk ? seed : ""}&list=${encodeURIComponent(list)}&hl=en&gl=US`;
    const res = await fetch(watchUrl, {
      headers: YT_FETCH_HEADERS,
      // Pas de cookies → version publique du mix.
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "fetch_failed", videoIds: [] }, { status: 200 });
    }
    const html = await res.text();
    const data = extractYtInitialData(html);
    if (!data) {
      return NextResponse.json({ error: "parse_failed", videoIds: [] }, { status: 200 });
    }
    const renderers: Record<string, unknown>[] = [];
    collectRenderers(data, "playlistPanelVideoRenderer", renderers, new Set<string>());
    const ids = renderers.map((r) => r.videoId as string);
    const titles: Record<string, string> = {};
    for (const r of renderers) {
      const t = ytText(r.title);
      if (t) titles[r.videoId as string] = t;
    }
    // Garde la seed en tête si présente et connue.
    if (seedOk && ids[0] !== seed) {
      const idx = ids.indexOf(seed);
      if (idx > 0) ids.splice(idx, 1);
      ids.unshift(seed);
    }
    cache.set(list, { ids, titles });
    return NextResponse.json({ videoIds: ids, titles });
  } catch {
    return NextResponse.json({ error: "exception", videoIds: [] }, { status: 200 });
  }
}
