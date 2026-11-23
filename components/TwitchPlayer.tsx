"use client";

import { useEffect, useRef } from "react";
import type { PlayerAdapter } from "@/lib/playback/types";
import { TwitchAdapter, type TwitchEmbedPlayer } from "@/lib/playback/twitch";

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
  volume?: number; // 0–1
  /** Reçoit l'adaptateur de lecture (interface unique de la session). */
  onAdapter?: (a: PlayerAdapter | null) => void;
}

export default function TwitchPlayer({ channel, vodId, token, volume = 0.8, onAdapter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<TwitchEmbedInstance | null>(null);
  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  const onAdapterRef = useRef(onAdapter);
  useEffect(() => { onAdapterRef.current = onAdapter; }, [onAdapter]);

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
      const adapter = new TwitchAdapter(
        () => (embedRef.current === embed ? embed.getPlayer() : null),
        vodId
          ? { id: `vod:${vodId}`, title: `Rediffusion ${vodId}`, subtitle: "Twitch", vod: true }
          : { id: `live:${channel}`, title: channel ?? "Twitch", subtitle: "Live Twitch", vod: false },
      );
      onAdapterRef.current?.(adapter);

      embed.addEventListener(window.Twitch.Embed.VIDEO_READY, () => {
        try {
          embed.getPlayer().setQuality("720p60");
        } catch {
          // quality string may vary — try fallback
          try { embed.getPlayer().setQuality("720p"); } catch { /* ignore */ }
        }
        try { embed.getPlayer().setVolume(volumeRef.current); } catch { /* ignore */ }
        adapter.markReady();
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
      onAdapterRef.current?.(null);
    };
  }, [channel, vodId, token]);

  useEffect(() => {
    if (!embedRef.current) return;
    try { embedRef.current.getPlayer().setVolume(volume); } catch { /* ignore */ }
  }, [volume]);

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
