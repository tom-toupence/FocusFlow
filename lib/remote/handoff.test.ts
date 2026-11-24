import { describe, it, expect, vi, beforeEach } from "vitest";
const memory = vi.hoisted(() => {
  const data = new Map<string, string>();
  const ls = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g.localStorage = ls;
  g.window = { localStorage: ls };
  return data;
});

import { useTimerStore, PRESETS } from "@/store/timerStore";
import { useStatsStore, localToday } from "@/store/statsStore";
import { closeActiveSession } from "@/lib/sessionEnd";
import type { Todo } from "@/store/sessionStore";
import {
  buildHandoffState, mediaForHandoff, phoneTimerPatch, splitCredit, isSameSession, mergeTodos, resumePosition,
  type MediaSnapshot, type TimerSnapshot,
} from "./handoff";
import { makeMessage, parseMessage, MAX_TODOS, MAX_TRACKS } from "./protocol";

const T0 = 1_700_000_000_000;
const classic = { preset: "classic" as const, ...PRESETS.classic };

const timer = (over: Partial<TimerSnapshot> = {}): TimerSnapshot => ({
  settings: classic, mode: "work", isRunning: true, endsAt: T0 + 15 * 60_000, secondsLeft: 900,
  cycleSeconds: 1500, sessionsCompleted: 2, stopAt: null, flowBreakTotal: 0, ...over,
});
const video: MediaSnapshot = {
  kind: "youtube", youtube: { type: "video", id: "86CFyZDqiAI", title: "Rainy Shibuya", subtitle: "Abao in Tokyo" },
  spotifyUri: null, twitch: null, trackId: "86CFyZDqiAI", position: 312.46, playing: true,
};
const todos: Todo[] = [
  { id: "t1", text: "Finir le rapport", status: "in-progress" },
  { id: "t2", text: "Relire", status: "done" },
];

/** Aller-retour réseau : JSON puis validation stricte du message. */
function roundTrip(state: ReturnType<typeof buildHandoffState>) {
  const wire = JSON.parse(JSON.stringify(makeMessage({ type: "handoff", id: "req12345", state }, T0)));
  const m = parseMessage(wire);
  if (!m || m.type !== "handoff") throw new Error("message refusé");
  return m.state;
}

