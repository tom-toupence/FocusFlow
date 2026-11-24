// Chemins et invité de la reprise au téléphone (lot 7). Module minuscule, sans
// store : importé par l'AuthGate, le splash et la pastille de retour.

/** Session reprise sans compte : /session et /summary passent l'AuthGate dans cet onglet. */
export const GUEST_KEY = "focusflow-handoff-guest";

export function isHandoffGuest(): boolean {
  try { return sessionStorage.getItem(GUEST_KEY) === "1"; } catch { return false; }
}

/** Fin de la session invitée : connexion, ou sortie de /session et /summary. */
export function clearHandoffGuest() {
  try { sessionStorage.removeItem(GUEST_KEY); } catch { /* stockage bloqué */ }
}

/** Chemin sans slash final ("/session/" vaut "/session"). */
export const cleanPath = (p: string | null | undefined) => (p ?? "").replace(/\/+$/, "") || "/";
export const isPhonePath = (p: string | null | undefined) => ["/remote", "/handoff"].includes(cleanPath(p));
export const isGuestPath = (p: string | null | undefined) => ["/session", "/summary"].includes(cleanPath(p));
