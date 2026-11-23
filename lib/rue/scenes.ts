// Les rues de nuit préparées par scripts/rue/ (public/rue/<id>/).
// Source unique : landing, fond de l'app, session et /lab/rue s'en servent.
// Les crédits des photos sous licence CC BY sont affichés là où elles le sont.

export interface RueSceneInfo {
  id: string;
  label: string;
  /** Crédit à afficher (licence de la photo). */
  credit: string;
  /** Page de la photo d'origine ; vide pour les photos personnelles. */
  href: string;
  /** Dosage de l'étalonnage néon (0..1). */
  style: number;
  /** Décentrement vertical du cadre (1 = garder le bas, le sol). */
  frameY: number;
  /** Photo de jour : pas de pluie (et pas d'enseignes, voir scene.json "day"). */
  day?: boolean;
}

export const RUE_SCENES: RueSceneInfo[] = [
  {
    "id": "pont",
    "label": "Pont sous la pluie",
    "credit": "Photo : Moyan Brenn, CC BY 2.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File:Tokyo_(16042877318).jpg",
    "style": 0.35,
    "frameY": 1
  },
  {
    "id": "carrefour",
    "label": "Carrefour sous la pluie",
    "credit": "Photo : Moyan Brenn, CC BY 2.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File:Tokyo_(16204487106).jpg",
    "style": 0.4,
    "frameY": 0.3
  },
  {
    "id": "kabukicho",
    "label": "Rue commerçante",
    "credit": "Photo : Daniel Ramirez, CC BY 2.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File:Walking_around_Kabukicho,_Shinjuku_at_night._(29362321701).jpg",
    "style": 1,
    "frameY": 0.4
  },
  {
    "id": "viaduc",
    "label": "Rue mouillée sous le viaduc",
    "credit": "Photo : Toomore Chiang, CC BY 3.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File:%E7%A7%8B%E8%91%89%E5%8E%9F_Akihabara_Japan_Agfa_Vistaplus_Nikon_Fm2_(181746787).jpeg",
    "style": 0.8,
    "frameY": 0.6
  },
  {
    "id": "avenue",
    "label": "Avenue des enseignes",
    "credit": "Photo : Wilfredor, CC0 (domaine public)",
    "href": "https://commons.wikimedia.org/wiki/File:Hong_Kong_night_street.jpg",
    "style": 0.5,
    "frameY": 0.7
  },
  {
    "id": "ecrans",
    "label": "Rue des écrans",
    "credit": "Photo : César García Pont, CC BY 3.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File:Shibuya_At_Night_(153069373).jpeg",
    "style": 0.8,
    "frameY": 0.5
  },
  {
    "id": "ruelle",
    "label": "Ruelle des enseignes",
    "credit": "Photo : lumoplank, CC0 (domaine public)",
    "href": "https://commons.wikimedia.org/wiki/File:Osaka_Neon_-_OsakaNeon6674.jpg",
    "style": 0.9,
    "frameY": 0.5
  },
  {
    "id": "fleuve",
    "label": "Skyline au bord du fleuve",
    "style": 0.35,
    "frameY": 0.6,
    "credit": "Photo personnelle",
    "href": ""
  },
  {
    "id": "pavillon",
    "label": "Pavillon sur l'eau",
    "style": 0.15,
    "frameY": 0.3,
    "credit": "Photo personnelle",
    "href": ""
  },
  {
    "id": "tours",
    "label": "Tours et esplanade",
    "style": 0.4,
    "frameY": 0.6,
    "credit": "Photo personnelle",
    "href": ""
  },
  {
    "id": "boulevard",
    "label": "Boulevard la nuit",
    "style": 0.45,
    "frameY": 0.7,
    "credit": "Photo personnelle",
    "href": ""
  },
  {
    "id": "hanoi-rail",
    "label": "Rue du train, Hanoï",
    "credit": "Photo : lumoplank, CC0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AHanoi1617.jpg",
    "style": 0.5,
    "frameY": 0.3
  },
  {
    "id": "hanoi-arbres",
    "label": "Vieux quartier de Hanoï",
    "credit": "Photo : Alexkom000, CC BY 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3A2024-11-03_Hanoi%27s_Old_Quarter_5.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "ubud-maisons",
    "label": "Rizières d'Ubud",
    "credit": "Photo : Jakub Hałun, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3APaddy_fields_and_houses_in_Ubud%2C_Bali%2C_Indonesia%2C_20220822_1453_0152.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "ubud",
    "label": "Champs d'Ubud",
    "credit": "Photo : Jakub Hałun, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AFields_in_Ubud%2C_Bali%2C_Indonesia%2C_20220822_1401_0133.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "gion-ruelle",
    "label": "Ruelle de Gion",
    "credit": "Photo : Basile Morin, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AWooden_and_bamboo_facades_of_dwellings_with_sudare_in_a_cobbled_street_of_Gion%2C_perspective_effect_with_vanishing_point%2C_Kyoto%2C_Japan.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "gion-pavee",
    "label": "Rue pavée de Gion",
    "credit": "Photo : Josep M. Gracia, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AGIO_-_Traditional_wooden_houses_along_a_stone-paved_street_in_Gion%2C_Kyoto%2C_Japan%2C_2015.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "gion-nuit",
    "label": "Gion la nuit",
    "credit": "Photo : lumoplank, CC0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AStreets_of_Gion%2C_Kyoto_-_Gion7709.jpg",
    "style": 0.5,
    "frameY": 0.3
  },
];

export const rueBase = (id: string) => `/rue/${id}`;
export const rueStill = (id: string) => `/rue/${id}/still.webp`;
