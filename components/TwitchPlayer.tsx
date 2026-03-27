"use client";

import { useEffect, useState } from "react";

interface Props {
  channel?: string;
  vodId?: string;
}

export default function TwitchPlayer({ channel, vodId }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const parent = window.location.hostname;
    if (channel) {
      setSrc(
        `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=true&muted=false`
      );
    } else if (vodId) {
      setSrc(
        `https://player.twitch.tv/?video=${encodeURIComponent(vodId)}&parent=${parent}&autoplay=true&muted=false`
      );
    }
  }, [channel, vodId]);

  if (!src) return null;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        allowFullScreen
        style={{ border: "none", pointerEvents: "none" }}
      />
    </div>
  );
}
