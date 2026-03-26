"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

interface SessionState {
  selectedVideoId: string | null;
  todos: Todo[];

  selectVideo: (id: string) => void;
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  clearDone: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      selectedVideoId: "lofi-girl",
      todos: [],

      selectVideo: (id) => set({ selectedVideoId: id }),

      addTodo: (text) => {
        const { todos } = get();
        set({
          todos: [
            ...todos,
            { id: crypto.randomUUID(), text, done: false },
          ],
        });
      },

      toggleTodo: (id) => {
        const { todos } = get();
        set({
          todos: todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        });
      },

      deleteTodo: (id) => {
        const { todos } = get();
        set({ todos: todos.filter((t) => t.id !== id) });
      },

      clearDone: () => {
        const { todos } = get();
        set({ todos: todos.filter((t) => !t.done) });
      },
    }),
    { name: "focusflow-session" }
  )
);
