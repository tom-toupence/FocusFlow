// Adaptateur YouTube (IFrame API). Reprend la logique qui vivait dans la page
// de session, à l'identique sur les points sensibles (AGENTS.md) :
//   . jamais `videoId` + `list` dans le constructeur (sinon autoplay hors liste) ;
//   . vraie playlist en repli natif : loadPlaylist({list}) dans onReady + setLoop ;
//   . file maison pour tout le reste : à la fin d'un titre (ENDED = 0) on charge
//     le suivant nous-mêmes ;
//   . garde anti-doublon pendant une prolongation (`fetchingMore`), sinon les
//     ENDED redondants font avancer deux fois.
// Nouveau : prolongation à partir de TOUTE la playlist (lib/playback/continuation).
import { fetchMixVideos } from "@/store/playlistStore";
import { TrackQueue } from "./queue";
import { continuePlaylist, type ContinuationTrack } from "./continuation";
import { Observable, type ExtendedEvent, type PlaybackState, type PlayerAdapter } from "./types";

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
  setPlaybackQuality: (q: string) => void;
  setVolume: (v: number) => void;
  nextVideo: () => void;
  previousVideo: () => void;
  loadVideoById: (id: string) => void;
  loadPlaylist: (opts: string[] | { list: string; listType: string; index?: number; startSeconds?: number }) => void;
  setLoop: (loop: boolean) => void;
}

declare global {
  interface Window {
    YT: { Player: new (id: string, cfg: object) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YouTubeSource =
  | { type: "video"; id: string; title: string; subtitle?: string }
  /** File maison : File FocusFlow, mix radio résolu, playlist résolue. */
  | { type: "queue"; tracks: { id: string; title: string }[]; subtitle?: string }
  /** Repli : vraie playlist que l'on n'a pas pu résoudre côté serveur. */
  | { type: "native"; listId: string; title: string };

export interface YouTubeOptions {
  volume: number;
  shuffle: boolean;
  loop: boolean;
  /** Lecture voulue au démarrage (minuteur en marche, hors pause). */
  playing: boolean;
  onExtended?: (e: ExtendedEvent) => void;
  /** Recommandations pour une graine (injectable pour les tests). */
  recommend?: (seed: string) => Promise<ContinuationTrack[]>;
}

const thumb = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

let apiPromise: Promise<void> | null = null;
/** Charge l'API IFrame une seule fois pour toute l'application. */
export function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("serveur"));
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    // Filet : le callback a pu partir avant qu'on l'installe.
    const poll = setInterval(() => { if (window.YT?.Player) { clearInterval(poll); resolve(); } }, 100);
  });
  return apiPromise;
}

const defaultRecommend = async (seed: string): Promise<ContinuationTrack[]> => {
  const { ids, titles } = await fetchMixVideos(`RD${seed}`, seed);
  return ids.map((id) => ({ id, title: titles[id] ?? "Titre similaire" }));
};

export class YouTubeAdapter extends Observable<PlaybackState> implements PlayerAdapter {
  readonly kind = "youtube" as const;
  private player: YTPlayer | null = null;
  private ready = false;
  private queue: TrackQueue | null = null;
  private titles: Record<string, string> = {};
  private fetchingMore = false;
  private wantPlay: boolean;
  private volume: number;
  private destroyed = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  constructor(private elementId: string, private source: YouTubeSource, private opts: YouTubeOptions) {
    const queued = source.type === "queue";
    super({
      kind: "youtube", ready: false, playing: false, track: null,
      caps: { skip: queued || source.type === "native", shuffle: queued, loop: queued, volume: true },
      shuffle: queued && opts.shuffle, loop: opts.loop, extending: false, error: null,
    });
    this.wantPlay = opts.playing;
    this.volume = opts.volume;
    if (source.type === "queue") {
      this.titles = Object.fromEntries(source.tracks.map((t) => [t.id, t.title]));
      this.queue = new TrackQueue(source.tracks.map((t) => t.id), { shuffle: opts.shuffle });
    }
    // Le titre est connu avant que le lecteur soit prêt : on l'affiche tout de suite.
    this.state = { ...this.state, track: this.trackInfo() };
    loadYouTubeApi().then(() => { if (!this.destroyed) this.create(); }).catch(() => {
      this.set({ error: "Le lecteur YouTube n'a pas pu se charger." });
    });
    // Réseau filtré, bloqueur : on le dit au lieu de rester muet.
    this.watchdog = setTimeout(() => {
      if (!this.ready && !this.destroyed) this.set({ error: "YouTube ne répond pas. Vérifie ta connexion ou ton bloqueur de contenu." });
    }, 15000);
  }

  /** Piste courante telle que l'interface l'affiche. */
  private trackInfo() {
    const s = this.source;
    if (s.type === "video") return { id: s.id, title: s.title, subtitle: s.subtitle, artwork: thumb(s.id) };
    if (s.type === "native") return { id: s.listId, title: s.title, subtitle: "Playlist YouTube" };
    const q = this.queue!;
    const id = q.current;
    if (!id) return null;
    return { id, title: this.titles[id] ?? "Titre", subtitle: s.subtitle, artwork: thumb(id), index: q.index, total: q.size };
  }

