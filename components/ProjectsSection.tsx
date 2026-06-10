"use client";

import { useState } from "react";
import { useProjectStore, getProjectStatus, PROJECT_COLORS } from "@/store/projectStore";
import { cn } from "@/lib/utils";

export default function ProjectsSection() {
  const { projects, activeProjectId, addProject, removeProject, setActiveProject } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState(20);
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const create = () => {
    if (!name.trim()) return;
    addProject({ name: name.trim(), color, deadline: deadline || null, pomodoroBudget: Math.max(1, budget) });
    setName(""); setDeadline(""); setBudget(20); setColor(PROJECT_COLORS[0]); setOpen(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Projets & deadlines</h2>
          <p className="text-xs text-foreground/40 mt-0.5">Suis tes gros objectifs et le rythme à tenir.</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground/70 text-xs font-medium transition-all"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Nouveau projet
        </button>
      </div>

      {open && (
        <div className="mb-4 p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.08] flex flex-col gap-3">
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du projet (ex: Mémoire)"
            className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25"
          />
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-foreground/40 uppercase tracking-wider">Deadline</span>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="bg-foreground/5 border border-foreground/10 rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-foreground/25" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-foreground/40 uppercase tracking-wider">Pomodoros visés</span>
              <input type="number" min={1} value={budget} onChange={(e) => setBudget(parseInt(e.target.value) || 1)}
                className="bg-foreground/5 border border-foreground/10 rounded-lg px-2.5 py-1.5 text-sm text-foreground w-24 focus:outline-none focus:border-foreground/25" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-foreground/40 uppercase tracking-wider">Couleur</span>
              <div className="flex gap-1.5 items-center h-[34px]">
                {PROJECT_COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} className={cn("w-5 h-5 rounded-full transition-transform", color === c && "ring-2 ring-foreground/40 scale-110")} style={{ background: c }} />
                ))}
              </div>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={!name.trim()} className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-30 transition-all">Créer</button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-foreground/40 hover:text-foreground/70 text-sm transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-foreground/25 text-center py-8">Aucun projet. Crée-en un pour suivre une deadline.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => {
            const st = getProjectStatus(p);
            const isActive = p.id === activeProjectId;
            return (
              <div key={p.id} className="px-4 py-3.5 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">{p.name}</span>
                  <span className="text-xs text-foreground/40 tabular-nums flex-shrink-0">{p.pomodorosDone}/{p.pomodoroBudget} 🍅</span>
                  <button
                    onClick={() => setActiveProject(isActive ? null : p.id)}
                    className={cn("text-[10px] px-2 py-1 rounded-lg font-medium transition-all flex-shrink-0", isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-foreground/8 text-foreground/40 hover:text-foreground/70")}
                  >
                    {isActive ? "✓ Actif" : "Activer"}
                  </button>
                  <button onClick={() => removeProject(p.id)} className="text-foreground/20 hover:text-red-400 transition-colors flex-shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                  </button>
                </div>
                <div className="h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${st.pct * 100}%`, background: p.color }} />
                </div>
                <p className="text-[11px] mt-2 flex items-center gap-2 flex-wrap">
                  {p.deadline ? (
                    st.overdue ? <span className="text-red-400">⚠️ Deadline dépassée — {st.pomodorosLeft} pomodoros restants</span>
                    : st.daysLeft === 0 ? <span className="text-amber-400">📅 Deadline aujourd&apos;hui · {st.pomodorosLeft} restants</span>
                    : <span className="text-foreground/45">{st.daysLeft}j restants · vise <strong className="text-foreground/65">{st.perDayNeeded}/jour</strong></span>
                  ) : <span className="text-foreground/30">Sans deadline · {st.pomodorosLeft} restants</span>}
                  {p.deadline && !st.overdue && (
                    <span className={cn("px-1.5 py-0.5 rounded", st.onTrack ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400")}>
                      {st.onTrack ? "sur la bonne voie" : "en retard"}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
          <p className="text-[10px] text-foreground/30">Le projet « actif » avance automatiquement d&apos;un pomodoro à chaque session de focus terminée.</p>
        </div>
      )}
    </section>
  );
}
