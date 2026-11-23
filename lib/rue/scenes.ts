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
    "id": "ubud-maisons",
    "label": "Rizières d'Ubud",
    "credit": "Photo : Jakub Hałun, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3APaddy_fields_and_houses_in_Ubud%2C_Bali%2C_Indonesia%2C_20220822_1453_0152.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "gion-nuit",
    "label": "Gion la nuit",
    "credit": "Photo : lumoplank, CC0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AStreets_of_Gion%2C_Kyoto_-_Gion7709.jpg",
    "style": 0.12,
    "frameY": 0.3
  },
  {
    "id": "sannenzaka",
    "label": "Sannenzaka au petit matin, Kyoto",
    "credit": "Photo : Basile Morin, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3APedestrian_road_with_pavements_and_paper_umbrellas%2C_Higashiyama-ku%2C_Kyoto%2C_Japan%2C_early_morning.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "shirakawa",
    "label": "Canal de Shirakawa, Kyoto",
    "credit": "Photo : HAGAT hOMSZE, CC0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AJP_%E6%97%A5%E6%9C%AC_Japan_%E4%BA%AC%E9%83%BD_Kyoto_tourism_%E6%9D%B1%E5%B1%B1%E5%8D%80_Higashiyama-ku_river_1334pm_June_2026_N13P_100.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "dotonbori",
    "label": "Dotonbori la nuit, Osaka",
    "credit": "Photo : Sakai Yayoi, CC0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AOsaka_Dotonbori_yoru.jpg",
    "style": 0.12,
    "frameY": 0.3
  },
  {
    "id": "takayama",
    "label": "Vieille ville de Takayama",
    "credit": "Photo : Raita Futo, CC BY 2.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AHida_Takayama_old_town_streets_%2848519369602%29.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "manhattan",
    "label": "Manhattan depuis Jersey City",
    "credit": "Photo : King of Hearts, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ALower_Manhattan_from_Jersey_City_September_2020_panorama.jpg",
    "style": 0.12,
    "frameY": 0.3
  },
  {
    "id": "seattle",
    "label": "Seattle et l'I-5 au crépuscule",
    "credit": "Photo : Dllu, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ASeattle_I-5_skyline_dllu.jpg",
    "style": 0.12,
    "frameY": 0.3
  },
  {
    "id": "bryggen",
    "label": "Bryggen la nuit, Bergen",
    "credit": "Photo : Svein Magne Tunli, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ABergen_Bryggen_night_tunliweb.jpg",
    "style": 0.12,
    "frameY": 0.3
  },
  {
    "id": "reine",
    "label": "Reine au soir, Lofoten",
    "credit": "Photo : Ximonic (Simo Räsänen), CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AHouses_of_Reine_by_Gravdalsbukta%2C_Moskenes%2C_Nordland%2C_Norway%2C_2022_June.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "sakrisoy",
    "label": "Sakrisøy sous la neige, Lofoten",
    "credit": "Photo : Svein Magne Tunli, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ASakrisoy_Reine_Lofoten_tunliweb.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "bandung",
    "label": "Vallée de Bandung",
    "credit": "Photo : Afrogindahood, CC BY 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ABandung_Basin_Pacet_Cianjur_2022.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "times-square",
    "label": "Times Square la nuit",
    "credit": "Photo : Florian Pépellin, CC BY-SA 2.5 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ATimes_square_nuit.jpg",
    "style": 0.12,
    "frameY": 0.3
  },
  {
    "id": "geiranger",
    "label": "Fjord de Geiranger",
    "credit": "Photo : Ximonic (Simo Räsänen), CC BY-SA 3.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AGeirangerfjord_from_%C3%98rnesvingen%2C_2013_June.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "sapa",
    "label": "Rizières de Sapa",
    "credit": "Photo : David McKelvey, CC BY 2.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ASapa_view_3.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "sapa-vallee",
    "label": "Vallée de Sapa",
    "credit": "Photo : Phi Phi Hoang, CC BY 2.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ARay_over_terrace_rice_field_in_Sapa_-_Trung_Ch%E1%BA%A3i..jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "tegallalang",
    "label": "Rizières en terrasses, Bali",
    "credit": "Photo : Vyacheslav Argenberg, CC BY 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ARice_terraces%2C_Ubud%2C_Bali.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "batad",
    "label": "Terrasses de Batad, Philippines",
    "credit": "Photo : CEphoto, Uwe Aranas, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ABanaue_Philippines_Batad-Rice-Terraces-02.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "banaue",
    "label": "Montagnes de Banaue, Philippines",
    "credit": "Photo : Maezeltugas24, CC BY-SA 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3ABanaue_Rice_Terraces_2019.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "hoian",
    "label": "Hoi An sous la pluie",
    "credit": "Photo : lumoplank, CC0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AHoi_An_-_HoiAn1457.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "hoian-nuit",
    "label": "Hoi An la nuit",
    "credit": "Photo : Alexkom000, CC BY 4.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3A2024-12-20_Hoi_An_Old_Town_at_night_4.jpg",
    "style": 0.12,
    "frameY": 0.3
  },
  {
    "id": "kanazawa",
    "label": "Higashi Chaya, Kanazawa",
    "credit": "Photo : Andrea Schaffer, CC BY 2.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AHigashi_Chaya_district%2C_Kanazawa_%283810720612%29.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
  {
    "id": "ninenzaka",
    "label": "Ninenzaka et la pagode Yasaka, Kyoto",
    "credit": "Photo : Domenico Convertini, CC BY-SA 2.0 (modifiée : profondeur, plans, effets)",
    "href": "https://commons.wikimedia.org/wiki/File%3AGion_-_Nineizaka_%28Ninenzaka%29%2C_Kyoto%2C_Japan_%2848923271673%29.jpg",
    "style": 0.0,
    "frameY": 0.3,
    "day": true
  },
];

export const rueBase = (id: string) => `/rue/${id}`;
export const rueStill = (id: string) => `/rue/${id}/still.webp`;
