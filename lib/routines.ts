"use client";

import { useTimerStore } from "@/store/timerStore";
import { useSoundscapeStore } from "@/store/soundscapeStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import type { SoundscapeId } from "@/lib/soundscapes";
import type { Routine } from "@/store/routineStore";

/**
 * Applies a saved routine to the live stores: timer durations, ambient mix, the
 * media selection and a fresh set of template tasks. The caller navigates to
 * /settings afterwards to review and start.
 */
export function applyRoutine(r: Routine) {
  // Timer
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

  // Ambiances
  const ss = useSoundscapeStore.getState();
  ss.reset();
  for (const [id, v] of Object.entries(r.soundscape)) {
    if (typeof v === "number") ss.setLayer(id as SoundscapeId, v);
  }

  // Media
  const session = useSessionStore.getState();
  useSpotifyStore.getState().selectPlaylist(null);
  useTwitchStore.getState().clear();
  if (r.media) {
    switch (r.media.kind) {
      case "video":
        session.selectVideo(r.media.ref);
        break;
      case "playlist":
        session.selectPlaylist(r.media.ref);
        break;
      case "spotify":
        session.selectVideo("v1");
        useSessionStore.setState({ selectedPlaylistId: null });
        useSpotifyStore.getState().selectPlaylist(r.media.ref);
        break;
      case "twitch-channel":
        session.selectVideo("v1");
        useSessionStore.setState({ selectedPlaylistId: null });
        useTwitchStore.getState().selectChannel(r.media.ref);
        break;
      case "twitch-vod":
        session.selectVideo("v1");
        useSessionStore.setState({ selectedPlaylistId: null });
        useTwitchStore.getState().selectVod(r.media.ref);
        break;
    }
  }

  // Template tasks (skip ones already present)
  const existing = new Set(session.todos.map((t) => t.text.toLowerCase()));
  for (const text of r.tasks) {
    if (text.trim() && !existing.has(text.trim().toLowerCase())) session.addTodo(text.trim());
  }
}

/** Captures the current live setup into a routine draft (minus id/name/emoji). */
export function captureCurrentRoutine(): Omit<Routine, "id" | "name" | "emoji"> {
  const { settings } = useTimerStore.getState();
  const { layers } = useSoundscapeStore.getState();
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
    soundscape: { ...layers },
    tasks: todos.filter((t) => t.status !== "done").map((t) => t.text),
    media,
  };
}
