import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts : app + YouTube IFrame API + Spotify Web Playback SDK
              "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://sdk.scdn.co",
              // Iframes : YouTube embed + Spotify SDK + Twitch player
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://sdk.scdn.co https://player.twitch.tv",
              // Images : YouTube thumbnails + Spotify artwork + oEmbed
              "img-src 'self' data: https: blob:",
              // Styles
              "style-src 'self' 'unsafe-inline'",
              // Connexions API : Supabase + Spotify API + YouTube oEmbed
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.spotify.com https://accounts.spotify.com https://www.youtube.com https://*.spotify.com wss://*.spotify.com https://apresolve.spotify.com https://*.apresolve.spotify.com https://*.twitch.tv wss://*.twitch.tv",
              // Médias (audio Spotify SDK)
              "media-src 'self' blob: https://*.scdn.co https://*.spotifycdn.com",
              // Workers Spotify SDK
              "worker-src 'self' blob:",
              // Pas de framing de notre app par des sites tiers
              "frame-ancestors 'none'",
              // Forcer HTTPS
              "upgrade-insecure-requests",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
