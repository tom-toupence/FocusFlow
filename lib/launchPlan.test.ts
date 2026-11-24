import { describe, expect, it } from "vitest";
import { parseQuickLaunch } from "./quickLaunch";
import { buildContextFrom, resolveLaunch, timerPlan, type ContextSnapshot } from "./launchPlan";
import { PRESETS } from "@/store/timerStore";
import type { Video } from "@/data/videos";

const v = (id: string, title: string, youtubeId: string, channel = "Chaîne"): Video => ({ id, title, channel, youtubeId, mood: "lofi" });

const snap = (over: Partial<ContextSnapshot> = {}): ContextSnapshot => ({
  todos: [
    { id: "t1", text: "Finir le rapport trimestriel", status: "todo" },
    { id: "t2", text: "Réviser les maths", status: "in-progress" },
  ],
  catalogue: [
    v("osaka-1", "Study With Me · Osaka Midnight", "aaaaaaaaaa1", "study with japan"),
    v("osaka-2", "Study With Me · Osaka Sunset", "aaaaaaaaaa2", "study with japan"),
    v("kyoto-1", "Kyoto drive, lofi", "aaaaaaaaaa3", "Abao Vision"),
  ],
  custom: [v("custom-1", "Piano pluie", "bbbbbbbbbb1"), v("dup", "Doublon Kyoto", "aaaaaaaaaa3")],
  playlists: [{ id: "p1", playlistId: "PLjazz", title: "Café jazz", channelName: "Jazz FM" }],
  localPlaylists: [
    { id: "l1", name: "Soirée calme", tracks: [{ youtubeId: "ccccccccccc", title: "x" }] },
    { id: "l2", name: "Vide", tracks: [] },
  ],
  history: [
    { mediaKey: "aaaaaaaaaa3", type: "youtube", title: "Kyoto drive, lofi", subtitle: "Abao Vision", minutes: 30 },
    { mediaKey: "spotify:playlist:42", type: "spotify", title: "Mes favoris", subtitle: "Spotify", minutes: 20 },
    { mediaKey: "aaaaaaaaaa3", type: "youtube", title: "Kyoto drive, lofi", subtitle: "Abao Vision", minutes: 30 },
    { mediaKey: "ddddddddddd", type: "youtube", title: "Vidéo oubliée", subtitle: "Ailleurs", minutes: 10 },
    { mediaKey: "queue", type: "playlist", title: "File FocusFlow", subtitle: "3 titres", minutes: 10 },
  ],
  env: {
    timer: { preset: "classic", ...PRESETS.classic },
    sessionActive: false,
    spotify: { connected: false, selectedUri: null, playlists: [] },
    twitch: { selectedChannel: null, selectedVodId: null, followed: [] },
  },
  ...over,
});

describe("buildContextFrom", () => {
  it("clés stables, écoutes, doublons et historique seul", () => {
    const ctx = buildContextFrom(snap());
    const keys = ctx.media.map((m) => m.key);
    expect(keys).toEqual([
      "cat:osaka-1", "cat:osaka-2", "cat:kyoto-1", "vid:custom-1", "pl:p1", "loc:l1",
      "his:spotify:playlist:42", "his:ddddddddddd",
    ]);
    expect(ctx.media.find((m) => m.key === "cat:kyoto-1")?.plays).toBe(2);
    expect(ctx.media.find((m) => m.key === "his:ddddddddddd")?.ref).toEqual({ type: "youtube", youtubeId: "ddddddddddd", title: "Vidéo oubliée", channel: "Ailleurs" });
  });
});

