"use client";

import { create } from "zustand";
import { getCurrentUserId } from "@/lib/authState";
import {
  Friend, PendingRequest, MyInvite,
  ensureMyProfile, fetchFriendsAndRequests, upsertMyFriendStats, subscribeFriendStats,
} from "@/lib/friends";
import { useStatsStore } from "@/store/statsStore";
import { useAchievementsStore } from "@/store/achievementsStore";
import { getWeekDetail, totalXp, getLevelInfo } from "@/lib/progression";
import { getStreak } from "@/store/statsStore";

// Store du système d'amis (ONLINE-ONLY). Non persisté : reconstruit au login.
// Publie MES agrégats via une subscription aux stats (pattern lib/stateSync),
// et écoute les changements des amis en temps réel (Realtime).

interface FriendsState {
  friends: Friend[];
  pending: PendingRequest[];
  myInvite: MyInvite | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  setMyInvite: (i: MyInvite | null) => void;
}

export const useFriendsStore = create<FriendsState>((set) => ({
  friends: [],
  pending: [],
  myInvite: null,
  loaded: false,
  refresh: async () => {
    const { friends, pending } = await fetchFriendsAndRequests();
    set({ friends, pending, loaded: true });
  },
  setMyInvite: (myInvite) => set({ myInvite }),
}));

// ── Publication de MES agrégats (dérivés des stats, fonctions pures) ──────────

/** Recalcule mes agrégats hebdo + niveau + badges depuis les stores. */
export function computeMyAggregate() {
  const days = useStatsStore.getState().days;
  const badges = Object.keys(useAchievementsStore.getState().unlocked).length;
  const week = getWeekDetail(days);
  const xp = totalXp(days, badges);
  return {
    weekMinutes: week.minutes,
    weekSessions: week.sessions,
    streak: getStreak(days),
    level: getLevelInfo(xp).level,
    xp,
    badges,
  };
}

let statsUnsub: (() => void) | null = null;
let realtimeUnsub: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePushAggregate() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (getCurrentUserId()) upsertMyFriendStats(computeMyAggregate());
  }, 1500);
}

/**
 * Démarre le système d'amis au login : identité publique, 1ère synchro,
 * publication des agrégats à chaque changement de stats, et écoute Realtime.
 */
export async function initFriends(displayName: string, avatarUrl: string | null): Promise<void> {
  if (!getCurrentUserId()) return;

  const invite = await ensureMyProfile(displayName, avatarUrl);
  useFriendsStore.getState().setMyInvite(invite);

  // Amorce ma ligne de stats + première charge des amis.
  await upsertMyFriendStats(computeMyAggregate());
  await useFriendsStore.getState().refresh();

  // Republie mes agrégats quand mes stats/succès changent (debounce).
  if (!statsUnsub) {
    const s1 = useStatsStore.subscribe(schedulePushAggregate);
    const s2 = useAchievementsStore.subscribe(schedulePushAggregate);
    statsUnsub = () => { s1(); s2(); };
  }

  // Écoute les changements des amis (leaderboard + statut « en focus »).
  if (!realtimeUnsub) {
    realtimeUnsub = subscribeFriendStats(() => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => useFriendsStore.getState().refresh(), 400);
    });
  }
}

/** Arrêt à la déconnexion. */
export function teardownFriends(): void {
  statsUnsub?.(); statsUnsub = null;
  realtimeUnsub?.(); realtimeUnsub = null;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  useFriendsStore.setState({ friends: [], pending: [], myInvite: null, loaded: false });
}
