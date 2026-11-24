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
import type { Radio } from "@/lib/radio";
import { catalogueRadio, clockLabel, newCursor, radioTarget, radioUpcoming, sessionDeadIds, RADIO_NAME, type RadioCursor, type RadioTarget } from "@/lib/radioProgram";
import { NO_CAPS, Observable, type ExtendedEvent, type PlaybackState, type PlayerAdapter, type Track } from "./types";

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
  setPlaybackQuality: (q: string) => void;
  setVolume: (v: number) => void;
  nextVideo: () => void;
  previousVideo: () => void;
  loadVideoById: (id: string | { videoId: string; startSeconds?: number }) => void;
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
  | { type: "native"; listId: string; title: string }
  /** Radio FocusFlow : programme commun calculé depuis l'heure (lib/radioProgram). */
  | { type: "radio" };

export interface YouTubeOptions {
  volume: number;
  shuffle: boolean;
  loop: boolean;
  /** Lecture voulue au démarrage (minuteur en marche, hors pause). */
  playing: boolean;
  onExtended?: (e: ExtendedEvent) => void;
  /** Recommandations pour une graine (injectable pour les tests). */
  recommend?: (seed: string) => Promise<ContinuationTrack[]>;
  /** Radio : programme et horloge (injectables pour les tests). */
  radio?: Radio;
  now?: () => number;
  radioCursor?: RadioCursor;
}

