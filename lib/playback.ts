"use client";

// Lecture d'une playlist locale : on charge ses titres dans la File d'attente
// (remplacement, sémantique Spotify) puis on passe en mode file — la session
// joue alors via la file maison existante (shuffle/loop/recos de fin inclus),
// sans aucune modification de app/session/page.tsx.

import { useQueueStore, QueueItem } from "@/store/queueStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { useLocalPlaylistStore } from "@/store/localPlaylistStore";
import { toast } from "@/components/Toast";

/**
 * Prépare la lecture d'une playlist locale. Retourne true si prête —
 * l'appelant fait alors `router.push("/settings")`.
 */
export function playLocalPlaylist(playlistId: string): boolean {
  const playlist = useLocalPlaylistStore.getState().playlists.find((p) => p.id === playlistId);
  if (!playlist || playlist.tracks.length === 0) return false;

  const hadQueue = useQueueStore.getState().items.length > 0;
  const items: QueueItem[] = playlist.tracks.map((t) => ({
    id: crypto.randomUUID(),
    youtubeId: t.youtubeId,
    title: t.title,
    channelName: t.channelName,
    thumbnailUrl: t.thumbnailUrl ?? `https://img.youtube.com/vi/${t.youtubeId}/mqdefault.jpg`,
  }));
  useQueueStore.setState({ items });

  useSpotifyStore.getState().selectPlaylist(null);
  useTwitchStore.getState().clear();
  useSessionStore.getState().selectQueue();

  toast({
    title: `Lecture de « ${playlist.name} »`,
    description: hadQueue ? "La file d'attente a été remplacée." : `${items.length} titre${items.length > 1 ? "s" : ""} dans la file.`,
    accent: "emerald",
  });
  return true;
}
