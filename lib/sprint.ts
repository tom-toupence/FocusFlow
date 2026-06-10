"use client";

// Sprint mode: objective + deadline → day-by-day focus blocks, tasks, and a
// coach-picked music mood. AI plan via /api/coach (Groq → Gemini), with a
// local heuristic fallback so it always works at €0 / offline.

import { planTasks, totalPomodoros, type PlannedTask } from "@/lib/coach";
import { defaultVideos, type VideoMood } from "@/data/videos";
import { localToday } from "@/store/statsStore";
import { usePlanStore } from "@/store/planStore";
import { useSessionStore } from "@/store/sessionStore";
import { useTimerStore } from "@/store/timerStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { useNotesStore } from "@/store/notesStore";
import { useSprintStore, type Sprint } from "@/store/sprintStore";

export interface SprintDayPlan {
  date: string;
  startMin: number;
  durationMin: number;
  label: string;
}

export interface SprintPlan {
  days: SprintDayPlan[];
  tasks: PlannedTask[];
  mood: VideoMood;
  source: "ai" | "local";
}

// ── Local fallback ────────────────────────────────────────────────────────────

const MOOD_KEYWORDS: [VideoMood, string[]][] = [
  ["synthwave", ["cod", "développ", "developp", "programm", "bug", "api", "script", "tech"]],
  ["classical", ["révis", "examen", "concours", "partiel", "mémoris", "memoris", "math"]],
  ["jazz", ["écrir", "ecrir", "rédig", "redig", "rapport", "mémoire", "memoire", "article", "lettre"]],
  ["nature", ["lire", "lecture", "réfléch", "reflech", "créati", "creati", "dessin"]],
  ["ambience", ["design", "maquette", "présent", "present", "slide", "organis", "tri", "admin"]],
];

function pickMood(objective: string): VideoMood {
  const lower = objective.toLowerCase();
  for (const [mood, words] of MOOD_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return mood;
  }
  return "lofi";
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end && out.length < 60) {
    out.push([d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Heuristic plan: tasks via lib/coach, work spread evenly over the remaining days. */
export function localSprintPlan(
  objective: string,
  deadline: string,
  dailyMinutes: number,
  startMin: number
): SprintPlan {
  const tasks = planTasks(objective);
  const totalMinutes = totalPomodoros(tasks) * 30; // 25 min focus + breathing room
  const dates = eachDate(localToday(), deadline);

  // Spread: as many days as needed at dailyMinutes, spaced evenly across the range.
  const daysNeeded = Math.max(1, Math.min(dates.length, Math.ceil(totalMinutes / dailyMinutes)));
  const step = dates.length / daysNeeded;
  const days: SprintDayPlan[] = [];
  let taskIdx = 0;
  for (let i = 0; i < daysNeeded; i++) {
    const date = dates[Math.min(dates.length - 1, Math.floor(i * step))];
    const label = tasks[taskIdx]?.text ?? objective.slice(0, 60);
    taskIdx = Math.min(tasks.length - 1, taskIdx + 1);
    days.push({
      date,
      startMin,
      durationMin: Math.max(25, Math.min(180, dailyMinutes)),
      label: label.slice(0, 80),
    });
  }
  return { days, tasks, mood: pickMood(objective), source: "local" };
}

// ── AI plan with local fallback ───────────────────────────────────────────────

export async function requestSprintPlan(
  objective: string,
  deadline: string,
  dailyMinutes: number,
  startMin: number
): Promise<SprintPlan> {
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "sprint",
        objective,
        deadline,
        startDate: localToday(),
        dailyMinutes,
        startMin,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.days) && Array.isArray(data?.tasks)) {
        return { days: data.days, tasks: data.tasks, mood: data.mood as VideoMood, source: "ai" };
      }
    }
  } catch {
    // network error → local fallback
  }
  return localSprintPlan(objective, deadline, dailyMinutes, startMin);
}

// ── Apply / launch ────────────────────────────────────────────────────────────

