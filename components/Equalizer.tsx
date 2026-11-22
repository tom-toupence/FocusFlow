"use client";

import type { VideoMood } from "@/data/videos";

// Durées par mood : lofi = lent, ambience = très lent, nature = ondulation.
const MOOD_DURATIONS: Partial<Record<VideoMood, [number, number, number]>> = {
  lofi: [1.2, 1.5, 1.35],
  ambience: [1.9, 2.3, 2.1],
  nature: [1.6, 2.0, 1.8],
};
const DEFAULT_DURATIONS: [number, number, number] = [1.2, 1.5, 1.35];

/**
 * Petit equalizer PSEUDO-réactif (3 barres, sinusoïdes déphasées en CSS —
 * l'audio des iframes est cross-origin, impossible à analyser). Il tourne
 * quand la lecture est active et se fige en pause : illusion suffisante.
 */
export default function Equalizer({ playing, mood }: { playing: boolean; mood?: VideoMood }) {
  const durations = (mood && MOOD_DURATIONS[mood]) || DEFAULT_DURATIONS;
  return (
    <span className="flex items-end gap-[2px] h-3 flex-shrink-0" aria-hidden>
      {durations.map((d, i) => (
        <span
          key={i}
          className="anim-eq w-[3px] h-full rounded-full bg-emerald-400"
          style={{
            animationDuration: `${d}s`,
            animationDelay: `${-i * 0.45}s`,
            animationPlayState: playing ? "running" : "paused",
          }}
        />
      ))}
    </span>
  );
}
