import { describe, it, expect } from "vitest";
import {
  CODE_ALPHABET, generateCode, normalizeCode, makeMessage, parseMessage, ReplayGuard, displaySeconds,
  isPhoneConnected, MAX_MESSAGE_AGE_MS, type RemoteState,
} from "./protocol";

const STATE: RemoteState = {
  mode: "work", running: true, flow: false, endsAt: 1_000_000 + 600_000, flowStartedAt: null,
  seconds: 600, total: 1500, pomodoro: 2, title: "Kyoto drive", sub: null, caps: { skip: true },
  distractions: 1, expiresAt: 1_000_000 + 7_200_000,
};

describe("code d'appairage", () => {
  it("6 caractères de l'alphabet sans ambiguïté", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateCode();
      expect(c).toMatch(/^[A-Z2-9]{6}$/);
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
      expect(c).not.toMatch(/[ILO01]/);
    }
  });

  it("tirage par rejet : les octets hors de la plage sans biais sont jetés", () => {
    // 248..255 rejetés ; 0 -> A, 31 -> A, 1 -> B
    let call = 0;
    const rand = (n: number) => {
      call++;
      return call === 1 ? new Uint8Array([255, 250, 248, 0, 31, 1, 2, 3, 4, ...new Array(n - 9).fill(255)]) : new Uint8Array(n).fill(5);
    };
    expect(generateCode(rand)).toBe("AABCDE");
  });

  it("normalise la saisie et refuse le reste", () => {
    expect(normalizeCode(" abc234 ")).toBe("ABC234");
    expect(normalizeCode("ABC23")).toBeNull();
    expect(normalizeCode("ABC2340")).toBeNull();
    expect(normalizeCode("ABCDE1")).toBeNull(); // 1 hors alphabet
    expect(normalizeCode("ABC-23")).toBeNull();
    expect(normalizeCode(42)).toBeNull();
  });
});

describe("validation des messages", () => {
  it("accepte les messages v1 bien formés", () => {
    const now = 1_000_000;
    expect(parseMessage(makeMessage({ type: "state", s: STATE }, now))).not.toBeNull();
    expect(parseMessage(makeMessage({ type: "cmd", id: "device1234", cmd: "pause" }, now))).not.toBeNull();
    expect(parseMessage(makeMessage({ type: "hello", role: "remote", id: "abcdEFGH12" }, now))).not.toBeNull();
    expect(parseMessage(makeMessage({ type: "bye", reason: "expired" }, now))).not.toBeNull();
    expect(parseMessage(makeMessage({ type: "wait", id: "abcdEFGH12" }, now))).not.toBeNull();
    expect(parseMessage(makeMessage({ type: "paired", id: "abcdEFGH12" }, now))).not.toBeNull();
    expect(parseMessage(makeMessage({ type: "refused", id: "abcdEFGH12", reason: "changed" }, now))).not.toBeNull();
    expect(parseMessage(makeMessage({ type: "ack", id: "abcdEFGH12", ack: "nonceNONCEnonce123" }, now))).not.toBeNull();
  });

  it("ignore les types inconnus, les autres versions et les formes lâches", () => {
    const base = makeMessage({ type: "cmd", id: "device1234", cmd: "pause" }, 1_000_000);
    expect(parseMessage({ ...base, type: "shutdown" })).toBeNull();
    expect(parseMessage({ ...base, v: 2 })).toBeNull();
    expect(parseMessage({ ...base, cmd: "reboot" })).toBeNull();
    expect(parseMessage({ ...base, extra: 1 })).toBeNull(); // clé en trop
    expect(parseMessage({ ...base, n: "court" })).toBeNull();
    expect(parseMessage({ ...base, t: "hier" })).toBeNull();
    expect(parseMessage({ ...base, id: undefined })).toBeNull(); // commande sans appareil
    expect(parseMessage(makeMessage({ type: "ack", id: "abcdEFGH12", ack: "court" }, 1_000_000))).toBeNull();
    expect(parseMessage(makeMessage({ type: "refused", id: "abcdEFGH12", reason: "parce que" } as never, 1_000_000))).toBeNull();
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage("cmd")).toBeNull();
    expect(parseMessage([base])).toBeNull();
  });

  it("borne les tailles et vérifie les types de l'état", () => {
    const ok = makeMessage({ type: "state", s: STATE }, 1_000_000);
    expect(parseMessage({ ...ok, s: { ...STATE, title: "x".repeat(201) } })).toBeNull();
    expect(parseMessage({ ...ok, s: { ...STATE, mode: "nap" } })).toBeNull();
    expect(parseMessage({ ...ok, s: { ...STATE, seconds: -1 } })).toBeNull();
    expect(parseMessage({ ...ok, s: { ...STATE, seconds: 1.5 } })).toBeNull();
    expect(parseMessage({ ...ok, s: { ...STATE, caps: { skip: "oui" } } })).toBeNull();
    expect(parseMessage({ ...ok, s: { ...STATE, endsAt: Infinity } })).toBeNull();
    const { title: _t, ...missing } = STATE;
    void _t;
    expect(parseMessage({ ...ok, s: missing })).toBeNull();
  });
});

