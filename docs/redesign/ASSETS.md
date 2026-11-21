# Assets de la refonte : sources et licences

Règle depuis le lab 3 (consigne utilisateur) : le réalisme vient des assets,
de la matière, de la lumière et du post-traitement, pas de sommets tapés à la
main. Chaque ressource externe est listée ici avec sa licence vérifiée sur sa
page d'origine. Un crédit visible est donné pour toute licence CC BY.

## Production

| Asset | Où | Source | Licence | Crédit exigé | Usage |
|---|---|---|---|---|---|
| Ruelle de nuit (photo) | `public/city/alley/` (dérivés : photo, profondeur, masques) | Wikimedia Commons, « 2024-10-20 Shinjuku Golden Gai at night.jpg », par Alexkom000 | CC BY 4.0 | oui : auteur + licence + lien, dans le pied de la landing et ici | décor de la landing, de la halte, du mode Spotify, du résumé |
| Big Shoulders | `next/font/google` + sous-ensemble `public/fonts/city-signage.woff` | Google Fonts (City of Chicago, Patric King) | SIL OFL 1.1 | non | titres, enseignes |
| Doto | `next/font/google` + sous-ensemble `public/fonts/city-led.woff` | Google Fonts (Óliver Lalan) | SIL OFL 1.1 | non | minuteur, panneau LED |
| Atkinson Hyperlegible Next | `next/font/google` | Google Fonts (Braille Institute) | SIL OFL 1.1 | non | texte courant |

Données calculées par nous à partir de la photo (même licence que la photo,
CC BY 4.0, mêmes crédits) : carte de profondeur (modèle Depth Anything V2
Small, Apache 2.0, exécuté hors ligne avec onnxruntime ; le modèle n'est pas
distribué), masques sol et émissif, carte de débord lumineux, liste des
enseignes (`scripts/city/prep_photo.py`).

## Lab uniquement (route `/lab`, exclue de la production)

| Asset | Où | Source | Licence | Usage |
|---|---|---|---|---|
| Supérette sous la pluie (photo) | `public/lab/city/konbini/` | Wikimedia Commons, « DFC 6246 Late-night rain… », PattayaPatrol | CC BY-SA 4.0 | piste A, scène de halte. Écartée de la production : logo d'enseigne réelle très lisible, et partage à l'identique sur les dérivés |
| Kit « hidden alley » : façade modulaire, rideaux métalliques, climatiseurs, escalier de secours, gouttières, boîtiers, applique, gaine, plaque d'égout, poubelles | `public/lab/city/assets/*.glb` | Poly Haven | CC0 | piste C (3D temps réel) |
| Asphalte « asphalt_02 » (albedo, normal, rugosité, AO) | `public/lab/city/assets/asphalt_*.webp` | Poly Haven | CC0 | piste C |
| HDRI « modern_buildings_night » | `public/lab/city/assets/modern_buildings_night_1k.hdr` | Poly Haven | CC0 | piste C (réflexions d'ambiance) |
| Photos de référence (comparaison) | non distribuées (dossier de travail) | Wikimedia Commons : « Cruce de Shinjuku de noche bajo la lluvia » (ProtoplasmaKid, CC BY 4.0), « Night markets of Taipei TaipeiNM4950 » (lumoplank, CC0), « DFC 3503 A wet city street at night… » (PattayaPatrol, CC BY-SA 4.0) | voir colonne source | planches `docs/redesign/shots/lab3/compare-*.jpg` |
| Polices du lab 2 (TTF) | `public/lab/fonts/` | Google Fonts | SIL OFL 1.1 | prototypes du lab 2 |
| manifold-3d (WASM) | `public/lab/manifold.wasm` | npm `manifold-3d` | Apache 2.0 (`manifold-LICENSE.txt`) | lab 2·2 |

## À retirer

| Asset | Raison |
|---|---|
| `public/tokyo_night.glb` (Sketchfab, CC BY 4.0, 37,9 Mo) | jamais utilisé, trop lourd |
| `public/seoul/*` (Pexels) | landing précédente ; plus utilisés par la landing actuelle, à confirmer avant suppression |
