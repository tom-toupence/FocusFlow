"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSessionStore } from "@/store/sessionStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { useTimerStore } from "@/store/timerStore";
import { useAmbientStore } from "@/store/ambientStore";
import { getVideoColor } from "@/data/videos";

const TWITCH_PURPLE = "#9146ff";
const SPOTIFY_GREEN = "#1db954";
const PLAYLIST_FALLBACK = "#3d4a6b";
const NEUTRAL = "#4a4a55";

/**
 * Résout la teinte d'ambiance depuis le média sélectionné (même règle de
 * priorité que la session : Twitch > Spotify > file/playlist > vidéo) et la
 * reflète sur <html> : var --ambient-raw + attribut data-ambient-phase.
 * Toute l'UI consomme ensuite var(--ambient) / var(--ambient-2) en CSS.
 * Rend null → aucun impact SSR/hydratation.
 */
export default function AmbientProvider() {
  const pathname = usePathname();
  // Sélecteurs fins : ce composant est monté globalement, il ne doit se
  // re-rendre que sur changement de média (pas sur todos/notes/etc.).
  const selectedVideoId = useSessionStore((s) => s.selectedVideoId);
  const selectedPlaylistId = useSessionStore((s) => s.selectedPlaylistId);
  const playQueue = useSessionStore((s) => s.playQueue);
  const getAllVideos = useSessionStore((s) => s.getAllVideos);
  const spotifyUri = useSpotifyStore((s) => s.selectedPlaylistUri);
  const spotifyToken = useSpotifyStore((s) => s.accessToken);
  const twitchChannel = useTwitchStore((s) => s.selectedChannel);
  const twitchVod = useTwitchStore((s) => s.selectedVodId);
  const mode = useTimerStore((s) => s.mode);

  let hex = NEUTRAL;
  if (twitchChannel || twitchVod) hex = TWITCH_PURPLE;
  else if (spotifyUri && spotifyToken) hex = SPOTIFY_GREEN;
  else if (playQueue || selectedPlaylistId) hex = PLAYLIST_FALLBACK;
  else {
    const all = getAllVideos();
    const video = all.find((v) => v.id === selectedVideoId) ?? all[0];
    if (video) hex = getVideoColor(video);
  }

  const phase = pathname === "/session" ? (mode !== "work" ? "break" : "work") : null;

  useEffect(() => {
    useAmbientStore.getState().setAmbient(hex, phase);
    const el = document.documentElement;
    el.style.setProperty("--ambient-raw", hex);
    if (phase) el.setAttribute("data-ambient-phase", phase);
    else el.removeAttribute("data-ambient-phase");
  }, [hex, phase]);

  // Onglet caché → data-tab-hidden met les animations d'ambiance en pause.
  useEffect(() => {
    const onVisibility = () => {
      const el = document.documentElement;
      if (document.hidden) el.setAttribute("data-tab-hidden", "");
      else el.removeAttribute("data-tab-hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return null;
}
