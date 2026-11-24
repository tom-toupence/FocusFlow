// Interface de lecture unique (phase 8). L'interface de session ne connaît que
// ceci : un adaptateur par source (YouTube, Spotify, Twitch) qui expose le même
// état et les mêmes commandes. Ce qu'une source ne sait pas faire est déclaré
// dans `caps` (l'interface masque le contrôle) au lieu d'être deviné.
import { useSyncExternalStore } from "react";

export type SourceKind = "youtube" | "spotify" | "twitch";

/** Modèle de piste normalisé, quelle que soit la source. */
export interface Track {
  id: string;
  title: string;
  /** Artistes (Spotify) ou chaîne (YouTube, Twitch). */
  subtitle?: string;
  artwork?: string;
  durationSec?: number;
  source: SourceKind;
  /** Ajoutée par la lecture continue (pas dans la playlist d'origine). */
  suggested?: boolean;
}

export interface NowPlaying extends Omit<Track, "source"> {
  source?: SourceKind;
  /** Position dans la file (0-based) et taille de la file, si connues. */
  index?: number;
  total?: number;
}

export interface Capabilities {
  skip: boolean;
  shuffle: boolean;
  loop: boolean;
  volume: boolean;
  /** Avancer dans la piste (VOD Twitch, YouTube, Spotify). */
  seek: boolean;
  /** Titres proches à la demande (pas pour un live). */
  suggestions: boolean;
  /** Retirer un titre à venir (impossible avec la file Spotify). */
  removeUpcoming: boolean;
}

export interface PlaybackState {
  kind: SourceKind;
  ready: boolean;
  playing: boolean;
  track: NowPlaying | null;
  caps: Capabilities;
  shuffle: boolean;
  loop: boolean;
  /** Une prolongation de playlist est en cours de calcul. */
  extending: boolean;
  /** Les prochains titres (une dizaine au plus), suggestions marquées. */
  upcoming: Track[];
  /** Message d'erreur lisible (compte, réseau…), sinon null. */
  error: string | null;
}

export interface PlayerAdapter {
  readonly kind: SourceKind;
  getState(): PlaybackState;
  subscribe(cb: () => void): () => void;
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
  setVolume(v: number): void;
  setShuffle(on: boolean): void;
  setLoop(on: boolean): void;
  seek(seconds: number): void;
  /** Titres proches de `seeds` (ou de toute la file si absent). */
  getSuggestions(seeds?: string[], limit?: number): Promise<Track[]>;
  /** Met un titre (une suggestion) dans la file, juste après les titres à venir. */
  enqueue(track: Track): Promise<boolean>;
  /** Retire un titre à venir (sans effet si `caps.removeUpcoming` est faux). */
  removeUpcoming(id: string): void;
  /** Position dans la piste (s), si la source la connaît (YouTube). null si pas prêt. */
  getCurrentTime?(): number | null;
  getDuration?(): number | null;
  /** État brut du lecteur (YouTube : 0 fin, 1 lecture, 2 pause, 3 chargement). */
  getPlayerState?(): number | null;
  destroy(): void;
}

/** Événement « la playlist a été prolongée » (toast, ville). */
export interface ExtendedEvent { added: number; titles: Record<string, string> }

/** Petite base commune : état observable + abonnement. */
export class Observable<S> {
  private listeners = new Set<() => void>();
  constructor(protected state: S) {}
  getState = (): S => this.state;
  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  protected set(patch: Partial<S>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
}

export const NO_CAPS: Capabilities = { skip: false, shuffle: false, loop: false, volume: false, seek: false, suggestions: false, removeUpcoming: false };

const IDLE: PlaybackState = {
  kind: "youtube", ready: false, playing: false, track: null, caps: NO_CAPS,
  shuffle: false, loop: true, extending: false, upcoming: [], error: null,
};
const noop = () => () => {};

/** État réactif d'un adaptateur (ou d'aucun) pour l'interface. */
export function usePlayback(adapter: PlayerAdapter | null): PlaybackState {
  return useSyncExternalStore(
    adapter ? adapter.subscribe : noop,
    adapter ? adapter.getState : () => IDLE,
    () => IDLE,
  );
}
