"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractYouTubeId } from "@/data/videos";
import { useQueueStore, fetchVideoMeta } from "@/store/queueStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { cn } from "@/lib/utils";

export default function QueuePanel() {
  const router = useRouter();
  const { items, addItem, removeItem, moveItem, clear } = useQueueStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    setError("");
    const youtubeId = extractYouTubeId(input.trim());
    if (!youtubeId) {
      setError("Lien YouTube invalide (colle un lien de vidéo : youtube.com/watch?v=… ou youtu.be/…)");
      return;
    }
    if (items.some((i) => i.youtubeId === youtubeId)) {
      setError("Cette vidéo est déjà dans la file.");
      return;
    }
    setLoading(true);
    const meta = await fetchVideoMeta(youtubeId);
    setLoading(false);
    addItem({
      youtubeId,
      title: meta.title ?? "Vidéo YouTube",
      channelName: meta.channelName,
      thumbnailUrl: meta.thumbnailUrl ?? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
    });
    setInput("");
  };

  const handleStart = () => {
    if (items.length === 0) return;
    useSpotifyStore.getState().selectPlaylist(null);
    useTwitchStore.getState().clear();
    useSessionStore.getState().selectQueue();
    router.push("/settings");
  };

  return (
    <div className="rounded-2xl bg-foreground/[0.03] border border-foreground/[0.08] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-foreground/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="8" y1="6" x2="21" y2="6" strokeLinecap="round" /><line x1="8" y1="12" x2="21" y2="12" strokeLinecap="round" /><line x1="8" y1="18" x2="14" y2="18" strokeLinecap="round" />
              <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
            </svg>
            Ma file de lecture
            {items.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/50 font-medium">{items.length}</span>}
          </h3>
          <p className="text-xs text-foreground/40 mt-1">Tes titres exacts, dans l&apos;ordre — lecture continue + skip.</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background font-semibold text-xs hover:bg-foreground/90 transition-all flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Démarrer
          </button>
        )}
      </div>

      {/* Add by URL */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleAdd(); }}
            placeholder="Colle un lien de vidéo YouTube…"
            className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/25 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim() || loading}
            className="px-4 py-2 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-sm font-medium text-foreground/80 disabled:opacity-30 transition-all flex items-center gap-1.5"
          >
            {loading ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83" strokeLinecap="round" />
              </svg>
            ) : "Ajouter"}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <p className="text-sm text-foreground/30 py-2">
          File vide. Ajoute des vidéos YouTube une par une pour composer ta session — l&apos;ordre est respecté à la lecture.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item, idx) => (
            <div key={item.id} className="group flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-foreground/[0.04] transition-colors">
              <span className="text-[11px] text-foreground/30 tabular-nums w-5 text-center flex-shrink-0">{idx + 1}</span>
              <div className="w-14 h-9 rounded-md overflow-hidden bg-foreground/10 flex-shrink-0">
                {item.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground/85 truncate">{item.title}</p>
                {item.channelName && <p className="text-[11px] text-foreground/35 truncate">{item.channelName}</p>}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveItem(item.id, "up")}
                  disabled={idx === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 transition-all"
                  title="Monter"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button
                  onClick={() => moveItem(item.id, "down")}
                  disabled={idx === items.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 transition-all"
                  title="Descendre"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all",
                    "sm:opacity-0 sm:group-hover:opacity-100"
                  )}
                  title="Retirer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>
          ))}
          <button onClick={clear} className="self-start mt-1 text-xs text-foreground/40 hover:text-red-400 transition-colors">
            Vider la file
          </button>
        </div>
      )}
    </div>
  );
}
