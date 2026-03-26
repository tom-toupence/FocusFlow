"use client";

import { useState } from "react";
import { videos, VideoMood, moodLabels } from "@/data/videos";
import { useSessionStore } from "@/store/sessionStore";

const moodColors: Record<VideoMood, string> = {
  focus: "bg-rose-900/50 text-rose-300 border-rose-800",
  chill: "bg-sky-900/50 text-sky-300 border-sky-800",
  creative: "bg-purple-900/50 text-purple-300 border-purple-800",
  nature: "bg-emerald-900/50 text-emerald-300 border-emerald-800",
};

const allMoods: VideoMood[] = ["focus", "chill", "creative", "nature"];

export default function VideoCatalog() {
  const { selectedVideoId, selectVideo } = useSessionStore();
  const [filter, setFilter] = useState<VideoMood | null>(null);

  const filtered = filter ? videos.filter((v) => v.mood.includes(filter)) : videos;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Catalogue
        </h2>
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter(null)}
            className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
              filter === null
                ? "bg-gray-600 text-white border-gray-500"
                : "text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
          >
            Tous
          </button>
          {allMoods.map((m) => (
            <button
              key={m}
              onClick={() => setFilter(filter === m ? null : m)}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                filter === m ? moodColors[m] : "text-gray-500 border-gray-700 hover:text-gray-300"
              }`}
            >
              {moodLabels[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
        {filtered.map((video) => (
          <button
            key={video.id}
            onClick={() => selectVideo(video.id)}
            className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
              selectedVideoId === video.id
                ? "bg-gray-700 ring-1 ring-gray-500"
                : "bg-gray-800/50 hover:bg-gray-800"
            }`}
          >
            {/* YouTube thumbnail */}
            <div className="w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-700">
              <img
                src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{video.title}</p>
              <div className="flex gap-1 mt-1">
                {video.mood.map((m) => (
                  <span
                    key={m}
                    className={`text-xs px-1.5 py-0.5 rounded border ${moodColors[m]}`}
                  >
                    {moodLabels[m]}
                  </span>
                ))}
              </div>
            </div>
            {selectedVideoId === video.id && (
              <div className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
