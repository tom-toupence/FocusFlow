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

// Génération : incrémentée par clear() et au changement d'adresse. Un résultat
// arrivé après (Retirer pendant la lecture, Tester une autre adresse) est ignoré.
let generation = 0;
let lastUrl: string | null = null;
let inflight: { url: string; gen: number; promise: Promise<AgendaResult | null> } | null = null;

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
    if (target !== lastUrl) {
      generation++;
      lastUrl = target;
      // Les événements d'une autre adresse ne valent plus rien.
      set({ events: [], fetchedAt: null });
    }
    if (inflight && inflight.url === target && inflight.gen === generation) return inflight.promise;
    const gen = generation;
    set({ status: "loading", error: null });
    const promise = fetchAgenda(target).then((r): AgendaResult | null => {
      if (gen !== generation) return null; // périmé : on ne touche à rien
      const now = Date.now();
      if (r.ok) set({ events: r.events, fetchedAt: now, status: "ok", error: null });
      // Erreur : on garde ce qu'on savait encore à venir.
      else set((s) => ({ events: s.events.filter((e) => e.end > now), status: "error", error: r.error }));
      return r;
    }).finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
    inflight = { url: target, gen, promise };
    return promise;
  },
  clear: () => {
    generation++;
    lastUrl = null;
    inflight = null;
    set({ events: [], fetchedAt: null, status: "idle", error: null });
  },
}));