/** Writes the validated plan into the stores (plan blocks + kanban tasks + sprint). */
export function applySprintPlan(
  plan: SprintPlan,
  objective: string,
  deadline: string,
  dailyMinutes: number,
  startMin: number
): Sprint {
  const planStore = usePlanStore.getState();
  const sessionStore = useSessionStore.getState();

  const blockIds = plan.days.map((d) =>
    planStore.addBlock({ date: d.date, startMin: d.startMin, durationMin: d.durationMin, label: `🏃 ${d.label}` })
  );

  const existing = new Set(sessionStore.todos.map((t) => t.text.toLowerCase()));
  const taskIds = plan.tasks
    .filter((t) => !existing.has(t.text.toLowerCase()))
    .map((t) => sessionStore.addTodo(t.text, { pomodoroEstimate: t.pomodoroEstimate }));

  const sprint: Sprint = {
    id: crypto.randomUUID(),
    objective,
    deadline,
    createdAt: localToday(),
    dailyMinutes,
    startMin,
    mood: plan.mood,
    blockIds,
    taskIds,
  };
  useSprintStore.getState().setSprint(sprint);
  return sprint;
}

/**
 * "Go" button: applies the sprint media (a catalogue video matching the coach's
 * mood) and the timer preset, then the caller navigates to /session.
 */
export function launchSprintSession(sprint: Sprint, blockDurationMin?: number): void {
  // Media: random curated video in the sprint mood
  const candidates = defaultVideos.filter((v) => v.mood === sprint.mood);
  const video = candidates[Math.floor(Math.random() * candidates.length)] ?? defaultVideos[0];
  useSpotifyStore.getState().selectPlaylist(null);
  useTwitchStore.getState().clear();
  useSessionStore.getState().selectVideo(video.id);

  // Timer: deep blocks get the 50/10 preset, shorter ones the classic 25/5
  const timer = useTimerStore.getState();
  timer.applyPreset((blockDurationMin ?? 50) >= 50 ? "deep" : "classic");
  timer.resetAll();

  useSessionStore.getState().clearDone();
  useNotesStore.getState().clearAll();
}

/**
 * Re-plans the remaining work: removes future (and missed) undone sprint blocks,
 * then redistributes the unfinished tasks' pomodoros from today to the deadline.
 */
export function recalcSprint(sprint: Sprint): Sprint {
  const planStore = usePlanStore.getState();
  const { todos } = useSessionStore.getState();
  const today = localToday();
  const ids = new Set(sprint.blockIds);

  // Keep completed blocks; drop pending ones (missed or future) to re-plan them.
  const keep: string[] = [];
  for (const b of planStore.blocks) {
    if (!ids.has(b.id)) continue;
    if (b.done) keep.push(b.id);
    else planStore.removeBlock(b.id);
  }

  // Remaining work from the sprint's unfinished tasks
  const sprintTasks = todos.filter((t) => sprint.taskIds.includes(t.id) && t.status !== "done");
  const remainingPoms = sprintTasks.reduce(
    (s, t) => s + Math.max(1, (t.pomodoroEstimate ?? 1) - (t.pomodorosUsed ?? 0)),
    0
  );
  const objectiveForPlan = sprintTasks.map((t) => t.text).join("\n") || sprint.objective;
  const plan = localSprintPlan(objectiveForPlan, sprint.deadline, sprint.dailyMinutes, sprint.startMin);
  // Scale the replanned days to the remaining workload
  const daysNeeded = Math.max(1, Math.ceil((remainingPoms * 30) / sprint.dailyMinutes));
  const futureDates = eachDate(today, sprint.deadline);
  const days = plan.days.slice(0, Math.min(daysNeeded, futureDates.length));

  const newIds = days.map((d) =>
    planStore.addBlock({ date: d.date, startMin: d.startMin, durationMin: d.durationMin, label: `🏃 ${d.label}` })
  );

  const updated: Sprint = { ...sprint, blockIds: [...keep, ...newIds] };
  useSprintStore.getState().setSprint(updated);
  return updated;
}

/** Ends the sprint: clears it and removes its future undone blocks from the plan. */
export function endSprint(sprint: Sprint): void {
  const planStore = usePlanStore.getState();
  const ids = new Set(sprint.blockIds);
  for (const b of planStore.blocks) {
    if (ids.has(b.id) && !b.done) planStore.removeBlock(b.id);
  }
  useSprintStore.getState().clearSprint();
}
