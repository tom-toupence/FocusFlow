"use client";

import { create } from "zustand";
import { getCurrentUserId } from "@/lib/authState";
import {
  ChatMessage,
  fetchConversation, sendMessage, markConversationRead,
  fetchUnreadCounts, subscribeMessages,
  CHEER_BODY, CHEER_COOLDOWN_MS, isCheer,
} from "@/lib/friends";
import { useFriendsStore } from "@/store/friendsStore";
import { toast } from "@/components/Toast";

/** Événement de fenêtre émis à la réception d'un encouragement (la session
 *  l'écoute pour allumer la rue). */
export const CHEER_EVENT = "focusflow:cheer";

// Chat direct entre amis (ONLINE-ONLY, non persisté). Une conversation ouverte à
// la fois (façon launcher). Les messages arrivent en temps réel (Realtime) et la
// RLS garantit qu'on ne reçoit que nos propres conversations.

interface ChatState {
  openFriendId: string | null;       // conversation actuellement ouverte
  messages: Record<string, ChatMessage[]>; // par userId d'ami
  unread: Record<string, number>;    // non lus par userId d'ami
  loadingConvo: boolean;
  openChat: (friendId: string) => Promise<void>;
  closeChat: () => void;
  send: (friendId: string, body: string) => Promise<void>;
  refreshUnread: () => Promise<void>;
  /** Dernier encouragement envoyé, par ami (anti-spam, non persisté). */
  cheeredAt: Record<string, number>;
  /** Encourage un ami. false si un encouragement récent bloque l'envoi. */
  cheer: (friendId: string) => Promise<boolean>;
}

export const useChatStore = create<ChatState>((set) => ({
  openFriendId: null,
  messages: {},
  unread: {},
  loadingConvo: false,
  cheeredAt: {},

  cheer: async (friendId) => {
    const last = useChatStore.getState().cheeredAt[friendId] ?? 0;
    if (Date.now() - last < CHEER_COOLDOWN_MS) return false;
    set((s) => ({ cheeredAt: { ...s.cheeredAt, [friendId]: Date.now() } }));
    const m = await sendMessage(friendId, CHEER_BODY);
    if (!m) {
      set((s) => ({ cheeredAt: { ...s.cheeredAt, [friendId]: last } }));
      return false;
    }
    set((s) => {
      const list = s.messages[friendId];
      if (!list || list.some((x) => x.id === m.id)) return {} as Partial<ChatState>;
      return { messages: { ...s.messages, [friendId]: [...list, m] } };
    });
    return true;
  },

  openChat: async (friendId) => {
    set({ openFriendId: friendId, loadingConvo: true });
    const msgs = await fetchConversation(friendId);
    set((s) => ({
      messages: { ...s.messages, [friendId]: msgs },
      unread: { ...s.unread, [friendId]: 0 },
      loadingConvo: false,
    }));
    markConversationRead(friendId);
  },

  closeChat: () => set({ openFriendId: null }),

  send: async (friendId, body) => {
    const m = await sendMessage(friendId, body);
    if (!m) return;
    set((s) => {
      const list = s.messages[friendId] ?? [];
      if (list.some((x) => x.id === m.id)) return {} as Partial<ChatState>;
      return { messages: { ...s.messages, [friendId]: [...list, m] } };
    });
  },

  refreshUnread: async () => {
    const unread = await fetchUnreadCounts();
    set({ unread });
  },
}));

/** Total des messages non lus (toutes conversations). */
export function totalUnread(unread: Record<string, number>): number {
  return Object.values(unread).reduce((a, b) => a + b, 0);
}

// ── Lifecycle Realtime (branché au login via friendsStore) ───────────────────

let msgUnsub: (() => void) | null = null;

export async function initChat(): Promise<void> {
  if (!getCurrentUserId()) return;
  await useChatStore.getState().refreshUnread();

  if (!msgUnsub) {
    msgUnsub = subscribeMessages((m) => {
      const me = getCurrentUserId();
      const friendId = m.senderId === me ? m.recipientId : m.senderId;
      const st = useChatStore.getState();
      const list = st.messages[friendId] ?? [];
      if (list.some((x) => x.id === m.id)) return; // déjà là (envoi optimiste)

      const isOpen = st.openFriendId === friendId;
      const hasConvo = st.messages[friendId] !== undefined;

      useChatStore.setState((s) => {
        const cur = s.messages[friendId] ?? [];
        const messages = (hasConvo || isOpen)
          ? { ...s.messages, [friendId]: [...cur, m] }
          : s.messages;
        const unread = (m.senderId !== me && !isOpen)
          ? { ...s.unread, [friendId]: (s.unread[friendId] ?? 0) + 1 }
          : s.unread;
        return { messages, unread };
      });

      // Reçu dans la conversation ouverte → marque lu immédiatement.
      if (m.senderId !== me && isOpen) markConversationRead(friendId);

      // Encouragement reçu : un mot, et la rue de la session s'illumine.
      if (m.senderId !== me && isCheer(m)) {
        const name = useFriendsStore.getState().friends.find((f) => f.userId === m.senderId)?.displayName ?? "Un ami";
        toast({ title: `${name} t'encourage`, description: "Continue, tu n'es pas seul ce soir.", accent: "sky" });
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHEER_EVENT, { detail: { from: name } }));
      }
    });
  }
}

export function teardownChat(): void {
  msgUnsub?.(); msgUnsub = null;
  useChatStore.setState({ openFriendId: null, messages: {}, unread: {}, loadingConvo: false, cheeredAt: {} });
}
