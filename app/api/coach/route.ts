import { NextRequest, NextResponse } from "next/server";

// Planning coach powered by Google Gemini (free tier). The API key lives ONLY on
// the server (process.env.GEMINI_API_KEY) — it is never sent to the browser.
// If the key is missing or Gemini fails/quota-limits, the client falls back to
// the local heuristic planner (lib/coach.ts), so the feature always works at €0.

const API_KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const MAX_INPUT = 500;

const SYSTEM = `Tu es un coach de productivité expert de la méthode Pomodoro.
On te donne un objectif. Découpe-le en 3 à 8 tâches CONCRÈTES et ACTIONNABLES, dans l'ordre logique, en français.
Chaque tâche doit tenir en une phrase courte. Pour chacune, estime le nombre de pomodoros (sessions de 25 min) entre 1 et 4.
Reste réaliste et évite les tâches vagues.`;

interface GeminiTask {
  text: string;
  pomodoroEstimate: number;
}

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    // No key configured → tell the client to use its local fallback.
    return NextResponse.json({ error: "no_key" }, { status: 503 });
  }

  let body: { objective?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const objective = String(body.objective ?? "").trim().slice(0, MAX_INPUT);
  if (!objective) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
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
                    properties: {
                      text: { type: "STRING" },
                      pomodoroEstimate: { type: "INTEGER" },
                    },
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

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return NextResponse.json({ error: "upstream", status: res.status, detail }, { status: 502 });
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return NextResponse.json({ error: "empty_response" }, { status: 502 });

    let parsed: { tasks?: GeminiTask[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "parse" }, { status: 502 });
    }

    const tasks = (parsed.tasks ?? [])
      .filter((t) => t && typeof t.text === "string" && t.text.trim().length > 0)
      .slice(0, 8)
      .map((t) => ({
        text: t.text.trim().slice(0, 140),
        pomodoroEstimate: Math.max(1, Math.min(6, Math.round(Number(t.pomodoroEstimate) || 1))),
      }));

    if (tasks.length === 0) return NextResponse.json({ error: "empty_response" }, { status: 502 });

    return NextResponse.json({ tasks, source: "ai" });
  } catch (err) {
    return NextResponse.json({ error: "upstream", detail: String(err).slice(0, 300) }, { status: 502 });
  }
}
