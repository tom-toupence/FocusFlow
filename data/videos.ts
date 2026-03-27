export type VideoMood = "lofi" | "jazz" | "ambience" | "nature" | "synthwave" | "classical";

export interface Video {
  id: string;
  title: string;
  channel: string;
  youtubeId: string;
  mood: VideoMood;
  color?: string;
  country?: string;
  custom?: boolean;
}

export const defaultVideos: Video[] = [

  // ─── Japon — Abao in Tokyo ───────────────────────────────────────────────────
  { id: "abao-01", title: "Study With Me — Rainy Shibuya Crossing",      channel: "Abao in Tokyo",    youtubeId: "86CFyZDqiAI", mood: "ambience",  color: "#1e3a5f", country: "Japon" },
  { id: "abao-02", title: "Study With Me — Shibuya Rain (Piano)",        channel: "Abao in Tokyo",    youtubeId: "LjRygr4xR7g", mood: "ambience",  color: "#1a2e4a", country: "Japon" },
  { id: "abao-03", title: "Study With Me — Tokyo Skyline Summer",        channel: "Abao in Tokyo",    youtubeId: "reyJo2i3kik", mood: "ambience",  color: "#2a3e5f", country: "Japon" },
  { id: "abao-04", title: "Study With Me — Sunrise Coastal Japan",       channel: "Abao in Tokyo",    youtubeId: "_bTvI1DfWz0", mood: "ambience",  color: "#3a2e1a", country: "Japon" },
  { id: "abao-05", title: "Study With Me — Coastal Japan (Lofi)",        channel: "Abao in Tokyo",    youtubeId: "z-j6jsLtgjs", mood: "lofi",      color: "#2a3a4f", country: "Japon" },
  { id: "abao-06", title: "Study With Me — Golden Morning Tokyo",        channel: "Abao in Tokyo",    youtubeId: "iF3thiZR0fQ", mood: "ambience",  color: "#4a3a1a", country: "Japon" },
  { id: "abao-07", title: "Study With Me — Rainy Day Shibuya",           channel: "Abao in Tokyo",    youtubeId: "cNKH2uNM_t8", mood: "ambience",  color: "#1a2a3e", country: "Japon" },
  { id: "abao-08", title: "Study With Me — Sunlit Harbor Yokohama",      channel: "Abao in Tokyo",    youtubeId: "1OM0r8mLsek", mood: "ambience",  color: "#2e3a4a", country: "Japon" },
  { id: "abao-09", title: "Study With Me — Yokohama Sunset",             channel: "Abao in Tokyo",    youtubeId: "UskBAildgLg", mood: "ambience",  color: "#4a2a1e", country: "Japon" },
  { id: "abao-10", title: "Study With Me — Snowy Street in Japan",       channel: "Abao in Tokyo",    youtubeId: "Q_je9MUhN5g", mood: "ambience",  color: "#2a3a4a", country: "Japon" },
  { id: "abao-11", title: "Study With Me — Rainy Shinjuku",              channel: "Abao in Tokyo",    youtubeId: "E-U7Tv1srxs", mood: "ambience",  color: "#1a2e3a", country: "Japon" },
  { id: "abao-12", title: "Study With Me — Tokyo Tower Sunset",          channel: "Abao in Tokyo",    youtubeId: "v06qseR7V5U", mood: "ambience",  color: "#4a2e2a", country: "Japon" },
  { id: "abao-13", title: "Study With Me — Christmas Night Tokyo",       channel: "Abao in Tokyo",    youtubeId: "0AOIn63U-yg", mood: "ambience",  color: "#1a2a2a", country: "Japon" },
  { id: "abao-14", title: "Study With Me — Rainy Tokyo from Above",      channel: "Abao in Tokyo",    youtubeId: "yBazmKLMGpE", mood: "ambience",  color: "#1e2a3e", country: "Japon" },
  { id: "abao-15", title: "Study With Me — Rainy Night Over the Bay",    channel: "Abao in Tokyo",    youtubeId: "RgQYhSmXAOU", mood: "ambience",  color: "#1a1e3a", country: "Japon" },
  { id: "abao-16", title: "Study With Me — Peaceful Afternoon Tokyo",    channel: "Abao in Tokyo",    youtubeId: "BXDatxhn-B8", mood: "ambience",  color: "#2a2e3a", country: "Japon" },

  // ─── Japon — Rambalac Walks ──────────────────────────────────────────────────
  { id: "ramb-01", title: "Walking in Tokyo Shibuya at Night",           channel: "Rambalac",         youtubeId: "6qGiXY1SB68", mood: "ambience",  color: "#1a1e2e", country: "Japon" },
  { id: "ramb-02", title: "Autumn Walk Through Gion, Kyoto",             channel: "Rambalac",         youtubeId: "kd-OLM-6GRE", mood: "nature",    color: "#3a2a1a", country: "Japon" },
  { id: "ramb-03", title: "Tokyo Tachikawa Evening to Night Walk",       channel: "Rambalac",         youtubeId: "FyNBZCNzBn4", mood: "ambience",  color: "#1e1e2a", country: "Japon" },
  { id: "ramb-04", title: "Tokyo Snowfall Walk",                         channel: "Rambalac",         youtubeId: "PF-BNCDM9AE", mood: "ambience",  color: "#2a2e3a", country: "Japon" },
  { id: "ramb-05", title: "Snowfall in Niigata, Japan",                  channel: "Rambalac",         youtubeId: "QNGD12JW5Lk", mood: "nature",    color: "#2e3a3e", country: "Japon" },
  { id: "ramb-06", title: "Night Tokyo Walk — Hino to Tama",             channel: "Rambalac",         youtubeId: "jFxIaOLdgNM", mood: "ambience",  color: "#1a1a2a", country: "Japon" },
  { id: "ramb-07", title: "Night Tsukishima Walk, Tokyo",                channel: "Rambalac",         youtubeId: "kEr_lGSdLjI", mood: "ambience",  color: "#1e2a2e", country: "Japon" },
  { id: "ramb-08", title: "Tokyo Marunouchi Christmas Lights",           channel: "Rambalac",         youtubeId: "yKi3pFNK5TI", mood: "ambience",  color: "#2a1a2e", country: "Japon" },
  { id: "ramb-09", title: "Tokyo Mitake — Fall Hike in Red & Gold",      channel: "Rambalac",         youtubeId: "I6ZsokzXIo0", mood: "nature",    color: "#3a2e1a", country: "Japon" },
  { id: "ramb-10", title: "Blooming Sakura in Atami",                    channel: "Rambalac",         youtubeId: "lKLTjDX7EJo", mood: "nature",    color: "#3a1a2a", country: "Japon" },

  // ─── Japon — Trajets & Paysages ──────────────────────────────────────────────
  { id: "trai-02", title: "Riverside Train in Gifu, Japan — Piano",      channel: "Train Views",      youtubeId: "q8nPaqfRm_c", mood: "ambience",  color: "#1e2e2a", country: "Japon" },
  { id: "trai-04", title: "Shinkansen Osaka to Tokyo",                   channel: "Train Views",      youtubeId: "XyGcUXDuXVY", mood: "ambience",  color: "#1a2a2e", country: "Japon" },
  { id: "trai-05", title: "Tokyo Yurikamome — Side Window View 4K",      channel: "Train Views",      youtubeId: "7iSOMLkFizU", mood: "ambience",  color: "#1e2a3a", country: "Japon" },
  { id: "trai-06", title: "Lilac Express — Hokkaido Window View",        channel: "Train Views",      youtubeId: "0NS8S7AAUIM", mood: "nature",    color: "#2a2e3a", country: "Japon" },
  { id: "trai-07", title: "Spirited Away Train Scene — Fake Window",     channel: "Ghibli Vibes",     youtubeId: "pl2-zgZBo5Y", mood: "ambience",  color: "#1a2a3a", country: "Japon" },
  { id: "natu-01", title: "Japan 4K — Scenic Relaxation Film",           channel: "Scenic Films",     youtubeId: "D48T0wNm96w", mood: "nature",    color: "#1a3a2a", country: "Japon" },
  { id: "natu-02", title: "Japan in 8K — Land of The Rising Sun",        channel: "Scenic Films",     youtubeId: "G5RpJwCJDqc", mood: "nature",    color: "#2a3a1a", country: "Japon" },
  { id: "natu-03", title: "Flying Over Japan 4K — Relaxing Music",       channel: "Scenic Films",     youtubeId: "AY5qcIq5u2g", mood: "nature",    color: "#1e3a2e", country: "Japon" },
  { id: "natu-04", title: "Japan Cherry Blossoms 4K HDR — Kawazu",       channel: "Scenic Films",     youtubeId: "kZN2yTa1HcY", mood: "nature",    color: "#3a1a2a", country: "Japon" },
  { id: "natu-12", title: "Feeding Deer at Nara Park — Autumn",          channel: "Nomadic Ambience", youtubeId: "XZwNVLGUIDM", mood: "nature",    color: "#2e3a1a", country: "Japon" },
  { id: "natu-13", title: "Rain Walk in Kyoto, Japan",                   channel: "Nomadic Ambience", youtubeId: "PwpxZXp8z5Y", mood: "ambience",  color: "#1e2e2a", country: "Japon" },

  // ─── Japon — Conduites de nuit / City Pop ────────────────────────────────────
  { id: "driv-01", title: "Tokyo Night Drive — 8K HDR + Lofi Beats",     channel: "Tokyo Drives",     youtubeId: "-Xh4BNbxpI8", mood: "lofi",      color: "#1a1e3a", country: "Japon" },
  { id: "driv-02", title: "Tokyo Night Drive — Lofi Hiphop & Chill",     channel: "Tokyo Drives",     youtubeId: "Lcdi9O2XB4E", mood: "lofi",      color: "#1e1a3a", country: "Japon" },
  { id: "driv-03", title: "Tokyo Night Drive — Citypop & Disco Grooves", channel: "Tokyo Drives",     youtubeId: "byGTaXSZ0nA", mood: "synthwave", color: "#2e1a3b", country: "Japon" },
  { id: "driv-06", title: "Tokyo Sunset Drive — 80s Japanese City Pop",  channel: "Tokyo Drives",     youtubeId: "dY9wRyyfKRA", mood: "synthwave", color: "#3a2a1e", country: "Japon" },
  { id: "driv-07", title: "Saturday Night in Tokyo — 80s City Pop",      channel: "Tokyo Drives",     youtubeId: "6e2smNPwxbk", mood: "synthwave", color: "#3a1e2a", country: "Japon" },
  { id: "driv-08", title: "Rainy Night Walk Shibuya 8K — Calm Piano",    channel: "Tokyo Walks",      youtubeId: "2y2Z06hVmWE", mood: "ambience",  color: "#1a2a2a", country: "Japon" },

  // ─── Corée du Sud ────────────────────────────────────────────────────────────
  { id: "driv-04", title: "Seoul Night Drive — Gangnam 4K HDR + Lofi",   channel: "Seoul Drives",     youtubeId: "40xZVEFVBuE", mood: "lofi",      color: "#1a2a3a", country: "Corée du Sud" },
  { id: "driv-05", title: "Seoul Night Drive — Downtown Vibes + Lofi",   channel: "Seoul Drives",     youtubeId: "SRpMapyw6Aw", mood: "lofi",      color: "#1e2a3a", country: "Corée du Sud" },

  // ─── États-Unis ──────────────────────────────────────────────────────────────
  { id: "noma-01", title: "Snowfall in New York — Times Square",         channel: "Nomadic Ambience", youtubeId: "2JWKWszOu7g", mood: "ambience",  color: "#1e2a3a", country: "États-Unis" },
  { id: "noma-02", title: "Snow Walk in Manhattan at Night",             channel: "Nomadic Ambience", youtubeId: "nswBLdiJwMw", mood: "ambience",  color: "#1a2a3e", country: "États-Unis" },
  { id: "noma-06", title: "New York Penthouse Cityscape View",           channel: "Nomadic Ambience", youtubeId: "PJnXm7opYks", mood: "ambience",  color: "#2a1e2e", country: "États-Unis" },
  { id: "city-02", title: "New York City Drive — Harlem to SoHo 4K",    channel: "4K Urban Life",    youtubeId: "88ESxZZzY-A", mood: "ambience",  color: "#2a1e2a", country: "États-Unis" },
  { id: "us-04",   title: "New York Jazz Lounge — Bar Classics",         channel: "Jazz Lounge",      youtubeId: "mM1dIwGO00w", mood: "jazz",      color: "#2e1a1e", country: "États-Unis" },

  // ─── Italie ──────────────────────────────────────────────────────────────────
  { id: "noma-09", title: "Venice Italy Cityscape 8K HDR",               channel: "Nomadic Ambience", youtubeId: "89r4hUMxMtg", mood: "ambience",  color: "#2e2a1e", country: "Italie" },
  { id: "noma-10", title: "Sea Sounds — Manarola Italy Cliffside",       channel: "Nomadic Ambience", youtubeId: "c1AywfvVmvI", mood: "nature",    color: "#1a2a2e", country: "Italie" },
  { id: "it-04",   title: "Amalfi Coast Drive — Sunrise 4K",             channel: "Italy Scenic",     youtubeId: "IUN664s7N-c", mood: "nature",    color: "#2a1e1a", country: "Italie" },

  // ─── Norvège ─────────────────────────────────────────────────────────────────
  { id: "noma-08", title: "Windy Walk — Lofoten, Norway 4K",             channel: "Nomadic Ambience", youtubeId: "cVB07aYcsyY", mood: "nature",    color: "#1a2e2e", country: "Norvège" },
  { id: "noma-11", title: "Snowstorm Drive — Arctic Circle Norway",      channel: "Nomadic Ambience", youtubeId: "cPz7ZOZNXMA", mood: "ambience",  color: "#2a2e3a", country: "Norvège" },

  // ─── Suisse ──────────────────────────────────────────────────────────────────
  { id: "noma-07", title: "Autumn Walk — Lauterbrunnen, Switzerland",    channel: "Nomadic Ambience", youtubeId: "u4DUtsiedcA", mood: "nature",    color: "#2a3a1e", country: "Suisse" },
  { id: "trai-01", title: "Grindelwald to Interlaken — Swiss Train",     channel: "Train Views",      youtubeId: "h0vrvXBLoCU", mood: "nature",    color: "#2a3a2e", country: "Suisse" },
  { id: "trai-03", title: "Train Through the Swiss Alps — 4K",           channel: "Train Views",      youtubeId: "ADt_RisXY0U", mood: "nature",    color: "#2e3a2a", country: "Suisse" },

  // ─── Émirats Arabes Unis ─────────────────────────────────────────────────────
  { id: "ae-01",   title: "Dubai Night Drive — Burj Khalifa 4K",          channel: "Dubai Drives",     youtubeId: "bTqVqk7FSmY", mood: "synthwave", color: "#2e2a1a", country: "Émirats" },

  // ─── Cozy / Ambiance (universel) ────────────────────────────────────────────
  { id: "cafe-01", title: "Cozy Coffee Shop — Smooth Piano Jazz",        channel: "Café Ambience",    youtubeId: "MYPVQccHhAQ", mood: "jazz" },
  { id: "cafe-02", title: "Rainy Jazz Café — Slow Jazz & Coffee",        channel: "Café Ambience",    youtubeId: "NJuSStkIZBg", mood: "jazz" },
  { id: "cafe-03", title: "Rainy Night Coffee Shop — Jazz 8 Hours",      channel: "Café Ambience",    youtubeId: "c0_ejQQcrwI", mood: "jazz" },
  { id: "cafe-04", title: "Cozy Fall Coffee Shop — Jazz & Rain",         channel: "Café Ambience",    youtubeId: "VMAPTo7RVCo", mood: "jazz" },
  { id: "cafe-05", title: "Ghibli Coffee Shop — Lofi Hip Hop",           channel: "Ghibli Vibes",     youtubeId: "zhDwjnYZiCo", mood: "lofi" },
  { id: "cafe-07", title: "Rainy Day — 4K Cozy Coffee Shop",             channel: "Café Ambience",    youtubeId: "0L38Z9hIi5s", mood: "jazz" },
  { id: "cafe-08", title: "Winter Bookstore — Jazz & Fireplace",         channel: "Cozy Ambience",    youtubeId: "HO6cbtdmkIc", mood: "jazz" },
  { id: "cozy-01", title: "Rain & Thunder — Crackling Fireplace 3H",    channel: "Cozy Sounds",      youtubeId: "3sL0omwElxw", mood: "ambience" },
  { id: "cozy-02", title: "Relaxing Fireplace 12 Hours (No Music)",     channel: "Cozy Sounds",      youtubeId: "UgHKb_7884o", mood: "ambience" },
  { id: "cozy-03", title: "Cozy Cabin — Rain & Fireplace at Night",     channel: "Cozy Sounds",      youtubeId: "1RcVIuZ8Wdk", mood: "ambience" },
  { id: "cozy-05", title: "Rain on Window & Warm Fireplace",            channel: "Cozy Sounds",      youtubeId: "sTGeUZzXSjM", mood: "ambience" },
  { id: "cozy-06", title: "Blizzard & Fireplace for Sleep",             channel: "Cozy Sounds",      youtubeId: "jK3cMcH9e_c", mood: "ambience" },
  { id: "natu-06", title: "Ocean Waves — Relaxing Sleep Music",         channel: "Nature Sounds",    youtubeId: "PgkvwG971hw", mood: "nature" },
  { id: "natu-07", title: "The Most Relaxing Waves Ever",               channel: "Nature Sounds",    youtubeId: "vPhg6sc1Mk4", mood: "nature" },
  { id: "natu-05", title: "Cherry Blossom — Relaxing Japanese Zen",    channel: "Zen Music",        youtubeId: "oxlaAdCY4jA", mood: "classical" },
  { id: "city-03", title: "Night Drive Tokyo — City Pop & Lofi Mix",   channel: "Tokyo Drives",     youtubeId: "sfxQRGHJU8M", mood: "synthwave", country: "Japon" },
];

// Couleurs par défaut pour les vidéos sans couleur définie
const defaultColors: Record<VideoMood, string> = {
  lofi:      "#1a1e3a",
  jazz:      "#2a1a1f",
  ambience:  "#1e2a3a",
  nature:    "#1a3a2a",
  synthwave: "#2e1a3b",
  classical: "#2a1a2e",
};

export function getVideoColor(v: Video): string {
  return v.color ?? defaultColors[v.mood];
}

export const moodLabels: Record<VideoMood, string> = {
  lofi:      "Lofi",
  jazz:      "Jazz",
  ambience:  "Ambiance",
  nature:    "Nature",
  synthwave: "Synthwave",
  classical: "Classique",
};

export const moodColors: Record<VideoMood, string> = {
  lofi:      "text-violet-400 bg-violet-400/10",
  jazz:      "text-amber-400 bg-amber-400/10",
  ambience:  "text-sky-400 bg-sky-400/10",
  nature:    "text-emerald-400 bg-emerald-400/10",
  synthwave: "text-pink-400 bg-pink-400/10",
  classical: "text-orange-300 bg-orange-300/10",
};

export function extractYouTubeId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}
