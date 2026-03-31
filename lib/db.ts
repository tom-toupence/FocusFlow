/**
 * Database helpers — all operations are no-ops when Supabase is not configured.
 * Stores call these functions; they fall through silently in localStorage-only mode.
 */

import { supabase } from "./supabase";
import type { Video } from "@/data/videos";
import type { Todo } from "@/store/sessionStore";
import type { SavedPlaylist } from "@/store/playlistStore";

// ─── Custom Videos ────────────────────────────────────────────────────────────

export async function fetchCustomVideos(userId: string): Promise<Video[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("custom_videos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) { console.error("[db] fetchCustomVideos:", error.message); return []; }
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    channel: r.channel,
    youtubeId: r.youtube_id,
    mood: r.mood,
    color: r.color,
    custom: true,
  }));
}

export async function upsertCustomVideo(userId: string, video: Video): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("custom_videos").upsert({
    id: video.id,
    user_id: userId,
    title: video.title,
    channel: video.channel,
    youtube_id: video.youtubeId,
    mood: video.mood,
    color: video.color,
  });
  if (error) console.error("[db] upsertCustomVideo:", error.message);
}

export async function deleteCustomVideo(userId: string, videoId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("custom_videos").delete().eq("id", videoId).eq("user_id", userId);
}

// ─── Todos ────────────────────────────────────────────────────────────────────

export async function fetchTodos(userId: string): Promise<Todo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) { console.error("[db] fetchTodos:", error.message); return []; }
  return (data ?? []).map((r) => ({
    id: r.id,
    text: r.text,
    status: (r.status ?? (r.done ? "done" : "todo")) as "todo" | "in-progress" | "done",
    completedAt: r.completed_at ?? undefined,
    priority: (r.priority ?? "normal") as "urgent" | "normal" | "low",
    dueDate: r.due_date ?? undefined,
    pomodoroEstimate: r.pomodoro_estimate ?? 1,
    pomodorosUsed: r.pomodoros_used ?? 0,
    createdAt: r.created_at_local ?? undefined,
  }));
}

export async function upsertTodo(userId: string, todo: Todo): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("todos").upsert({
    id: todo.id,
    user_id: userId,
    text: todo.text,
    done: todo.status === "done",
    status: todo.status,
    completed_at: todo.completedAt ?? null,
    priority: todo.priority ?? "normal",
    due_date: todo.dueDate ?? null,
    pomodoro_estimate: todo.pomodoroEstimate ?? 1,
    pomodoros_used: todo.pomodorosUsed ?? 0,
    created_at_local: todo.createdAt ?? null,
  });
  if (error) console.error("[db] upsertTodo:", error.message);
}

export async function deleteTodo(userId: string, todoId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("todos").delete().eq("id", todoId).eq("user_id", userId);
}

// ─── User Playlists ───────────────────────────────────────────────────────────

export async function fetchPlaylists(userId: string): Promise<SavedPlaylist[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("user_playlists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) { console.error("[db] fetchPlaylists:", error.message); return []; }
  return (data ?? []).map((r) => ({
    id: r.id,
    playlistId: r.playlist_id,
    startVideoId: r.start_video_id ?? undefined,
    title: r.title,
    channelName: r.channel_name ?? undefined,
    thumbnailUrl: r.thumbnail_url ?? undefined,
  }));
}

export async function upsertPlaylist(userId: string, playlist: SavedPlaylist): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("user_playlists").upsert({
    id: playlist.id,
    user_id: userId,
    playlist_id: playlist.playlistId,
    start_video_id: playlist.startVideoId ?? null,
    title: playlist.title,
    channel_name: playlist.channelName ?? null,
    thumbnail_url: playlist.thumbnailUrl ?? null,
  });
  if (error) console.error("[db] upsertPlaylist:", error.message);
}

export async function deletePlaylist(userId: string, playlistId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("user_playlists").delete().eq("id", playlistId).eq("user_id", userId);
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface DbProfile {
  displayName: string | null;
  avatarData: string | null;
}

export async function fetchProfile(userId: string): Promise<DbProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_data")
    .eq("id", userId)
    .single();
  if (error) return null; // row may not exist yet
  return { displayName: data.display_name ?? null, avatarData: data.avatar_data ?? null };
}

export async function upsertProfile(userId: string, profile: DbProfile): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    display_name: profile.displayName,
    avatar_data: profile.avatarData,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("[db] upsertProfile:", error.message);
}

// ─── Work Sessions (stats) ────────────────────────────────────────────────────

export async function fetchWorkSessions(userId: string): Promise<Record<string, { sessions: number; minutesWorked: number }>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("work_sessions")
    .select("date, sessions, minutes_worked")
    .eq("user_id", userId);
  if (error) { console.error("[db] fetchWorkSessions:", error.message); return {}; }
  const result: Record<string, { sessions: number; minutesWorked: number }> = {};
  for (const r of data ?? []) {
    result[r.date] = { sessions: r.sessions, minutesWorked: r.minutes_worked };
  }
  return result;
}

export async function upsertWorkSession(
  userId: string,
  date: string,
  sessions: number,
  minutesWorked: number
): Promise<void> {
  if (!supabase) return;
  await supabase.from("work_sessions").upsert(
    { user_id: userId, date, sessions, minutes_worked: minutesWorked },
    { onConflict: "user_id,date" }
  );
}
