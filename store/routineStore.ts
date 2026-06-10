"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TimerPreset } from "@/store/timerStore";
import type { SoundscapeId } from "@/lib/soundscapes";

export interface RoutineMedia {
  kind: "video" | "playlist" | "spotify" | "twitch-channel" | "twitch-vod";
  ref: string; // videoId / playlistId / spotify uri / channel login / vod id
  label?: string;
}

export interface Routine {
  id: string;
  name: string;
  emoji: string;
  preset: TimerPreset;
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  soundscape: Partial<Record<SoundscapeId, number>>;
  tasks: string[];
  media?: RoutineMedia;
}

interface RoutineState {
  routines: Routine[];
  addRoutine: (r: Omit<Routine, "id">) => void;
  removeRoutine: (id: string) => void;
  renameRoutine: (id: string, name: string) => void;
}

export const useRoutineStore = create<RoutineState>()(
  persist(
    (set) => ({
      routines: [],
      addRoutine: (r) => set((s) => ({ routines: [...s.routines, { ...r, id: crypto.randomUUID() }] })),
      removeRoutine: (id) => set((s) => ({ routines: s.routines.filter((x) => x.id !== id) })),
      renameRoutine: (id, name) => set((s) => ({ routines: s.routines.map((x) => (x.id === id ? { ...x, name } : x)) })),
    }),
    { name: "focusflow-routines" }
  )
);
