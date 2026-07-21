import { NextRequest, NextResponse } from "next/server";

// Planning coach powered by a free LLM. Keys live ONLY on the server — never sent
// to the browser. Providers are tried in order of preference:
//   1. Groq   (free, no credit card, works worldwide — recommended)
//   2. Gemini (free tier, but daily quota can be 0 in some regions)
// If no key is set, or every provider fails (quota, network…), the client falls
// back to the local heuristic planner (lib/coach.ts, lib/sprint.ts) — always €0.
//
// Three request shapes:
//   { objective }                            → task breakdown (original coach)
//   { type: "sprint", objective, deadline,
//     dailyMinutes, startDate, startMin }    → day-by-day sprint plan
//   { type: "music", titles: string[] }      → refined YouTube search queries
//                                              for the Discover recommendations

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const MAX_INPUT = 500;

// Seuls les moods réellement présents dans le catalogue refondu (data/videos.ts)
const MOODS = ["lofi", "ambience", "nature"] as const;

const SYSTEM = `Tu es un coach de productivité expert de la méthode Pomodoro.
On te donne un objectif. Découpe-le en 3 à 8 tâches CONCRÈTES et ACTIONNABLES, dans l'ordre logique, en français.
Chaque tâche tient en une phrase courte. Pour chacune, estime le nombre de pomodoros (sessions de 25 min) entre 1 et 4.
Reste réaliste, évite les tâches vagues.`;

const SYSTEM_JSON = `${SYSTEM}
Réponds UNIQUEMENT avec un objet JSON de la forme :
{"tasks":[{"text":"...","pomodoroEstimate":2}]}
où pomodoroEstimate est un entier entre 1 et 4. Aucun texte en dehors du JSON.`;

const SYSTEM_SPRINT = `Tu es un coach de productivité expert de la méthode Pomodoro.
On te donne un objectif avec une DATE LIMITE, la date de départ, le budget de minutes de focus par jour
et l'heure de début préférée (en minutes depuis minuit). Construis un plan de sprint réaliste en français :
1. Découpe l'objectif en 3 à 8 tâches CONCRÈTES et ACTIONNABLES (une phrase courte chacune, pomodoros de 25 min estimés entre 1 et 4).
2. Répartis le travail en blocs de focus jour par jour, de la date de départ jusqu'à la veille ou le jour de la deadline.
   Un bloc par jour maximum, durée entre 25 et 180 minutes, en respectant à peu près le budget quotidien.
   Le label de chaque bloc décrit ce qui sera travaillé ce jour-là. Tu peux sauter des jours si le budget total est faible.
3. Choisis le mood musical le plus adapté au type de travail parmi : lofi, ambience, nature.
Réponds UNIQUEMENT avec un objet JSON de la forme :
{"days":[{"date":"YYYY-MM-DD","startMin":540,"durationMin":50,"label":"..."}],"tasks":[{"text":"...","pomodoroEstimate":2}],"mood":"lofi"}
Aucun texte en dehors du JSON.`;

const SYSTEM_MUSIC = `Tu es un expert en musique de concentration sur YouTube (lofi, ambient, study with me, paysages sonores).
On te donne une liste de titres de vidéos récemment écoutées par l'utilisateur pendant ses sessions de focus.
Déduis-en 3 à 4 THÈMES distincts qui lui plairaient (lieux, ambiances, genres proches mais pas identiques),
et pour chaque thème construis une requête de recherche YouTube en anglais visant des vidéos LONGUES (mixes, study with me, ambiances).
Réponds UNIQUEMENT avec un objet JSON de la forme :
{"queries":[{"label":"Kyoto pluie","query":"rainy kyoto lofi ambient mix"}]}
label = thème court en français, query = requête YouTube en anglais. Aucun texte hors du JSON.`;

interface Task { text: string; pomodoroEstimate: number; }
interface SprintDay { date: string; startMin: number; durationMin: number; label: string; }
interface SprintPlan { days: SprintDay[]; tasks: Task[]; mood: string; }

type ChatResult =
  | { ok: true; raw: string }
  | { ok: false; status: number; detail: string };

