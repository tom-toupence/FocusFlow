"use client";

import { create } from "zustand";
import { getCurrentUserId } from "@/lib/authState";
import {
  ChatMessage,
  fetchConversation, sendMessage, markConversationRead,
  fetchUnreadCounts, subscribeMessages,
} from "@/lib/friends";

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
}

export const useChatStore = create<ChatState>((set) => ({
  openFriendId: null,
  messages: {},
  unread: {},
  loadingConvo: false,

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
    });
  }
}

export function teardownChat(): void {
  msgUnsub?.(); msgUnsub = null;
  useChatStore.setState({ openFriendId: null, messages: {}, unread: {}, loadingConvo: false });
}