describe("anti-rejeu", () => {
  it("refuse un message vu deux fois", () => {
    const g = new ReplayGuard();
    const m = makeMessage({ type: "cmd", id: "device1234", cmd: "distraction" }, 1_000_000);
    expect(g.accept(m, 1_000_100)).not.toBeNull();
    expect(g.accept(m, 1_000_200)).toBeNull();
  });

  it("refuse un message de plus de 30 s (ou daté du futur de plus de 30 s)", () => {
    const g = new ReplayGuard();
    expect(g.accept(makeMessage({ type: "cmd", id: "device1234", cmd: "pause" }, 1_000_000), 1_000_000 + MAX_MESSAGE_AGE_MS + 1)).toBeNull();
    expect(g.accept(makeMessage({ type: "cmd", id: "device1234", cmd: "pause" }, 1_000_000), 1_000_000 - MAX_MESSAGE_AGE_MS - 1)).toBeNull();
    expect(g.accept(makeMessage({ type: "cmd", id: "device1234", cmd: "pause" }, 1_000_000), 1_000_000 + MAX_MESSAGE_AGE_MS)).not.toBeNull();
  });

  it("téléphone : décalage estimé sur le premier message signé, puis fenêtre de 30 s corrigée", () => {
    const g = new ReplayGuard(undefined, null);
    const hostT = 1_000_000;
    const phoneNow = hostT + 5 * 60_000; // téléphone en avance de 5 min
    const first = makeMessage({ type: "wait", id: "abcdEFGH12" }, hostT);
    expect(g.accept(first, phoneNow)).toBeNull(); // pas encore calé
    g.calibrate(first, phoneNow);
    expect(g.offset).toBe(5 * 60_000);
    expect(g.accept(first, phoneNow)).not.toBeNull();
    expect(g.accept(makeMessage({ type: "wait", id: "abcdEFGH12" }, hostT - 40_000), phoneNow)).toBeNull();
    // Au-delà de 24 h, pas de calage.
    const g2 = new ReplayGuard(undefined, null);
    g2.calibrate(makeMessage({ type: "wait", id: "abcdEFGH12" }, 1), 9e12);
    expect(g2.offset).toBeNull();
  });

  it("reste borné en mémoire sous une inondation de nonces", () => {
    const g = new ReplayGuard();
    for (let i = 0; i < 2000; i++) g.accept(makeMessage({ type: "cmd", id: "device1234", cmd: "pause" }, 1_000_000), 1_000_000);
    // Toujours fonctionnel : un nouveau message passe.
    expect(g.accept(makeMessage({ type: "cmd", id: "device1234", cmd: "next" }, 1_000_000), 1_000_000)).not.toBeNull();
  });
});

describe("affichage du téléphone", () => {
  it("temps restant depuis l'échéance, corrigé du décalage d'horloge", () => {
    // Téléphone en avance de 5 s sur l'ordinateur.
    const offset = 5000;
    const phoneNow = 1_000_000 + offset + 60_000; // 60 s plus tard côté ordinateur
    expect(displaySeconds(STATE, offset, phoneNow)).toBe(540);
  });

  it("valeur figée en pause, chrono croissant en flow", () => {
    expect(displaySeconds({ ...STATE, running: false, endsAt: null, seconds: 321 }, 0, 9e9)).toBe(321);
    expect(displaySeconds({ ...STATE, flow: true, endsAt: null, flowStartedAt: 1_000_000 }, 0, 1_000_000 + 90_500)).toBe(90);
  });

  it("téléphone connecté s'il a parlé dans les 15 dernières secondes", () => {
    expect(isPhoneConnected(null, 1000)).toBe(false);
    expect(isPhoneConnected(1000, 16_000)).toBe(true);
    expect(isPhoneConnected(1000, 16_001)).toBe(false);
  });
});
