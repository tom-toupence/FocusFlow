// Interface commune des scènes de ville (consommée par components/CityScene).
export type CityPhase = "work" | "break" | "idle";

export interface CityOptions {
  reducedMotion?: boolean;
  /** 0 = nuit, 1 = petit matin (thème clair). */
  dawn?: number;
  phase?: CityPhase;
  board?: string;
  friends?: number;
}

export interface CityRenderer {
  setPhase: (p: CityPhase) => void;
  setBoard: (text: string) => void;
  setFriends: (n: number) => void;
  setDawn: (v: number) => void;
  /** Distraction : une enseigne grésille. */
  flicker: () => void;
  /** Playlist prolongée : une enseigne s'allume. */
  extend: () => void;
  /** Objectif atteint : des phares passent au bout de la ruelle. */
  goal: () => void;
  dispose: () => void;
}

/** Crédit de la photo (CC BY 4.0) : à afficher partout où la ruelle apparaît. */
export const CITY_CREDIT = {
  text: "Photo : Alexkom000, CC BY 4.0",
  href: "https://commons.wikimedia.org/wiki/File:2024-10-20_Shinjuku_Golden_Gai_at_night.jpg",
};
