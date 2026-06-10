"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/authState";
import { getOrCreateCalendarToken } from "@/lib/db";
import { usePlanStore } from "@/store/planStore";
import { downloadICS } from "@/lib/ics";
import { toast } from "@/components/Toast";

/**
 * "📅 Calendrier" button for the week planner.
 * Signed in + Supabase configured → secret webcal:// subscription URL that
 * iPhone / Google Calendar refresh automatically (read-only push of the plan).
 * Otherwise → plain .ics download of the current blocks.
 */
export default function CalendarSync() {
  const { blocks } = usePlanStore();
  const [open, setOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canFeed = !!supabase && !!getCurrentUserId();

  const handleOpen = async () => {
    if (!canFeed) {
      if (blocks.length === 0) {
        toast({ title: "Planning vide", description: "Ajoute d'abord des blocs de focus.", emoji: "📅" });
        return;
      }
      downloadICS(blocks);
      toast({ title: "Fichier .ics téléchargé", description: "Importe-le dans ton appli calendrier. Connecte-toi pour la synchro automatique.", emoji: "📅" });
      return;
    }
    setOpen(true);
    if (feedUrl) return;
    setLoading(true);
    const token = await getOrCreateCalendarToken(getCurrentUserId()!);
    setLoading(false);
    if (!token) {
      toast({ title: "Erreur", description: "Impossible de générer le lien d'abonnement.", emoji: "⚠️", accent: "amber" });
      setOpen(false);
      return;
    }
    setFeedUrl(`${window.location.origin}/api/calendar/${token}`);
  };

  const webcalUrl = feedUrl?.replace(/^https?:\/\//, "webcal://") ?? "";

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié !", description: what, emoji: "📋" });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/60 hover:text-foreground/90 text-xs font-medium transition-all"
        title={canFeed ? "Synchroniser avec ton calendrier (iPhone, Google…)" : "Télécharger le planning en .ics"}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>
        Calendrier
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-background border border-foreground/10 rounded-2xl shadow-2xl shadow-black/20 w-full max-w-md p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-sm font-semibold text-foreground">📅 Synchro automatique du planning</h2>
              <p className="text-xs text-foreground/45 mt-1 leading-relaxed">
                Abonne ton calendrier à ce lien secret : tes blocs de focus apparaîtront automatiquement
                sur ton téléphone, avec un rappel 10 min avant. Lecture seule — rien d&apos;autre ne transite.
              </p>
            </div>

            {loading || !feedUrl ? (
              <p className="text-xs text-foreground/30 text-center py-4">Génération du lien…</p>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-foreground/[0.05] border border-foreground/10">
                  <span className="flex-1 text-[11px] text-foreground/60 font-mono truncate">{webcalUrl}</span>
                  <button onClick={() => copy(webcalUrl, "Lien webcal copié")} className="text-xs text-foreground/50 hover:text-foreground font-medium flex-shrink-0">Copier</button>
                </div>

                <div className="flex flex-col gap-3 text-xs text-foreground/55 leading-relaxed">
                  <div>
                    <p className="font-semibold text-foreground/75 mb-0.5"> iPhone / iPad</p>
                    Réglages → Apps → Calendrier → Comptes → Ajouter un compte → Autre →
                    <span className="text-foreground/75"> Ajouter un cal. avec abonnement</span> → colle le lien.
                  </div>
                  <div>
                    <p className="font-semibold text-foreground/75 mb-0.5">🗓 Google Calendar (web)</p>
                    Paramètres → Ajouter un agenda → <span className="text-foreground/75">À partir de l&apos;URL</span> → colle le lien
                    (remplace <span className="font-mono">webcal://</span> par <span className="font-mono">https://</span>).
                    <button onClick={() => copy(feedUrl, "Lien https copié")} className="ml-1 underline text-foreground/45 hover:text-foreground/80">copier en https</button>
                  </div>
                  <p className="text-[11px] text-foreground/30">
                    Les calendriers se rafraîchissent automatiquement (de quelques minutes à quelques heures selon l&apos;appli).
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => { if (blocks.length > 0) downloadICS(blocks); }}
                className="text-[11px] text-foreground/35 hover:text-foreground/60 transition-colors underline"
              >
                ou télécharger un fichier .ics
              </button>
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground text-xs font-semibold transition-all">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
