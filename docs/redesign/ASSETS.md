# Assets de la refonte : sources et licences

Le cœur visuel est fait main (géométrie procédurale, shaders TSL, modèles
Blender scriptés). Les ressources externes ne sont qu'en appoint.

| Asset | Où | Source | Licence | Usage |
|---|---|---|---|---|
| Bricolage Grotesque | `next/font/google` | Google Fonts (Mathieu Triay) | SIL OFL 1.1 | titres, chiffres |
| Gowun Dodum | `next/font/google` | Google Fonts (Yanghee Ryu) | SIL OFL 1.1 | interface |
| Archivo Black (TTF) | `public/lab/fonts/ArchivoBlack.ttf` | Google Fonts (Omnibus-Type) | SIL OFL 1.1 | lab 2 (extrusion de glyphes) |
| Gowun Dodum, Instrument Sans, IBM Plex Sans Condensed | `next/font/google` (lab) | Google Fonts | SIL OFL 1.1 | prototypes du lab |
| Police intégrée de Blender (Bfont) | dans `public/lab/counter.glb` | Blender | GPL avec exception de police (sortie libre) | chiffres du compteur (lab 6) |
| Photos de Séoul | `public/seoul/*` | Pexels | Licence Pexels (libre) | lab 3 (conversion en glyphes), landing précédente |
| Paper.js (UMD) | `public/lab/vendor/paper-core.min.js` | paper.js | MIT (`paper-LICENSE.txt`) | lab 4 |
| `public/tokyo_night.glb` | non utilisé | Sketchfab (Nikitos & 3130) | CC-BY-4.0 | aucun ; à retirer du dépôt (décision utilisateur) |

Modèles générés par nos scripts (aucune ressource tierce) :
- `public/lab/counter.glb` ← `scripts/blender/counter.py`
- pièces de céramique : générées au runtime (`lib/atelier/`, profils dessinés à la main)

Aucun HDRI n'est utilisé : l'éclairage est construit (softbox, contre-jour,
ombre de contact précalculée).
