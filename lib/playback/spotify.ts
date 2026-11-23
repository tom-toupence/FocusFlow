// Adaptateur Spotify (Web Playback SDK). Le SDK et l'API vivent dans le
// composant SpotifyPlayer ; l'adaptateur ne fait que traduire l'interface de
// lecture unique vers un « pont » de fonctions, ce qui le rend testable.
import { Observable, type PlaybackState, type PlayerAdapter, type Track } from "./types";

export interface SpotifyBridge {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  volume: (v: number) => void;
  shuffle: (on: boolean) => void;
  repeat: (on: boolean) => void;
  seek: (sec: number) => void;
  suggest: (seeds: string[] | undefined, limit: number) => Promise<Track[]>;
  enqueue: (t: Track) => Promise<boolean>;
}

export class SpotifyAdapter extends Observable<PlaybackState> implements PlayerAdapter {
  readonly kind = "spotify" as const;
  constructor(private b: SpotifyBridge, init: { shuffle: boolean; loop: boolean }) {
    super({
      kind: "spotify", ready: false, playing: false, track: null,
      // La file Spotify ne permet pas de retirer un titre (aucun endpoint) :
      // on peut seulement le passer.
      caps: { skip: true, shuffle: true, loop: true, volume: true, seek: true, suggestions: true, removeUpcoming: false },
      shuffle: init.shuffle, loop: init.loop, extending: false, upcoming: [], error: null,
    });
  }
  /** Mises à jour venant du SDK (piste, statut, erreurs). */
  patch(p: Partial<PlaybackState>) { this.set(p); }
  play() { this.b.play(); this.set({ playing: true }); }
  pause() { this.b.pause(); this.set({ playing: false }); }
  next() { this.b.next(); }
  previous() { this.b.previous(); }
  setVolume(v: number) { this.b.volume(v); }
  setShuffle(on: boolean) { if (on === this.state.shuffle) return; this.set({ shuffle: on }); this.b.shuffle(on); }
  setLoop(on: boolean) { if (on === this.state.loop) return; this.set({ loop: on }); this.b.repeat(on); }
  seek(sec: number) { this.b.seek(sec); }
  getSuggestions(seeds?: string[], limit = 10) { return this.b.suggest(seeds, limit); }
  enqueue(t: Track) { return this.b.enqueue(t); }
  removeUpcoming() {}
  destroy() {}
}

