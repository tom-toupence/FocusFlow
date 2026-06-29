import { NextRequest, NextResponse } from "next/server";

// Résout un « mix radio » YouTube (list=RD…) en une liste ordonnée de videoIds.
// Les radios sont des playlists infinies personnalisées : l'API IFrame ne sait pas
// les rejouer en embed. On récupère ici la version publique du mix en parsant la
// page watch de YouTube (objet `ytInitialData`). Aucune clé API requise.
//
// ⚠️ Dépend du markup de YouTube : robuste aux échecs (retourne [] → repli côté client).

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const LIST_ID_RE = /^[a-zA-Z0-9_-]{10,60}$/;

// Cache mémoire court : un mix public bouge peu sur quelques minutes.
const cache = new Map<string, { ids: string[]; at: number }>();
const TTL_MS = 15 * 60 * 1000;

// Parcourt récursivement ytInitialData et collecte les videoId des entrées de mix,
// dans l'ordre de rencontre, sans doublon.
function collectMixVideoIds(node: unknown, acc: string[], seen: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectMixVideoIds(item, acc, seen);
    return;
  }
  const obj = node as Record<string, unknown>;
  const renderer = obj.playlistPanelVideoRenderer as { videoId?: unknown } | undefined;
  if (renderer && typeof renderer.videoId === "string" && VIDEO_ID_RE.test(renderer.videoId)) {
    if (!seen.has(renderer.videoId)) {
      seen.add(renderer.videoId);
      acc.push(renderer.videoId);
    }
  }
  for (const key of Object.keys(obj)) collectMixVideoIds(obj[key], acc, seen);
}

function extractYtInitialData(html: string): unknown | null {
  // YouTube embarque: var ytInitialData = {...};  (ou window["ytInitialData"] = {...};)
  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = '];
  for (const marker of markers) {
    const start = html.indexOf(marker);
    if (start === -1) continue;
    const jsonStart = start + marker.length;
    // Découpe équilibrée des accolades pour isoler l'objet JSON.
    let depth = 0;
    let inStr = false;
    let escaped = false;
    for (let i = jsonStart; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(jsonStart, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const list = request.nextUrl.searchParams.get("list") ?? "";
  const seed = request.nextUrl.searchParams.get("seed") ?? "";

  if (!LIST_ID_RE.test(list)) {
    return NextResponse.json({ error: "invalid_list", videoIds: [] }, { status: 400 });
  }
  const seedOk = VIDEO_ID_RE.test(seed);

  const cached = cache.get(list);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ videoIds: cached.ids, cached: true });
  }

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${seedOk ? seed : ""}&list=${encodeURIComponent(list)}&hl=en&gl=US`;
    const res = await fetch(watchUrl, {
      headers: {
        // UA desktop : la page renvoie alors ytInitialData avec le panneau de mix.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
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
    const ids: string[] = [];
    collectMixVideoIds(data, ids, new Set<string>());
    // Garde la seed en tête si présente et connue.
    if (seedOk && ids[0] !== seed) {
      const idx = ids.indexOf(seed);
      if (idx > 0) ids.splice(idx, 1);
      ids.unshift(seed);
    }
    cache.set(list, { ids, at: Date.now() });
    // Éviction simple : purge les entrées expirées pour borner la mémoire.
    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of cache) if (now - v.at >= TTL_MS) cache.delete(k);
    }
    return NextResponse.json({ videoIds: ids });
  } catch {
    return NextResponse.json({ error: "exception", videoIds: [] }, { status: 200 });
  }
}
