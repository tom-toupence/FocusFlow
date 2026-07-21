import { NextRequest, NextResponse } from "next/server";
import {
  LIST_ID_RE,
  YT_FETCH_HEADERS,
  extractYtInitialData,
  collectRenderers,
  makeTtlCache,
  ytText,
} from "@/lib/ytParse";

// Résout une vraie playlist YouTube (PL/OL/UU/FL/…) en liste ordonnée de vidéos
// { id, title } en parsant la page /playlist (`playlistVideoRenderer` dans
// ytInitialData). Permet de jouer la playlist via la file maison (shuffle,
// reorder, titre exact en Now Playing, enchaînement de recos en fin de liste).
// Limite YouTube : ~100 premières vidéos sans continuation. Aucune clé API.
//
// ⚠️ Robuste aux échecs : retourne { videos: [] } → repli lecteur natif côté client.

const cache = makeTtlCache<{ id: string; title: string }[]>(15 * 60 * 1000);

export async function GET(request: NextRequest) {
  const list = request.nextUrl.searchParams.get("list") ?? "";
  if (!LIST_ID_RE.test(list)) {
    return NextResponse.json({ error: "invalid_list", videos: [] }, { status: 400 });
  }

  const cached = cache.get(list);
  if (cached) {
    return NextResponse.json({ videos: cached, cached: true });
  }

  try {
    const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}&hl=en&gl=US`;
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
    collectRenderers(data, "playlistVideoRenderer", renderers, new Set<string>());
    const videos = renderers.map((r) => ({
      id: r.videoId as string,
      title: ytText(r.title) || "Vidéo YouTube",
    }));
    cache.set(list, videos);
    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ error: "exception", videos: [] }, { status: 200 });
  }
}
