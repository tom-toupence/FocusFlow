// Helpers serveur partagés pour parser les pages YouTube (objet `ytInitialData`).
// Utilisés par les routes app/api/youtube/* (mix, playlist, search). Aucune clé API.
// Dépend du markup de YouTube : toujours robuste aux échecs (retour null/[]).

export const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
export const LIST_ID_RE = /^[a-zA-Z0-9_-]{10,60}$/;

export const YT_FETCH_HEADERS = {
  // UA desktop : la page renvoie alors ytInitialData complet.
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

// YouTube embarque: var ytInitialData = {...};  (ou window["ytInitialData"] = {...};)
// Découpe équilibrée des accolades pour isoler l'objet JSON.
export function extractYtInitialData(html: string): unknown | null {
  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = '];
  for (const marker of markers) {
    const start = html.indexOf(marker);
    if (start === -1) continue;
    const jsonStart = start + marker.length;
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

// Extrait le texte d'un champ YouTube (`{ runs: [{text}] }` ou `{ simpleText }`).
export function ytText(field: unknown): string {
  if (!field || typeof field !== "object") return "";
  const f = field as { simpleText?: unknown; runs?: unknown };
  if (typeof f.simpleText === "string") return f.simpleText;
  if (Array.isArray(f.runs)) {
    return f.runs
      .map((r) => (r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string" ? (r as { text: string }).text : ""))
      .join("");
  }
  return "";
}

// Parcourt récursivement un arbre ytInitialData et collecte, dans l'ordre de
// rencontre et sans doublon d'id, les objets portés par la clé `rendererKey`.
export function collectRenderers(
  node: unknown,
  rendererKey: string,
  acc: Record<string, unknown>[],
  seen: Set<string>
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectRenderers(item, rendererKey, acc, seen);
    return;
  }
  const obj = node as Record<string, unknown>;
  const renderer = obj[rendererKey] as { videoId?: unknown } | undefined;
  if (renderer && typeof renderer === "object" && typeof renderer.videoId === "string" && VIDEO_ID_RE.test(renderer.videoId)) {
    if (!seen.has(renderer.videoId)) {
      seen.add(renderer.videoId);
      acc.push(renderer as Record<string, unknown>);
    }
  }
  for (const key of Object.keys(obj)) collectRenderers(obj[key], rendererKey, acc, seen);
}

// Cache mémoire court partagé (clé arbitraire → payload). Un contenu public
// bouge peu sur quelques minutes ; borne la mémoire par purge des expirés.
export function makeTtlCache<T>(ttlMs: number, maxEntries = 200) {
  const cache = new Map<string, { value: T; at: number }>();
  return {
    get(key: string): T | undefined {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      return undefined;
    },
    set(key: string, value: T) {
      cache.set(key, { value, at: Date.now() });
      if (cache.size > maxEntries) {
        const now = Date.now();
        for (const [k, v] of cache) if (now - v.at >= ttlMs) cache.delete(k);
      }
    },
  };
}
