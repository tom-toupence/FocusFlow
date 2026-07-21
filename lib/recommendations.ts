// Moteur de recommandations « Découvrir » : dérive des requêtes de recherche
// YouTube des thèmes réellement écoutés (titres de l'historique + file + vidéos
// custom). 100% local par défaut ; le coach IA (route /api/coach, type "music")
// peut affiner les requêtes si une clé serveur est configurée — sinon repli ici.

export interface RecQuery {
  label: string; // thème lisible affiché à l'utilisateur
  query: string; // requête envoyée à /api/youtube/search
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

// Requêtes locales : thèmes les plus récurrents des titres écoutés, ancrés sur
// des formats longs adaptés au focus.
export function buildLocalQueries(titles: string[]): RecQuery[] {
  const counts = new Map<string, number>();
  for (const title of titles) {
    // Un même token compté une fois par titre (évite qu'un seul titre domine).
    for (const tok of new Set(tokenize(title))) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 4);

  const ANCHORS = ["lofi ambient mix", "study with me", "ambient music long", "lofi playlist"];
  const queries = top.map((w, i) => ({
    label: capitalize(w),
    query: `${w} ${ANCHORS[i % ANCHORS.length]}`,
  }));
  // Repli sans historique : thèmes du catalogue (lofi paysages / study with me).
  if (queries.length === 0) {
    return [
      { label: "Lofi", query: "lofi ambient mix landscape" },
      { label: "Study With Me", query: "study with me scenic view" },
    ];
  }
  return queries;
}

// Requêtes affinées par le coach IA (Groq → Gemini). null si pas de clé/échec
// → l'appelant retombe sur buildLocalQueries.
export async function fetchAiQueries(titles: string[]): Promise<RecQuery[] | null> {
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "music", titles: titles.slice(0, 20) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.queries)) return null;
    const queries = (data.queries as { label?: unknown; query?: unknown }[])
      .filter((q) => q && typeof q.label === "string" && typeof q.query === "string")
      .slice(0, 4)
      .map((q) => ({ label: String(q.label).slice(0, 40), query: String(q.query).slice(0, 80) }));
    return queries.length > 0 ? queries : null;
  } catch {
    return null;
  }
}

// Recherche YouTube via notre route serveur (parse, sans clé). [] si échec.
export async function fetchSearchVideos(query: string): Promise<RecVideo[]> {
  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.videos) ? data.videos : [];
  } catch {
    return [];
  }
}
