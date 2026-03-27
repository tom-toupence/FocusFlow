"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

interface NotesState {
  notes: StickyNote[];
  addNote: () => void;
  updateNote: (id: string, patch: Partial<Omit<StickyNote, "id">>) => void;
  removeNote: (id: string) => void;
  clearAll: () => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],

      addNote: () => {
        const note: StickyNote = {
          id: crypto.randomUUID(),
          text: "",
          x: 80 + Math.random() * 160,
          y: 80 + Math.random() * 160,
          color: "#fef08a",
        };
        set((s) => ({ notes: [...s.notes, note] }));
      },

      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),

      removeNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      clearAll: () => set({ notes: [] }),
    }),
    { name: "focusflow-notes" }
  )
);
