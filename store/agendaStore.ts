"use client";

// Événements occupés de l'agenda, en mémoire seulement (jamais persistés).
// Hors ligne ou en erreur, on garde les derniers connus : le minuteur ne
// bloque jamais une session à cause de l'agenda.
import { create } from "zustand";
import type { BusyEvent } from "@/lib/agendaFit";
import { fetchAgenda, type AgendaResult } from "@/lib/agendaClient";
import { usePrefsStore } from "@/store/prefsStore";

export const AGENDA_REFRESH_MS = 15 * 60_000;

interface AgendaState {
  events: BusyEvent[];
  fetchedAt: number | null;
  status: "idle" | "loading" | "ok" | "error";
  error: string | null;
  /** Relit l'agenda (adresse du profil par défaut). Sans adresse : vide. */
  refresh: (url?: string | null) => Promise<AgendaResult | null>;
  clear: () => void;
}

let inflight: Promise<AgendaResult | null> | null = null;

export const useAgendaStore = create<AgendaState>()((set, get) => ({
  events: [],
  fetchedAt: null,
  status: "idle",
  error: null,
  refresh: (url) => {
    const target = url === undefined ? usePrefsStore.getState().icalUrl : url;
    if (!target) {
      get().clear();
      return Promise.resolve(null);
    }
    if (inflight) return inflight;
    set({ status: "loading", error: null });
    inflight = fetchAgenda(target)
      .then((r) => {
        const now = Date.now();
        if (r.ok) set({ events: r.events, fetchedAt: now, status: "ok", error: null });
        // Erreur : on garde ce qu'on savait encore à venir.
        else set((s) => ({ events: s.events.filter((e) => e.end > now), status: "error", error: r.error }));
        return r;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  clear: () => set({ events: [], fetchedAt: null, status: "idle", error: null }),
}));
