// Interface de lecture unique (phase 8). L'interface de session ne connaît que
// ceci : un adaptateur par source (YouTube, Spotify, Twitch) qui expose le même
// état et les mêmes commandes. Ce qu'une source ne sait pas faire est déclaré
// dans `caps` (l'interface masque le contrôle) au lieu d'être deviné.
import { useSyncExternalStore } from "react";

export type SourceKind = "youtube" | "spotify" | "twitch";

export interface NowPlaying {
  id: string;
  title: string;
  subtitle?: string;
  artwork?: string;
  /** Position dans la file (0-based) et taille de la file, si connues. */
  index?: number;
  total?: number;
}

export interface Capabilities {
  skip: boolean;
  shuffle: boolean;
  loop: boolean;
  volume: boolean;
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

const IDLE: PlaybackState = {
  kind: "youtube", ready: false, playing: false, track: null,
  caps: { skip: false, shuffle: false, loop: false, volume: false },
  shuffle: false, loop: true, extending: false, error: null,
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