describe("sérialisation de la session", () => {
  it("l'état complet passe la validation après un aller-retour JSON", () => {
    const s = roundTrip(buildHandoffState(timer(), todos, video, T0));
    expect(s.timer.secondsLeft).toBe(900);
    expect(s.timer.endsAt).toBe(T0 + 15 * 60_000);
    expect(s.media).toEqual({ kind: "video", id: "86CFyZDqiAI", title: "Rainy Shibuya", sub: "Abao in Tokyo", position: 312.5, playing: true });
    expect(s.todos.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("restant exact au moment de l'envoi (depuis l'échéance)", () => {
    const s = buildHandoffState(timer(), [], video, T0 + 60_000);
    expect(s.timer.secondsLeft).toBe(840);
  });

  it("file maison : la piste en cours d'abord, bornée à 200 titres", () => {
    const tracks = Array.from({ length: 250 }, (_, i) => ({ id: `vid${String(i).padStart(8, "0")}`, title: `Titre ${i}` }));
    const m = mediaForHandoff({ ...video, youtube: { type: "queue", tracks, subtitle: "Ma file" }, trackId: tracks[3].id, position: 42 });
    expect(m.kind).toBe("queue");
    if (m.kind !== "queue") return;
    expect(m.tracks).toHaveLength(MAX_TRACKS);
    expect(m.tracks[0].id).toBe(tracks[3].id);
    expect(m.tracks[1].id).toBe(tracks[4].id);
    expect(m.index).toBe(0);
    expect(m.position).toBe(42);
  });

  it("tâches bornées, non terminées d'abord", () => {
    const many: Todo[] = Array.from({ length: 80 }, (_, i) => ({ id: `id${i}`, text: `T${i}`, status: i % 2 ? "done" : "todo" }));
    const s = roundTrip(buildHandoffState(timer(), many, video, T0));
    expect(s.todos).toHaveLength(MAX_TODOS);
    expect(s.todos.slice(0, 40).every((t) => t.status === "todo")).toBe(true);
  });

  it("Spotify, Twitch et radio : ce qui peut être repris", () => {
    expect(mediaForHandoff({ ...video, kind: "spotify", youtube: null, spotifyUri: "spotify:playlist:37i9dQZF1DX8Uebhn9wzrS" })).toEqual({ kind: "spotify", uri: "spotify:playlist:37i9dQZF1DX8Uebhn9wzrS" });
    expect(mediaForHandoff({ ...video, kind: "twitch", youtube: null, twitch: { channel: "lofigirl" } })).toEqual({ kind: "twitch", channel: "lofigirl", vodId: null });
    expect(mediaForHandoff({ ...video, youtube: { type: "radio" } })).toEqual({ kind: "radio" });
    expect(mediaForHandoff({ ...video, youtube: null })).toEqual({ kind: "none" });
  });

  it("refuse un état corrompu (média, minuteur, tâches)", () => {
    const s = buildHandoffState(timer(), todos, video, T0);
    const send = (state: unknown) => parseMessage(makeMessage({ type: "handoff", id: "req12345", state } as never, T0));
    expect(send({ ...s, media: { kind: "video", id: "pas-un-id", title: "x", sub: null, position: 0, playing: true } })).toBeNull();
    expect(send({ ...s, timer: { ...s.timer, mode: "sieste" } })).toBeNull();
    expect(send({ ...s, todos: [{ id: "a", text: "", status: "todo" }] })).toBeNull();
    expect(send({ ...s, media: { kind: "spotify", uri: "javascript:alert(1)" } })).toBeNull();
  });
});

describe("désérialisation côté téléphone", () => {
  it("même temps restant, corrigé du décalage d'horloge", () => {
    const s = roundTrip(buildHandoffState(timer(), todos, video, T0));
    const offset = -4000; // téléphone en retard de 4 s
    const phoneNow = T0 + offset + 1000; // 1 s de transit
    const p = phoneTimerPatch(s, offset, phoneNow);
    expect(p.endsAt).toBe(T0 + 15 * 60_000 + offset);
    expect(p.secondsLeft).toBe(899);
    expect(p.mode).toBe("work");
    expect(p.sessionsCompleted).toBe(2);
    expect(p.active).toBe(true);
  });

  it("session en pause : reste en pause au même restant", () => {
    const s = roundTrip(buildHandoffState(timer({ isRunning: false, endsAt: null, secondsLeft: 600 }), [], video, T0));
    const p = phoneTimerPatch(s, 0, T0 + 5000);
    expect(p.isRunning).toBe(false);
    expect(p.endsAt).toBeNull();
    expect(p.secondsLeft).toBe(600);
  });

  it("Flowtime : le téléphone repart d'un flow à zéro (l'ordinateur a tout crédité)", () => {
    const s = roundTrip(buildHandoffState(timer({ settings: { preset: "flowtime", ...PRESETS.flowtime }, endsAt: null }), [], video, T0));
    const p = phoneTimerPatch(s, 0, T0);
    expect(p.flowSeconds).toBe(0);
    expect(p.flowStartedAt).toBe(T0);
    expect(p.endsAt).toBeNull();
  });

  it("reconnaît la même session (même navigateur) pour ne pas la clore deux fois", () => {
    const s = buildHandoffState(timer(), [], video, T0);
    const local = { active: true, mode: "work" as const, sessionsCompleted: 2, isRunning: true, endsAt: T0 + 15 * 60_000 + 500, secondsLeft: 900, settings: { preset: "classic" } };
    expect(isSameSession(local, s, 0)).toBe(true);
    expect(isSameSession({ ...local, sessionsCompleted: 1 }, s, 0)).toBe(false);
    expect(isSameSession({ ...local, endsAt: T0 }, s, 0)).toBe(false);
    expect(isSameSession({ ...local, active: false }, s, 0)).toBe(false);
  });

  it("fusion des tâches par id", () => {
    const local: Todo[] = [{ id: "t1", text: "ancien", status: "todo" }, { id: "p1", text: "à moi", status: "todo" }];
    const merged = mergeTodos(local, [{ id: "t1", text: "Finir le rapport", status: "done" }, { id: "t3", text: "Nouveau", status: "todo" }], "2026-11-24");
    expect(merged.map((t) => [t.id, t.text, t.status])).toEqual([
      ["t1", "Finir le rapport", "done"], ["p1", "à moi", "todo"], ["t3", "Nouveau", "todo"],
    ]);
    expect(merged[0].completedAt).toBe("2026-11-24");
  });

  it("seconde de reprise recalculée au moment du toucher", () => {
    expect(resumePosition(312.5, true, 1000, 8000)).toBeCloseTo(319.5);
    expect(resumePosition(312.5, false, 1000, 8000)).toBe(312.5);
  });
});

describe("crédit unique", () => {
  it("ordinateur + téléphone = le cycle, jamais plus", () => {
    for (const left of [0, 1, 59, 600, 899, 1499, 1500]) {
      const { hostSeconds, phoneCycleSeconds } = splitCredit("work", 1500, left);
      expect(hostSeconds + phoneCycleSeconds).toBe(1500);
    }
    expect(splitCredit("short-break", 300, 120)).toEqual({ hostSeconds: 0, phoneCycleSeconds: 300 });
  });

  beforeEach(() => {
    memory.clear();
    useStatsStore.setState({ days: {} });
  });

  it("le téléphone ne recrédite pas la part de l'ordinateur, même s'il clôt aussitôt", () => {
    // 10 min faites sur l'ordinateur, envoyé avec 15 min restantes.
    const s = roundTrip(buildHandoffState(timer(), [], video, T0));
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 5 * 60_000); // 5 min plus tard sur le téléphone
    useTimerStore.setState({ ...phoneTimerPatch(s, 0, T0), hydrated: true });
    closeActiveSession();
    const day = localToday();
    vi.useRealTimers();
    // Crédité ici : les 5 min faites sur le téléphone, pas les 10 de l'ordinateur.
    expect(useStatsStore.getState().days[day]?.minutesWorked).toBe(5);
  });
});
