import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// localStorage factice, posé avant la création du store (sinon persist est inactif).
vi.hoisted(() => {
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

import { useTimerStore, mergeTimerState } from "./timerStore";
import { useAgendaStore } from "./agendaStore";
import type { BusyEvent } from "@/lib/agendaFit";

// Le minuteur qui connaît ton agenda : horloge simulée, événements posés à la main.
const T0 = new Date("2026-03-02T14:36:00Z").getTime();
const min = (n: number) => n * 60_000;
const st = () => useTimerStore.getState();
const meeting = (startMin: number, endMin: number, title = "Réunion d'équipe"): BusyEvent => ({
  start: T0 + min(startMin),
  end: T0 + min(endMin),
  title,
});
const setEvents = (events: BusyEvent[]) => useAgendaStore.setState({ events });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  st().applyPreset("classic");
  st().resetAll();
  setEvents([]);
});
afterEach(() => vi.useRealTimers());

describe("démarrage d'un pomodoro avant une réunion", () => {
  it("sans agenda : 25 min, aucune proposition", () => {
    st().start();
    expect(st().secondsLeft).toBe(25 * 60);
    expect(st().agendaNotice).toBeNull();
  });

  it("réunion à +24 min : raccourci par défaut à 19 min (marge 5 min), crédit exact", () => {
    setEvents([meeting(24, 60)]);
    st().start();
    expect(st().isRunning).toBe(true);
    expect(st().secondsLeft).toBe(19 * 60);
    expect(st().cycleSeconds).toBe(19 * 60);
    expect(st().endsAt).toBe(T0 + min(19));
    const n = st().agendaNotice;
    expect(n?.kind).toBe("fit");
    if (n?.kind === "fit") {
      expect(n.fullSeconds).toBe(25 * 60);
      expect(n.event.title).toBe("Réunion d'équipe");
    }
  });

  it("« Garder 25 min » rétablit la durée pleine, même après quelques minutes", () => {
    setEvents([meeting(24, 60)]);
    st().start();
    vi.setSystemTime(T0 + min(3));
    st().tick();
    st().keepFullCycle();
    expect(st().cycleSeconds).toBe(25 * 60);
    expect(st().secondsLeft).toBe(22 * 60);
    expect(st().endsAt).toBe(T0 + min(25));
    expect(st().agendaNotice).toBeNull();
    // L'événement gardé n'est pas reproposé pendant ce cycle.
    st().refitAgenda();
    expect(st().cycleSeconds).toBe(25 * 60);
  });

  it("réunion loin : rien ne change", () => {
    setEvents([meeting(40, 60)]);
    st().start();
    expect(st().secondsLeft).toBe(25 * 60);
    expect(st().agendaNotice).toBeNull();
  });

  it("réunion dans 8 min : pas assez pour un pomodoro, rien ne démarre", () => {
    setEvents([meeting(8, 38)]);
    st().start();
    expect(st().isRunning).toBe(false);
    expect(st().active).toBe(true);
    expect(st().secondsLeft).toBe(25 * 60);
    const n = st().agendaNotice;
    expect(n?.kind).toBe("tooShort");
    if (n?.kind === "tooShort") {
      expect(n.until).toBe(T0 + min(38));
      expect(n.inProgress).toBe(false);
    }
  });

  it("« Démarrer quand même » : un cycle plein, la réunion ignorée pour ce cycle", () => {
    setEvents([meeting(8, 38)]);
    st().start();
    st().start();
    expect(st().isRunning).toBe(true);
    expect(st().secondsLeft).toBe(25 * 60);
    expect(st().agendaNotice).toBeNull();
  });

  it("« Attendre » : pause jusqu'à la fin de la réunion, puis invitation à reprendre", () => {
    setEvents([meeting(8, 38)]);
    st().start();
    st().waitForMeeting();
    expect(st().mode).toBe("short-break");
    expect(st().isRunning).toBe(true);
    expect(st().endsAt).toBe(T0 + min(38));
    expect(st().agendaMeeting?.until).toBe(T0 + min(38));
    expect(st().sessionsCompleted).toBe(0);
    vi.setSystemTime(T0 + min(38));
    st().nextSession(true);
    expect(st().mode).toBe("work");
    expect(st().isRunning).toBe(false);
    expect(st().agendaNotice?.kind).toBe("resume");
    expect(st().agendaMeeting).toBeNull();
    st().start();
    expect(st().isRunning).toBe(true);
    expect(st().secondsLeft).toBe(25 * 60);
    expect(st().agendaNotice).toBeNull();
  });

  it("« Ignorer la réunion » : durée pleine et plus de proposition pour la session", () => {
    setEvents([meeting(24, 60)]);
    st().start();
    st().ignoreAgendaEvent();
    expect(st().cycleSeconds).toBe(25 * 60);
    expect(st().agendaNotice).toBeNull();
    vi.setSystemTime(T0 + min(25));
    st().nextSession(true); // pause : la réunion ignorée ne la rallonge pas
    expect(st().secondsLeft).toBe(5 * 60);
    expect(st().agendaMeeting).toBeNull();
  });

  it("réunion en cours : pas de cycle, attente jusqu'à sa fin", () => {
    setEvents([meeting(-10, 20)]);
    st().start();
    const n = st().agendaNotice;
    expect(n?.kind).toBe("tooShort");
    if (n?.kind === "tooShort") {
      expect(n.inProgress).toBe(true);
      expect(n.until).toBe(T0 + min(20));
    }
  });
});

