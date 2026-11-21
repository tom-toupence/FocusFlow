"use client";

import { useSessionStore } from "@/store/sessionStore";

export default function VideoPlayer() {
  const { selectedVideoId, getAllVideos } = useSessionStore();
  const video = getAllVideos().find((v) => v.id === selectedVideoId);

  if (!video) {
    return (
      <div className="aspect-video bg-gray-900 rounded-2xl flex items-center justify-center text-gray-500">
        Sélectionne une vidéo dans le catalogue
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden aspect-video bg-black shadow-2xl shadow-black/50">
      <iframe
        key={video.youtubeId}
        src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1`}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}
