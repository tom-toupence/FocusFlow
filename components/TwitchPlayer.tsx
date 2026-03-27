"use client";

import { useEffect, useState } from "react";

interface Props {
  channel: string;
}

export default function TwitchPlayer({ channel }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const parent = window.location.hostname;
    setSrc(
      `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=true&muted=false`
    );
  }, [channel]);

  if (!src) return null;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        allowFullScreen
        style={{ border: "none", pointerEvents: "none" }}
      />
      {/* Subtle dark overlay so the Twitch UI doesn't distract */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
    </div>
  );
}