describe("pendant la réunion", () => {
  it("un cycle qui finit sur la réunion : pause rallongée jusqu'à sa fin, puis « Reprendre »", () => {
    setEvents([meeting(24, 60)]);
    st().start(); // 19 min
    vi.setSystemTime(T0 + min(19));
    st().nextSession(true);
    expect(st().mode).toBe("short-break");
    expect(st().sessionsCompleted).toBe(1);
    expect(st().secondsLeft).toBe(41 * 60);
    expect(st().endsAt).toBe(T0 + min(60));
    expect(st().agendaMeeting?.event.title).toBe("Réunion d'équipe");
    // Fin de la réunion : on ne relance pas le travail sans l'utilisateur.
    vi.setSystemTime(T0 + min(60));
    st().nextSession(true);
    expect(st().mode).toBe("work");
    expect(st().isRunning).toBe(false);
    expect(st().agendaNotice?.kind).toBe("resume");
    expect(st().secondsLeft).toBe(25 * 60);
  });

  it("passer la pause pendant la réunion : on ne lance pas de travail qui la chevauche", () => {
    setEvents([meeting(24, 60)]);
    st().start();
    vi.setSystemTime(T0 + min(19));
    st().nextSession(true);
    vi.setSystemTime(T0 + min(30)); // en pleine réunion
    st().nextSession(true);
    expect(st().mode).toBe("work");
    expect(st().isRunning).toBe(false);
    expect(st().agendaNotice?.kind).toBe("tooShort");
  });

  it("deux réunions qui se suivent : la pause couvre les deux", () => {
    setEvents([meeting(24, 40), meeting(42, 55, "Point client")]);
    st().start();
    vi.setSystemTime(T0 + min(19));
    st().nextSession(true);
    expect(st().endsAt).toBe(T0 + min(55));
  });

  it("la pause rallongée survit au rechargement (agendaMeeting persisté)", () => {
    setEvents([meeting(24, 60)]);
    st().start();
    vi.setSystemTime(T0 + min(19));
    st().nextSession(true);
    const persisted = JSON.parse(localStorage.getItem("focusflow-timer")!).state;
    const merged = mergeTimerState(persisted, st(), T0 + min(20));
    expect(merged.agendaMeeting?.until).toBe(T0 + min(60));
  });
});

describe("agenda reçu après le démarrage (refitAgenda)", () => {
  it("cycle tout juste lancé : raccourci comme au départ", () => {
    st().start();
    vi.setSystemTime(T0 + 10_000);
    st().tick();
    setEvents([meeting(20, 50)]);
    st().refitAgenda();
    expect(st().agendaNotice?.kind).toBe("fit");
    expect(st().endsAt).toBe(T0 + 10_000 + min(14));
    expect(st().cycleSeconds).toBe(10 + 14 * 60);
  });

  it("en plein cycle : fin avant l'événement, minutes déjà faites comptées", () => {
    st().start();
    vi.setSystemTime(T0 + min(10));
    st().tick();
    setEvents([meeting(18, 50)]);
    st().refitAgenda();
    expect(st().secondsLeft).toBe(3 * 60);
    expect(st().cycleSeconds).toBe(13 * 60);
    expect(st().endsAt).toBe(T0 + min(13));
  });
});