/** Parses + sanitizes a JSON string into a clean task list (or null if unusable). */
function sanitizeTasks(raw: string | undefined): Task[] | null {
  if (!raw) return null;
  let parsed: { tasks?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return sanitizeTaskArray(parsed.tasks);
}

function sanitizeTaskArray(arr: unknown): Task[] | null {
  const list = Array.isArray(arr) ? (arr as Task[]) : [];
  const tasks = list
    .filter((t) => t && typeof t.text === "string" && t.text.trim().length > 0)
    .slice(0, 8)
    .map((t) => ({
      text: t.text.trim().slice(0, 140),
      pomodoroEstimate: Math.max(1, Math.min(6, Math.round(Number(t.pomodoroEstimate) || 1))),
    }));
  return tasks.length > 0 ? tasks : null;
}

/** Validates a sprint plan: dates within [startDate, deadline], sane blocks. */
function sanitizeSprint(raw: string | undefined, startDate: string, deadline: string): SprintPlan | null {
  if (!raw) return null;
  let parsed: { days?: unknown; tasks?: unknown; mood?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const tasks = sanitizeTaskArray(parsed.tasks);
  const rawDays = Array.isArray(parsed.days) ? (parsed.days as SprintDay[]) : [];
  const seen = new Set<string>();
  const days = rawDays
    .filter((d) =>
      d &&
      typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
      d.date >= startDate && d.date <= deadline
    )
    .filter((d) => { if (seen.has(d.date)) return false; seen.add(d.date); return true; })
    .slice(0, 30)
    .map((d) => ({
      date: d.date,
      startMin: Math.max(0, Math.min(23 * 60, Math.round(Number(d.startMin) || 540))),
      durationMin: Math.max(25, Math.min(180, Math.round(Number(d.durationMin) || 50))),
      label: String(d.label ?? "").trim().slice(0, 80) || "Focus sprint",
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const mood = MOODS.includes(parsed.mood as (typeof MOODS)[number]) ? (parsed.mood as string) : "lofi";
  if (!tasks || days.length === 0) return null;
  return { days, tasks, mood };
}

/** Parses + sanitizes the music discovery queries (or null if unusable). */
function sanitizeMusicQueries(raw: string | undefined): { label: string; query: string }[] | null {
  if (!raw) return null;
  let parsed: { queries?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const list = Array.isArray(parsed.queries) ? (parsed.queries as { label?: unknown; query?: unknown }[]) : [];
  const queries = list
    .filter((q) => q && typeof q.label === "string" && typeof q.query === "string" && q.query.trim().length >= 3)
    .slice(0, 4)
    .map((q) => ({
      label: String(q.label).trim().slice(0, 40),
      query: String(q.query).trim().slice(0, 80),
    }));
  return queries.length > 0 ? queries : null;
}

// ── Groq (OpenAI-compatible) ─────────────────────────────────────────────────────
async function callGroq(system: string, user: string): Promise<ChatResult> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) };
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    return raw ? { ok: true, raw } : { ok: false, status: 502, detail: "empty" };
  } catch (err) {
    return { ok: false, status: 502, detail: String(err).slice(0, 300) };
  }
}

// ── Gemini ───────────────────────────────────────────────────────────────────────
// NOTE: Gemini JSON schema types must be UPPERCASE ("OBJECT", "ARRAY"…).
const GEMINI_TASKS_SCHEMA = {
  type: "OBJECT",
  properties: {
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { text: { type: "STRING" }, pomodoroEstimate: { type: "INTEGER" } },
        required: ["text", "pomodoroEstimate"],
      },
    },
  },
  required: ["tasks"],
};

const GEMINI_MUSIC_SCHEMA = {
  type: "OBJECT",
  properties: {
    queries: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { label: { type: "STRING" }, query: { type: "STRING" } },
        required: ["label", "query"],
      },
    },
  },
  required: ["queries"],
};

const GEMINI_SPRINT_SCHEMA = {
  type: "OBJECT",
  properties: {
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          startMin: { type: "INTEGER" },
          durationMin: { type: "INTEGER" },
          label: { type: "STRING" },
        },
        required: ["date", "startMin", "durationMin", "label"],
      },
    },
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { text: { type: "STRING" }, pomodoroEstimate: { type: "INTEGER" } },
        required: ["text", "pomodoroEstimate"],
      },
    },
    mood: { type: "STRING" },
  },
  required: ["days", "tasks", "mood"],
};

