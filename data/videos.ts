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

// Catalogue refondu (2026-07) : uniquement des « Study With Me » scéniques et du
// lofi/ambient sur beaux paysages (dominante Asie), + quelques walks. Tous les IDs
// ont été vérifiés embarquables via oEmbed.
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

  // ─── Japon — Study With Me (Osaka & Tokyo) ───────────────────────────────────
  { id: "swj-01",  title: "Study With Me — Osaka Midnight (4h)",         channel: "study with japan", youtubeId: "gHmq9Xd6qMQ", mood: "ambience",  color: "#1a1e3a", country: "Japon" },
  { id: "swj-02",  title: "Study With Me — Osaka Sunset (7h)",           channel: "study with japan", youtubeId: "tA33x7DE1j4", mood: "ambience",  color: "#4a2a1e", country: "Japon" },
  { id: "hatsu-01", title: "Study With Me — Tokyo Night View (1h)",      channel: "Hatsu Tokyo",      youtubeId: "kMCbva2SvMU", mood: "ambience",  color: "#1a1e2e", country: "Japon" },
  { id: "hatsu-02", title: "Study With Me — Tokyo Skytree Night (2h)",   channel: "Hatsu Tokyo",      youtubeId: "tCAUKfgEBpI", mood: "ambience",  color: "#1e1a3a", country: "Japon" },

  // ─── Japon — Lofi & paysages ─────────────────────────────────────────────────
  { id: "jplo-01", title: "Kyoto Dawn Drive — Japanese Ambient Lofi",    channel: "Abao Vision",      youtubeId: "cZhR365mLO4", mood: "lofi",      color: "#2a1e2e", country: "Japon" },
  { id: "jplo-02", title: "Mount Fuji Dusk Drive — 8K Piano",            channel: "Abao Vision",      youtubeId: "TnG89ChN9LQ", mood: "ambience",  color: "#3a1a2a", country: "Japon" },
  { id: "jplo-03", title: "Mt. Fuji Drive — Calm Lofi & Scenic Road",    channel: "Drive Lo-fi Japan", youtubeId: "YOs-kGN39hM", mood: "lofi",     color: "#2a2e3a", country: "Japon" },
  { id: "jplo-04", title: "Mount Fuji from the Train Window — Lofi",     channel: "Somewhere Else",   youtubeId: "-Y01AvcZaks", mood: "lofi",      color: "#2e3a3e", country: "Japon" },
  { id: "jplo-05", title: "fujisan. — Japan Lofi Vibes",                 channel: "The Jazz Hop Café", youtubeId: "RtWgbht6qe8", mood: "lofi",     color: "#1e2a3a", country: "Japon" },
  { id: "driv-01", title: "Tokyo Night Drive — 8K HDR + Lofi Beats",     channel: "Abao Vision",      youtubeId: "-Xh4BNbxpI8", mood: "lofi",      color: "#1a1e3a", country: "Japon" },
  { id: "trai-02", title: "Riverside Train in Gifu, Japan — Piano",      channel: "Abao Vision",      youtubeId: "q8nPaqfRm_c", mood: "ambience",  color: "#1e2e2a", country: "Japon" },
  { id: "trai-06", title: "Lilac Express — Hokkaido Window View",        channel: "Spirit of Japan TV", youtubeId: "0NS8S7AAUIM", mood: "nature",  color: "#2a2e3a", country: "Japon" },
  { id: "natu-01", title: "Japan 4K — Scenic Relaxation Film",           channel: "Scenic Relaxation", youtubeId: "D48T0wNm96w", mood: "nature",   color: "#1a3a2a", country: "Japon" },
  { id: "natu-04", title: "Japan Cherry Blossoms 4K HDR — Kawazu",       channel: "Virtual Japan",    youtubeId: "kZN2yTa1HcY", mood: "nature",    color: "#3a1a2a", country: "Japon" },

  // ─── Japon — Walks ───────────────────────────────────────────────────────────
  { id: "ramb-02", title: "Evening Walk Through Gion, Kyoto",            channel: "Rambalac",         youtubeId: "kd-OLM-6GRE", mood: "nature",    color: "#3a2a1a", country: "Japon" },
  { id: "ramb-10", title: "Blooming Sakura in Atami",                    channel: "Rambalac",         youtubeId: "lKLTjDX7EJo", mood: "nature",    color: "#3a1a2a", country: "Japon" },

  // ─── Corée du Sud ────────────────────────────────────────────────────────────
  { id: "driv-05", title: "Seoul Night Drive — Downtown + Lofi",         channel: "Seoul Walker",     youtubeId: "SRpMapyw6Aw", mood: "lofi",      color: "#1e2a3a", country: "Corée du Sud" },
  { id: "kr-01",   title: "Jeju Island — Ocean Views + Lofi Beats",      channel: "Coffee Backgrounds", youtubeId: "Hpmr6R8uTU8", mood: "lofi",    color: "#1a2e2e", country: "Corée du Sud" },

  // ─── Chine ───────────────────────────────────────────────────────────────────
  { id: "cn-01",   title: "Study With Me — Shanghai, The Bund Night (4h)", channel: "Sean Study",     youtubeId: "eusFXcYHGTY", mood: "ambience",  color: "#1a1e3a", country: "Chine" },
  { id: "cn-02",   title: "Study With Me — Guangzhou Afternoon (4h)",    channel: "Sean Study",       youtubeId: "1Md2UbiiN1U", mood: "ambience",  color: "#2a3e5f", country: "Chine" },
  { id: "cn-03",   title: "Guilin 4K — Mountains Meet the River",        channel: "Frame Art TV",     youtubeId: "r0LVnW1ekic", mood: "nature",    color: "#1a3a2a", country: "Chine" },

  // ─── Taïwan ──────────────────────────────────────────────────────────────────
  { id: "tw-01",   title: "Taiwan Nostalgic Lofi — Tainan Lanterns",     channel: "Lofi Tripper Ryo", youtubeId: "nYSi0kgX4xQ", mood: "lofi",      color: "#3a1e2a", country: "Taïwan" },
  { id: "tw-02",   title: "Midnight in Taipei — Real Life Lofi 4K",      channel: "Walking Around Taiwan", youtubeId: "iSucHjikLuE", mood: "lofi",  color: "#1a1a2a", country: "Taïwan" },
  { id: "tw-03",   title: "Study With Me — Lofi Beats @ Taipei",         channel: "PT STEM Tutor",    youtubeId: "HtdYFyKRVOI", mood: "lofi",      color: "#1e2a2e", country: "Taïwan" },

  // ─── Hong Kong ───────────────────────────────────────────────────────────────
  { id: "hk-01",   title: "Hong Kong Late Night Walk — Lofi Vibes",      channel: "MOMA Serenade",    youtubeId: "gg7jX09L05E", mood: "lofi",      color: "#2a1a2e", country: "Hong Kong" },
  { id: "hk-02",   title: "Hong Kong Night Drive — Neon + Chillhop",     channel: "HK Midnight LoFi", youtubeId: "7nThSsjKi8M", mood: "lofi",      color: "#1e1a3a", country: "Hong Kong" },

  // ─── Vietnam ─────────────────────────────────────────────────────────────────
  { id: "vn-01",   title: "Ha Long Bay — Immersive Vietnam Lofi",        channel: "Asia Lofi Walks",  youtubeId: "oGUutDb2TMo", mood: "lofi",      color: "#1a2e2e", country: "Vietnam" },
  { id: "vn-02",   title: "Vietnam 4K — Scenic Relaxation Film",         channel: "Scenic Relaxation", youtubeId: "w1ucZCmvO5c", mood: "nature",   color: "#2a3a1a", country: "Vietnam" },

  // ─── Thaïlande · Singapour · Indonésie ──────────────────────────────────────
  { id: "th-01",   title: "Thailand 4K — Scenic Relaxation Film",        channel: "Scenic Relaxation", youtubeId: "SadzfrxVuF0", mood: "nature",   color: "#1e3a2e", country: "Thaïlande" },
  { id: "sg-01",   title: "Singapore Lofi Skies — Tropical Chill",       channel: "You Are Here",     youtubeId: "Tn31FGv8l4E", mood: "lofi",      color: "#2e2a1a", country: "Singapour" },
  { id: "id-01",   title: "Bali 4K — Scenic Relaxation Film",            channel: "Cinematic Relaxation", youtubeId: "Xh9oyZzbjZY", mood: "nature", color: "#2a3a2e", country: "Indonésie" },
  { id: "id-02",   title: "Work & Study With Me in Bali — Lofi",         channel: "Favorable Background", youtubeId: "6gKkxxC0ywQ", mood: "lofi",   color: "#2e3a1a", country: "Indonésie" },

  // ─── Népal ───────────────────────────────────────────────────────────────────
  { id: "np-01",   title: "Himalayan Dawn — Nepali Peaceful Lofi",       channel: "Nepal Lofi Station", youtubeId: "a7brjR17Wrc", mood: "lofi",    color: "#3a2e1a", country: "Népal" },

  // ─── Europe & ailleurs (quelques touches) ───────────────────────────────────
  { id: "gr-01",   title: "Santorini 4K — Lofi Chill BGM",               channel: "4K Serene Earth",  youtubeId: "fxMiz41D1_U", mood: "lofi",      color: "#1a2a3e", country: "Grèce" },
  { id: "no-01",   title: "Norway Fjords 4K — Peaceful Landscapes",      channel: "Relaxing World",   youtubeId: "MuyczkzKoYw", mood: "nature",    color: "#1a2e2e", country: "Norvège" },
  { id: "noma-08", title: "Windy Walk — Lofoten, Norway 4K",             channel: "Nomadic Ambience", youtubeId: "cVB07aYcsyY", mood: "nature",    color: "#2a2e3a", country: "Norvège" },
  { id: "noma-07", title: "Autumn Walk — Lauterbrunnen, Switzerland",    channel: "Nomadic Ambience", youtubeId: "u4DUtsiedcA", mood: "nature",    color: "#2a3a1e", country: "Suisse" },
  { id: "uk-01",   title: "Study With Me — London, Big Ben Sunset (2h)", channel: "Sean Study",       youtubeId: "p3ynjjRbU9A", mood: "ambience",  color: "#4a2a1e", country: "Royaume-Uni" },
  { id: "eu-01",   title: "Study With Me — Lake at Sunrise (3h)",        channel: "Celine",           youtubeId: "lu-P1q_4MfQ", mood: "nature",    color: "#2a3a2e" },
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
