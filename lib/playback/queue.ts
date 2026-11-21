// File de lecture maison, commune à toutes les sources pilotées pistes par
// pistes (mixes YouTube, playlists résolues, File FocusFlow). Logique PURE :
// aucune dépendance au lecteur, testée unitairement (lib/playback/queue.test.ts).
//
// Pourquoi une file maison : YouTube n'enchaîne pas de façon fiable une liste
// d'IDs arbitraires en embed (après le premier titre, l'autoplay « vidéos
// liées » reprend la main). On garde donc l'ordre nous-mêmes et le lecteur ne
// fait que charger la piste qu'on lui donne.

export type AdvanceResult =
  | { kind: "track"; id: string; index: number }
  /** Fin de la file sans boucle : il faut la prolonger (voir continuation). */
  | { kind: "end" };

export class TrackQueue {
  private ids: string[];
  private original: string[];
  private i = 0;
  private shuffled = false;

  constructor(ids: string[], opts: { shuffle?: boolean; random?: () => number } = {}) {
    this.random = opts.random ?? Math.random;
    this.original = dedupe(ids);
    this.ids = [...this.original];
    if (opts.shuffle) this.setShuffle(true);
  }

  private random: () => number;

  get index() { return this.i; }
  get size() { return this.ids.length; }
  get current(): string | null { return this.ids[this.i] ?? null; }
  get order(): readonly string[] { return this.ids; }
  get isShuffled() { return this.shuffled; }
  /** Tout ce qui est dans la file, quel que soit l'ordre (pour exclure des recos). */
  get all(): ReadonlySet<string> { return new Set(this.original); }
  /** Pistes déjà jouées ou en cours, dans l'ordre de lecture. */
  get played(): string[] { return this.ids.slice(0, this.i + 1); }
  get isLast() { return this.i >= this.ids.length - 1; }

  /** Piste suivante. `loop` : reboucle en tête ; sinon signale la fin. */
  next(loop: boolean): AdvanceResult {
    if (this.ids.length === 0) return { kind: "end" };
    if (this.isLast) {
      if (!loop) return { kind: "end" };
      this.i = 0;
    } else {
      this.i += 1;
    }
    return { kind: "track", id: this.ids[this.i], index: this.i };
  }

  /** Piste précédente (bloque sur la première, ne reboucle pas à l'envers). */
  previous(): AdvanceResult {
    if (this.ids.length === 0) return { kind: "end" };
    this.i = Math.max(0, this.i - 1);
    return { kind: "track", id: this.ids[this.i], index: this.i };
  }

  /**
   * Mélange ON : piste courante en tête, le reste mélangé (Fisher-Yates).
   * OFF : ordre d'origine, index replacé sur la piste courante.
   */
  setShuffle(on: boolean) {
    const cur = this.current;
    if (on) {
      const rest = this.ids.filter((id) => id !== cur);
      for (let k = rest.length - 1; k > 0; k--) {
        const j = Math.floor(this.random() * (k + 1));
        [rest[k], rest[j]] = [rest[j], rest[k]];
      }
      this.ids = cur ? [cur, ...rest] : rest;
      this.i = 0;
    } else {
      this.ids = [...this.original];
      this.i = cur ? Math.max(0, this.ids.indexOf(cur)) : 0;
    }
    this.shuffled = on;
  }

  /**
   * Retire un titre À VENIR (jamais la piste en cours ni une piste déjà jouée).
   * Retourne vrai si le titre a été retiré.
   */
  remove(id: string): boolean {
    const at = this.ids.indexOf(id);
    if (at <= this.i) return false;
    this.ids.splice(at, 1);
    const o = this.original.indexOf(id);
    if (o >= 0) this.original.splice(o, 1);
    return true;
  }

  /** Les `n` prochains titres après la piste en cours. */
  upcoming(n = 10): string[] {
    return this.ids.slice(this.i + 1, this.i + 1 + n);
  }

  /**
   * Ajoute des pistes à la fin (prolongation). Ignore les doublons de la file.
   * Retourne les pistes réellement ajoutées.
   */
  append(ids: string[]): string[] {
    const have = new Set(this.original);
    const fresh = dedupe(ids).filter((id) => !have.has(id));
    this.original.push(...fresh);
    this.ids.push(...fresh);
    return fresh;
  }
}

function dedupe(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) if (id && !seen.has(id)) { seen.add(id); out.push(id); }
  return out;
}
