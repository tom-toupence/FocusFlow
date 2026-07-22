// Moteur de recommandations « Découvrir » : dérive des requêtes de recherche
// YouTube des thèmes réellement écoutés (titres de l'historique + file + vidéos
// custom). 100% local par défaut ; le coach IA (route /api/coach, type "music")
// peut affiner les requêtes si une clé serveur est configurée — sinon repli ici.

export interface RecQuery {
  label: string;   // thème lisible affiché à l'utilisateur
  query: string;   // requête envoyée à /api/youtube/search
  reason?: string; // explication courte (« tu écoutes des OST d'anime ») — IA
}

export interface RecVideo {
  id: string;
  title: string;
  channel: string;
  lengthSeconds: number | null;
}

// Stopwords FR/EN + bruit typique des titres YouTube (formats, durées, qualité).
const STOPWORDS = new Set([
  "the", "and", "with", "for", "your", "from", "this", "that", "into", "over",
  "les", "des", "une", "sur", "dans", "pour", "avec", "sous", "par", "aux",
  "mix", "music", "musique", "video", "official", "live", "hour", "hours",
  "min", "beats", "playlist", "study", "work", "chill", "relax", "relaxing",
  "focus", "session", "background", "ambience", "ambient", "sounds", "vibes",
  "night", "day", "morning", "evening", "view", "film", "hdr", "drive",
]);

function tokenize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[—–·|/()\[\],:;!?"'’&+~—-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+[hk]?$/.test(w) && !STOPWORDS.has(w));
}

function capitalize(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// Mini-dictionnaire d'univers : détection locale de thèmes non littéraux
// (le repli sans IA doit rester digne — ex. titres d'anime → « anime music »).
const UNIVERSE_RULES: { re: RegExp; label: string; query: string }[] = [
  { re: /\b(anime|opening|op\s?\d|ending|naruto|ghibli|shippuden|one\s?piece|jujutsu|evangelion)\b/i, label: "Musiques d'anime", query: "anime ost openings mix" },
  { re: /\b(game|gaming|zelda|final fantasy|nier|minecraft|hollow knight|undertale|skyrim|ost)\b/i, label: "OST de jeux vidéo", query: "video game ost relaxing mix" },
  { re: /\b(piano|classical|chopin|debussy|einaudi)\b/i, label: "Piano", query: "calm piano focus mix" },
  { re: /\b(jazz|saxo|swing|bossa)\b/i, label: "Jazz", query: "smooth jazz instrumental mix" },
  { re: /\b(synthwave|retrowave|cyberpunk|vaporwave)\b/i, label: "Synthwave", query: "synthwave chill mix" },
  { re: /\b(rain|pluie|thunder|storm)\b/i, label: "Pluie & orage", query: "rain ambience lofi mix" },
];

// Requêtes locales : détection d'univers + thèmes récurrents des titres/chaînes.
export function buildLocalQueries(titles: string[], channels: string[] = []): RecQuery[] {
  const queries: RecQuery[] = [];
  const corpus = [...titles, ...channels].join(" \n ");
  for (const rule of UNIVERSE_RULES) {
    if (rule.re.test(corpus)) queries.push({ label: rule.label, query: rule.query });
    if (queries.length >= 2) break;
  }

  const counts = new Map<string, number>();
  for (const text of [...titles, ...channels]) {
    // Un même token compté une fois par texte (évite qu'un seul titre domine).
    for (const tok of new Set(tokenize(text))) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 4);

  // Ancres NEUTRES : on cible des formats longs sans imposer un genre — si
  // l'utilisateur écoute autre chose que du lofi, ses thèmes restent les siens.
  const ANCHORS = ["music mix", "playlist", "compilation", "mix"];
  for (const [i, w] of top.entries()) {
    if (queries.length >= 4) break;
    queries.push({ label: capitalize(w), query: `${w} ${ANCHORS[i % ANCHORS.length]}` });
  }
  // Repli sans historique : thèmes du catalogue (lofi paysages / study with me).
  if (queries.length === 0) {
    return [
      { label: "Lofi", query: "lofi ambient mix landscape" },
      { label: "Study With Me", query: "study with me scenic view" },
    ];
  }
  return queries;
}

export interface AiQueryInput {
  titles: string[];
  channels?: string[];
  moods?: string[];
  scope?: "global" | "playlist";
  playlistName?: string;
}

// Cache sessionStorage (30 min) : préserve le quota Groq/Gemini quand on
// revient sur l'onglet. « Actualiser » passe force=true.
const AI_CACHE_TTL = 30 * 60 * 1000;

function aiCacheKey(input: AiQueryInput): string {
  return `focusflow-ai-queries:${input.scope ?? "global"}:${input.playlistName ?? ""}:${input.titles.slice(0, 8).join("|")}`;
}

// Requêtes affinées par le coach IA (Groq → Gemini) — le coach INTERPRÈTE les
// titres (univers/genres/artistes). null si pas de clé/échec → repli
// buildLocalQueries chez l'appelant.
export async function fetchAiQueries(input: AiQueryInput, opts?: { force?: boolean }): Promise<RecQuery[] | null> {
  const key = aiCacheKey(input);
  if (!opts?.force) {
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const { at, queries } = JSON.parse(cached);
        if (Date.now() - at < AI_CACHE_TTL && Array.isArray(queries) && queries.length > 0) return queries;
      }
    } catch { /* sessionStorage indisponible */ }
  }
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "music",
        titles: input.titles.slice(0, 20),
        channels: input.channels?.slice(0, 15),
        moods: input.moods?.slice(0, 6),
        scope: input.scope,
        playlistName: input.playlistName,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.queries)) return null;
    const queries = (data.queries as { label?: unknown; query?: unknown; reason?: unknown }[])
      .filter((q) => q && typeof q.label === "string" && typeof q.query === "string")
      .slice(0, 5)
      .map((q) => ({
        label: String(q.label).slice(0, 40),
        query: String(q.query).slice(0, 80),
        ...(typeof q.reason === "string" && q.reason ? { reason: String(q.reason).slice(0, 90) } : {}),
      }));
    if (queries.length === 0) return null;
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), queries })); } catch { /* plein */ }
    return queries;
  } catch {
    return null;
  }
}

// Recherche YouTube via notre route serveur (parse, sans clé). [] si échec.
// minSeconds : 0 = tout (recherche directe de morceaux), défaut serveur = 600 s
// (recommandations → formats longs adaptés au focus).
export async function fetchSearchVideos(query: string, minSeconds?: number): Promise<RecVideo[]> {
  try {
    const params = new URLSearchParams({ q: query });
    if (minSeconds !== undefined) params.set("min", String(minSeconds));
    const res = await fetch(`/api/youtube/search?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.videos) ? data.videos : [];
  } catch {
    return [];
  }
}
