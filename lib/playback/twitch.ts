// Adaptateur Twitch (live ou rediffusion), branché sur le lecteur de l'embed.
import { NO_CAPS, Observable, type PlaybackState, type PlayerAdapter } from "./types";

export interface TwitchEmbedPlayer {
  setQuality: (quality: string) => void;
  setVolume: (volume: number) => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
}

/** Adaptateur Twitch (live ou rediffusion) : lecture, pause, volume. Pas de
 *  piste suivante, d'aléatoire ni de boucle : déclaré dans `caps`. */
export class TwitchAdapter extends Observable<PlaybackState> implements PlayerAdapter {
  readonly kind = "twitch" as const;
  constructor(private getPlayer: () => TwitchEmbedPlayer | null, label: { id: string; title: string; subtitle: string; vod: boolean }) {
    super({
      kind: "twitch", ready: false, playing: false, track: { id: label.id, title: label.title, subtitle: label.subtitle, source: "twitch" },
      // Seek uniquement pour une VOD (un live n'a pas de position).
      caps: { ...NO_CAPS, volume: true, seek: label.vod },
      shuffle: false, loop: false, extending: false, upcoming: [], error: null,
    });
  }
  /** Dernière intention (lecture ou pause), réappliquée quand le flux est prêt :
   *  une pause demandée avant VIDEO_READY n'est pas perdue (l'embed démarre en autoplay). */
  private wantPlay = true;
  markReady() {
    this.set({ ready: true });
    this.call((p) => (this.wantPlay ? p.play() : p.pause()));
  }
  private call(f: (p: TwitchEmbedPlayer) => void) { try { const p = this.getPlayer(); if (p) f(p); } catch { /* lecteur pas prêt */ } }
  play() { this.wantPlay = true; this.call((p) => p.play()); this.set({ playing: true }); }
  pause() { this.wantPlay = false; this.call((p) => p.pause()); this.set({ playing: false }); }
  next() {}
  previous() {}
  setVolume(v: number) { this.call((p) => p.setVolume(v)); }
  setShuffle() {}
  setLoop() {}
  seek(sec: number) { if (this.state.caps.seek) this.call((p) => p.seek(Math.max(0, sec))); }
  async getSuggestions() { return []; }
  async enqueue() { return false; }
  removeUpcoming() {}
  destroy() {}
}

