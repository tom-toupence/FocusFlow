"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayHistoryStore, getTopPlays } from "@/store/playHistoryStore";
import { useQueueStore } from "@/store/queueStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpotifyStore } from "@/store/spotifyStore";
import { useTwitchStore } from "@/store/twitchStore";
import { fetchMixVideos } from "@/store/playlistStore";
import { buildLocalQueries, fetchAiQueries, fetchSearchVideos, RecVideo } from "@/lib/recommendations";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// Onglet « Découvrir » : recommandations dérivées de ce que l'utilisateur a
// réellement écouté. Deux sources, toutes gratuites et sans clé côté client :
//  1. « Parce que tu as écouté X » — mix radio YouTube (RD<videoId>) du top média.
//  2. « Autour de tes thèmes » — recherches YouTube sur des mots-clés extraits
//     des titres écoutés (affinés par le coach IA si une clé serveur existe).

interface Section {
  label: string;
  videos: RecVideo[];
}

export default function DiscoverPanel() {
  const router = useRouter();
  const entries = usePlayHistoryStore((s) => s.entries);
  const queueItems = useQueueStore((s) => s.items);
  const { customVideos, getAllVideos } = useSessionStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [becauseSection, setBecauseSection] = useState<Section | null>(null);
  const [themeSections, setThemeSections] = useState<Section[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Ids déjà connus (catalogue + bibliothèque + file) → exclus des recos.
  const knownIds = new Set<string>([
    ...getAllVideos().map((v) => v.youtubeId),
    ...queueItems.map((i) => i.youtubeId),
  ]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Titres réellement écoutés (YouTube uniquement), du plus récent au plus ancien.
      const listened = entries.filter((e) => e.type === "youtube" || e.type === "playlist");
      const titles = [...new Set(listened.map((e) => e.title))].slice(0, 20);

      // 1. Mix lié au média YouTube le plus écouté.
      const topYoutube = getTopPlays(listened, 10).find((p) => p.type === "youtube");
      const becausePromise: Promise<Section | null> = topYoutube
        ? fetchMixVideos(`RD${topYoutube.mediaKey}`, topYoutube.mediaKey).then(({ ids, titles: t }) => {
            const videos = ids
              .filter((id) => id !== topYoutube.mediaKey)
              .slice(0, 8)
              .map((id) => ({ id, title: t[id] ?? "Titre similaire", channel: "", lengthSeconds: null }));
            return videos.length > 0 ? { label: `Parce que tu as écouté « ${topYoutube.title} »`, videos } : null;
          })
        : Promise.resolve(null);

      // 2. Thèmes : requêtes IA si dispo, sinon extraction locale de mots-clés.
      const queries = (titles.length > 0 ? await fetchAiQueries(titles) : null) ?? buildLocalQueries(titles);
      const themesPromise = Promise.all(
        queries.slice(0, 3).map(async (q) => ({
          label: q.label,
          videos: (await fetchSearchVideos(q.query)).slice(0, 8),
        }))
      );

      const [because, themes] = await Promise.all([becausePromise, themesPromise]);
      if (cancelled) return;
      setBecauseSection(because);
      setThemeSections(themes.filter((s) => s.videos.length > 0));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // Relance uniquement au montage / bouton actualiser (pas à chaque écoute).
  }, [mounted, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const handlePlay = (v: RecVideo) => {
    const session = useSessionStore.getState();
    const existing = session.getAllVideos().find((x) => x.youtubeId === v.id);
    let id = existing?.id;
    if (!id) {
      id = `disc-${v.id}`;
      session.addCustomVideo({ id, title: v.title, channel: v.channel || "YouTube", youtubeId: v.id, mood: "lofi", custom: true });
    }
    useSpotifyStore.getState().selectPlaylist(null);
    useTwitchStore.getState().clear();
    session.selectVideo(id);
    router.push("/settings");
  };

  const handleAddQueue = (v: RecVideo) => {
    useQueueStore.getState().addItem({
      youtubeId: v.id,
      title: v.title,
      channelName: v.channel || undefined,
      thumbnailUrl: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
    });
    toast({ title: "Ajouté à la file", description: v.title, emoji: "🎵", accent: "emerald" });
  };

  const handleAddLibrary = (v: RecVideo) => {
    useSessionStore.getState().addCustomVideo({
      id: `disc-${v.id}`,
      title: v.title,
      channel: v.channel || "YouTube",
      youtubeId: v.id,
      mood: "lofi",
      custom: true,
    });
    toast({ title: "Ajouté à ta bibliothèque", description: v.title, emoji: "📚", accent: "emerald" });
  };

  const sections = [
    ...(becauseSection ? [becauseSection] : []),
    ...themeSections,
  ].map((s) => ({ ...s, videos: s.videos.filter((v) => !knownIds.has(v.id)) }))
    .filter((s) => s.videos.length > 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">Découvrir</h1>
          <p className="text-foreground/40 mt-1 text-sm">
            Des recommandations basées sur ce que tu écoutes pendant tes sessions.
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/50 hover:text-foreground text-xs font-medium transition-all disabled:opacity-40"
        >
          <svg className={cn("w-3.5 h-3.5", loading && "animate-spin")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="aspect-video rounded-xl bg-foreground/[0.05] anim-skeleton" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-foreground/25">
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-center max-w-sm">
            Pas encore assez d&apos;écoutes pour te recommander des titres — lance quelques sessions
            avec le catalogue ou ta bibliothèque, puis reviens ici.
          </p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.label}>
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest mb-4">{section.label}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {section.videos.map((v) => (
                <DiscoverCard
                  key={v.id}
                  video={v}
                  inQueue={queueItems.some((i) => i.youtubeId === v.id)}
                  inLibrary={customVideos.some((c) => c.youtubeId === v.id)}
                  onPlay={() => handlePlay(v)}
                  onAddQueue={() => handleAddQueue(v)}
                  onAddLibrary={() => handleAddLibrary(v)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function formatLength(s: number | null): string | null {
  if (s === null) return null;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${m > 0 ? `${m.toString().padStart(2, "0")}` : ""}`.trim() : `${m} min`;
}

function DiscoverCard({
  video,
  inQueue,
  inLibrary,
  onPlay,
  onAddQueue,
  onAddLibrary,
}: {
  video: RecVideo;
  inQueue: boolean;
  inLibrary: boolean;
  onPlay: () => void;
  onAddQueue: () => void;
  onAddLibrary: () => void;
}) {
  const length = formatLength(video.lengthSeconds);
  return (
    <div className="group relative rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-foreground/30 bg-foreground/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Durée */}
      {length && (
        <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-black/50 text-white/80">
          {length}
        </span>
      )}

      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 transition-opacity duration-200 group-hover:opacity-0">
        <p className="text-white text-xs font-medium leading-tight line-clamp-2">{video.title}</p>
        {video.channel && <p className="text-white/50 text-[10px] mt-0.5 line-clamp-1">{video.channel}</p>}
      </div>

      {/* Hover : actions */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 px-3">
        <button
          onClick={onPlay}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black text-[11px] font-semibold shadow-lg hover:bg-white/90 transition-all"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Lire
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onAddQueue}
            disabled={inQueue}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all",
              inQueue
                ? "bg-white/5 border-white/10 text-white/30 cursor-default"
                : "bg-white/10 border-white/20 text-white/85 hover:bg-white/20 hover:text-white"
            )}
          >
            {inQueue ? "Dans la file" : "+ File"}
          </button>
          <button
            onClick={onAddLibrary}
            disabled={inLibrary}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all",
              inLibrary
                ? "bg-white/5 border-white/10 text-white/30 cursor-default"
                : "bg-white/10 border-white/20 text-white/85 hover:bg-white/20 hover:text-white"
            )}
          >
            {inLibrary ? "Dans la biblio" : "+ Bibliothèque"}
          </button>
        </div>
      </div>
    </div>
  );
}