describe("timerPlan", () => {
  const classic = { preset: "classic" as const, ...PRESETS.classic };
  it("durée libre : personnalisé avec les pauses du preset courant", () => {
    expect(timerPlan({ minutes: 50 }, classic)).toMatchObject({ preset: "custom", settings: { ...PRESETS.classic, workDuration: 50 } });
    expect(timerPlan({ minutes: 40, preset: "deep" }, classic)).toMatchObject({ preset: "custom", settings: { ...PRESETS.deep, workDuration: 40 } });
  });
  it("presets", () => {
    expect(timerPlan({ preset: "deep" }, classic)).toMatchObject({ keep: false, preset: "deep" });
    expect(timerPlan({ minutes: 50, preset: "deep" }, classic)).toEqual({ keep: false, preset: "deep", label: "50 min, Deep" });
    expect(timerPlan({ preset: "flowtime", minutes: 30 }, classic)).toMatchObject({ preset: "flowtime" });
    expect(timerPlan({}, classic)).toMatchObject({ keep: true, preset: "classic" });
    expect(timerPlan({ minutes: 25 }, classic)).toMatchObject({ keep: true });
  });
});

describe("resolveLaunch", () => {
  const ctx = buildContextFrom(snap());
  const plan = (text: string, c = ctx) => resolveLaunch(parseQuickLaunch(text, c), c);

  it("« 50 min osaka midnight rapport »", () => {
    const p = plan("50 min osaka midnight rapport");
    expect(p.launchable).toBe(true);
    expect(p.timer).toMatchObject({ preset: "custom", settings: { workDuration: 50 } });
    expect(p.todo?.id).toBe("t1");
    expect(p.media?.ref).toEqual({ type: "video", id: "osaka-1" });
  });

  it("ambiguïté : rien n'est lancé, les choix sont listés", () => {
    const p = plan("osaka");
    expect(p.launchable).toBe(false);
    expect(p.mediaChoices.map((m) => m.key).sort()).toEqual(["cat:osaka-1", "cat:osaka-2"]);
    expect(p.media).toBeNull();
  });

  it("provenance d'historique", () => {
    expect(plan("kyoto drive").media?.provenance).toBe("trouvé dans ton historique (2 écoutes)");
  });

  it("comme hier : dernier média écouté", () => {
    expect(plan("comme hier").media?.ref).toEqual({ type: "video", id: "kyoto-1" });
    const empty = buildContextFrom(snap({ history: [] }));
    expect(plan("comme hier", empty).error).toMatch(/historique/);
  });

  it("liens collés", () => {
    expect(plan("https://youtu.be/aaaaaaaaaa1").media?.ref).toEqual({ type: "video", id: "osaka-1" });
    expect(plan("https://youtu.be/zzzzzzzzzzz").media?.ref).toEqual({ type: "youtube", youtubeId: "zzzzzzzzzzz" });
    expect(plan("https://open.spotify.com/playlist/37i9").error).toMatch(/Connecte Spotify/);
    const sp = buildContextFrom(snap({ env: { ...snap().env, spotify: { connected: true, selectedUri: null, playlists: [] } } }));
    expect(plan("https://open.spotify.com/playlist/37i9", sp).media?.ref).toEqual({ type: "spotify", uri: "spotify:playlist:37i9" });
    expect(plan("https://open.spotify.com/track/1", sp).error).toMatch(/playlist ou d'album/);
    expect(plan("twitch.tv/lofigirl").media?.ref).toEqual({ type: "twitch-channel", login: "lofigirl" });
    expect(plan("https://www.twitch.tv/videos/123").media?.ref).toEqual({ type: "twitch-vod", id: "123" });
  });

  it("source seule : deep spotify reprend la dernière playlist écoutée", () => {
    const sp = buildContextFrom(snap({ env: { ...snap().env, spotify: { connected: true, selectedUri: null, playlists: [{ uri: "spotify:playlist:9", name: "Autre" }] } } }));
    const p = plan("deep spotify", sp);
    expect(p.timer.preset).toBe("deep");
    expect(p.media?.ref).toEqual({ type: "spotify", uri: "spotify:playlist:42" });
  });

  it("reprendre : seulement si une session est active", () => {
    expect(plan("reprendre").error).toBeDefined();
    const active = buildContextFrom(snap({ env: { ...snap().env, sessionActive: true } }));
    expect(plan("reprendre", active).launchable).toBe(true);
  });

  it("sans média cité : la sélection actuelle est gardée", () => {
    const p = plan("25 min maths");
    expect(p.todo?.id).toBe("t2");
    expect(p.media?.ref).toBeNull();
    expect(p.launchable).toBe(true);
  });
});
