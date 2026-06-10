"use client";

import { useRouter } from "next/navigation";
import { useRoutineStore } from "@/store/routineStore";
import { applyRoutine } from "@/lib/routines";

const MEDIA_LABEL: Record<string, string> = {
  video: "YouTube", playlist: "Playlist", spotify: "Spotify", "twitch-channel": "Twitch", "twitch-vod": "Twitch VOD",
};

export default function RoutinesManager() {
  const router = useRouter();
  const { routines, removeRoutine } = useRoutineStore();

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Mes routines</h2>
        <p className="text-xs text-foreground/40 mt-0.5">Lance une configuration complète en un clic. Crée-en depuis l&apos;écran de configuration (bouton « Routine »).</p>
      </div>

      {routines.length === 0 ? (
        <p className="text-sm text-foreground/25 text-center py-8">Aucune routine. Configure une session puis enregistre-la comme routine.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {routines.map((r) => (
            <div key={r.id} className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
              <span className="text-xl flex-shrink-0">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                <p className="text-[11px] text-foreground/40">
                  {r.workDuration}/{r.shortBreakDuration} min
                  {r.media && ` · ${MEDIA_LABEL[r.media.kind]}`}
                  {r.tasks.length > 0 && ` · ${r.tasks.length} tâche${r.tasks.length > 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                onClick={() => { applyRoutine(r); router.push("/settings"); }}
                className="px-3 py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground/80 text-xs font-medium transition-all flex-shrink-0"
              >
                Lancer
              </button>
              <button onClick={() => removeRoutine(r.id)} className="text-foreground/20 hover:text-red-400 transition-colors flex-shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
