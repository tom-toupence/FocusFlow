import { describe, expect, it } from "vitest";
import { normalize, parseQuickLaunch, type QuickContext } from "./quickLaunch";

const ctx: QuickContext = {
  todos: [
    { id: "t1", text: "Finir le rapport trimestriel", status: "todo" },
    { id: "t2", text: "Répondre aux e-mails", status: "in-progress" },
    { id: "t3", text: "Rapport archivé", status: "done" },
  ],
  media: [
    { key: "cat:kyoto", title: "Study With Me in Kyoto", subtitle: "Lofi rain", kind: "catalogue", plays: 0 },
    { key: "his:lofikyoto", title: "Lofi Kyoto night walk", kind: "history", plays: 12 },
    { key: "cat:tokyo", title: "Tokyo lofi drive", kind: "catalogue" },
    { key: "pl:jazz", title: "Café jazz", subtitle: "Playlist", kind: "playlist", plays: 2 },
    { key: "loc:piano", title: "Piano du soir", kind: "local-playlist" },
  ],
};

describe("normalize", () => {
  it("accents, casse, apostrophes", () => {
    expect(normalize("  Répondre À L'ÉQUIPE !")).toBe("repondre a l equipe");
  });
});

describe("parseQuickLaunch", () => {
  it("« 50 min rapport lofi kyoto »", () => {
    const r = parseQuickLaunch("50 min rapport lofi kyoto", ctx);
    expect(r.minutes).toBe(50);
    expect(r.todoId).toBe("t1"); // la tâche terminée est ignorée
    expect(r.mediaKey).toBe("his:lofikyoto"); // bonus d'écoutes
    expect(r.intent).toBe("launch");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("« deep spotify »", () => {
    const r = parseQuickLaunch("deep spotify", ctx);
    expect(r.preset).toBe("deep");
    expect(r.source).toBe("spotify");
    expect(r.mediaKey).toBeUndefined();
    expect(r.intent).toBe("launch");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("URL YouTube collée", () => {
    const r = parseQuickLaunch("https://www.youtube.com/watch?v=dQw4w9WgXcQ 25", ctx);
    expect(r.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r.youtubeId).toBe("dQw4w9WgXcQ");
    expect(r.source).toBe("youtube");
    expect(r.minutes).toBe(25);
    expect(r.mediaKey).toBeUndefined();
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("URL Spotify et Twitch", () => {
    expect(parseQuickLaunch("https://open.spotify.com/playlist/37i9dQZF1DX", ctx).source).toBe("spotify");
    expect(parseQuickLaunch("twitch.tv/lofigirl", ctx)).toMatchObject({ source: "twitch", url: "https://twitch.tv/lofigirl" });
  });

  it("« comme hier »", () => {
    expect(parseQuickLaunch("comme hier", ctx)).toEqual({ intent: "relaunch-last", confidence: 0.95 });
    expect(parseQuickLaunch("comme la dernière fois", ctx).intent).toBe("relaunch-last");
    expect(parseQuickLaunch("relancer", ctx).intent).toBe("relaunch-last");
  });

  it("reprendre la session", () => {
    expect(parseQuickLaunch("reprendre la session", ctx)).toEqual({ intent: "resume-session", confidence: 0.95 });
    expect(parseQuickLaunch("retour", ctx).intent).toBe("resume-session");
  });

  it("durées", () => {
    expect(parseQuickLaunch("1h", ctx).minutes).toBe(60);
    expect(parseQuickLaunch("1 h 30", ctx).minutes).toBe(90);
    expect(parseQuickLaunch("1h30", ctx).minutes).toBe(90);
    expect(parseQuickLaunch("2 heures", ctx).minutes).toBe(120);
    expect(parseQuickLaunch("25", ctx).minutes).toBe(25);
    expect(parseQuickLaunch("45 minutes", ctx).minutes).toBe(45);
    expect(parseQuickLaunch("rapport 1", ctx).minutes).toBeUndefined();
  });

  it("presets", () => {
    expect(parseQuickLaunch("flow", ctx).preset).toBe("flowtime");
    expect(parseQuickLaunch("Flowtime", ctx).preset).toBe("flowtime");
    expect(parseQuickLaunch("classique", ctx).preset).toBe("classic");
    expect(parseQuickLaunch("deep", ctx).preset).toBe("deep");
  });

  it("accents et casse tolérés", () => {
    const r = parseQuickLaunch("REPONDRE emails cafe jazz", ctx);
    expect(r.todoId).toBe("t2");
    expect(r.mediaKey).toBe("pl:jazz");
  });

  it("préfixe et faute légère", () => {
    expect(parseQuickLaunch("rapp", ctx).todoId).toBe("t1");
    expect(parseQuickLaunch("trimestrel", ctx).todoId).toBe("t1");
  });

  it("ambiguïté : alternatives, pas de choix silencieux", () => {
    const amb: QuickContext = {
      todos: [],
      media: [
        { key: "a", title: "Lofi rain", kind: "catalogue" },
        { key: "b", title: "Lofi beats", kind: "catalogue" },
      ],
    };
    const r = parseQuickLaunch("lofi", amb);
    expect(r.mediaKey).toBeUndefined();
    expect(r.mediaAlternatives?.sort()).toEqual(["a", "b"]);
    expect(r.confidence).toBeLessThan(0.6);
  });

  it("un mot consommé par un élément ne sert pas aux autres", () => {
    const c: QuickContext = {
      todos: [{ id: "x", text: "Rapport lofi", status: "todo" }],
      media: [{ key: "m", title: "Rapport de nuit", kind: "catalogue" }],
    };
    const r = parseQuickLaunch("rapport nuit", c);
    expect(r.mediaKey).toBe("m");
    expect(r.todoId).toBeUndefined(); // « rapport » déjà pris par le média
  });

  it("mots non compris : confiance réduite", () => {
    const r = parseQuickLaunch("25 zorglub", ctx);
    expect(r.minutes).toBe(25);
    expect(r.confidence).toBeLessThan(0.8);
  });

  it("phrase vide ou sans sens : confiance 0", () => {
    expect(parseQuickLaunch("", ctx)).toEqual({ confidence: 0 });
    expect(parseQuickLaunch("lancer une session", ctx).confidence).toBe(0);
  });
});
