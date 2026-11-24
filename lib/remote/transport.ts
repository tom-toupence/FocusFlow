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
  /** Envoie un message (sérialisable JSON). true s'il est parti, false sinon. */
  send(msg: unknown): Promise<boolean>;
  /** Abonne un récepteur ; rend la fonction de désabonnement. */
  onMessage(cb: (msg: unknown) => void): () => void;
  close(): void;
}

const EVENT = "m";
/** Attente bornée de l'état « joined » avant un envoi Supabase. */
const JOIN_WAIT_MS = 5000;
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

/** `name` : nom du canal, dérivé du code et du secret (lib/remote/crypto.ts). */
export function openTransport(name: string): RemoteTransport | null {
  const kind = transportKind();
  if (kind === "supabase") return new SupabaseTransport(name);
  if (kind === "local") return new LocalTransport(name);
  return null;
}

// ─── BroadcastChannel ─────────────────────────────────────────────────────────

class LocalTransport implements RemoteTransport {
  readonly kind = "local" as const;
  private ch: BroadcastChannel;
  private listeners = new Set<(m: unknown) => void>();
  private closed = false;

  constructor(name: string) {
    this.ch = new BroadcastChannel(name);
    // Un BroadcastChannel ne se renvoie pas ses propres messages (comme self:false).
    this.ch.onmessage = (e: MessageEvent) => this.listeners.forEach((l) => l(e.data));
  }

  async send(msg: unknown) {
    if (this.closed) return false;
    try { this.ch.postMessage(msg); return true; } catch { return false; }
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
  private closed = false;

  constructor(name: string) {
    const client = supabase!;
    this.ch = client.channel(name, { config: { broadcast: { self: false } } });
    this.ch.on("broadcast", { event: EVENT }, ({ payload }) => this.listeners.forEach((l) => l(payload)));
    // supabase-js rejoint seul après une coupure : l'état est relu à chaque envoi.
    this.ch.subscribe();
  }

  /** Attend l'état « joined » (borné) : sinon l'envoi partirait par REST ou se perdrait. */
  private async joined(): Promise<boolean> {
    const deadline = Date.now() + JOIN_WAIT_MS;
    while (!this.closed && this.ch.state !== "joined") {
      if (Date.now() > deadline) return false;
      await new Promise((r) => setTimeout(r, 100));
    }
    return !this.closed;
  }

  async send(msg: unknown) {
    if (this.closed || !(await this.joined())) return false;
    try {
      const r = await this.ch.send({ type: "broadcast", event: EVENT, payload: msg });
      return r === "ok";
    } catch {
      return false;
    }
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
