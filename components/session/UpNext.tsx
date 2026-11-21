"use client";
// « À venir » : les prochains titres de la source, les suggestions de la
// lecture continue marquées comme telles, et des titres proches à la demande.
// Neutre vis-à-vis de la source : tout passe par l'adaptateur et ses `caps`.
//   . retirer un titre : seulement si `caps.removeUpcoming` (la file Spotify
//     n'a pas d'endpoint de retrait : on propose alors de le passer) ;
//   . ajouter une suggestion : `adapter.enqueue()` ; sans file (vidéo seule),
//     elle part dans la File FocusFlow pour la prochaine session.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PlaybackState, PlayerAdapter, Track } from "@/lib/playback/types";
import { useQueueStore } from "@/store/queueStore";
import { toast } from "@/components/Toast";

interface Props {
  adapter: PlayerAdapter | null;
  pb: PlaybackState;
}

export default function UpNext({ adapter, pb }: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const root = useRef<HTMLDivElement>(null);
  // Adaptateur courant : une réponse arrivée après un changement de source est ignorée.
  const current = useRef(adapter);
  useEffect(() => { current.current = adapter; }, [adapter]);

  // Changement de source : les suggestions affichées ne valent plus rien.
  useEffect(() => {
    setSuggestions(null);
    setAdded(new Set());
  }, [adapter]);

  // Fermeture au clic dehors et à Échap.
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", out);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", out); window.removeEventListener("keydown", esc); };
  }, [open]);

  if (!adapter || (!pb.upcoming.length && !pb.caps.suggestions)) return null;

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const list = await adapter.getSuggestions(undefined, 8);
      if (current.current === adapter) setSuggestions(list);
    } catch {
      if (current.current === adapter) setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const add = async (t: Track) => {
    const ok = await adapter.enqueue(t);
    if (ok) {
      setAdded((s) => new Set(s).add(t.id));
      toast({ title: "Ajouté à la suite", description: t.title, accent: "emerald" });
      return;
    }
    if (t.source === "youtube") {
      // Vidéo seule : pas de file en cours, on garde le titre pour plus tard.
      useQueueStore.getState().addItem({ youtubeId: t.id, title: t.title, thumbnailUrl: t.artwork });
      setAdded((s) => new Set(s).add(t.id));
      toast({ title: "Ajouté à la File d'attente", description: "Il sera joué à ta prochaine session en file.", accent: "emerald" });
      return;
    }
    toast({ title: "Impossible d'ajouter ce titre", description: "La source n'a pas répondu. Réessaie dans un instant.", accent: "amber" });
  };

  // Spotify : la file n'a pas d'endpoint de retrait. On ne prétend pas
  // « passer » un titre ; on propose de l'écouter tout de suite.
  const playNow = (t: Track) => { if (pb.upcoming[0]?.id === t.id) adapter.next(); };

  return (
    <div ref={root} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-[6px] transition-all",
          open ? "bg-white/20 text-white" : "text-white/75 hover:text-white hover:bg-white/10",
        )}
        title="À venir"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M4 6h11M4 12h11M4 18h7M18 15v6M15 18h6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="À venir"
          className="fixed md:absolute inset-x-2 bottom-16 md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-80 max-h-[60vh] overflow-y-auto rounded-[6px] bg-[#05070a]/92 backdrop-blur-md border border-white/12 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] text-white z-40"
        >
          <div className="px-3 pt-3 pb-2 border-b border-white/10">
            <p className="font-mono uppercase tracking-[0.14em] text-[10px] text-white/55">À venir</p>
          </div>

          {pb.upcoming.length === 0 ? (
            <p className="px-3 py-3 text-xs text-white/60">
              {pb.caps.skip ? "C'est le dernier titre. Coupe la boucle pour que la session continue avec des titres proches." : "Un seul titre en lecture."}
            </p>
          ) : (
            <ol className="py-1">
              {pb.upcoming.map((t, i) => (
                <li key={`${t.id}-${i}`} className="group flex items-center gap-2.5 px-3 py-1.5">
                  <Thumb src={t.artwork} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/90 truncate">{t.title}</p>
                    <p className="text-[10px] text-white/55 truncate">
                      {t.suggested && <span className="text-[#7fd6a0]">Suggestion · </span>}
                      {t.subtitle}
                    </p>
                  </div>
                  {pb.caps.removeUpcoming ? (
                    <IconButton label={`Retirer ${t.title}`} onClick={() => adapter.removeUpcoming(t.id)}>
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </IconButton>
                  ) : i === 0 && pb.caps.skip ? (
                    <IconButton label={`Écouter maintenant ${t.title}`} onClick={() => playNow(t)}>
                      <path d="M5 6l8 6-8 6zM17 6v12" strokeLinecap="round" strokeLinejoin="round" />
                    </IconButton>
                  ) : null}
                </li>
              ))}
            </ol>
          )}

          {pb.upcoming.some((t) => t.suggested) && (
            <p className="px-3 pb-2 text-[10px] text-white/50">La session continue avec des titres proches de toute ta playlist.</p>
          )}

          {pb.caps.suggestions && (
            <div className="border-t border-white/10 px-3 py-2.5">
              {suggestions === null ? (
                <button
                  onClick={loadSuggestions}
                  disabled={loading}
                  className="w-full text-left text-xs text-white/80 hover:text-white disabled:opacity-60"
                >
                  {loading ? "Recherche de titres proches…" : "Trouver des titres proches"}
                </button>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-white/60">Aucun titre proche trouvé pour l&apos;instant (réseau ou quota). Réessaie plus tard.</p>
              ) : (
                <>
                  <p className="font-mono uppercase tracking-[0.14em] text-[10px] text-white/55 mb-1.5">Titres proches</p>
                  <ul>
                    {suggestions.map((t) => (
                      <li key={t.id} className="flex items-center gap-2.5 py-1.5">
                        <Thumb src={t.artwork} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white/90 truncate">{t.title}</p>
                          {t.subtitle && <p className="text-[10px] text-white/55 truncate">{t.subtitle}</p>}
                        </div>
                        {added.has(t.id) ? (
                          <span className="text-[10px] text-[#7fd6a0]">Ajouté</span>
                        ) : (
                          <IconButton label={`Ajouter ${t.title} à la suite`} onClick={() => void add(t)}>
                            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                          </IconButton>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="w-10 h-7 rounded-[3px] object-cover flex-shrink-0 bg-white/5" />
  ) : (
    <span aria-hidden className="w-10 h-7 rounded-[3px] flex-shrink-0 bg-white/5" />
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-[4px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>{children}</svg>
    </button>
  );
}