describe("contraintes combinées et modes exclus", () => {
  it("heure d'arrêt plus proche que la réunion : l'arrêt gagne", () => {
    setEvents([meeting(30, 60)]);
    st().setStopAt(T0 + min(18));
    st().start();
    expect(st().secondsLeft).toBe(18 * 60);
    expect(st().agendaNotice).toBeNull();
  });

  it("réunion plus proche que l'heure d'arrêt : la réunion gagne", () => {
    setEvents([meeting(20, 40)]);
    st().setStopAt(T0 + min(120));
    st().start();
    expect(st().secondsLeft).toBe(15 * 60);
    expect(st().agendaNotice?.kind).toBe("fit");
  });

  it("Flowtime : l'agenda est sans effet", () => {
    st().applyPreset("flowtime");
    setEvents([meeting(8, 38)]);
    st().start();
    expect(st().isRunning).toBe(true);
    expect(st().agendaNotice).toBeNull();
  });

  it("calé sur la vidéo : l'agenda est sans effet", () => {
    setEvents([meeting(8, 38)]);
    st().startVideoSync("vid", [{ start: 0, end: 1500, kind: "work" }] as never);
    st().start();
    expect(st().isRunning).toBe(true);
    expect(st().agendaNotice).toBeNull();
  });

  it("fin de session : tout l'état agenda est effacé", () => {
    setEvents([meeting(24, 60)]);
    st().start();
    st().ignoreAgendaEvent();
    st().endSession();
    expect(st().agendaIgnored).toEqual([]);
    expect(st().agendaNotice).toBeNull();
    expect(st().agendaMeeting).toBeNull();
  });
});

describe("corrections de relecture", () => {
  it("heure d'arrêt atteinte : l'état agenda est remis à zéro", () => {
    setEvents([meeting(24, 60)]);
    st().setStopAt(T0 + min(30));
    st().start(); // raccourci à 19 min par la réunion
    expect(st().agendaNotice?.kind).toBe("fit");
    vi.setSystemTime(T0 + min(19));
    st().nextSession(true);
    expect(st().stopReached).toBe(true);
    expect(st().agendaNotice).toBeNull();
    expect(st().agendaMeeting).toBeNull();
    expect(st().agendaCycleIgnored).toEqual([]);
  });

  it("la réunion persistée ne contient pas son titre", () => {
    setEvents([meeting(24, 60)]);
    st().start();
    vi.setSystemTime(T0 + min(19));
    st().nextSession(true);
    const persisted = JSON.parse(localStorage.getItem("focusflow-timer")!).state;
    expect(persisted.agendaMeeting.event.title).toBeUndefined();
    expect(JSON.stringify(persisted)).not.toContain("Réunion d'équipe");
  });
});

describe("agendaStore : résultats périmés", () => {
  const pending: ((v: unknown) => void)[] = [];
  beforeEach(() => {
    pending.length = 0;
    useAgendaStore.getState().clear();
    globalThis.fetch = vi.fn(() => new Promise((resolve) => pending.push(resolve))) as never;
  });
  const respond = (i: number, events: BusyEvent[]) =>
    pending[i]({ ok: true, json: async () => ({ events }) });

  it("Retirer pendant la lecture : le résultat est ignoré", async () => {
    const p = useAgendaStore.getState().refresh("https://a.example.com/a.ics");
    useAgendaStore.getState().clear();
    respond(0, [meeting(24, 60)]);
    expect(await p).toBeNull();
    expect(useAgendaStore.getState().events).toEqual([]);
    expect(useAgendaStore.getState().status).toBe("idle");
  });

  it("Tester une autre adresse : seul le dernier résultat compte", async () => {
    const p1 = useAgendaStore.getState().refresh("https://a.example.com/a.ics");
    const p2 = useAgendaStore.getState().refresh("https://b.example.com/b.ics");
    respond(1, [meeting(40, 50, "B")]);
    respond(0, [meeting(24, 60, "A")]);
    expect(await p1).toBeNull();
    expect((await p2)?.ok).toBe(true);
    expect(useAgendaStore.getState().events.map((e) => e.title)).toEqual(["B"]);
  });
});
