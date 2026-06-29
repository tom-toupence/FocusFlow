"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// File de lecture FocusFlow : une liste ORDONNÉE de vidéos YouTube choisies par
// l'utilisateur. Contrairement aux mixes radio (RD…, personnalisés/non
// reproductibles), la file est 100% sous notre contrôle → titres exacts, ordre
// exact, skip et boucle fiables (lecture gérée manuellement dans la session).
export interface QueueItem {
  id: string;          // id interne (uuid)
  youtubeId: string;   // id vidéo YouTube (11 car.)
  title: string;
  channelName?: string;
  thumbnailUrl?: string;
}

interface QueueState {
  items: QueueItem[];
  addItem: (item: Omit<QueueItem, "id">) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, dir: "up" | "down") => void;
  clear: () => void;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        // Évite les doublons exacts (même vidéo déjà dans la file).
        if (get().items.some((i) => i.youtubeId === item.youtubeId)) return;
        set((s) => ({ items: [...s.items, { ...item, id: crypto.randomUUID() }] }));
      },
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      moveItem: (id, dir) => {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return;
        const swap = dir === "up" ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= items.length) return;
        [items[idx], items[swap]] = [items[swap], items[idx]];
        set({ items });
      },
      clear: () => set({ items: [] }),
    }),
    { name: "focusflow-queue" }
  )
);

// Récupère titre/chaîne/miniature d'une vidéo via oEmbed YouTube (pas de clé API).
export async function fetchVideoMeta(youtubeId: string): Promise<{
  title?: string;
  channelName?: string;
  thumbnailUrl?: string;
}> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${youtubeId}`
      )}&format=json`
    );
    if (!res.ok) return {};
    const data = await res.json();
    return {
      title: data.title,
      channelName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    };
  } catch {
    return {};
  }
}
