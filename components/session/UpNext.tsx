"use client";
// « À venir » : les prochains titres de la source, les suggestions de la
// lecture continue marquées comme telles, et des titres proches à la demande.
// Panneau docké en bas à droite de la session (pas un menu).
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
  /** Panneau affiché (le bouton « À venir » de la barre le bascule). */
  open: boolean;
  className?: string;
}

/** Y a-t-il quelque chose à montrer dans « À venir » pour cette source ? */
export function hasUpNext(adapter: PlayerAdapter | null, pb: PlaybackState) {
  return !!adapter && (pb.upcoming.length > 0 || pb.caps.suggestions);
}

/** Titres montrés avant « voir la suite » (le panneau reste compact, comme
 *  sur l'image de la landing). */
const PEEK = 3;

// Panneau posé en bas à droite de la session, visible sans ouvrir de menu :
// c'est l'écran annoncé sur la landing (SessionReplica).
export default function UpNext({ adapter, pb, open, className }: Props) {
  const [suggestions, setSuggestions] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  // Adaptateur courant : une réponse arrivée après un changement de source est ignorée.
  const current = useRef(adapter);
  useEffect(() => { current.current = adapter; }, [adapter]);

  // Changement de source : les suggestions affichées ne valent plus rien.
  useEffect(() => {
    setSuggestions(null);
    setAdded(new Set());
    setExpanded(false);
  }, [adapter]);

  if (!open || !adapter || !hasUpNext(adapter, pb)) return null;

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

  const shown = expanded ? pb.upcoming : pb.upcoming.slice(0, PEEK);
  const hidden = pb.upcoming.length - shown.length;

  return (
    <section
      aria-label="À venir"
      className={cn(
        "max-h-[50vh] overflow-y-auto rounded-xl border border-white/10 bg-night/85 backdrop-blur-sm p-2.5 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <p className="mb-1.5 px-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">À venir</p>

      {pb.upcoming.length === 0 ? (
        <p className="px-0.5 py-1 text-xs text-white/60">
          {pb.caps.skip ? "C'est le dernier titre. Coupe la boucle pour que la session continue avec des titres proches." : "Un seul titre en lecture."}
        </p>
      ) : (
        <ol>
          {shown.map((t, i) => (
            <li key={`${t.id}-${i}`} className="flex items-center gap-2 py-1">
              <Thumb src={t.artwork} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-white/85">
                  {t.suggested && <span className="text-focus">Suggestion · </span>}
                  {t.title}
                </p>
                {t.subtitle && <p className="truncate text-[10px] text-white/45">{t.subtitle}</p>}
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

      {(hidden > 0 || expanded) && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-0.5 px-0.5 text-[11px] text-white/55 hover:text-white">
          {expanded ? "Réduire" : hidden === 1 ? "Voir le suivant" : `Voir les ${hidden} suivants`}
        </button>
      )}

      {pb.upcoming.some((t) => t.suggested) && (
        <p className="mt-1 px-0.5 text-[10px] text-white/45">La session continue avec des titres proches de toute ta playlist.</p>
      )}

      {pb.caps.suggestions && (
        <div className="mt-2 border-t border-white/10 pt-2">
          {suggestions === null ? (
            <button
              onClick={loadSuggestions}
              disabled={loading}
              className="w-full px-0.5 text-left text-xs text-white/75 hover:text-white disabled:opacity-60"
            >
              {loading ? "Recherche de titres proches…" : "Trouver des titres proches"}
            </button>
          ) : suggestions.length === 0 ? (
            <p className="px-0.5 text-xs text-white/60">Aucun titre proche trouvé pour l&apos;instant (réseau ou quota). Réessaie plus tard.</p>
          ) : (
            <>
              <p className="mb-1 px-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">Titres proches</p>
              <ul>
                {suggestions.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 py-1">
                    <Thumb src={t.artwork} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-white/85">{t.title}</p>
                      {t.subtitle && <p className="truncate text-[10px] text-white/45">{t.subtitle}</p>}
                    </div>
                    {added.has(t.id) ? (
                      <span className="text-[10px] text-focus">Ajouté</span>
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
    </section>
  );
}

function Thumb({ src }: { src?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="w-8 h-5 rounded object-cover flex-shrink-0 bg-white/10" />
  ) : (
    <span aria-hidden className="w-8 h-5 rounded flex-shrink-0 bg-white/10" />
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>{children}</svg>
    </button>
  );
}
