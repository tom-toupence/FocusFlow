"use client";

// Client de l'agenda : envoie l'adresse iCal (locale) à notre route serveur, en
// POST, et reçoit les événements occupés des 36 prochaines heures.
import type { BusyEvent } from "@/lib/agendaFit";

export type AgendaResult = { ok: true; events: BusyEvent[] } | { ok: false; error: string };

function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function cleanEvents(raw: unknown): BusyEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: BusyEvent[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const { start, end, title } = e as Record<string, unknown>;
    if (typeof start !== "number" || typeof end !== "number" || !(end > start)) continue;
    out.push({ start, end, ...(typeof title === "string" && title ? { title: title.slice(0, 200) } : {}) });
  }
  return out.sort((a, b) => a.start - b.start);
}

export async function fetchAgenda(url: string, signal?: AbortSignal): Promise<AgendaResult> {
  try {
    const res = await fetch("/api/calendar/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, timeZone: localTimeZone() }),
      cache: "no-store",
      signal,
    });
    const data = (await res.json().catch(() => null)) as { events?: unknown; error?: unknown } | null;
    if (!res.ok) return { ok: false, error: typeof data?.error === "string" ? data.error : "Agenda injoignable." };
    return { ok: true, events: cleanEvents(data?.events) };
  } catch {
    return { ok: false, error: "Hors ligne : agenda non mis à jour." };
  }
}
