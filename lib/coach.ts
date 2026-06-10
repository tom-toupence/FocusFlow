// Local planning "coach" — turns a free-text objective into Pomodoro-sized tasks
// with estimates. 100% heuristic: no API, no key, no network, no cost. Runs offline.

export interface PlannedTask {
  text: string;
  pomodoroEstimate: number;
}

// ── Intent templates ────────────────────────────────────────────────────────────
// Each intent maps to a sensible default workflow when the objective is a single
// goal rather than an explicit list of steps.

interface Intent {
  id: string;
  keywords: string[];
  steps: string[];
}

const INTENTS: Intent[] = [
  {
    id: "study",
    keywords: ["révis", "etudi", "étudi", "examen", "cours", "apprendre", "mémoris", "memoris", "chapitre", "leçon", "lecon", "ds ", "partiel", "concours"],
    steps: [
      "Survoler et organiser le contenu à couvrir",
      "Lire en profondeur et prendre des notes actives",
      "Faire des fiches / résumés synthétiques",
      "S'auto-tester (questions, flashcards)",
      "Réviser les points faibles identifiés",
    ],
  },
  {
    id: "writing",
    keywords: ["écrir", "ecrir", "rédig", "redig", "rapport", "mémoire", "memoire", "article", "dissert", "lettre", "mail", "e-mail", "cv", "texte", "blog", "post"],
    steps: [
      "Clarifier le message et le plan",
      "Rédiger un premier brouillon sans s'auto-censurer",
      "Développer et étoffer le corps",
      "Relire, couper et corriger",
      "Mise en forme et finalisation",
    ],
  },
  {
    id: "dev",
    keywords: ["cod", "développ", "developp", "programm", "bug", "feature", "fonctionnal", "app", "site", "api", "refactor", "test", "script", "déploi", "deploi", "intégr", "integr"],
    steps: [
      "Définir le besoin et découper le travail",
      "Mettre en place la base / le squelette",
      "Implémenter le cœur de la fonctionnalité",
      "Tester et déboguer",
      "Nettoyer, documenter et finaliser",
    ],
  },
  {
    id: "design",
    keywords: ["design", "maquette", "ui", "ux", "logo", "présent", "present", "slide", "diapo", "affiche", "illustr", "graph", "figma"],
    steps: [
      "Rassembler références et inspiration",
      "Esquisser plusieurs pistes",
      "Créer la première version complète",
      "Affiner les détails et la cohérence",
      "Exporter et finaliser les livrables",
    ],
  },
  {
    id: "admin",
    keywords: ["rang", "nettoy", "tri", "organis", "paperass", "administ", "factur", "inbox", "boîte mail", "boite mail", "dossier", "compta", "déclar", "declar"],
    steps: [
      "Faire un tri rapide global",
      "Traiter le plus urgent en premier",
      "Classer et organiser le reste",
      "Vérifier et finaliser",
    ],
  },
];

const DEFAULT_STEPS = [
  "Clarifier l'objectif et lister les étapes",
  "Préparer ce dont tu as besoin",
  "Réaliser le gros du travail",
  "Vérifier et finaliser",
];

// ── Splitting an explicit list ───────────────────────────────────────────────────

const SPLIT_REGEX = /\s*(?:\n+|;|•|·|^\s*\d+[.)]\s*|^\s*[-*]\s+|,?\s+(?:puis|ensuite|enfin|et ensuite|après|apres)\s+)\s*/gim;

function splitExplicit(objective: string): string[] {
  // Prefer line breaks / bullets / numbered lists / sequence words.
  const parts = objective
    .split(SPLIT_REGEX)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
  return parts;
}

// ── Estimation ───────────────────────────────────────────────────────────────────

const HEAVY_WORDS = ["tout", "toute", "complet", "complète", "complete", "gros", "grosse", "complexe", "entier", "entièrement", "entierement", "beaucoup", "plusieurs", "long", "longue", "maximum", "approfond"];

function estimatePomodoros(text: string, sizeBoost: number): number {
  let est = 1;
  const lower = text.toLowerCase();
  if (text.length > 55) est += 1;
  if (HEAVY_WORDS.some((w) => lower.includes(w))) est += 1;
  // Numbers like "10 pages", "20 exercices" scale the estimate.
  const num = lower.match(/\b(\d{1,3})\b/);
  if (num) {
    const n = parseInt(num[1], 10);
    if (n >= 5 && n < 15) est += 1;
    else if (n >= 15) est += 2;
  }
  est += sizeBoost;
  return Math.max(1, Math.min(4, est));
}

/** Overall size signal from the whole objective (adds to each task estimate). */
function sizeBoost(objective: string): number {
  const lower = objective.toLowerCase();
  let boost = 0;
  if (["gros projet", "grand projet", "tout le", "toute la", "en entier", "de a à z", "de a a z"].some((w) => lower.includes(w))) boost += 1;
  return boost;
}

function detectIntent(objective: string): Intent | null {
  const lower = objective.toLowerCase();
  let best: { intent: Intent; score: number } | null = null;
  for (const intent of INTENTS) {
    const score = intent.keywords.reduce((s, k) => (lower.includes(k) ? s + 1 : s), 0);
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }
  return best?.intent ?? null;
}

/**
 * Plans an objective into Pomodoro-sized tasks. Strategy:
 *  1. If the objective already reads as a list (commas, "puis", bullets, lines),
 *     respect the user's own steps.
 *  2. Otherwise, pick an intent template (study/writing/dev/design/admin) or a
 *     generic plan, and prefix it with the objective for context.
 */
export function planTasks(objectiveRaw: string): PlannedTask[] {
  const objective = objectiveRaw.trim();
  if (!objective) return [];

  const boost = sizeBoost(objective);
  const explicit = splitExplicit(objective);

  let steps: string[];
  if (explicit.length >= 2) {
    steps = explicit;
  } else {
    const intent = detectIntent(objective);
    steps = intent ? intent.steps : DEFAULT_STEPS;
  }

  // Cap to keep the plan focused.
  steps = steps.slice(0, 8);

  return steps.map((text) => {
    const clean = text.charAt(0).toUpperCase() + text.slice(1);
    return { text: clean, pomodoroEstimate: estimatePomodoros(clean, boost) };
  });
}

export function totalPomodoros(tasks: PlannedTask[]): number {
  return tasks.reduce((s, t) => s + t.pomodoroEstimate, 0);
}
