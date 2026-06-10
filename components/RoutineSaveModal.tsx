"use client";

import { useState } from "react";
import { useRoutineStore } from "@/store/routineStore";
import { captureCurrentRoutine } from "@/lib/routines";
import { cn } from "@/lib/utils";

const EMOJIS = ["⚡", "🌅", "🌙", "📚", "💻", "✍️", "🎯", "🧘", "🔥", "☕"];

/** Captures the current timer/ambiance/media/tasks setup as a reusable routine. */
export default function RoutineSaveModal({ onClose }: { onClose: () => void }) {
  const { addRoutine } = useRoutineStore();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    const draft = captureCurrentRoutine();
    addRoutine({ ...draft, name: name.trim(), emoji });
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
        <p className="text-[11px] text-foreground/40 -mt-2">Mémorise les durées, l&apos;ambiance, le média et les tâches actuelles pour les relancer en 1 clic.</p>

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
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={cn("w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all", emoji === e ? "bg-foreground/15 ring-1 ring-foreground/30" : "bg-foreground/5 hover:bg-foreground/10")}>{e}</button>
              ))}
            </div>
            <button onClick={save} disabled={!name.trim()} className="py-2.5 bg-foreground text-background font-semibold text-sm rounded-xl hover:bg-foreground/90 disabled:opacity-30 transition-all">Enregistrer</button>
          </>
        )}
      </div>
    </div>
  );
}
