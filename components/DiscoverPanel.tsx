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
import { LocalTrack } from "@/store/localPlaylistStore";
import AddToMenu from "@/components/AddToMenu";
import { cn } from "@/lib/utils";

// Onglet « Découvrir » : recommandations dérivées de ce que l'utilisateur a
// réellement écouté + recherche musicale intégrée. Sources gratuites, sans
// clé côté client :
//  1. « Parce que tu as écouté X » — mix radio YouTube (RD<videoId>) du top média.
//  2. « Autour de tes thèmes » — recherches YouTube sur des mots-clés extraits
//     des titres écoutés (affinés par le coach IA si une clé serveur existe).
//  3. Recherche libre — /api/youtube/search, en tête, à tout moment.

interface Section {
  label: string;
  videos: RecVideo[];
  /** Explication du coach IA (« tu écoutes des OST d'anime »). */
  reason?: string;
}

const SUGGESTION_CHIPS: { label: string; query: string }[] = [
  { label: "Lofi", query: "lofi ambient mix" },
  { label: "Anime OST", query: "anime ost mix" },
  { label: "Piano", query: "piano focus music" },
  { label: "Game OST", query: "video game ost mix" },
  { label: "Study with me", query: "study with me" },
];

export default function DiscoverPanel() {
  const router = useRouter();
  const entries = usePlayHistoryStore((s) => s.entries);
  const queueItems = useQueueStore((s) => s.items);
  const { getAllVideos } = useSessionStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [becauseSection, setBecauseSection] = useState<Section | null>(null);
  const [themeSections, setThemeSections] = useState<Section[]>([]);
  const [aiUsed, setAiUsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Recherche libre.
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecVideo[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const isSearching = query.trim().length > 0;

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

      // 2. Thèmes : le coach IA INTERPRÈTE les titres/chaînes (univers, genres,
      // artistes) si une clé serveur existe ; sinon extraction locale enrichie.
      const channels = [...new Set(
        listened.map((e) => e.subtitle).filter((c) => c && c !== "YouTube Playlist")
      )].slice(0, 15);
      const aiQueries = titles.length > 0
        ? await fetchAiQueries({ titles, channels }, { force: refreshKey > 0 })
        : null;
      const queries = aiQueries ?? buildLocalQueries(titles, channels);
      const themesPromise = Promise.all(
        queries.slice(0, 3).map(async (q) => ({
          label: q.label,
          reason: q.reason,
          videos: (await fetchSearchVideos(q.query)).slice(0, 8),
        }))
      );

      const [because, themes] = await Promise.all([becausePromise, themesPromise]);
      if (cancelled) return;
      setAiUsed(aiQueries !== null);
      setBecauseSection(because);
      setThemeSections(themes.filter((s) => s.videos.length > 0));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // Relance uniquement au montage / bouton actualiser (pas à chaque écoute).
  }, [mounted, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recherche libre, debounce 400 ms.
  useEffect(() => {
    if (!mounted) return;
    const q = query.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      // Recherche directe : toutes durées (une musique fait souvent 3-4 min).
      const results = await fetchSearchVideos(q, 0);
      if (cancelled) return;
      setSearchResults(results);
      setSearchLoading(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, mounted]);

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

  const sections = [
    ...(becauseSection ? [becauseSection] : []),
    ...themeSections,
  ].map((s) => ({ ...s, videos: s.videos.filter((v) => !knownIds.has(v.id)) }))
    .filter((s) => s.videos.length > 0);

  const visibleSearchResults = searchResults.filter((v) => !knownIds.has(v.id));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Découvrir</h1>
          <p className="text-foreground/40 mt-1 text-sm">
            Des recommandations basées sur ce que tu écoutes, ou cherche directement un titre.
          </p>
        </div>
        {!isSearching && (
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/50 hover:text-foreground text-xs font-medium transition-all disabled:opacity-40 flex-shrink-0"
          >
            <svg className={cn("w-3.5 h-3.5", loading && "animate-spin")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Actualiser
          </button>
        )}
      </div>

      {/* Barre de recherche — toujours en tête */}
      <div className="relative max-w-xl w-full">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une musique, un artiste, un mix…"
          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-10 pr-9 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/25 transition-colors"
        />
        {searchLoading && (
          <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83" strokeLinecap="round" />
          </svg>
        )}
        {!searchLoading && isSearching && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-foreground/30 hover:text-foreground hover:bg-foreground/10 transition-all"
            aria-label="Effacer la recherche"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>

      {isSearching ? (
        <>
          <div className="flex items-center justify-between -mt-2">
            <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest">Résultats pour « {query.trim()} »</p>
            <button onClick={() => setQuery("")} className="text-xs text-foreground/40 hover:text-foreground transition-colors">
              Effacer
            </button>
          </div>
          {searchLoading && visibleSearchResults.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="aspect-video rounded-xl bg-foreground/[0.05] anim-skeleton" />
              ))}
            </div>
          ) : visibleSearchResults.length === 0 ? (
            <p className="text-sm text-foreground/30 py-8 text-center">Aucun résultat pour cette recherche.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleSearchResults.map((v) => (
                <DiscoverCard key={v.id} video={v} onPlay={() => handlePlay(v)} />
              ))}
            </div>
          )}
        </>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="aspect-video rounded-xl bg-foreground/[0.05] anim-skeleton" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-foreground/25">
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-center max-w-sm">
            Pas encore assez d&apos;écoutes pour te recommander des titres — cherche une musique
            ci-dessus, ou lance quelques sessions puis reviens ici.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {SUGGESTION_CHIPS.map((c) => (
              <button
                key={c.label}
                onClick={() => setQuery(c.query)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-foreground/5 hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-all"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.label}>
            <div className="flex items-baseline gap-2 mb-4 flex-wrap">
              <p className="text-xs font-semibold text-foreground/30 uppercase tracking-widest">{section.label}</p>
              {aiUsed && section.reason && (
                <span className="text-[11px] text-foreground/35">
                  <span className="text-violet-400/80 font-medium mr-1">✦ IA</span>
                  {section.reason}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {section.videos.map((v) => (
                <DiscoverCard key={v.id} video={v} onPlay={() => handlePlay(v)} />
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

function toLocalTrack(v: RecVideo): LocalTrack {
  return {
    youtubeId: v.id,
    title: v.title,
    channelName: v.channel || undefined,
    thumbnailUrl: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
  };
}

// Carte de recommandation : actions TOUJOURS visibles (pas de hover-only),
// popover AddToMenu hors du conteneur overflow-hidden (seule la miniature l'est).
function DiscoverCard({ video, onPlay }: { video: RecVideo; onPlay: () => void }) {
  const length = formatLength(video.lengthSeconds);
  return (
    <div className="rounded-xl bg-foreground/[0.03] border border-foreground/[0.08] transition-all hover:ring-1 hover:ring-foreground/20">
      <button onClick={onPlay} className="relative block w-full aspect-video overflow-hidden rounded-t-xl bg-foreground/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
        {length && (
          <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-black/50 text-white/80">
            {length}
          </span>
        )}
      </button>

      <div className="p-2.5 flex flex-col gap-2">
        <div>
          <p className="text-xs font-medium text-foreground/85 leading-tight line-clamp-2">{video.title}</p>
          {video.channel && <p className="text-[11px] text-foreground/35 mt-0.5 line-clamp-1">{video.channel}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPlay}
            className="flex-1 flex items-center justify-center gap-1.5 bg-foreground text-background rounded-lg px-3 py-1.5 text-[11px] font-semibold hover:bg-foreground/90 transition-all"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Lire
          </button>
          <AddToMenu track={toLocalTrack(video)} />
        </div>
      </div>
    </div>
  );
}
