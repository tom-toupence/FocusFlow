"use client";

/**
 * Synchronisation multi-appareils des « petits » stores via la table KV
 * `user_state` (une ligne par clé, valeur jsonb). Complète les tables dédiées
 * (custom_videos, todos, work_sessions, user_playlists, plan_blocks, projects).
 *
 * - Au login : `applyRemoteState` merge chaque clé distante dans son store
 *   (stratégie par type : union par id pour les listes, max pour les compteurs,
 *   remote-wins pour les petits objets), puis pousse l'état mergé.
 * - Ensuite : chaque store est abonné → push debouncé (2 s) à chaque changement.
 *
 * Tout est no-op sans Supabase (upsertUserState/fetchUserState le sont déjà).
 */

import { getCurrentUserId } from "@/lib/authState";
import { fetchUserState, upsertUserState } from "@/lib/db";
import { useRoutineStore, Routine } from "@/store/routineStore";
import { useJournalStore, JournalEntry } from "@/store/journalStore";
import { useGoalStore } from "@/store/goalStore";
import { usePlayHistoryStore, PlayEntry } from "@/store/playHistoryStore";
import { useDistractionStore } from "@/store/distractionStore";
import { useAchievementsStore } from "@/store/achievementsStore";
import { useSprintStore, Sprint } from "@/store/sprintStore";

const DEBOUNCE_MS = 2000;

// true pendant l'application du merge distant → les subscriptions n'envoient
// pas de push pour nos propres setState.
let applying = false;
let subscribed = false;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function schedulePush(key: string, getValue: () => unknown) {
  if (applying) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    const uid = getCurrentUserId();
    if (uid) upsertUserState(uid, key, getValue());
  }, DEBOUNCE_MS));
}

// Union de deux listes par id : les items distants d'abord (source durable),
// plus les locaux inconnus du remote (ajoutés hors-ligne / pendant le fetch).
function unionById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const seen = new Set(remote.map((x) => x.id));
  return [...remote, ...local.filter((x) => !seen.has(x.id))];
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// Garde-fou poste partagé : si un AUTRE compte se connecte sur ce navigateur,
// on vide les stores personnels avant le merge — sinon le journal/l'historique
// du compte précédent serait unioné puis poussé dans user_state du nouveau
// compte (même pattern que le clearAuth Spotify/Twitch de SupabaseProvider).
const OWNER_KEY = "focusflow-sync-owner";

function resetPersonalStoresIfOwnerChanged(userId: string) {
  try {
    const prev = localStorage.getItem(OWNER_KEY);
    if (prev && prev !== userId) {
      useRoutineStore.setState({ routines: [] });
      useJournalStore.setState({ entries: [] });
      usePlayHistoryStore.setState({ entries: [] });
      useDistractionStore.setState({ byDate: {} });
      useAchievementsStore.setState({ unlocked: {} });
      useSprintStore.setState({ sprint: null });
    }
    localStorage.setItem(OWNER_KEY, userId);
  } catch { /* localStorage indisponible */ }
}

