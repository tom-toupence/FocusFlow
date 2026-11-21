// Interface commune des scènes de ville (consommée par components/CityScene).
export type CityPhase = "work" | "break" | "idle";

export interface CityOptions {
  reducedMotion?: boolean;
  /** 0 = nuit, 1 = petit matin (thème clair). */
  dawn?: number;
  phase?: CityPhase;
  board?: string;
  friends?: number;
  /** Lacet de la caméra en radians (positif = tourne à gauche). */
  yaw?: number;
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

/** Crédit de la capture (CC BY 4.0) : à afficher partout où la ville apparaît. */
export const CITY_CREDIT = {
  text: "Ville : « Tokyo Night », Nikitos & 3130, CC BY 4.0",
  href: "https://sketchfab.com/3d-models/tokyo-night-9a50456b41ec4b17b870883d75c6b184",
};
