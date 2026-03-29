"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Video, defaultVideos } from "@/data/videos";
import { getCurrentUserId } from "@/lib/authState";
import { upsertCustomVideo, deleteCustomVideo, upsertTodo, deleteTodo as dbDeleteTodo } from "@/lib/db";

export type TodoStatus = "todo" | "in-progress" | "done";
export type TodoPriority = "urgent" | "normal" | "low";

export interface Todo {
  id: string;
  text: string;
  status: TodoStatus;
  completedAt?: string;   // YYYY-MM-DD
  createdAt?: string;     // YYYY-MM-DD
  priority?: TodoPriority;
  dueDate?: string;       // YYYY-MM-DD
  pomodoroEstimate?: number;
  pomodorosUsed?: number;
}

export interface AddTodoOptions {
  priority?: TodoPriority;
  dueDate?: string;
  pomodoroEstimate?: number;
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
  addTodo: (text: string, opts?: AddTodoOptions) => void;
  setTodoStatus: (id: string, status: TodoStatus) => void;
  updateTodo: (id: string, fields: Partial<Pick<Todo, "text" | "priority" | "dueDate" | "pomodoroEstimate">>) => void;
  incrementPomodoro: (id: string) => void;
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

      addTodo: (text, opts) => {
        const todo: Todo = {
          id: crypto.randomUUID(),
          text,
          status: "todo",
          createdAt: localDate(),
          priority: opts?.priority ?? "normal",
          dueDate: opts?.dueDate,
          pomodoroEstimate: opts?.pomodoroEstimate ?? 1,
          pomodorosUsed: 0,
        };
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

      updateTodo: (id, fields) => {
        const { todos } = get();
        const updated = todos.map((t) => t.id === id ? { ...t, ...fields } : t);
        set({ todos: updated });
        const todo = updated.find((t) => t.id === id);
        const userId = getCurrentUserId();
        if (todo && userId) upsertTodo(userId, todo);
      },

      incrementPomodoro: (id) => {
        const { todos } = get();
        const updated = todos.map((t) =>
          t.id === id ? { ...t, pomodorosUsed: (t.pomodorosUsed ?? 0) + 1 } : t
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
