export type VideoMood = "focus" | "chill" | "creative" | "nature";

export interface Video {
  id: string;
  title: string;
  youtubeId: string;
  mood: VideoMood[];
  thumbnail?: string;
}

export const videos: Video[] = [
  {
    id: "lofi-girl",
    title: "Lofi Girl — 24/7 Live",
    youtubeId: "jfKfPfyJRdk",
    mood: ["focus", "chill"],
  },
  {
    id: "seoul-driving",
    title: "Driving in Seoul — Lofi",
    youtubeId: "na7Do_cWT-8",
    mood: ["focus", "chill"],
  },
  {
    id: "tokyo-night",
    title: "Tokyo Night — Lofi Hip Hop",
    youtubeId: "5qap5aO4i9A",
    mood: ["focus", "creative"],
  },
  {
    id: "rainy-coffee",
    title: "Rainy Coffee Shop Ambience",
    youtubeId: "h2ZAoTSBxoQ",
    mood: ["chill", "focus"],
  },
  {
    id: "chillhop",
    title: "Chillhop Music — Raccoon",
    youtubeId: "7NOSDKb0HlU",
    mood: ["focus", "creative"],
  },
  {
    id: "study-jazz",
    title: "Study Jazz — Café Vibes",
    youtubeId: "Dx5qFachd3A",
    mood: ["creative", "chill"],
  },
  {
    id: "nature-rain",
    title: "Rain on Window — 10h",
    youtubeId: "q76bMs-NwRk",
    mood: ["nature", "chill"],
  },
  {
    id: "synthwave",
    title: "Synthwave — Night Drive",
    youtubeId: "4xDzrJKXOOY",
    mood: ["creative", "focus"],
  },
];

export const moodLabels: Record<VideoMood, string> = {
  focus: "Focus",
  chill: "Chill",
  creative: "Créatif",
  nature: "Nature",
};
