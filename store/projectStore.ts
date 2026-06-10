"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { localToday } from "@/store/statsStore";

export interface Project {
  id: string;
  name: string;
  color: string;
  deadline: string | null; // YYYY-MM-DD
  pomodoroBudget: number;   // total pomodoros targeted
  pomodorosDone: number;
  createdAt: string;        // YYYY-MM-DD
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;

  addProject: (p: Pick<Project, "name" | "color" | "deadline" | "pomodoroBudget">) => void;
  updateProject: (id: string, fields: Partial<Omit<Project, "id" | "createdAt">>) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  logPomodoro: (id?: string) => void; // increments active (or given) project
}

export const PROJECT_COLORS = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      addProject: (p) =>
        set((s) => ({
          projects: [
            ...s.projects,
            { ...p, id: crypto.randomUUID(), pomodorosDone: 0, createdAt: localToday() },
          ],
        })),

      updateProject: (id, fields) =>
        set((s) => ({ projects: s.projects.map((x) => (x.id === id ? { ...x, ...fields } : x)) })),

      removeProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((x) => x.id !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        })),

      setActiveProject: (id) => set({ activeProjectId: id }),

      logPomodoro: (id) => {
        const target = id ?? get().activeProjectId;
        if (!target) return;
        set((s) => ({
          projects: s.projects.map((x) => (x.id === target ? { ...x, pomodorosDone: x.pomodorosDone + 1 } : x)),
        }));
      },
    }),
    { name: "focusflow-projects" }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export interface ProjectStatus {
  pct: number;            // 0..1 completion
  pomodorosLeft: number;
  daysLeft: number | null;
  perDayNeeded: number | null;
  onTrack: boolean;
  overdue: boolean;
}

export function getProjectStatus(p: Project): ProjectStatus {
  const pomodorosLeft = Math.max(0, p.pomodoroBudget - p.pomodorosDone);
  const pct = p.pomodoroBudget > 0 ? Math.min(1, p.pomodorosDone / p.pomodoroBudget) : 0;

  let daysLeft: number | null = null;
  let perDayNeeded: number | null = null;
  let overdue = false;

  if (p.deadline) {
    const today = new Date(localToday() + "T00:00:00");
    const dl = new Date(p.deadline + "T00:00:00");
    const diff = Math.round((dl.getTime() - today.getTime()) / 86_400_000);
    daysLeft = diff;
    overdue = diff < 0 && pomodorosLeft > 0;
    const usableDays = Math.max(1, diff + 1); // include today
    perDayNeeded = pomodorosLeft > 0 ? Math.ceil(pomodorosLeft / usableDays) : 0;
  }

  // "On track" = if done >= expected progress given elapsed time toward deadline.
  let onTrack = true;
  if (p.deadline && daysLeft !== null && p.pomodoroBudget > 0) {
    const start = new Date(p.createdAt + "T00:00:00").getTime();
    const end = new Date(p.deadline + "T00:00:00").getTime();
    const now = new Date(localToday() + "T00:00:00").getTime();
    const span = Math.max(1, end - start);
    const elapsedFrac = Math.min(1, Math.max(0, (now - start) / span));
    onTrack = pct >= elapsedFrac - 0.05;
  }

  return { pct, pomodorosLeft, daysLeft, perDayNeeded, onTrack, overdue };
}
