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

// Résout une vraie playlist YouTube (PL/OL/UU/FL/…) en liste ordonnée de vidéos
// { id, title }. La page /playlist ne sert PLUS les vidéos côté serveur
// (ytInitialData vide depuis 2026) → stratégie en 2 temps, vérifiée empiriquement :
//   1. Flux RSS `feeds/videos.xml?playlist_id=…` (XML stable, sans consentement)
//      → jusqu'à 15 titres + une vidéo « seed » fiable.
//   2. Page watch `watch?v=<seed>&list=…` → panneau `playlistPanelVideoRenderer`
//      (jusqu'à ~200 titres). Le client peut fournir sa propre seed
//      (`startVideoId`) pour économiser l'appel RSS.
// Repli : si le panneau échoue, on sert au moins les entrées RSS. Aucune clé API.
//
// ⚠️ Robuste aux échecs : retourne { videos: [] } → repli lecteur natif côté client.

interface PlaylistVideo { id: string; title: string; }

const cache = makeTtlCache<PlaylistVideo[]>(15 * 60 * 1000);

// Décode les entités XML courantes des titres RSS.
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

async function fetchRssVideos(list: string): Promise<PlaylistVideo[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(list)}`,
      { headers: YT_FETCH_HEADERS, cache: "no-store" }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>[\s\S]*?<\/entry>/g)];
    const videos: PlaylistVideo[] = [];
    for (const [entry] of entries) {
      const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
      const title = entry.match(/<media:title>([^<]*)<\/media:title>/)?.[1];
      if (id && VIDEO_ID_RE.test(id)) {
        videos.push({ id, title: title ? decodeXml(title) : "Vidéo YouTube" });
      }
    }
    return videos;
  } catch {
    return [];
  }
}

async function fetchWatchPanelVideos(list: string, seed: string): Promise<PlaylistVideo[]> {
  try {
    const url = `https://www.youtube.com/watch?v=${seed}&list=${encodeURIComponent(list)}&hl=en&gl=US`;
    const res = await fetch(url, { headers: YT_FETCH_HEADERS, cache: "no-store" });
    if (!res.ok) return [];
    const data = extractYtInitialData(await res.text());
    if (!data) return [];
    const renderers: Record<string, unknown>[] = [];
    collectRenderers(data, "playlistPanelVideoRenderer", renderers, new Set<string>());
    return renderers.map((r) => ({
      id: r.videoId as string,
      title: ytText(r.title) || "Vidéo YouTube",
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const list = request.nextUrl.searchParams.get("list") ?? "";
  const seedParam = request.nextUrl.searchParams.get("seed") ?? "";
  if (!LIST_ID_RE.test(list)) {
    return NextResponse.json({ error: "invalid_list", videos: [] }, { status: 400 });
  }

  const cached = cache.get(list);
  if (cached) {
    return NextResponse.json({ videos: cached, cached: true });
  }

  const rssVideos = await fetchRssVideos(list);
  const seed = VIDEO_ID_RE.test(seedParam) ? seedParam : rssVideos[0]?.id;
  if (!seed) {
    // Playlist introuvable (supprimée/privée) ou RSS indisponible sans seed client.
    return NextResponse.json({ error: "no_seed", videos: [] }, { status: 200 });
  }

  const panelVideos = await fetchWatchPanelVideos(list, seed);
  // Panneau = source principale (ordre + exhaustivité) ; RSS en repli.
  const videos = panelVideos.length > 0 ? panelVideos : rssVideos;
  if (videos.length > 0) cache.set(list, videos);
  return NextResponse.json({ videos, error: videos.length === 0 ? "resolve_failed" : undefined });
}