/** Merge l'état distant dans les stores puis pousse l'état résultant. */
export async function applyRemoteState(userId: string): Promise<void> {
  resetPersonalStoresIfOwnerChanged(userId);
  const remote = await fetchUserState(userId);
  applying = true;
  try {
    // Routines : union par id.
    {
      const r = asArray<Routine>((remote["routines"]?.value as { routines?: unknown } | undefined)?.routines);
      if (r.length > 0) {
        useRoutineStore.setState((s) => ({ routines: unionById(r, s.routines) }));
      }
    }
    // Journal : union par id, tri anté-chronologique, borne 500.
    {
      const r = asArray<JournalEntry>((remote["journal"]?.value as { entries?: unknown } | undefined)?.entries);
      if (r.length > 0) {
        useJournalStore.setState((s) => ({
          entries: unionById(r, s.entries).sort((a, b) => b.timestamp - a.timestamp).slice(0, 500),
        }));
      }
    }
    // Historique de lecture : idem, borne 200.
    {
      const r = asArray<PlayEntry>((remote["play_history"]?.value as { entries?: unknown } | undefined)?.entries);
      if (r.length > 0) {
        usePlayHistoryStore.setState((s) => ({
          entries: unionById(r, s.entries).sort((a, b) => b.timestamp - a.timestamp).slice(0, 200),
        }));
      }
    }
    // Distractions : max par date (compteurs).
    {
      const r = (remote["distractions"]?.value as { byDate?: Record<string, number> } | undefined)?.byDate;
      if (r && typeof r === "object") {
        useDistractionStore.setState((s) => {
          const merged = { ...s.byDate };
          for (const [date, n] of Object.entries(r)) {
            merged[date] = Math.max(Number(n) || 0, merged[date] ?? 0);
          }
          return { byDate: merged };
        });
      }
    }
    // Succès : union (la date locale est conservée si déjà débloqué ici).
    {
      const r = (remote["achievements"]?.value as { unlocked?: Record<string, string> } | undefined)?.unlocked;
      if (r && typeof r === "object") {
        useAchievementsStore.setState((s) => ({ unlocked: { ...r, ...s.unlocked } }));
      }
    }
    // Objectif quotidien : remote gagne au login (la copie durable fait foi ;
    // un changement local ultérieur sera poussé par la subscription).
    {
      const r = remote["goal"]?.value as { unit?: "minutes" | "pomodoros"; target?: number } | undefined;
      if (r && (r.unit === "minutes" || r.unit === "pomodoros") && typeof r.target === "number") {
        useGoalStore.setState({ unit: r.unit, target: Math.max(1, Math.round(r.target)) });
      }
    }
    // Sprint : remote gagne s'il existe (un seul sprint actif à la fois).
    {
      const r = (remote["sprint"]?.value as { sprint?: Sprint | null } | undefined)?.sprint;
      if (r && typeof r === "object" && typeof r.id === "string") {
        useSprintStore.setState({ sprint: r });
      }
    }
  } finally {
    applying = false;
  }

  // Pousse l'état mergé (peuple la table au premier login de chaque appareil).
  pushAll(userId);
  subscribeStores();
}

function pushAll(userId: string) {
  upsertUserState(userId, "routines", { routines: useRoutineStore.getState().routines });
  upsertUserState(userId, "journal", { entries: useJournalStore.getState().entries });
  upsertUserState(userId, "play_history", { entries: usePlayHistoryStore.getState().entries });
  upsertUserState(userId, "distractions", { byDate: useDistractionStore.getState().byDate });
  upsertUserState(userId, "achievements", { unlocked: useAchievementsStore.getState().unlocked });
  upsertUserState(userId, "goal", { unit: useGoalStore.getState().unit, target: useGoalStore.getState().target });
  upsertUserState(userId, "sprint", { sprint: useSprintStore.getState().sprint });
}

function subscribeStores() {
  if (subscribed) return;
  subscribed = true;
  useRoutineStore.subscribe(() =>
    schedulePush("routines", () => ({ routines: useRoutineStore.getState().routines })));
  useJournalStore.subscribe(() =>
    schedulePush("journal", () => ({ entries: useJournalStore.getState().entries })));
  usePlayHistoryStore.subscribe(() =>
    schedulePush("play_history", () => ({ entries: usePlayHistoryStore.getState().entries })));
  useDistractionStore.subscribe(() =>
    schedulePush("distractions", () => ({ byDate: useDistractionStore.getState().byDate })));
  useAchievementsStore.subscribe(() =>
    schedulePush("achievements", () => ({ unlocked: useAchievementsStore.getState().unlocked })));
  useGoalStore.subscribe(() =>
    schedulePush("goal", () => ({ unit: useGoalStore.getState().unit, target: useGoalStore.getState().target })));
  useSprintStore.subscribe(() =>
    schedulePush("sprint", () => ({ sprint: useSprintStore.getState().sprint })));
}
