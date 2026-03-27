"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Video, defaultVideos } from "@/data/videos";
import { getCurrentUserId } from "@/lib/authState";
import { upsertCustomVideo, deleteCustomVideo, upsertTodo, deleteTodo as dbDeleteTodo } from "@/lib/db";

export type TodoStatus = "todo" | "in-progress" | "done";

export interface Todo {
  id: string;
  text: string;
  status: TodoStatus;
  completedAt?: string; // local date "YYYY-MM-DD", set when marked done
}

interface SessionState {
  selectedVideoId: string | null;
  selectedPlaylistId: string | null;
  customVideos: Video[];
  todos: Todo[];

  // video
  selectVideo: (id: string) => void;
  selectPlaylist: (id: string) => void;
  addCustomVideo: (video: Video) => void;
  removeCustomVideo: (id: string) => void;
  getAllVideos: () => Video[];

  // todos
  addTodo: (text: string) => void;
  setTodoStatus: (id: string, status: TodoStatus) => void;
  deleteTodo: (id: string) => void;
  clearDone: () => void;
}

function localDate(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      selectedVideoId: "v1",
      selectedPlaylistId: null,
      customVideos: [],
      todos: [],

      selectVideo: (id) => set({ selectedVideoId: id, selectedPlaylistId: null }),
      selectPlaylist: (id) => set({ selectedPlaylistId: id, selectedVideoId: null }),

      addCustomVideo: (video) => {
        const { customVideos } = get();
        if (customVideos.some((v) => v.youtubeId === video.youtubeId)) return;
        set({ customVideos: [...customVideos, video] });
        const userId = getCurrentUserId();
        if (userId) {
          upsertCustomVideo(userId, video);
        } else {
          console.warn("[sessionStore] addCustomVideo: pas de userId, write DB ignoré");
        }
      },

      removeCustomVideo: (id) => {
        const { customVideos, selectedVideoId } = get();
        set({
          customVideos: customVideos.filter((v) => v.id !== id),
          selectedVideoId: selectedVideoId === id ? "v1" : selectedVideoId,
        });
        const userId = getCurrentUserId();
        if (userId) deleteCustomVideo(userId, id);
      },

      getAllVideos: () => {
        const { customVideos } = get();
        return [...defaultVideos, ...customVideos];
      },

      addTodo: (text) => {
        const todo: Todo = { id: crypto.randomUUID(), text, status: "todo" };
        set((s) => ({ todos: [...s.todos, todo] }));
        const userId = getCurrentUserId();
        if (userId) upsertTodo(userId, todo);
      },

      setTodoStatus: (id, status) => {
        const { todos } = get();
        const updated = todos.map((t) =>
          t.id === id
            ? { ...t, status, completedAt: status === "done" ? localDate() : undefined }
            : t
        );
        set({ todos: updated });
        const todo = updated.find((t) => t.id === id);
        const userId = getCurrentUserId();
        if (todo && userId) upsertTodo(userId, todo);
      },

      deleteTodo: (id) => {
        set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
        const userId = getCurrentUserId();
        if (userId) dbDeleteTodo(userId, id);
      },

      clearDone: () => {
        set((s) => ({ todos: s.todos.filter((t) => t.status !== "done") }));
      },
    }),
    {
      name: "focusflow-session",
      partialize: (state) => ({
        selectedVideoId: state.selectedVideoId,
        selectedPlaylistId: state.selectedPlaylistId,
        customVideos: state.customVideos,
        todos: state.todos,
      }),
    }
  )
);