  private onReady = (p: YTPlayer) => {
    this.ready = true;
    p.setPlaybackQuality("hd1080");
    p.setVolume(Math.round(this.volume * 100));
    if (this.wantPlay) p.playVideo(); else p.pauseVideo();
    this.set({ ready: true, playing: this.wantPlay, track: this.trackInfo(), error: null });
  };

  private create() {
    const vars = { autoplay: 1, mute: 0, controls: 0, rel: 0, modestbranding: 1 };
    const s = this.source;
    if (s.type === "video") {
      // Vidéo unique en boucle : `playlist` = elle-même (et JAMAIS `list`).
      this.player = new window.YT.Player(this.elementId, {
        videoId: s.id,
        playerVars: { ...vars, showinfo: 0, loop: 1, playlist: s.id, suggestedQuality: "hd1080" },
        events: { onReady: (e: { target: YTPlayer }) => this.onReady(e.target) },
      });
    } else if (s.type === "native") {
      this.player = new window.YT.Player(this.elementId, {
        playerVars: vars,
        events: {
          onReady: (e: { target: YTPlayer }) => {
            e.target.loadPlaylist({ list: s.listId, listType: "playlist", index: 0 });
            e.target.setLoop(true);
            this.onReady(e.target);
          },
        },
      });
    } else {
      const first = this.queue!.current;
      if (!first) { this.set({ error: "Aucun titre à lire." }); return; }
      this.player = new window.YT.Player(this.elementId, {
        videoId: first,
        playerVars: vars,
        events: {
          onReady: (e: { target: YTPlayer }) => this.onReady(e.target),
          onStateChange: (e: { data: number }) => { if (e.data === 0) this.onEnded(); },
        },
      });
    }
  }

  private load(id: string) {
    this.player?.loadVideoById(id);
    if (!this.wantPlay) this.player?.pauseVideo();
    this.set({ track: this.trackInfo() });
  }

  /** Fin d'un titre de la file maison. */
  private onEnded() {
    const q = this.queue;
    if (!q || this.fetchingMore) return; // prolongation en vol : ENDED redondant ignoré
    const r = q.next(this.state.loop);
    if (r.kind === "track") { this.load(r.id); return; }
    void this.extend();
  }

  /** Prolonge la file avec des titres proches de toute la playlist. */
  private async extend() {
    const q = this.queue!;
    this.fetchingMore = true;
    this.set({ extending: true });
    const res = await continuePlaylist(q.order, q.current, this.opts.recommend ?? defaultRecommend, { exclude: q.all });
    this.fetchingMore = false;
    if (this.destroyed) return;
    if (res.kind === "extend") {
      const added = q.append(res.tracks.map((t) => t.id));
      for (const t of res.tracks) this.titles[t.id] = t.title;
      this.opts.onExtended?.({ added: added.length, titles: Object.fromEntries(res.tracks.map((t) => [t.id, t.title])) });
      const n = q.next(false);
      if (n.kind === "track") { this.set({ extending: false }); this.load(n.id); return; }
    }
    // Rien de neuf (réseau, doublons) : on reboucle plutôt que de s'arrêter.
    const n = q.next(true);
    this.set({ extending: false });
    if (n.kind === "track") this.load(n.id);
  }

  play() {
    this.wantPlay = true;
    if (this.ready) this.player?.playVideo();
    this.set({ playing: true });
  }
  pause() {
    this.wantPlay = false;
    if (this.ready) this.player?.pauseVideo();
    this.set({ playing: false });
  }
  next() {
    if (this.source.type === "native") { this.player?.nextVideo(); return; }
    const q = this.queue;
    if (!q || this.fetchingMore) return;
    // Un skip manuel au bout de la file se comporte comme une fin de titre.
    const r = q.next(this.state.loop);
    if (r.kind === "track") this.load(r.id); else void this.extend();
  }
  previous() {
    if (this.source.type === "native") { this.player?.previousVideo(); return; }
    const r = this.queue?.previous();
    if (r?.kind === "track") this.load(r.id);
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.ready) this.player?.setVolume(Math.round(v * 100));
  }
  setShuffle(on: boolean) {
    if (!this.queue) return;
    this.queue.setShuffle(on);
    this.set({ shuffle: on, track: this.trackInfo() });
  }
  setLoop(on: boolean) { this.set({ loop: on }); }
  /** Titres connus (pour l'activité affichée aux amis, l'historique). */
  titleOf(id: string) { return this.titles[id]; }

  destroy() {
    this.destroyed = true;
    if (this.watchdog) clearTimeout(this.watchdog);
    try { this.player?.destroy(); } catch { /* déjà détruit */ }
    this.player = null;
    this.ready = false;
  }
}
