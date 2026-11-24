"use client";

// « Lancer en une phrase » : lit les stores pour construire le contexte de
// `parseQuickLaunch`, puis applique un plan (lib/launchPlan.ts) et ouvre
// directement /session, comme le « Go » du sprint et les routines.

import { defaultVideos } from "@/data/videos";
import type { QuickLaunch } from "@/lib/quickLaunch";
import { buildContextFrom, resolveLaunch, type LaunchContext, type MediaRef } from "@/lib/launchPlan";
import { closeActiveSession } from "@/lib/sessionEnd";
import { playLocalPlaylist } from "@/lib/playback/local";
import { useTimerStore } from "@/store/timerStore";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaylistStore, fetchPlaylistMeta } from "@/store/playlistStore";
import { useLocalPlaylistStore } from "@/store/localPlaylistStore";
import { usePlayHistoryStore } from "@/store/playHistoryStore";
import { useQueueStore, fetchVideoMeta } from "@/store/queueStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { useNotesStore } from "@/store/notesStore";
import { RADIO_NAME } from "@/lib/radioProgram";

/** Contexte d'analyse : tâches, médias (clés stables `kind:id`) et état courant. */
export function buildQuickContext(): LaunchContext {
  const session = useSessionStore.getState();
  const spotify = useSpotifyStore.getState();
  const twitch = useTwitchStore.getState();
  const timer = useTimerStore.getState();
  const playlists = usePlaylistStore.getState().playlists;

  let currentMediaTitle: string | undefined;
  if (spotify.selectedPlaylistUri && spotify.accessToken) {
    currentMediaTitle = spotify.playlists.find((p) => p.uri === spotify.selectedPlaylistUri)?.name ?? "Playlist Spotify";
  } else if (twitch.selectedVodId) currentMediaTitle = `VOD ${twitch.selectedVodId}`;
  else if (twitch.selectedChannel) currentMediaTitle = twitch.selectedChannel;
  else if (session.playRadio) currentMediaTitle = RADIO_NAME;
  else if (session.playQueue && useQueueStore.getState().items.length) currentMediaTitle = "File d'attente";
  else if (session.selectedPlaylistId) currentMediaTitle = playlists.find((p) => p.id === session.selectedPlaylistId)?.title;
  else if (session.selectedVideoId) currentMediaTitle = session.getAllVideos().find((v) => v.id === session.selectedVideoId)?.title;

  return buildContextFrom({
    todos: session.todos.map((t) => ({ id: t.id, text: t.text, status: t.status })),
    catalogue: defaultVideos,
    custom: session.customVideos,
    playlists,
    localPlaylists: useLocalPlaylistStore.getState().playlists,
    history: usePlayHistoryStore.getState().entries,
    env: {
      timer: timer.settings,
      sessionActive: timer.active,
      currentMediaTitle,
      spotify: {
        connected: !!spotify.accessToken,
        selectedUri: spotify.selectedPlaylistUri,
        playlists: spotify.playlists.map((p) => ({ uri: p.uri, name: p.name, imageUrl: p.imageUrl })),
      },
      twitch: {
        selectedChannel: twitch.selectedChannel,
        selectedVodId: twitch.selectedVodId,
        followed: twitch.followedChannels.map((c) => c.login),
      },
    },
  });
}

/** Média prêt à sélectionner (les liens collés ont été ajoutés à la bibliothèque). */
export type SelectableMedia = Exclude<MediaRef, { type: "youtube" } | { type: "yt-playlist-url" }>;

/**
 * Sélectionne un média dans les stores, en coupant les autres sources.
 * Partagé par les routines, le sprint et le lancement en une phrase.
 */
export function selectMedia(ref: SelectableMedia): void {
  const session = useSessionStore.getState();
  const spotify = useSpotifyStore.getState();
  const twitch = useTwitchStore.getState();
  if (ref.type === "local") {
    playLocalPlaylist(ref.id); // coupe lui-même Spotify/Twitch
    return;
  }
  spotify.selectPlaylist(null);
  twitch.clear();
  switch (ref.type) {
    case "video":
      session.selectVideo(ref.id);
      break;
    case "yt-playlist":
      session.selectPlaylist(ref.id);
      break;
    case "current-youtube":
      break;
    case "spotify":
      session.selectVideo(defaultVideos[0].id);
      useSessionStore.setState({ selectedPlaylistId: null });
      spotify.selectPlaylist(ref.uri);
      break;
    case "twitch-channel":
      session.selectVideo(defaultVideos[0].id);
      useSessionStore.setState({ selectedPlaylistId: null });
      twitch.selectChannel(ref.login);
      break;
    case "twitch-vod":
      session.selectVideo(defaultVideos[0].id);
      useSessionStore.setState({ selectedPlaylistId: null });
      twitch.selectVod(ref.id);
      break;
  }
}

