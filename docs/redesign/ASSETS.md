# Assets : sources et licences

## Rue de nuit en 2.5D (`/lab/rue`)

| Élément | Où | Source | Licence | Crédit |
|---|---|---|---|---|
| « Tokyo » (16042877318), passant sous un parapluie sur un pont, version 1920 x 1173 | `scripts/rue/scenes/pont/`, dérivés dans `public/lab/rue/pont/` | Moyan Brenn, Wikimedia Commons (depuis Flickr) : https://commons.wikimedia.org/wiki/File:Tokyo_(16042877318).jpg | CC BY 2.0 | oui : auteur, licence, lien et modifications affichés sur la page. La mention « Copyright © Moyan Brenn - Flickr.com » incrustée par l'auteur est conservée dans l'image. À noter avant toute production : marques lisibles (enseignes) et visages de mannequins sur les affiches. |
| « Walking around Kabukicho, Shinjuku at night. » (16 juin 2016), version 1920 x 1080 | `scripts/rue/scenes/kabukicho/`, dérivés dans `public/lab/rue/kabukicho/` | Daniel Ramirez, Wikimedia Commons (depuis Flickr) : https://commons.wikimedia.org/wiki/File:Walking_around_Kabukicho,_Shinjuku_at_night._(29362321701).jpg | CC BY 2.0 | oui : auteur, licence, lien et mention des modifications, affichés sur la page |
| Depth Anything V2 **Small** (ONNX) | téléchargé hors dépôt | `onnx-community/depth-anything-v2-small` | Apache 2.0 | carte de profondeur. Les versions Base et Large sont en CC BY-NC 4.0 (non commercial) : écartées. |
| SlimSAM (ONNX) | téléchargé hors dépôt | `Xenova/slimsam-77-uniform` (dérivé de Segment Anything, Meta) | Apache 2.0 | contours nets des objets qui en cachent d'autres |
| LaMa (ONNX) | téléchargé hors dépôt | `Carve/LaMa-ONNX` (LaMa, Samsung AI) | Apache 2.0 | reconstitution de ce que chaque plan cache |
| OpenCV, NumPy, onnxruntime | outils Python | PyPI | Apache 2.0 / BSD / MIT | traitement d'image, inférence |

La photo signée « Nocalz photo » utilisée d'abord (licence inconnue) a été retirée des fichiers et remplacée par celle-ci ; elle reste dans l'historique git de la branche.

Aucun modèle n'est livré avec l'application : ils ne servent qu'à la
préparation (`scripts/rue/`). L'application ne charge que des images WebP.

### Fichiers produits (`public/lab/rue/<scène>/`, 3,6 à 3,8 Mo par scène)

| Fichier | Contenu |
|---|---|
| `layer0.webp` à `layer3.webp` | les quatre plans (fond, milieu, proche, premier plan), RGBA ; chaque plan contient la photo avec ce qui est DEVANT lui retiré et reconstitué ; alpha = « ce plan ou plus proche » (jamais nul : WebP jetterait la couleur) |
| `depth.webp` | profondeur de chaque plan (un canal par plan), sans perte |
| `masks.webp` | R néons et enseignes, G fenêtres, B sol mouillé (sans alpha : WebP jette la couleur des pixels transparents) |
| `ids.webp` | R numéro d'enseigne, G numéro de fenêtre, B ciel (sans perte), pour que chaque élément vive pour son compte |
| `still.webp` | image fixe de repli |
