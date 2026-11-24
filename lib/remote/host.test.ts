import { describe, it, expect } from "vitest";
import { HostLogic, type HandoffBuild, type HostAction } from "./host";
import { makeMessage, type HandoffState, type RemoteMessage, type RemoteMessageBody } from "./protocol";

const msg = (body: RemoteMessageBody) => makeMessage(body, 1_000) as RemoteMessage;
const snap = (mode: "work" | "short-break" = "work", sessionsCompleted = 2) => () => ({ mode, sessionsCompleted });
const sent = (a: HostAction[]) => a.filter((x): x is Extract<HostAction, { type: "send" }> => x.type === "send").map((x) => x.body);
const STATE = { timer: {}, todos: [], media: { kind: "none" } } as unknown as HandoffState;
const build = (left = 900): HandoffBuild => ({ state: STATE, mode: "work", sessionsCompleted: 2, leftSeconds: left });
const ACK = "ackNONCEack123456";

describe("appairage de la télécommande", () => {
  it("premier hello : demande sur l'ordinateur, aucune commande avant Autoriser", () => {
    const h = new HostLogic();
    const a = h.receive(msg({ type: "hello", role: "remote", id: "phoneA1234" }), 0, snap());
    expect(a).toContainEqual({ type: "ask", ask: { kind: "remote", id: "phoneA1234", at: 0 } });
    expect(sent(a)).toEqual([{ type: "wait", id: "phoneA1234" }]);
    expect(h.receive(msg({ type: "cmd", id: "phoneA1234", cmd: "pause" }), 0, snap())).toEqual([]);
    const ok = h.authorize(1, build, ACK);
    expect(sent(ok)).toEqual([{ type: "paired", id: "phoneA1234" }]);
    expect(h.receive(msg({ type: "cmd", id: "phoneA1234", cmd: "pause" }), 2, snap())).toContainEqual({ type: "command", cmd: "pause" });
  });

  it("un autre appareil non appairé ne commande rien, Refuser le dit au téléphone", () => {
    const h = new HostLogic();
    h.receive(msg({ type: "hello", role: "remote", id: "phoneA1234" }), 0, snap());
    h.authorize(1, build, ACK);
    expect(h.receive(msg({ type: "cmd", id: "intrus1234", cmd: "next" }), 2, snap())).toEqual([]);
    h.receive(msg({ type: "hello", role: "remote", id: "intrus1234" }), 3, snap());
    expect(sent(h.deny())).toEqual([{ type: "refused", id: "intrus1234", reason: "denied" }]);
    expect(h.paired.has("intrus1234")).toBe(false);
  });
});

describe("handoff", () => {
  const asked = () => {
    const h = new HostLogic();
    h.receive(msg({ type: "hello", role: "handoff", id: "req12345" }), 0, snap());
    return h;
  };

  it("rien n'est envoyé avant Autoriser", () => {
    const h = new HostLogic();
    const a = h.receive(msg({ type: "hello", role: "handoff", id: "req12345" }), 0, snap());
    expect(sent(a)).toEqual([{ type: "wait", id: "req12345" }]);
    expect(h.pending).toBeNull();
  });

  it("état figé : un hello répété renvoie exactement le même message", () => {
    const h = asked();
    const first = sent(h.authorize(1, () => build(900), ACK))[0];
    const again = sent(h.receive(msg({ type: "hello", role: "handoff", id: "req12345" }), 5_000, snap()))[0];
    expect(again).toBe(first);
    expect(first).toMatchObject({ type: "handoff", ack: ACK });
    // Une autre demande pendant ce temps : refusée.
    expect(sent(h.receive(msg({ type: "hello", role: "handoff", id: "autre1234" }), 5_000, snap()))).toEqual([{ type: "refused", id: "autre1234", reason: "taken" }]);
  });

  it("l'accusé doit porter le nonce du handoff", () => {
    const h = asked();
    h.authorize(1, build, ACK);
    expect(h.receive(msg({ type: "ack", id: "req12345", ack: "mauvaisNONCE12345" }), 2, snap())).toEqual([]);
    const ok = h.receive(msg({ type: "ack", id: "req12345", ack: ACK }), 2, snap());
    expect(ok).toEqual([{ type: "handedOff", pending: expect.objectContaining({ leftSeconds: 900, mode: "work" }) }]);
    // Accusé répété (bye perdu) : le bye est redit, pas de deuxième crédit.
    expect(h.receive(msg({ type: "ack", id: "req12345", ack: ACK }), 3, snap())).toEqual([{ type: "send", body: { type: "bye", reason: "handed-off" } }]);
  });

  it("accusé refusé si le cycle a changé depuis l'envoi", () => {
    const h = asked();
    h.authorize(1, build, ACK);
    const a = h.receive(msg({ type: "ack", id: "req12345", ack: ACK }), 2, snap("short-break", 3));
    expect(sent(a)).toEqual([{ type: "refused", id: "req12345", reason: "changed" }]);
    expect(h.handedOff).toBe(false);
    expect(h.pending).toBeNull();
  });

  it("sans accusé en 10 s, l'ordinateur oublie la demande et continue", () => {
    const h = asked();
    h.authorize(1, build, ACK);
    expect(h.tick(12_000)).toContainEqual({ type: "pending", pending: null });
    expect(h.receive(msg({ type: "ack", id: "req12345", ack: ACK }), 12_001, snap())).toEqual([]);
  });

  it("après le transfert, le code ne sert plus", () => {
    const h = asked();
    h.authorize(1, build, ACK);
    h.receive(msg({ type: "ack", id: "req12345", ack: ACK }), 2, snap());
    expect(sent(h.receive(msg({ type: "hello", role: "handoff", id: "autre1234" }), 3, snap()))).toEqual([{ type: "refused", id: "autre1234", reason: "taken" }]);
  });
});
