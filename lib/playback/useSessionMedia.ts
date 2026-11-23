"use client";
// Ce que la session doit jouer, décrit une seule fois (phase 8, suite). La page
// de session ne connaît plus les sources : ce hook lit les stores, résout les
// mixes radio et les playlists YouTube, et rend une description neutre.
//   . `kind`     : quelle famille d'adaptateur monter ;
//   . `youtube`  : la source YouTube (vidéo, file maison, repli natif) ;
//   . `external` : lien « ouvrir chez la source » (Twitch) ;
//   . `playEntry`: l'entrée d'historique de lecture, quelle que soit la source.
import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaylistStore, isRadioMix, fetchMixVideos, fetchPlaylistVideos } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import type { PlayEntry } from "@/store/playHistoryStore";
import type { VideoMood as Mood } from "@/data/videos";
import { toast } from "@/components/Toast";
import { localToday } from "@/store/statsStore";
import type { SourceKind } from "./types";
import type { YouTubeSource } from "./youtube";

type Tracks = { id: string; title: string }[];

export interface SessionMedia {
  kind: SourceKind;
  /** null : source YouTube en cours de résolution (ou autre source). */
  youtube: YouTubeSource | null;
  spotify: { playlistUri: string } | null;
  twitch: { channel?: string; vodId?: string; token?: string } | null;
  /** Ouvrir le contenu chez la source (repli abonnés Twitch). */
  external: { href: string; label: string } | null;
  /** Ambiance de la vidéo du catalogue (vidéo seule), pour l'égaliseur. */
  mood?: Mood;
  /** Entrée d'historique de lecture pour `minutes` écoutées. */
  playEntry: (minutes: number) => Omit<PlayEntry, "id">;
}

