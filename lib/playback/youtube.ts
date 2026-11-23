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
import { NO_CAPS, Observable, type ExtendedEvent, type PlaybackState, type PlayerAdapter, type Track } from "./types";

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
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}

declare global {
  interface Window {
    YT: { Player: new (el: string | HTMLElement, cfg: object) => YTPlayer };
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
  /** Erreurs de lecture d'affilée (titres indisponibles) : au-delà de la taille
   *  de la file, on s'arrête au lieu de boucler sans fin. */
  private errorStreak = 0;
  private wantPlay: boolean;
  private volume: number;
  private destroyed = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private host: HTMLElement | null = null;
  private raceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Titres ajoutés par la lecture continue ou une suggestion acceptée. */
  private suggested = new Set<string>();

  constructor(private elementId: string, private source: YouTubeSource, private opts: YouTubeOptions) {
    const queued = source.type === "queue";
    super({
      kind: "youtube", ready: false, playing: false, track: null,
      caps: {
        ...NO_CAPS, volume: true, seek: true,
        skip: queued || source.type === "native", shuffle: queued, loop: queued,
        suggestions: source.type !== "native", removeUpcoming: queued,
      },
      shuffle: queued && opts.shuffle, loop: opts.loop, extending: false, upcoming: [], error: null,
    });
    this.wantPlay = opts.playing;
    this.volume = opts.volume;
    if (source.type === "queue") {
      this.titles = Object.fromEntries(source.tracks.map((t) => [t.id, t.title]));
      this.queue = new TrackQueue(source.tracks.map((t) => t.id), { shuffle: opts.shuffle });
    }
    // Le titre est connu avant que le lecteur soit prêt : on l'affiche tout de suite.
    this.state = { ...this.state, track: this.trackInfo(), upcoming: this.upcomingInfo() };
    loadYouTubeApi().then(() => { if (!this.destroyed) this.create(); }).catch(() => {
      this.set({ error: "Le lecteur YouTube n'a pas pu se charger." });
    });
    // Réseau filtré, bloqueur : on le dit au lieu de rester muet.
    this.watchdog = setTimeout(() => {
      if (!this.ready && !this.destroyed) this.set({ error: "YouTube ne répond pas. Vérifie ta connexion ou ton bloqueur de contenu." });
    }, 15000);
  }

  private toTrack(id: string, subtitle?: string): Track {
    return { id, title: this.titles[id] ?? "Titre", subtitle, artwork: thumb(id), source: "youtube", suggested: this.suggested.has(id) };
  }

  /** Piste courante telle que l'interface l'affiche. */
  private trackInfo() {
    const s = this.source;
    if (s.type === "video") return { id: s.id, title: s.title, subtitle: s.subtitle, artwork: thumb(s.id), source: "youtube" as const };
    if (s.type === "native") return { id: s.listId, title: s.title, subtitle: "Playlist YouTube", source: "youtube" as const };
    const q = this.queue!;
    const id = q.current;
    if (!id) return null;
    return { ...this.toTrack(id, s.subtitle), index: q.index, total: q.size };
  }

  private upcomingInfo(): Track[] {
    if (!this.queue || this.source.type !== "queue") return [];
    const sub = this.source.subtitle;
    return this.queue.upcoming(10).map((id) => this.toTrack(id, sub));
  }

  /** Republie la piste courante et la file à venir. */
  private sync(extra: Partial<PlaybackState> = {}) {
    this.set({ track: this.trackInfo(), upcoming: this.upcomingInfo(), ...extra });
  }

  private onReady = (p: YTPlayer) => {
    this.ready = true;
    p.setPlaybackQuality("hd1080");
    p.setVolume(Math.round(this.volume * 100));
    if (this.wantPlay) p.playVideo(); else p.pauseVideo();
    this.sync({ ready: true, playing: this.wantPlay, error: null });
  };

  /**
   * L'IFrame API REMPLACE l'élément qu'on lui donne par son iframe. On ne lui
   * confie donc jamais le conteneur géré par React (`elementId`) : on crée un
   * enfant à nous, retiré au `destroy()`. Le lecteur peut ainsi être recréé
   * autant de fois que la source change.
   */
  private mount(): HTMLElement | string {
    const host = typeof document !== "undefined" ? document.getElementById(this.elementId) : null;
    if (!host) return this.elementId; // environnement de test : identifiant brut
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "100%";
    host.appendChild(el);
    this.host = host;
    return el;
  }

  private create() {
    const target = this.mount();
    const vars = { autoplay: 1, mute: 0, controls: 0, rel: 0, modestbranding: 1 };
    const s = this.source;
    if (s.type === "video") {
      // Vidéo unique en boucle : `playlist` = elle-même (et JAMAIS `list`).
      this.player = new window.YT.Player(target, {
        videoId: s.id,
        playerVars: { ...vars, showinfo: 0, loop: 1, playlist: s.id, suggestedQuality: "hd1080" },
        events: { onReady: (e: { target: YTPlayer }) => this.onReady(e.target) },
      });
    } else if (s.type === "native") {
      this.player = new window.YT.Player(target, {
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
      this.player = new window.YT.Player(target, {
        videoId: first,
        playerVars: vars,
        events: {
          onReady: (e: { target: YTPlayer }) => this.onReady(e.target),
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) this.errorStreak = 0; // un titre joue : la série d'erreurs est rompue
            if (e.data === 0) this.onEnded();
          },
          // Vidéo supprimée, privée ou non embarquable (100, 101, 150) : pas de
          // ENDED, la file resterait bloquée ; on passe au titre suivant, sauf si
          // toute la file a échoué d'affilée (sinon boucle infinie en mode boucle).
          onError: () => {
            this.errorStreak++;
            if (this.errorStreak > Math.max(3, this.queue?.order.length ?? 0)) {
              this.set({ error: "Aucun titre de la file n'est lisible ici." });
              return;
            }
            this.onEnded();
          },
        },
      });
    }
  }

  private load(id: string) {
    this.player?.loadVideoById(id);
    if (!this.wantPlay) this.player?.pauseVideo();
    this.sync();
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
    try {
      // Au plus 10 s : une requête qui pend ne doit pas geler la file (les fins
      // de titre et « suivant » sont ignorés pendant une prolongation).
      const res = await Promise.race([
        continuePlaylist(q.order, q.current, this.opts.recommend ?? defaultRecommend, { exclude: q.excluded }),
        new Promise<{ kind: "loop" }>((r) => { this.raceTimer = setTimeout(() => r({ kind: "loop" }), 10_000); }),
      ]);
      if (this.raceTimer) { clearTimeout(this.raceTimer); this.raceTimer = null; }
      this.fetchingMore = false;
      if (this.destroyed) return;
      if (res.kind === "extend") {
        const added = q.append(res.tracks.map((t) => t.id));
        for (const t of res.tracks) this.titles[t.id] = t.title;
        for (const id of added) this.suggested.add(id);
        this.opts.onExtended?.({ added: added.length, titles: Object.fromEntries(res.tracks.map((t) => [t.id, t.title])) });
        const n = q.next(false);
        if (n.kind === "track") { this.set({ extending: false }); this.load(n.id); return; }
      }
      // Rien de neuf (réseau, doublons) : on reboucle plutôt que de s'arrêter.
      const n = q.next(true);
      this.set({ extending: false });
      if (n.kind === "track") this.load(n.id);
    } finally {
      // Jamais de file gelée, même si un rappel lève une exception.
      this.fetchingMore = false;
    }
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
    this.sync({ shuffle: on });
  }
  setLoop(on: boolean) { this.set({ loop: on }); }
  seek(sec: number) { if (this.ready) this.player?.seekTo(Math.max(0, sec), true); }

  /** Titres proches : mix radio de graines réparties sur toute la file. */
  async getSuggestions(seeds?: string[], limit = 10): Promise<Track[]> {
    const s = this.source;
    if (s.type === "native") return [];
    const pool = this.queue ? [...this.queue.order] : [s.type === "video" ? s.id : ""];
    const res = await continuePlaylist(
      seeds?.length ? seeds : pool, seeds?.length ? null : (this.queue?.current ?? pool[0]),
      this.opts.recommend ?? defaultRecommend,
      { exclude: this.queue?.excluded ?? new Set(pool), limit },
    ).catch(() => ({ kind: "loop" as const }));
    if (res.kind !== "extend") return [];
    for (const t of res.tracks) this.titles[t.id] ??= t.title;
    return res.tracks.map((t) => ({ id: t.id, title: t.title, subtitle: t.subtitle, artwork: thumb(t.id), source: "youtube" as const, suggested: true }));
  }

  /**
   * Ajoute un titre suggéré en fin de file. Sans file (vidéo seule), rien à
   * faire ici : la session le met dans la File FocusFlow.
   */
  async enqueue(t: Track) {
    if (!this.queue) return false;
    const added = this.queue.append([t.id], true);
    if (!added.length) return false;
    this.titles[t.id] = t.title;
    this.suggested.add(t.id);
    this.sync();
    return true;
  }

  removeUpcoming(id: string) {
    if (this.queue?.remove(id)) this.sync();
  }
  /** Titres connus (pour l'activité affichée aux amis, l'historique). */
  titleOf(id: string) { return this.titles[id]; }

  destroy() {
    this.destroyed = true;
    if (this.watchdog) clearTimeout(this.watchdog);
    if (this.raceTimer) clearTimeout(this.raceTimer);
    try { this.player?.destroy(); } catch { /* déjà détruit */ }
    if (this.host) this.host.replaceChildren();
    this.player = null;
    this.ready = false;
  }
}