async function callGemini(system: string, user: string, schema: object): Promise<ChatResult> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        }),
      }
    );
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) };
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return raw ? { ok: true, raw } : { ok: false, status: 502, detail: "empty" };
  } catch (err) {
    return { ok: false, status: 502, detail: String(err).slice(0, 300) };
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!GROQ_KEY && !GEMINI_KEY) {
    return NextResponse.json({ error: "no_key" }, { status: 503 });
  }

  let body: {
    type?: unknown;
    objective?: unknown;
    deadline?: unknown;
    dailyMinutes?: unknown;
    startDate?: unknown;
    startMin?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // ── Music discovery queries ────────────────────────────────────────────────
  if (body.type === "music") {
    const titles = (Array.isArray((body as { titles?: unknown }).titles) ? ((body as { titles: unknown[] }).titles) : [])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .slice(0, 20)
      .map((t) => t.trim().slice(0, 120));
    if (titles.length === 0) return NextResponse.json({ error: "empty" }, { status: 400 });

    const user = `Titres écoutés récemment :\n${titles.map((t) => `- ${t}`).join("\n")}`;
    let lastMusic: ChatResult | null = null;
    for (const provider of [
      GROQ_KEY ? () => callGroq(SYSTEM_MUSIC, user) : null,
      GEMINI_KEY ? () => callGemini(SYSTEM_MUSIC, user, GEMINI_MUSIC_SCHEMA) : null,
    ]) {
      if (!provider) continue;
      const result = await provider();
      if (result.ok) {
        const queries = sanitizeMusicQueries(result.raw);
        if (queries) return NextResponse.json({ queries, source: "ai" });
        lastMusic = { ok: false, status: 502, detail: "unparseable" };
      } else {
        lastMusic = result;
      }
    }
    return NextResponse.json(
      { error: "upstream", status: lastMusic?.ok === false ? lastMusic.status : 502, detail: lastMusic?.ok === false ? lastMusic.detail : "" },
      { status: 502 }
    );
  }

  const objective = String(body.objective ?? "").trim().slice(0, MAX_INPUT);
  if (!objective) return NextResponse.json({ error: "empty" }, { status: 400 });

  // ── Sprint plan ────────────────────────────────────────────────────────────
  if (body.type === "sprint") {
    const deadline = String(body.deadline ?? "");
    const startDate = String(body.startDate ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || deadline < startDate) {
      return NextResponse.json({ error: "bad_dates" }, { status: 400 });
    }
    const dailyMinutes = Math.max(25, Math.min(360, Math.round(Number(body.dailyMinutes) || 60)));
    const startMin = Math.max(0, Math.min(23 * 60, Math.round(Number(body.startMin) || 540)));

    const user =
      `Objectif : ${objective}\n` +
      `Date de départ : ${startDate}\nDate limite : ${deadline}\n` +
      `Budget quotidien : ${dailyMinutes} minutes de focus par jour maximum.\n` +
      `Heure de début préférée : ${startMin} minutes après minuit.`;

    let last: ChatResult | null = null;
    for (const provider of [
      GROQ_KEY ? () => callGroq(SYSTEM_SPRINT, user) : null,
      GEMINI_KEY ? () => callGemini(SYSTEM_SPRINT, user, GEMINI_SPRINT_SCHEMA) : null,
    ]) {
      if (!provider) continue;
      const result = await provider();
      if (result.ok) {
        const plan = sanitizeSprint(result.raw, startDate, deadline);
        if (plan) return NextResponse.json({ ...plan, source: "ai" });
        last = { ok: false, status: 502, detail: "unparseable" };
      } else {
        last = result;
      }
    }
    return NextResponse.json(
      { error: "upstream", status: last?.ok === false ? last.status : 502, detail: last?.ok === false ? last.detail : "" },
      { status: 502 }
    );
  }

  // ── Task breakdown (original coach) ────────────────────────────────────────
  let last: ChatResult | null = null;
  for (const provider of [
    GROQ_KEY ? () => callGroq(SYSTEM_JSON, `Objectif : ${objective}`) : null,
    GEMINI_KEY ? () => callGemini(SYSTEM, `Objectif : ${objective}`, GEMINI_TASKS_SCHEMA) : null,
  ]) {
    if (!provider) continue;
    const result = await provider();
    if (result.ok) {
      const tasks = sanitizeTasks(result.raw);
      if (tasks) return NextResponse.json({ tasks, source: "ai" });
      last = { ok: false, status: 502, detail: "empty_or_unparseable" };
    } else {
      last = result;
    }
  }

  return NextResponse.json(
    { error: "upstream", status: last?.ok === false ? last.status : 502, detail: last?.ok === false ? last.detail : "" },
    { status: 502 }
  );
}