export function useSessionMedia(): SessionMedia {
  const { selectedVideoId, selectedPlaylistId, playQueue, getAllVideos } = useSessionStore();
  const { playlists } = usePlaylistStore();
  const { items: queueItems } = useQueueStore();
  const { selectedPlaylistUri, accessToken, playlists: spotifyPlaylists } = useSpotifyStore();
  const { selectedChannel, selectedVodId, accessToken: twitchToken } = useTwitchStore();

  const allVideos = getAllVideos();
  const video = allVideos.find((v) => v.id === selectedVideoId) ?? allVideos[0];
  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) ?? null;
  const isQueue = playQueue && queueItems.length > 0;
  const isPlaylist = !isQueue && !!selectedPlaylist;
  const isMix = isPlaylist && isRadioMix(selectedPlaylist.playlistId);
  const kind: SourceKind = selectedPlaylistUri && accessToken ? "spotify" : selectedChannel || selectedVodId ? "twitch" : "youtube";

  // Mix radio RD… résolu en pistes (null = en cours). Les radios ne sont pas
  // embarquables : on les joue comme une file maison ; repli vidéo de départ.
  const [mixTracks, setMixTracks] = useState<Tracks | null>(null);
  useEffect(() => {
    if (kind !== "youtube" || !isMix || !selectedPlaylist) return;
    let cancelled = false;
    void (async () => {
      const { ids, titles } = await fetchMixVideos(selectedPlaylist.playlistId, selectedPlaylist.startVideoId);
      if (cancelled) return;
      if (ids.length > 0) { setMixTracks(ids.map((id) => ({ id, title: titles[id] ?? "Titre" }))); return; }
      const sv = selectedPlaylist.startVideoId;
      setMixTracks(sv ? [{ id: sv, title: selectedPlaylist.title }] : []);
      toast({ title: "Mix YouTube indisponible", description: "Lecture de la vidéo de départ en boucle.", accent: "amber" });
    })();
    return () => { cancelled = true; };
  }, [kind, isMix, selectedPlaylist?.playlistId, selectedPlaylist?.startVideoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vraie playlist PL… résolue côté serveur ([] = échec → lecteur natif).
  // Les titres ajoutés par l'utilisateur (« extras ») sont joués à la suite.
  const [playlistTracks, setPlaylistTracks] = useState<Tracks | null>(null);
  useEffect(() => {
    if (kind !== "youtube" || !isPlaylist || isMix || !selectedPlaylist) return;
    let cancelled = false;
    void (async () => {
      const videos = await fetchPlaylistVideos(selectedPlaylist.playlistId, selectedPlaylist.startVideoId);
      if (cancelled) return;
      const extras = (selectedPlaylist.extraVideos ?? []).filter((e) => !videos.some((v) => v.id === e.id));
      setPlaylistTracks(videos.length > 0 ? [...videos, ...extras] : extras);
    })();
    return () => { cancelled = true; };
  }, [kind, isPlaylist, isMix, selectedPlaylist?.playlistId]); // eslint-disable-line react-hooks/exhaustive-deps

  const youtube: YouTubeSource | null = (() => {
    if (kind !== "youtube") return null;
    if (isQueue) return { type: "queue", subtitle: "File FocusFlow", tracks: queueItems.map((i) => ({ id: i.youtubeId, title: i.title })) };
    if (isPlaylist) {
      const tracks = isMix ? mixTracks : playlistTracks;
      if (tracks === null) return null; // résolution en cours
      if (tracks.length) return { type: "queue", subtitle: selectedPlaylist.title || "Mix radio", tracks };
      return isMix ? null : { type: "native", listId: selectedPlaylist.playlistId, title: selectedPlaylist.title };
    }
    return video ? { type: "video", id: video.youtubeId, title: video.title, subtitle: video.channel } : null;
  })();

  const twitchHref = selectedVodId ? `https://www.twitch.tv/videos/${selectedVodId}` : `https://www.twitch.tv/${selectedChannel}`;

  const playEntry = (minutes: number): Omit<PlayEntry, "id"> => {
    const base = { date: localToday(), timestamp: Date.now(), minutes };
    if (kind === "spotify") {
      const pl = spotifyPlaylists.find((p) => p.uri === selectedPlaylistUri);
      return { ...base, type: "spotify", title: pl?.name ?? "Playlist Spotify", subtitle: `${pl?.trackCount ?? 0} titres`, thumbnailUrl: pl?.imageUrl, mediaKey: selectedPlaylistUri ?? "spotify" };
    }
    if (kind === "twitch") {
      if (selectedVodId) return { ...base, type: "twitch-vod", title: `VOD ${selectedVodId}`, subtitle: "Twitch VOD", mediaKey: `vod:${selectedVodId}` };
      return { ...base, type: "twitch-live", title: selectedChannel ?? "Twitch", subtitle: "Live Twitch", mediaKey: `live:${selectedChannel}` };
    }
    if (isQueue) return { ...base, type: "playlist", title: "File FocusFlow", subtitle: `${queueItems.length} titre${queueItems.length > 1 ? "s" : ""}`, thumbnailUrl: queueItems[0]?.thumbnailUrl, mediaKey: "queue" };
    if (isPlaylist) return { ...base, type: "playlist", title: selectedPlaylist.title, subtitle: selectedPlaylist.channelName ?? "YouTube Playlist", thumbnailUrl: selectedPlaylist.thumbnailUrl, mediaKey: `pl:${selectedPlaylist.playlistId}` };
    return { ...base, type: "youtube", title: video.title, subtitle: video.channel, thumbnailUrl: `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`, mediaKey: video.youtubeId };
  };

  return {
    kind,
    youtube,
    spotify: kind === "spotify" ? { playlistUri: selectedPlaylistUri! } : null,
    twitch: kind === "twitch" ? { channel: selectedChannel ?? undefined, vodId: selectedVodId ?? undefined, token: twitchToken ?? undefined } : null,
    external: kind === "twitch" ? { href: twitchHref, label: "Ouvrir sur Twitch" } : null,
    mood: kind === "youtube" && !isQueue && !isPlaylist ? video?.mood : undefined,
    playEntry,
  };
}
