# Assets de la refonte : sources et licences

Règle depuis le lab 3 (consigne utilisateur) : le réalisme vient des assets,
de la matière, de la lumière et du post-traitement, pas de sommets tapés à la
main. Chaque ressource externe est listée ici avec sa licence vérifiée sur sa
page d'origine. Un crédit visible est donné pour toute licence CC BY.

## Production

| Asset | Où | Source | Licence | Crédit exigé | Usage |
|---|---|---|---|---|---|
| « TOKYO NIGHT » (capture photogrammétrique) | original `public/tokyo_night.glb` (fourni par l'utilisateur, 37,9 Mo, non chargé par l'app) ; versions allégées `public/city/tokyo/tokyo-desk.glb` (249 k triangles, 2,2 Mo) et `tokyo-mob.glb` (79 k, 1,1 Mo) ; images fixes `still*.jpg` rendues par la scène | Sketchfab, Nikitos & 3130 (vrcityphoto) | CC BY 4.0 | oui : auteurs + licence + lien, affiché sur chaque scène (`CITY_CREDIT`) et dans le pied de la landing | « la fenêtre » : landing, halte, mode Spotify, résumé |
| Big Shoulders | `next/font/google` | Google Fonts (City of Chicago, Patric King) | SIL OFL 1.1 | non | titres, enseignes |
| Doto | `next/font/google` (aussi dessinée sur l écran de toit via canvas) | Google Fonts (Óliver Lalan) | SIL OFL 1.1 | non | minuteur, panneau LED |
| Atkinson Hyperlegible Next | `next/font/google` | Google Fonts (Braille Institute) | SIL OFL 1.1 | non | texte courant |

Versions allégées produites par nous (même licence, mêmes crédits) :
`gltf-transform optimize` (simplification meshopt, quantification, WebP 1024).

## Lab uniquement (route `/lab`, exclue de la production)

| Asset | Où | Source | Licence | Usage |
|---|---|---|---|---|
| Ruelle de nuit (photo) + dérivés (profondeur Depth Anything V2 Small, Apache 2.0, calculée hors ligne ; masques) | `public/lab/city/alley/` | Wikimedia Commons, « 2024-10-20 Shinjuku Golden Gai at night.jpg », Alexkom000 | CC BY 4.0 | lab 3, piste A (2.5D photographique), remplacée par la capture TOKYO NIGHT |
| Supérette sous la pluie (photo) | `public/lab/city/konbini/` | Wikimedia Commons, « DFC 6246 Late-night rain… », PattayaPatrol | CC BY-SA 4.0 | piste A, scène de halte. Écartée de la production : logo d'enseigne réelle très lisible, et partage à l'identique sur les dérivés |
| Kit « hidden alley » : façade modulaire, rideaux métalliques, climatiseurs, escalier de secours, gouttières, boîtiers, applique, gaine, plaque d'égout, poubelles | `public/lab/city/assets/*.glb` | Poly Haven | CC0 | piste C (3D temps réel) |
| Asphalte « asphalt_02 » (albedo, normal, rugosité, AO) | `public/lab/city/assets/asphalt_*.webp` | Poly Haven | CC0 | piste C |
| HDRI « modern_buildings_night » | `public/lab/city/assets/modern_buildings_night_1k.hdr` | Poly Haven | CC0 | piste C (réflexions d'ambiance) |
| Photos de référence (comparaison) | non distribuées (dossier de travail) | Wikimedia Commons : « Cruce de Shinjuku de noche bajo la lluvia » (ProtoplasmaKid, CC BY 4.0), « Night markets of Taipei TaipeiNM4950 » (lumoplank, CC0), « DFC 3503 A wet city street at night… » (PattayaPatrol, CC BY-SA 4.0) | voir colonne source | planches `docs/redesign/shots/lab3/compare-*.jpg` |
| Polices du lab 2 (TTF) | `public/lab/fonts/` | Google Fonts | SIL OFL 1.1 | prototypes du lab 2 |
| manifold-3d (WASM) | `public/lab/manifold.wasm` | npm `manifold-3d` | Apache 2.0 (`manifold-LICENSE.txt`) | lab 2·2 |

## Nettoyage effectué (2026-11-21)

- Retirés : `public/seoul/` (photos de l'ancienne landing), la photo Pexels
  historique, les SVG par défaut de Next.js ; composants morts `VideoPlayer`,
  `PomodoroTimer`, `VideoCatalog` (relevés à l'audit, aucun import).
- Gardé : `public/tokyo_night.glb`, la source fournie par l'utilisateur ;
  l'application ne charge que ses versions allégées.
