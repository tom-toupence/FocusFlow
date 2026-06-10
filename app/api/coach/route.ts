import { NextRequest, NextResponse } from "next/server";

// Planning coach powered by a free LLM. Keys live ONLY on the server — never sent
// to the browser. Providers are tried in order of preference:
//   1. Groq   (free, no credit card, works worldwide — recommended)
//   2. Gemini (free tier, but daily quota can be 0 in some regions)
// If no key is set, or every provider fails (quota, network…), the client falls
// back to the local heuristic planner (lib/coach.ts) — so it always works at €0.

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const MAX_INPUT = 500;

const SYSTEM = `Tu es un coach de productivité expert de la méthode Pomodoro.
On te donne un objectif. Découpe-le en 3 à 8 tâches CONCRÈTES et ACTIONNABLES, dans l'ordre logique, en français.
Chaque tâche tient en une phrase courte. Pour chacune, estime le nombre de pomodoros (sessions de 25 min) entre 1 et 4.
Reste réaliste, évite les tâches vagues.`;

const SYSTEM_JSON = `${SYSTEM}
Réponds UNIQUEMENT avec un objet JSON de la forme :
{"tasks":[{"text":"...","pomodoroEstimate":2}]}
où pomodoroEstimate est un entier entre 1 et 4. Aucun texte en dehors du JSON.`;

interface Task { text: string; pomodoroEstimate: number; }
type ProviderResult =
  | { ok: true; tasks: Task[] }
  | { ok: false; status: number; detail: string };

/** Parses + sanitizes a JSON string into a clean task list (or null if unusable). */
function sanitize(raw: string | undefined): Task[] | null {
  if (!raw) return null;
  let parsed: { tasks?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const arr = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const tasks = (arr as Task[])
    .filter((t) => t && typeof t.text === "string" && t.text.trim().length > 0)
    .slice(0, 8)
    .map((t) => ({
      text: t.text.trim().slice(0, 140),
      pomodoroEstimate: Math.max(1, Math.min(6, Math.round(Number(t.pomodoroEstimate) || 1))),
    }));
  return tasks.length > 0 ? tasks : null;
}

// ── Groq (OpenAI-compatible) ─────────────────────────────────────────────────────
async function callGroq(objective: string): Promise<ProviderResult> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_JSON },
          { role: "user", content: `Objectif : ${objective}` },
        ],
      }),
    });
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) };
    const data = await res.json();
    const tasks = sanitize(data?.choices?.[0]?.message?.content);
    return tasks ? { ok: true, tasks } : { ok: false, status: 502, detail: "empty_or_unparseable" };
  } catch (err) {
    return { ok: false, status: 502, detail: String(err).slice(0, 300) };
  }
}

// ── Gemini ───────────────────────────────────────────────────────────────────────
async function callGemini(objective: string): Promise<ProviderResult> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: `Objectif : ${objective}` }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
            responseSchema: {
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
            },
          },
        }),
      }
    );
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) };
    const data = await res.json();
    const tasks = sanitize(data?.candidates?.[0]?.content?.parts?.[0]?.text);
    return tasks ? { ok: true, tasks } : { ok: false, status: 502, detail: "empty_or_unparseable" };
  } catch (err) {
    return { ok: false, status: 502, detail: String(err).slice(0, 300) };
  }
}

export async function POST(request: NextRequest) {
  if (!GROQ_KEY && !GEMINI_KEY) {
    return NextResponse.json({ error: "no_key" }, { status: 503 });
  }

  let body: { objective?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const objective = String(body.objective ?? "").trim().slice(0, MAX_INPUT);
  if (!objective) return NextResponse.json({ error: "empty" }, { status: 400 });

  let last: ProviderResult | null = null;
  for (const provider of [
    GROQ_KEY ? () => callGroq(objective) : null,
    GEMINI_KEY ? () => callGemini(objective) : null,
  ]) {
    if (!provider) continue;
    const result = await provider();
    if (result.ok) return NextResponse.json({ tasks: result.tasks, source: "ai" });
    last = result;
  }

  return NextResponse.json(
    { error: "upstream", status: last?.ok === false ? last.status : 502, detail: last?.ok === false ? last.detail : "" },
    { status: 502 }
  );
}
