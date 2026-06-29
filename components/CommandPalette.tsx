"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useRouter } from "next/navigation";
import { useNavStore, NavSection, MediaSource } from "@/store/navStore";
import { cn } from "@/lib/utils";

// État d'ouverture partagé : ⌘K (clavier) + bouton header peuvent tous deux l'ouvrir.
export const useCommandPalette = create<{ open: boolean; setOpen: (v: boolean) => void; toggle: () => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));

interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
  run: () => void;
}

export default function CommandPalette() {
  const { open, setOpen, toggle } = useCommandPalette();

  // Ouverture par ⌘K / Ctrl+K (et fermeture par Échap)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, setOpen]);

  if (!open) return null;
  // Monté seulement à l'ouverture → query/index repartent à zéro sans effet de reset.
  return <PaletteDialog onClose={() => setOpen(false)} />;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const goSection = (s: NavSection) => () => { useNavStore.getState().setSection(s); router.push("/"); onClose(); };
  const goMedia = (m: MediaSource) => () => { useNavStore.getState().openMedia(m); router.push("/"); onClose(); };
  const goRoute = (path: string) => () => { router.push(path); onClose(); };

  const commands: Command[] = [
    { id: "start", label: "Démarrer une session", hint: "Choisir une ambiance", keywords: "demarrer session focus pomodoro play lancer", run: goMedia("catalogue") },
    { id: "accueil", label: "Aujourd'hui", hint: "Tableau de bord", keywords: "accueil home dashboard aujourdhui", run: goSection("accueil") },
    { id: "ecouter", label: "Écouter", hint: "Catalogue & sources", keywords: "ecouter musique media son", run: goSection("ecouter") },
    { id: "catalogue", label: "Catalogue", hint: "Vidéos lofi/chill", keywords: "catalogue ambiance lofi videos", run: goMedia("catalogue") },
    { id: "library", label: "Ma bibliothèque", hint: "Vidéos, playlists & file", keywords: "bibliotheque library file queue playlist perso", run: goMedia("library") },
    { id: "spotify", label: "Spotify", keywords: "spotify musique premium", run: goMedia("spotify") },
    { id: "twitch", label: "Twitch", keywords: "twitch live stream vod", run: goMedia("twitch") },
    { id: "organisation", label: "Organisation", hint: "Projets, planning, routines", keywords: "organisation projets planning routines sprint journal", run: goSection("organisation") },
    { id: "activite", label: "Activité", hint: "Stats & progression", keywords: "activite stats progression badges", run: goSection("activite") },
    { id: "settings", label: "Réglages", hint: "Preset & tâches", keywords: "reglages settings preset taches kanban coach", run: goRoute("/settings") },
    { id: "insights", label: "Statistiques détaillées", keywords: "insights stats graphiques export", run: goRoute("/insights") },
    { id: "wrapped", label: "Récap hebdo", keywords: "wrapped recap semaine partage", run: goRoute("/wrapped") },
  ];

  const q = query.trim().toLowerCase();
  const filtered = q ? commands.filter((c) => (c.label + " " + c.keywords).toLowerCase().includes(q)) : commands;
  const safeIndex = filtered.length ? Math.min(index, filtered.length - 1) : 0;

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex(Math.min(safeIndex + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex(Math.max(safeIndex - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[safeIndex]?.run(); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-foreground/[0.08]">
          <svg className="w-4 h-4 text-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onListKey}
            placeholder="Rechercher une action…"
            className="flex-1 bg-transparent py-3.5 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none"
          />
          <kbd className="text-[10px] text-foreground/30 border border-foreground/15 rounded px-1.5 py-0.5">Échap</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground/30 text-center">Aucune action</p>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.id}
                onClick={c.run}
                onMouseEnter={() => setIndex(i)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                  i === safeIndex ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
                )}
              >
                <span className="text-sm text-foreground/85">{c.label}</span>
                {c.hint && <span className="text-xs text-foreground/35 flex-shrink-0">{c.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
