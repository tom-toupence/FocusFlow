"use client";

import { useState } from "react";
import { useRoutineStore } from "@/store/routineStore";
import { captureCurrentRoutine } from "@/lib/routines";
import { cn } from "@/lib/utils";

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#38bdf8", "#a78bfa", "#fb7185", "#4ade80"];

/** Captures the current timer/media/tasks setup as a reusable routine. */
export default function RoutineSaveModal({ onClose }: { onClose: () => void }) {
  const { addRoutine } = useRoutineStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    const draft = captureCurrentRoutine();
    addRoutine({ ...draft, name: name.trim(), color });
    setSaved(true);
    setTimeout(onClose, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-foreground/10 rounded-2xl shadow-2xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Enregistrer comme routine</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="text-[11px] text-foreground/40 -mt-2">Mémorise les durées, le média et les tâches actuelles pour les relancer en 1 clic.</p>

        {saved ? (
          <div className="py-6 flex flex-col items-center gap-2 text-emerald-400">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <p className="text-sm font-medium">Routine enregistrée</p>
          </div>
        ) : (
          <>
            <input
              value={name} onChange={(e) => setName(e.target.value)} autoFocus
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Nom (ex: Deep Work matin)"
              className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25"
            />
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} title="Couleur" className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", color === c ? "ring-2 ring-foreground/40 ring-offset-2 ring-offset-card" : "hover:scale-110")}>
                  <span className="w-5 h-5 rounded-full" style={{ background: c }} />
                </button>
              ))}
            </div>
            <button onClick={save} disabled={!name.trim()} className="py-2.5 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 disabled:opacity-30 transition-all">Enregistrer</button>
          </>
        )}
      </div>
    </div>
  );
}
