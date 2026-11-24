"use client";

import { useTimerStore } from "@/store/timerStore";
import { closeActiveSession } from "@/lib/sessionEnd";
import { useSessionStore } from "@/store/sessionStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { selectMedia } from "@/lib/launch";
import type { Routine } from "@/store/routineStore";

/**
 * Applies a saved routine to the live stores: timer durations, the media
 * selection and a fresh set of template tasks. The caller navigates to
 * /settings afterwards to review and start.
 */
export function applyRoutine(r: Routine) {
  // Timer
  closeActiveSession();
  const timer = useTimerStore.getState();
  if (r.preset !== "custom") {
    timer.applyPreset(r.preset);
  } else {
    timer.updateSettings({
      workDuration: r.workDuration,
      shortBreakDuration: r.shortBreakDuration,
      longBreakDuration: r.longBreakDuration,
      sessionsBeforeLongBreak: r.sessionsBeforeLongBreak,
    });
  }

  // Media
  const session = useSessionStore.getState();
  if (r.media) {
    const { kind, ref } = r.media;
    selectMedia(
      kind === "video" ? { type: "video", id: ref }
      : kind === "playlist" ? { type: "yt-playlist", id: ref }
      : kind === "spotify" ? { type: "spotify", uri: ref }
      : kind === "twitch-channel" ? { type: "twitch-channel", login: ref }
      : { type: "twitch-vod", id: ref }
    );
  } else {
    useSpotifyStore.getState().selectPlaylist(null);
    useTwitchStore.getState().clear();
  }

  // Template tasks (skip ones already present)
  const existing = new Set(session.todos.map((t) => t.text.toLowerCase()));
  for (const text of r.tasks) {
    if (text.trim() && !existing.has(text.trim().toLowerCase())) session.addTodo(text.trim());
  }
}

/** Captures the current live setup into a routine draft (minus id/name/color). */
export function captureCurrentRoutine(): Omit<Routine, "id" | "name" | "color"> {
  const { settings } = useTimerStore.getState();
  const { todos, selectedVideoId, selectedPlaylistId } = useSessionStore.getState();
  const { selectedPlaylistUri } = useSpotifyStore.getState();
  const { selectedChannel, selectedVodId } = useTwitchStore.getState();

  let media: Routine["media"];
  if (selectedPlaylistUri) media = { kind: "spotify", ref: selectedPlaylistUri };
  else if (selectedVodId) media = { kind: "twitch-vod", ref: selectedVodId };
  else if (selectedChannel) media = { kind: "twitch-channel", ref: selectedChannel };
  else if (selectedPlaylistId) media = { kind: "playlist", ref: selectedPlaylistId };
  else if (selectedVideoId) media = { kind: "video", ref: selectedVideoId };

  return {
    preset: settings.preset,
    workDuration: settings.workDuration,
    shortBreakDuration: settings.shortBreakDuration,
    longBreakDuration: settings.longBreakDuration,
    sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
    tasks: todos.filter((t) => t.status !== "done").map((t) => t.text),
    media,
  };
}
