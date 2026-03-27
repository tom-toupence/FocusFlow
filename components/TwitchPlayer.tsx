"use client";

import { useEffect, useRef } from "react";

interface TwitchEmbedPlayer {
  setQuality: (quality: string) => void;
}

interface TwitchEmbedInstance {
  destroy: () => void;
  addEventListener: (event: string, cb: () => void) => void;
  getPlayer: () => TwitchEmbedPlayer;
}

declare global {
  interface Window {
    Twitch: {
      Embed: (new (
        id: string,
        options: {
          channel?: string;
          video?: string;
          oauth_token?: string;
          parent: string[];
          width: string | number;
          height: string | number;
          layout?: string;
          autoplay?: boolean;
          muted?: boolean;
        }
      ) => TwitchEmbedInstance) & {
        VIDEO_READY: string;
      };
    };
  }
}

interface Props {
  channel?: string;
  vodId?: string;
  token?: string;
}

export default function TwitchPlayer({ channel, vodId, token }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<TwitchEmbedInstance | null>(null);

  useEffect(() => {
    const initEmbed = () => {
      if (!window.Twitch?.Embed || !containerRef.current) return;

      embedRef.current?.destroy();
      embedRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";

      const options: {
        channel?: string;
        video?: string;
        oauth_token?: string;
        parent: string[];
        width: string | number;
        height: string | number;
        layout?: string;
        autoplay?: boolean;
        muted?: boolean;
      } = {
        parent: [window.location.hostname],
        width: "100%",
        height: "100%",
        layout: "video",
        autoplay: true,
        muted: false,
      };

      if (channel) options.channel = channel;
      if (vodId) options.video = vodId;
      if (token) options.oauth_token = token;

      const embed = new window.Twitch.Embed("twitch-embed-container", options);

      embed.addEventListener(window.Twitch.Embed.VIDEO_READY, () => {
        try {
          embed.getPlayer().setQuality("720p60");
        } catch {
          // quality string may vary — try fallback
          try { embed.getPlayer().setQuality("720p"); } catch { /* ignore */ }
        }
      });

      embedRef.current = embed;
    };

    if (window.Twitch?.Embed) {
      initEmbed();
    } else {
      const existing = document.querySelector('script[src*="embed.twitch.tv"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://embed.twitch.tv/embed/v1.js";
        script.onload = initEmbed;
        document.head.appendChild(script);
      } else {
        const poll = setInterval(() => {
          if (window.Twitch?.Embed) {
            clearInterval(poll);
            initEmbed();
          }
        }, 100);
        return () => clearInterval(poll);
      }
    }

    return () => {
      embedRef.current?.destroy();
      embedRef.current = null;
    };
  }, [channel, vodId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div
        id="twitch-embed-container"
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
}