/** Erreurs IFrame « vidéo indisponible » : supprimée, privée, non embarquable. */
const UNAVAILABLE_ERRORS = new Set([100, 101, 150]);
/** ENDED à moins de 3 s de la fin du créneau : fin normale, pas prématurée. */
const END_TOLERANCE_MS = 3000;

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
  // ── Radio ──
  private radio: Radio | null = null;
  private cursor: RadioCursor | null = null;
  private now: () => number;
  private onAir: RadioTarget | null = null;
  private loadedId: string | null = null;
  private switchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private elementId: string, private source: YouTubeSource, private opts: YouTubeOptions) {
    const queued = source.type === "queue";
    const radio = source.type === "radio";
    super({
      kind: "youtube", ready: false, playing: false, track: null,
      caps: {
        ...NO_CAPS, volume: true,
        // Radio : comme un live, ni suivant, ni précédent, ni avance dans la piste.
        seek: !radio,
        skip: queued || source.type === "native", shuffle: queued, loop: queued,
        suggestions: source.type !== "native" && !radio, removeUpcoming: queued,
      },
      shuffle: queued && opts.shuffle, loop: opts.loop, extending: false, upcoming: [], error: null,
    });
    this.wantPlay = opts.playing;
    this.volume = opts.volume;
    this.now = opts.now ?? (() => Date.now());
    if (radio) {
      this.radio = opts.radio ?? catalogueRadio();
      this.cursor = opts.radioCursor ?? newCursor(sessionDeadIds);
      this.onAir = radioTarget(this.radio, this.now(), this.cursor);
    }
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
    if (s.type === "radio") {
      const t = this.onAir?.slot.track;
      return t ? { id: t.youtubeId, title: t.title, subtitle: RADIO_NAME, artwork: thumb(t.youtubeId), durationSec: this.onAir!.slot.segmentSec, source: "youtube" as const } : null;
    }
    const q = this.queue!;
    const id = q.current;
    if (!id) return null;
    return { ...this.toTrack(id, s.subtitle), index: q.index, total: q.size };
  }

  private upcomingInfo(): Track[] {
    if (this.radio && this.onAir) {
      // « À venir » d'une radio = le programme, avec l'heure de passage.
      return radioUpcoming(this.radio, this.onAir.slot.index, 10, this.cursor?.dead).map((s) => ({
        id: s.track.youtubeId, title: s.track.title, subtitle: `${clockLabel(s.startsAt)} · ${s.track.channel}`,
        artwork: thumb(s.track.youtubeId), durationSec: s.segmentSec, source: "youtube" as const,
      }));
    }
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
    } else if (s.type === "radio") {
      // Pas de videoId au constructeur : la piste et sa seconde se calculent
      // au moment où le lecteur est prêt (le chargement de l'API prend du temps).
      this.player = new window.YT.Player(target, {
        playerVars: vars,
        events: {
          onReady: (e: { target: YTPlayer }) => {
            this.ready = true;
            e.target.setPlaybackQuality("hd1080");
            e.target.setVolume(Math.round(this.volume * 100));
            this.set({ ready: true, playing: this.wantPlay, error: null });
            this.resync();
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) this.errorStreak = 0;
            if (e.data === 0) this.onRadioEnded();
          },
          onError: (e: { data: number }) => this.onRadioError(e?.data),
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

  // ── Radio ────────────────────────────────────────────────────────────────

  /**
   * Se recale sur le programme : recalcule la piste à l'heure `at` (par défaut
   * maintenant) et la charge à la bonne seconde. Appelé au démarrage, à la fin
   * de chaque créneau, après une fin prématurée ou une erreur, et à chaque
   * reprise de la lecture (une radio, on la rejoint en direct).
   */
  private resync(at?: number) {
    if (!this.radio || !this.cursor || this.destroyed) return;
    if (this.switchTimer) { clearTimeout(this.switchTimer); this.switchTimer = null; }
    const now = this.now();
    const t = radioTarget(this.radio, Math.max(now, at ?? now), this.cursor);
    this.onAir = t;
    if (!t) { this.sync({ error: "Aucune vidéo de la radio n'est lisible ici." }); return; }
    const id = t.slot.track.youtubeId;
    // En pause, on ne touche pas au lecteur (sauf premier chargement, pour
    // avoir l'image) : la reprise se recalera de toute façon.
    if (this.ready && this.player && (this.wantPlay || this.loadedId === null)) {
      if (this.loadedId === id) {
        this.player.seekTo(t.offsetSec, true);
        this.player.playVideo();
      } else {
        this.player.loadVideoById({ videoId: id, startSeconds: t.offsetSec });
        this.loadedId = id;
      }
      if (!this.wantPlay) this.player.pauseVideo();
    }
    // Fin du créneau : on recalcule (resynchro), pas un simple « suivant ».
    this.switchTimer = setTimeout(() => this.resync(t.switchAt), Math.max(0, t.switchAt - now) + 20);
    this.sync({ error: null });
  }

  private onRadioEnded() {
    const cur = this.onAir;
    if (!cur) return;
    const now = this.now();
    this.loadedId = null;
    // Fin normale (à la tolérance près) : piste suivante du programme, calculée
    // à l'heure de fin du créneau.
    if (now >= cur.switchAt - END_TOLERANCE_MS) { this.resync(cur.switchAt); return; }
    // Vidéo plus courte que prévu : on ne la rejoue pas dans ce créneau.
    this.cursor!.skipped.add(cur.slot.index);
    this.resync();
  }

  private onRadioError(code: number | undefined) {
    const cur = this.onAir;
    if (!cur || !this.radio) return;
    if (code !== undefined && UNAVAILABLE_ERRORS.has(code)) this.cursor!.dead.add(cur.slot.track.youtubeId);
    else this.cursor!.skipped.add(cur.slot.index);
    this.errorStreak++;
    if (this.errorStreak > this.radio.size) { this.set({ error: "Aucune vidéo de la radio n'est lisible ici." }); return; }
    this.loadedId = null;
    this.resync();
  }

  play() {
    this.wantPlay = true;
    if (this.radio) {
      this.set({ playing: true });
      if (this.ready) this.resync();
      return;
    }
    if (this.ready) this.player?.playVideo();
    this.set({ playing: true });
  }
  pause() {
    this.wantPlay = false;
    if (this.ready) this.player?.pauseVideo();
    this.set({ playing: false });
  }
  next() {
    if (this.radio) return;
    if (this.source.type === "native") { this.player?.nextVideo(); return; }
    const q = this.queue;
    if (!q || this.fetchingMore) return;
    // Un skip manuel au bout de la file se comporte comme une fin de titre.
    const r = q.next(this.state.loop);
    if (r.kind === "track") this.load(r.id); else void this.extend();
  }
  previous() {
    if (this.radio) return;
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
  seek(sec: number) { if (this.ready && !this.radio) this.player?.seekTo(Math.max(0, sec), true); }

  /** Titres proches : mix radio de graines réparties sur toute la file. */
  async getSuggestions(seeds?: string[], limit = 10): Promise<Track[]> {
    const s = this.source;
    if (s.type === "native" || s.type === "radio") return [];
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
    if (this.switchTimer) clearTimeout(this.switchTimer);
    try { this.player?.destroy(); } catch { /* déjà détruit */ }
    if (this.host) this.host.replaceChildren();
    this.player = null;
    this.ready = false;
  }
}
