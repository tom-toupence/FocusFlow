"use client";

// Système d'amis — accès Supabase (identité publique, graphe, stats partagées,
// présence temps réel). Feature ONLINE-ONLY : tout est no-op sans Supabase, et
// l'UI affiche une invite de connexion. Confidentialité : on ne lit/écrit QUE
// des agrégats (jamais le contenu, les tâches, le journal…).

import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/authState";

// Un ami « en focus » n'est considéré actif que si son heartbeat est récent
// (tolérance à une fermeture d'onglet brutale qui laisserait in_focus=true).
export const FOCUS_STALE_MS = 2 * 60 * 1000;

export interface MyInvite {
  username: string;
  inviteCode: string;
}

export interface FriendStats {
  weekMinutes: number;
  weekSessions: number;
  streak: number;
  level: number;
  xp: number;
  badges: number;
  inFocus: boolean;
  focusStartedAt: number;
  focusHeartbeat: number;
}

export interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stats: FriendStats | null;
}

export interface PendingRequest {
  friendshipId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** true si un ami est réellement « en focus » (statut + heartbeat frais). */
export function isActivelyFocusing(s: FriendStats | null, now: number = Date.now()): boolean {
  return !!s && s.inFocus && now - s.focusHeartbeat < FOCUS_STALE_MS;
}

function statsFromRow(r: Record<string, unknown> | null | undefined): FriendStats | null {
  if (!r) return null;
  return {
    weekMinutes: Number(r.week_minutes) || 0,
    weekSessions: Number(r.week_sessions) || 0,
    streak: Number(r.streak) || 0,
    level: Number(r.level) || 1,
    xp: Number(r.xp) || 0,
    badges: Number(r.badges) || 0,
    inFocus: !!r.in_focus,
    focusStartedAt: Number(r.focus_started_at) || 0,
    focusHeartbeat: Number(r.focus_heartbeat) || 0,
  };
}

/** Crée/rafraîchit l'identité publique (username + code) et la renvoie. */
export async function ensureMyProfile(displayName: string, avatarUrl: string | null): Promise<MyInvite | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("ensure_public_profile", {
    p_display_name: displayName,
    p_avatar_url: avatarUrl,
  });
  if (error) { console.error("[friends] ensureMyProfile:", error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { username: row.username, inviteCode: row.invite_code };
}

export type SendResult =
  | "sent" | "accepted" | "already_friends" | "already_pending"
  | "invalid_code" | "cannot_add_self" | "error";

/** Envoie une demande à partir d'un code d'invitation. Retourne le statut. */
export async function sendFriendRequest(code: string): Promise<SendResult> {
  if (!supabase) return "error";
  const { data, error } = await supabase.rpc("send_friend_request", { p_code: code });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("invalid_code")) return "invalid_code";
    if (msg.includes("cannot_add_self")) return "cannot_add_self";
    console.error("[friends] sendFriendRequest:", msg);
    return "error";
  }
  return (typeof data === "string" ? data : "error") as SendResult;
}

/** Accepte une demande reçue. Passe par un RPC : seul l'addressee peut sceller
 *  l'amitié (aucun UPDATE direct sur friendships → pas d'amitié forgée). */
export async function acceptRequest(friendshipId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("accept_friend_request", { p_friendship_id: friendshipId });
  if (error) { console.error("[friends] acceptRequest:", error.message); return false; }
  return true;
}

/** Refuse une demande reçue OU retire un ami / annule une demande envoyée. */
export async function removeFriendship(friendshipId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) { console.error("[friends] removeFriendship:", error.message); return false; }
  return true;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
}

/** Charge la liste des amis acceptés + leurs stats agrégées, et les demandes reçues. */
export async function fetchFriendsAndRequests(): Promise<{ friends: Friend[]; pending: PendingRequest[] }> {
  const empty = { friends: [], pending: [] };
  if (!supabase) return empty;
  const me = getCurrentUserId();
  if (!me) return empty;

  const { data: rels, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
  if (error) { console.error("[friends] fetchFriendships:", error.message); return empty; }

  const rows = (rels ?? []) as FriendshipRow[];
  const otherId = (r: FriendshipRow) => (r.requester_id === me ? r.addressee_id : r.requester_id);

  const acceptedRels = rows.filter((r) => r.status === "accepted");
  const pendingRels = rows.filter((r) => r.status === "pending" && r.addressee_id === me);

  const allIds = [...new Set([...acceptedRels, ...pendingRels].map(otherId))];
  if (allIds.length === 0) return empty;

  const [{ data: profiles }, { data: stats }] = await Promise.all([
    supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", allIds),
    supabase.from("friend_stats").select("*").in("user_id", acceptedRels.map(otherId)),
  ]);

  const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const statsById = new Map((stats ?? []).map((s) => [s.user_id, s]));

  const friends: Friend[] = acceptedRels.map((r) => {
    const uid = otherId(r);
    const p = profById.get(uid);
    return {
      friendshipId: r.id,
      userId: uid,
      username: p?.username ?? "?",
      displayName: p?.display_name ?? p?.username ?? "Ami",
      avatarUrl: p?.avatar_url ?? null,
      stats: statsFromRow(statsById.get(uid)),
    };
  });

  const pending: PendingRequest[] = pendingRels.map((r) => {
    const uid = otherId(r);
    const p = profById.get(uid);
    return {
      friendshipId: r.id,
      userId: uid,
      username: p?.username ?? "?",
      displayName: p?.display_name ?? p?.username ?? "Quelqu'un",
      avatarUrl: p?.avatar_url ?? null,
    };
  });

  return { friends, pending };
}

/** Met à jour MA ligne de stats partagées (agrégats + statut focus). No-op si non connecté. */
export async function upsertMyFriendStats(partial: Partial<{
  weekMinutes: number; weekSessions: number; streak: number; level: number; xp: number; badges: number;
  inFocus: boolean; focusStartedAt: number; focusHeartbeat: number;
}>): Promise<void> {
  if (!supabase) return;
  const me = getCurrentUserId();
  if (!me) return;
  const row: Record<string, unknown> = { user_id: me, updated_at: Date.now() };
  if (partial.weekMinutes !== undefined) row.week_minutes = partial.weekMinutes;
  if (partial.weekSessions !== undefined) row.week_sessions = partial.weekSessions;
  if (partial.streak !== undefined) row.streak = partial.streak;
  if (partial.level !== undefined) row.level = partial.level;
  if (partial.xp !== undefined) row.xp = partial.xp;
  if (partial.badges !== undefined) row.badges = partial.badges;
  if (partial.inFocus !== undefined) row.in_focus = partial.inFocus;
  if (partial.focusStartedAt !== undefined) row.focus_started_at = partial.focusStartedAt;
  if (partial.focusHeartbeat !== undefined) row.focus_heartbeat = partial.focusHeartbeat;
  const { error } = await supabase.from("friend_stats").upsert(row, { onConflict: "user_id" });
  if (error) console.error("[friends] upsertMyFriendStats:", error.message);
}

/**
 * S'abonne aux changements de friend_stats (la RLS ne diffuse que les lignes
 * d'amis). Renvoie une fonction de désabonnement. No-op sans Supabase.
 */
export function subscribeFriendStats(onChange: () => void): () => void {
  const sb = supabase;
  if (!sb) return () => {};
  const channel = sb
    .channel("friend_stats_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "friend_stats" }, onChange)
    .subscribe();
  return () => { sb.removeChannel(channel); };
}
