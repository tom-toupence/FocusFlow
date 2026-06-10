"use client";

import { useState } from "react";
import { planTasks, totalPomodoros, PlannedTask } from "@/lib/coach";
import { cn } from "@/lib/utils";

interface EditableTask extends PlannedTask {
  id: string;
  include: boolean;
}

const EXAMPLES = [
  "Réviser le chapitre de biologie pour l'examen",
  "Rédiger le rapport de stage",
  "Coder la page de connexion du site",
];

/**
 * Local planning coach. Turns an objective into Pomodoro-sized tasks entirely
 * client-side (no API, no key, no cost), and adds the chosen ones to the plan.
 */
export default function CoachModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (tasks: PlannedTask[]) => void;
}) {
  const [objective, setObjective] = useState("");
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [planned, setPlanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"ai" | "local">("local");

  const applyTasks = (result: PlannedTask[], src: "ai" | "local") => {
    setTasks(result.map((t, i) => ({ ...t, id: `${Date.now()}-${i}`, include: true })));
    setSource(src);
    setPlanned(true);
  };

  const handlePlan = async (text?: string) => {
    const obj = (text ?? objective).trim();
    if (!obj) return;
    if (text) setObjective(text);
    setLoading(true);
    // Try the AI route first; fall back to the local heuristic planner on any failure
    // (no key configured, quota reached, network error). The feature always works.
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: obj }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tasks) && data.tasks.length > 0) {
          applyTasks(data.tasks, "ai");
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore — fall through to local */ }
    applyTasks(planTasks(obj), "local");
    setLoading(false);
  };

  const toggle = (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, include: !t.include } : t)));
  const bump = (id: string, delta: number) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, pomodoroEstimate: Math.max(1, Math.min(6, t.pomodoroEstimate + delta)) } : t)));

  const selected = tasks.filter((t) => t.include);

  const handleAdd = () => {
    if (selected.length === 0) return;
    onAdd(selected.map(({ text, pomodoroEstimate }) => ({ text, pomodoroEstimate })));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border border-foreground/10 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 3l1.9 4.8L19 9.6l-4 3.4 1.2 5L12 15.8 7.8 18l1.2-5-4-3.4 5.1-1.8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Coach de planification
            </h2>
            <p className="text-[11px] text-foreground/40 mt-0.5">Décris ton objectif, je le découpe en tâches Pomodoro. IA gratuite (Gemini), avec repli local si indisponible.</p>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors flex-shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Objective input */}
        <div className="flex flex-col gap-2">
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePlan(); }}
            placeholder="Ex : Réviser le chapitre 4 de maths pour le contrôle…"
            rows={2}
            maxLength={500}
            className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25 transition-colors resize-none"
          />
          {!planned && (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => handlePlan(ex)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-foreground/5 text-foreground/45 hover:text-foreground/70 hover:bg-foreground/10 transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => handlePlan()}
            disabled={!objective.trim() || loading}
            className="flex items-center justify-center gap-2 py-2.5 bg-violet-500/90 hover:bg-violet-500 disabled:opacity-30 text-white font-semibold text-sm rounded-xl transition-all"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 3l1.9 4.8L19 9.6l-4 3.4 1.2 5L12 15.8 7.8 18l1.2-5-4-3.4 5.1-1.8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {loading ? "Génération…" : planned ? "Re-générer" : "Découper en tâches"}
          </button>
        </div>

        {/* Result */}
        {planned && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">
                  {tasks.length} tâche{tasks.length > 1 ? "s" : ""} proposée{tasks.length > 1 ? "s" : ""}
                </p>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-md font-medium",
                  source === "ai" ? "bg-violet-500/15 text-violet-500 dark:text-violet-300" : "bg-foreground/10 text-foreground/40"
                )}>
                  {source === "ai" ? "✦ IA Gemini" : "Plan local"}
                </span>
              </div>
              <p className="text-[10px] text-foreground/40">
                {selected.length} sélectionnée{selected.length > 1 ? "s" : ""} · {totalPomodoros(selected)} pomodoro{totalPomodoros(selected) > 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto -mx-1 px-1">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors",
                    t.include ? "bg-foreground/[0.04] border-foreground/10" : "bg-transparent border-foreground/[0.05] opacity-50"
                  )}
                >
                  <button
                    onClick={() => toggle(t.id)}
                    className={cn(
                      "w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all",
                      t.include ? "bg-violet-500 border-violet-500" : "border-foreground/25"
                    )}
                  >
                    {t.include && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="flex-1 text-xs text-foreground/80 leading-snug min-w-0">{t.text}</span>
                  {/* Estimate stepper */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => bump(t.id, -1)} className="w-5 h-5 rounded bg-foreground/8 hover:bg-foreground/15 text-foreground/60 flex items-center justify-center text-xs">−</button>
                    <span className="text-[11px] text-foreground/60 tabular-nums w-10 text-center" title="Pomodoros estimés">
                      🍅 {t.pomodoroEstimate}
                    </span>
                    <button onClick={() => bump(t.id, 1)} className="w-5 h-5 rounded bg-foreground/8 hover:bg-foreground/15 text-foreground/60 flex items-center justify-center text-xs">+</button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleAdd}
              disabled={selected.length === 0}
              className="flex items-center justify-center gap-2 py-3 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 disabled:opacity-30 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Ajouter {selected.length} tâche{selected.length > 1 ? "s" : ""} au plan
            </button>
          </>
        )}
      </div>
    </div>
  );
}
