"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    Twitch: {
      Embed: new (
        id: string,
        options: {
          channel?: string;
          video?: string;
          oauth_token?: string;
          parent: string[];
          width: string | number;
          height: string | number;
          autoplay?: boolean;
          muted?: boolean;
        }
      ) => { destroy: () => void };
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
  const embedRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    const initEmbed = () => {
      if (!window.Twitch?.Embed || !containerRef.current) return;

      embedRef.current?.destroy();
      embedRef.current = null;

      // Clear any previous embed content
      if (containerRef.current) containerRef.current.innerHTML = "";

      const options: Parameters<typeof window.Twitch.Embed>[1] = {
        parent: [window.location.hostname],
        width: "100%",
        height: "100%",
        autoplay: true,
        muted: false,
      };

      if (channel) options.channel = channel;
      if (vodId) options.video = vodId;
      if (token) options.oauth_token = token;

      embedRef.current = new window.Twitch.Embed("twitch-embed-container", options);
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
        // Script already added, poll until ready
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
