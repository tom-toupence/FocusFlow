// Helpers de texte visible. Règle produit : zéro em-dash affiché. Les titres
// YouTube en contiennent souvent (« Study With Me — Rainy Shibuya ») : on les
// normalise à l'affichage, sans toucher aux données.
export function cleanTitle(t: string | null | undefined): string {
  if (!t) return "";
  return t.replace(/\s*[—–]\s*/g, " · ").replace(/\s{2,}/g, " ").trim();
}

/** « 1 titre », « 3 titres ». */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Durée lisible en mono : 75 → « 1 h 15 », 25 → « 25 min ». */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

/** Secondes → « 04:07 » ; au-delà d'une heure « 1:04:07 ». */
export function formatClock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
