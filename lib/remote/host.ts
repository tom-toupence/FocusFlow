// Décisions de l'ordinateur (lot 7), en logique PURE (testée dans host.test.ts).
// Le hook useRemoteHost exécute les actions rendues.
//   . Appairage : le premier `hello` d'un appareil demande « Autoriser ? » sur
//     l'ordinateur, avec son code de confirmation (empreinte de sa clé) ; seules
//     les commandes d'un appareil appairé sont appliquées. Le hook a déjà vérifié
//     la clé du hello et la signature ECDSA des commandes et de l'accusé.
//   . Chaque réponse à un hello renvoie son défi (`ch`) : le téléphone ne cale
//     son horloge que là-dessus.
//   . Handoff : la demande attend « Autoriser » ; l'état est alors figé (même
//     restant si le téléphone redemande), envoyé avec un nonce d'accusé. L'accusé
//     n'est accepté que s'il porte ce nonce ET que le mode et le nombre de
//     pomodoros n'ont pas bougé depuis l'envoi.
import { HANDOFF_ACK_TIMEOUT_MS, type HandoffState, type RemoteCommand, type RemoteMessage, type RemoteMessageBody } from "./protocol";
import type { TimerMode } from "@/store/timerStore";

/** Une demande en attente d'« Autoriser » sur l'ordinateur. */
export interface Ask { kind: "remote" | "handoff"; id: string; at: number; code: string; ch: string }

export interface Pending {
  id: string;
  ack: string;
  at: number;
  mode: TimerMode;
  sessionsCompleted: number;
  /** Restant au moment de l'envoi (null hors travail ou en Flowtime). */
  leftSeconds: number | null;
  ch: string;
  body: RemoteMessageBody;
}

export type HostAction =
  | { type: "send"; body: RemoteMessageBody }
  /** Diffuser l'état maintenant (s'il y a un appareil appairé). */
  | { type: "state" }
  | { type: "ask"; ask: Ask | null }
  | { type: "seen" }
  | { type: "command"; cmd: RemoteCommand }
  | { type: "pending"; pending: Pending | null }
  | { type: "handedOff"; pending: Pending };

/** Une demande sans réponse est oubliée au bout d'une minute (le téléphone redemandera). */
export const ASK_TIMEOUT_MS = 60_000;

export interface Snapshot { mode: TimerMode; sessionsCompleted: number }

export interface HandoffBuild extends Snapshot {
  state: HandoffState;
  leftSeconds: number | null;
}

export class HostLogic {
  paired = new Set<string>();
  ask: Ask | null = null;
  pending: Pending | null = null;
  handedOff = false;

  /** `code` : code de confirmation de l'appareil (hello seulement, calculé par le hook). */
  receive(m: RemoteMessage, now: number, snapshot: () => Snapshot, code = ""): HostAction[] {
    switch (m.type) {
      case "hello":
        return m.role === "remote" ? this.helloRemote(m.id, m.ch, code, now) : this.helloHandoff(m.id, m.ch, code, now);
      case "cmd":
        // Un appareil non appairé ne commande rien.
        if (!this.paired.has(m.id)) return [];
        return [{ type: "seen" }, { type: "command", cmd: m.cmd }, { type: "state" }];
      case "ack":
        return this.onAck(m.id, m.ack, snapshot());
      default:
        return []; // wait/paired/state/handoff/refused/bye viennent d'un ordinateur
    }
  }

  private helloRemote(id: string, ch: string, code: string, now: number): HostAction[] {
    if (this.paired.has(id)) return [{ type: "seen" }, { type: "send", body: { type: "paired", id, ch } }, { type: "state" }];
    if (!this.ask) this.ask = { kind: "remote", id, at: now, code, ch };
    else if (this.ask.id === id) this.ask = { ...this.ask, ch };
    return [{ type: "ask", ask: this.ask }, { type: "send", body: { type: "wait", id, ch } }];
  }

  private helloHandoff(id: string, ch: string, code: string, now: number): HostAction[] {
    if (this.handedOff) return [{ type: "send", body: { type: "refused", id, reason: "taken", ch } }];
    if (this.pending) {
      // Même appareil : le même état figé, renvoyé tel quel (après un wait qui cale
      // son horloge). Un autre : refusé.
      return this.pending.id === id
        ? [{ type: "send", body: { type: "wait", id, ch } }, { type: "send", body: this.pending.body }]
        : [{ type: "send", body: { type: "refused", id, reason: "taken", ch } }];
    }
    if (!this.ask) this.ask = { kind: "handoff", id, at: now, code, ch };
    else if (this.ask.id === id) this.ask = { ...this.ask, ch };
    return [{ type: "ask", ask: this.ask }, { type: "send", body: { type: "wait", id, ch } }];
  }

  /** « Autoriser » sur l'ordinateur. `build` n'est appelé que pour un handoff. */
  authorize(now: number, build: () => HandoffBuild, ackNonce: string): HostAction[] {
    const a = this.ask;
    if (!a) return [];
    this.ask = null;
    if (a.kind === "remote") {
      this.paired.add(a.id);
      return [{ type: "ask", ask: null }, { type: "seen" }, { type: "send", body: { type: "paired", id: a.id, ch: a.ch } }, { type: "state" }];
    }
    if (this.handedOff) return [{ type: "ask", ask: null }];
    const b = build();
    const body: RemoteMessageBody = { type: "handoff", id: a.id, ack: ackNonce, state: b.state };
    this.pending = { id: a.id, ack: ackNonce, at: now, mode: b.mode, sessionsCompleted: b.sessionsCompleted, leftSeconds: b.leftSeconds, ch: a.ch, body };
    return [{ type: "ask", ask: null }, { type: "pending", pending: this.pending }, { type: "send", body }];
  }

  deny(): HostAction[] {
    const a = this.ask;
    if (!a) return [];
    this.ask = null;
    return [{ type: "ask", ask: null }, { type: "send", body: { type: "refused", id: a.id, reason: "denied", ch: a.ch } }];
  }

  private onAck(id: string, ack: string, snap: Snapshot): HostAction[] {
    const p = this.pending;
    if (!p || p.id !== id || p.ack !== ack) return [];
    if (this.handedOff) return [{ type: "send", body: { type: "bye", reason: "handed-off" } }]; // bye perdu : redit
    if (snap.mode !== p.mode || snap.sessionsCompleted !== p.sessionsCompleted) {
      // Le cycle a changé entre l'envoi et l'accusé : rien n'est transféré.
      this.pending = null;
      return [{ type: "pending", pending: null }, { type: "send", body: { type: "refused", id, reason: "changed", ch: p.ch } }];
    }
    this.handedOff = true;
    return [{ type: "handedOff", pending: p }];
  }

  tick(now: number): HostAction[] {
    const out: HostAction[] = [];
    if (this.pending && !this.handedOff && now - this.pending.at > HANDOFF_ACK_TIMEOUT_MS) {
      // Pas d'accusé : l'ordinateur continue, comme si de rien n'était.
      this.pending = null;
      out.push({ type: "pending", pending: null });
    }
    if (this.ask && now - this.ask.at > ASK_TIMEOUT_MS) {
      this.ask = null;
      out.push({ type: "ask", ask: null });
    }
    return out;
  }
}
