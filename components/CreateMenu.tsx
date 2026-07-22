"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNavStore } from "@/store/navStore";
import { cn } from "@/lib/utils";

interface CreateEntry {
  id: string;
  label: string;
  sub: string;
  icon: React.ReactElement;
  run: () => void;
}

function useCreateEntries(close: () => void): CreateEntry[] {
  const router = useRouter();
  return [
    {
      id: "session",
      label: "Session de focus",
      sub: "Choisir une ambiance et lancer un pomodoro",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      run: () => { useNavStore.getState().openMedia("catalogue"); close(); },
    },
    {
      id: "project",
      label: "Projet",
      sub: "Budget de pomodoros, deadline, rythme",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 7h5l2-2h4l2 2h5v12H3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      run: () => { useNavStore.getState().requestCreate("project"); close(); },
    },
    {
      id: "sprint",
      label: "Sprint deadline",
      sub: "Un objectif, un plan généré pour toi",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      run: () => { useNavStore.getState().requestCreate("sprint"); close(); },
    },
    {
      id: "planBlock",
      label: "Bloc de planning",
      sub: "Réserve un créneau de focus dans ta semaine",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="4" x2="9" y2="22" strokeLinecap="round" />
        </svg>
      ),
      run: () => { useNavStore.getState().openOrg("planning"); close(); },
    },
    {
      id: "task",
      label: "Tâche",
      sub: "Ajoutée au Kanban de tes réglages de session",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      run: () => { router.push("/settings"); close(); },
    },
    {
      id: "routine",
      label: "Routine",
      sub: "Capture ambiance, durées et tâches à relancer",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      run: () => { useNavStore.getState().openOrg("routines"); close(); },
    },
  ];
}

export default function CreateMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const entries = useCreateEntries(close);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground/70 text-xs font-medium transition-all"
        title="Créer"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Créer</span>
      </button>

      {open && (
        <>
          {/* Backdrop invisible pour fermer au clic extérieur */}
          <div className="fixed inset-0 z-50" onClick={close} />

          {/* Desktop : popover absolu sous le bouton */}
          <div className="hidden sm:flex absolute right-0 top-full mt-2 z-50 w-72 flex-col gap-0.5 p-1.5 rounded-2xl bg-card border border-foreground/10 shadow-2xl">
            {entries.map((e) => (
              <CreateItem key={e.id} entry={e} />
            ))}
          </div>

          {/* Mobile : bottom-sheet */}
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-card border-t border-foreground/10 shadow-2xl p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="w-10 h-1 rounded-full bg-foreground/15 mx-auto mb-2" />
            {entries.map((e) => (
              <CreateItem key={e.id} entry={e} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CreateItem({ entry }: { entry: CreateEntry }) {
  return (
    <button
      onClick={entry.run}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-foreground/[0.06]"
      )}
    >
      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-foreground/5 text-foreground/60 flex-shrink-0">
        {entry.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{entry.label}</span>
        <span className="block text-[11px] text-foreground/40 leading-snug truncate">{entry.sub}</span>
      </span>
    </button>
  );
}
