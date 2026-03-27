"use client";

import { useState } from "react";
import { VideoMood, moodLabels, moodColors, getVideoColor } from "@/data/videos";
import { useSessionStore } from "@/store/sessionStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const allMoods: VideoMood[] = ["lofi", "jazz", "ambience", "nature", "synthwave", "classical"];

export default function VideoCatalog() {
  const { selectedVideoId, selectVideo, getAllVideos } = useSessionStore();
  const [moodFilter, setMoodFilter] = useState<VideoMood | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);

  const allVideos = getAllVideos();

  // Collect unique countries from default (non-custom) videos, preserving insertion order
  const countries = Array.from(
    new Set(allVideos.filter((v) => !v.custom && v.country).map((v) => v.country!))
  );

  const filtered = allVideos.filter((v) => {
    if (moodFilter && v.mood !== moodFilter) return false;
    if (countryFilter && v.country !== countryFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Catalogue</p>
        <span className="text-[10px] text-white/20">{filtered.length} vidéos</span>
      </div>

      {/* Mood filters */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setMoodFilter(null)}
          className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
            moodFilter === null && !countryFilter ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"
          )}
        >
          Tous
        </button>
        {allMoods.map((m) => (
          <button
            key={m}
            onClick={() => { setMoodFilter(moodFilter === m ? null : m); setCountryFilter(null); }}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
              moodFilter === m ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"
            )}
          >
            {moodLabels[m]}
          </button>
        ))}
      </div>

      {/* Country filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {countries.map((c) => (
          <button
            key={c}
            onClick={() => { setCountryFilter(countryFilter === c ? null : c); setMoodFilter(null); }}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
              countryFilter === c ? "bg-white/15 text-white" : "text-white/30 hover:text-white/60 hover:bg-white/5"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Video list */}
      <ScrollArea className="h-64">
        <div className="flex flex-col gap-1 pr-3">
          {filtered.length === 0 && (
            <p className="text-white/20 text-xs text-center py-8">Aucune vidéo</p>
          )}
          {filtered.map((video) => {
            const isSelected = selectedVideoId === video.id;
            return (
              <button
                key={video.id}
                onClick={() => selectVideo(video.id)}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 group",
                  isSelected ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
                )}
              >
                <div className="relative w-14 h-9 rounded-lg overflow-hidden flex-shrink-0">
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${getVideoColor(video)}, #0d0d0f)` }} />
                  <img
                    src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                    alt={video.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium truncate transition-colors", isSelected ? "text-white" : "text-white/70 group-hover:text-white/90")}>
                    {video.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium inline-block", moodColors[video.mood])}>
                      {moodLabels[video.mood]}
                    </span>
                    {video.country && (
                      <span className="text-[10px] text-white/25">{video.country}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
