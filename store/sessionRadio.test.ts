import { describe, it, expect, beforeEach, vi } from "vitest";
// localStorage factice, posé avant la création des stores (persist actif).
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
});
vi.mock("@/components/Toast", () => ({ toast: vi.fn() }));

import { useSessionStore } from "./sessionStore";
import { useSpotifyStore } from "./spotifyStore";
import { useTwitchStore } from "./twitchStore";
import { useTimerStore } from "./timerStore";
import { joinRadio } from "@/lib/radioSession";
import { applyRoutine, captureCurrentRoutine } from "@/lib/routines";

describe("sélection « radio » (exclusive)", () => {
  beforeEach(() => useSessionStore.getState().selectVideo("abao-01"));

  it("selectRadio coupe vidéo, playlist et file ; toute autre sélection coupe la radio", () => {
    const s = () => useSessionStore.getState();
    s().selectRadio();
    expect(s()).toMatchObject({ playRadio: true, playQueue: false, selectedVideoId: null, selectedPlaylistId: null });
    s().selectQueue();
    expect(s()).toMatchObject({ playRadio: false, playQueue: true });
    s().selectRadio();
    s().selectPlaylist("pl1");
    expect(s()).toMatchObject({ playRadio: false, selectedPlaylistId: "pl1" });
    s().selectRadio();
    s().selectVideo("abao-02");
    expect(s()).toMatchObject({ playRadio: false, selectedVideoId: "abao-02" });
  });

  it("persistée avec le reste de la sélection", () => {
    useSessionStore.getState().selectRadio();
    const saved = JSON.parse(localStorage.getItem("focusflow-session")!).state;
    expect(saved.playRadio).toBe(true);
  });

  it("routine : la radio est capturée comme média, puis réappliquée", () => {
    useSessionStore.getState().selectRadio();
    const draft = captureCurrentRoutine();
    expect(draft.media).toMatchObject({ kind: "radio" });
    useSessionStore.getState().selectVideo("abao-02");
    useSpotifyStore.getState().selectPlaylist("spotify:playlist:y");
    applyRoutine({ ...draft, id: "r1", name: "Radio", color: "#000" });
    expect(useSessionStore.getState().playRadio).toBe(true);
    expect(useSpotifyStore.getState().selectedPlaylistUri).toBeNull();
  });

  it("joinRadio : radio sélectionnée, Spotify et Twitch coupés, minuteur remis à zéro avec le preset courant, /session", () => {
    useSpotifyStore.getState().selectPlaylist("spotify:playlist:x");
    useTwitchStore.getState().selectChannel("chaine");
    useTimerStore.getState().applyPreset("deep");
    const push = vi.fn();
    joinRadio({ push });
    expect(useSessionStore.getState().playRadio).toBe(true);
    expect(useSpotifyStore.getState().selectedPlaylistUri).toBeNull();
    expect(useTwitchStore.getState().selectedChannel).toBeNull();
    const t = useTimerStore.getState();
    expect(t.settings.preset).toBe("deep");
    expect(t.active).toBe(false);
    expect(push).toHaveBeenCalledWith("/session");
  });
});