/** Délai de l'oEmbed, combiné à l'annulation du lancement : la requête est vraiment abandonnée. */
function metaSignal(cancel?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(2500);
  return cancel && typeof AbortSignal.any === "function" ? AbortSignal.any([timeout, cancel]) : timeout;
}

/** Ajoute à la bibliothèque ce qui vient d'un lien collé ou de l'historique seul. */
async function materialize(ref: MediaRef, cancel?: AbortSignal): Promise<SelectableMedia | null> {
  if (ref.type === "youtube") {
    const byYoutubeId = () => useSessionStore.getState().getAllVideos().find((v) => v.youtubeId === ref.youtubeId);
    const existing = byYoutubeId();
    if (existing) return { type: "video", id: existing.id };
    const meta = ref.title ? {} : await fetchVideoMeta(ref.youtubeId, metaSignal(cancel));
    if (cancel?.aborted) return null;
    useSessionStore.getState().addCustomVideo({
      id: `custom-${Date.now()}`,
      title: ref.title ?? meta.title ?? "Vidéo YouTube",
      channel: ref.channel ?? meta.channelName ?? "Ma vidéo",
      youtubeId: ref.youtubeId,
      mood: "lofi",
      color: "#1a1a2e",
      custom: true,
    });
    // addCustomVideo ignore les doublons : on relit l'id réellement enregistré.
    const saved = byYoutubeId();
    return saved ? { type: "video", id: saved.id } : null;
  }
  if (ref.type === "yt-playlist-url") {
    const find = () => usePlaylistStore.getState().playlists.find((p) => p.playlistId === ref.listId);
    if (!find()) {
      const url = `https://www.youtube.com/playlist?list=${ref.listId}`;
      const meta = ref.title ? {} : await fetchPlaylistMeta(url, metaSignal(cancel));
      if (cancel?.aborted) return null;
      usePlaylistStore.getState().addPlaylist({
        playlistId: ref.listId,
        startVideoId: ref.startVideoId,
        title: ref.title ?? meta.title ?? "Playlist YouTube",
        channelName: meta.channelName,
        thumbnailUrl: meta.thumbnailUrl,
      });
    }
    const saved = find();
    return saved ? { type: "yt-playlist", id: saved.id } : null;
  }
  return ref;
}

export type LaunchOutcome = { ok: true } | { ok: false; message: string };

/**
 * Applique une phrase analysée : clôt la session active, règle le minuteur,
 * met la tâche en cours, sélectionne le média et ouvre /session.
 */
export async function launchFromQuick(
  result: QuickLaunch,
  router: { push: (href: string) => void },
  ctx: LaunchContext = buildQuickContext(),
  /** Palette fermée pendant le lancement : rien n'est appliqué. */
  signal?: AbortSignal,
): Promise<LaunchOutcome> {
  const plan = resolveLaunch(result, ctx);
  if (plan.error) return { ok: false, message: plan.error };
  if (!plan.launchable) return { ok: false, message: "Précise la tâche ou la musique avant de lancer." };

  if (plan.intent === "resume-session") {
    router.push("/session");
    return { ok: true };
  }

  // Média d'abord : un lien qui échoue ne doit pas couper la session en cours.
  const media = plan.media?.ref ? await materialize(plan.media.ref, signal) : null;
  if (signal?.aborted) return { ok: false, message: "Lancement annulé." };
  if (plan.media?.ref && !media) return { ok: false, message: "Ce média n'a pas pu être ajouté à ta bibliothèque." };

  closeActiveSession();
  const timer = useTimerStore.getState();
  if (!plan.timer.keep) {
    if (plan.timer.preset === "custom" && plan.timer.settings) timer.updateSettings(plan.timer.settings);
    else timer.applyPreset(plan.timer.preset);
  }
  timer.resetAll();

  if (media) selectMedia(media);

  const session = useSessionStore.getState();
  if (plan.todo && plan.todo.status !== "in-progress") session.setTodoStatus(plan.todo.id, "in-progress");
  session.clearDone();
  useNotesStore.getState().clearAll();

  router.push("/session");
  return { ok: true };
}

/** « Relancer comme la dernière fois » : dernier média écouté, rythme courant. */
export const RELAUNCH_LAST: QuickLaunch = { intent: "relaunch-last", confidence: 1 };
