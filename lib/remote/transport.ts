"use client";
// Transports du canal télécommande (lot 7). Deux implémentations d'une même
// interface, choisie par `openTransport` :
//   . Supabase Realtime en broadcast : clé anon, aucune table, aucun compte, et
//     rien n'est écrit en base (pas de lib/db.ts). Le canal porte le nom du code.
//   . BroadcastChannel : même navigateur (tests e2e, développement sans Supabase).
// Choix : Supabase s'il est configuré. Sinon, le transport local seulement en
// développement ou en lab (NEXT_PUBLIC_LAB=1) ; en production sans Supabase, la
// fonction est indisponible (le bouton est masqué).
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface RemoteTransport {
  readonly kind: "supabase" | "local";
  /** Envoie un message (sérialisable JSON). Résolu une fois parti (ou abandonné). */
  send(msg: unknown): Promise<void>;
  /** Abonne un récepteur ; rend la fonction de désabonnement. */
  onMessage(cb: (msg: unknown) => void): () => void;
  close(): void;
}

const CHANNEL_PREFIX = "ff-remote-";
const EVENT = "m";
/** Clé de lab : force le transport local quand il est permis (tests e2e). */
export const FORCE_LOCAL_KEY = "focusflow-remote-transport";

/** Le transport local est permis : développement, ou build de lab. */
export const localTransportAllowed = () =>
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_LAB === "1";

function forcedLocal(): boolean {
  if (!localTransportAllowed()) return false;
  try { return localStorage.getItem(FORCE_LOCAL_KEY) === "local"; } catch { return false; }
}

/** Quel transport serait utilisé ici (null : fonction indisponible). */
export function transportKind(): RemoteTransport["kind"] | null {
  if (typeof window === "undefined") return null;
  const local = localTransportAllowed() && typeof BroadcastChannel !== "undefined";
  if (forcedLocal() && local) return "local";
  if (supabase) return "supabase";
  return local ? "local" : null;
}

export function openTransport(code: string): RemoteTransport | null {
  const kind = transportKind();
  if (kind === "supabase") return new SupabaseTransport(code);
  if (kind === "local") return new LocalTransport(code);
  return null;
}

// ─── BroadcastChannel ─────────────────────────────────────────────────────────

class LocalTransport implements RemoteTransport {
  readonly kind = "local" as const;
  private ch: BroadcastChannel;
  private listeners = new Set<(m: unknown) => void>();
  private closed = false;

  constructor(code: string) {
    this.ch = new BroadcastChannel(CHANNEL_PREFIX + code);
    // Un BroadcastChannel ne se renvoie pas ses propres messages (comme self:false).
    this.ch.onmessage = (e: MessageEvent) => this.listeners.forEach((l) => l(e.data));
  }

  async send(msg: unknown) {
    if (this.closed) return;
    try { this.ch.postMessage(msg); } catch { /* message non clonable : ignoré */ }
  }

  onMessage(cb: (m: unknown) => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.listeners.clear();
    this.ch.close();
  }
}

// ─── Supabase Realtime (broadcast) ────────────────────────────────────────────

class SupabaseTransport implements RemoteTransport {
  readonly kind = "supabase" as const;
  private ch: RealtimeChannel;
  private listeners = new Set<(m: unknown) => void>();
  private ready: Promise<boolean>;
  private closed = false;

  constructor(code: string) {
    const client = supabase!;
    this.ch = client.channel(CHANNEL_PREFIX + code, { config: { broadcast: { self: false } } });
    this.ch.on("broadcast", { event: EVENT }, ({ payload }) => this.listeners.forEach((l) => l(payload)));
    // Les envois attendent l'abonnement (sinon ils partent par l'API REST, ou se perdent).
    this.ready = new Promise((resolve) => {
      this.ch.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve(true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") resolve(false);
      });
    });
  }

  async send(msg: unknown) {
    if (this.closed) return;
    const ok = await Promise.race([this.ready, new Promise<boolean>((r) => setTimeout(() => r(false), 8000))]);
    if (!ok || this.closed) return;
    try {
      await this.ch.send({ type: "broadcast", event: EVENT, payload: msg });
    } catch { /* réseau : le prochain état partira dans 5 s */ }
  }

  onMessage(cb: (m: unknown) => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.listeners.clear();
    void supabase?.removeChannel(this.ch);
  }
}
