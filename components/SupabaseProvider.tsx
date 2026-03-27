"use client";

/**
 * SupabaseProvider — charge les données Supabase dans Zustand au login.
 *
 * Règles :
 * - setupSync ne tourne qu'UNE seule fois par userId (module-level guard).
 * - Le merge préserve les items ajoutés localement pendant que le fetch tourne.
 * - Les écritures DB se font directement dans les actions store, pas ici.
 */

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { setCurrentUserId } from "@/lib/authState";
import { fetchCustomVideos, fetchTodos, fetchWorkSessions, fetchPlaylists } from "@/lib/db";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useStatsStore } from "@/store/statsStore";

// Guard module-level : évite de ré-écraser le state si l'event auth refire
// (React Strict Mode double-mount, token refresh, etc.)
let syncedUserId: string | null = null;

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!supabase) return;

    const setupSync = async (userId: string) => {
      // Ne syncer qu'une seule fois par utilisateur par session browser
      if (syncedUserId === userId) return;
      syncedUserId = userId;

      const [remoteVideos, remoteTodos, remoteSessions, remotePlaylists] = await Promise.all([
        fetchCustomVideos(userId),
        fetchTodos(userId),
        fetchWorkSessions(userId),
        fetchPlaylists(userId),
      ]);

      // Merge custom videos : remote wins pour les conflits d'id,
      // mais on conserve les items ajoutés localement pendant le fetch.
      useSessionStore.setState((s) => {
        const remoteIds = new Set(remoteVideos.map((v) => v.id));
        const localOnly = s.customVideos.filter((v) => !remoteIds.has(v.id));
        return { customVideos: [...remoteVideos, ...localOnly] };
      });

      // Merge todos : remote wins, on conserve les todos locaux non encore en DB.
      useSessionStore.setState((s) => {
        const remoteIds = new Set(remoteTodos.map((t) => t.id));
        const localOnly = s.todos.filter((t) => !remoteIds.has(t.id));
        return { todos: [...remoteTodos, ...localOnly] };
      });

      // Stats : prend le max par jour (l'activité locale avant login compte).
      useStatsStore.setState((s) => {
        const merged = { ...s.days };
        for (const [date, remote] of Object.entries(remoteSessions)) {
          const local = merged[date];
          merged[date] = {
            date,
            sessions: Math.max(remote.sessions, local?.sessions ?? 0),
            minutesWorked: Math.max(remote.minutesWorked, local?.minutesWorked ?? 0),
          };
        }
        return { days: merged };
      });

      // Merge playlists : idem.
      usePlaylistStore.setState((s) => {
        const remoteIds = new Set(remotePlaylists.map((p) => p.id));
        const localOnly = s.playlists.filter((p) => !remoteIds.has(p.id));
        return { playlists: [...remotePlaylists, ...localOnly] };
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
        setCurrentUserId(session.user.id);
        await setupSync(session.user.id);
      } else if (event === "SIGNED_OUT") {
        syncedUserId = null;
        setCurrentUserId(null);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  return <>{children}</>;
}
