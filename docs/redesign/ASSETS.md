# Assets : sources et licences

## Rue de Séoul en 2.5D (`/lab/seoul`)

| Élément | Où | Source | Licence | Statut |
|---|---|---|---|---|
| Photo de la rue sous la pluie, la nuit (1920 x 1280) | `scripts/seoul/source.webp`, dérivés dans `public/lab/seoul/` | fournie par l'utilisateur ; signature « Nocalz photo » dans l'image | **inconnue** | **À vérifier avant toute mise en production.** La signature est conservée (jamais retirée ni masquée) et un crédit est affiché sur la page. Sans autorisation du photographe ou licence libre confirmée, ce visuel reste au laboratoire. |
| Depth Anything V2 **Small** (ONNX) | téléchargé hors dépôt | `onnx-community/depth-anything-v2-small` | Apache 2.0 | carte de profondeur. Les versions Base et Large sont en CC BY-NC 4.0 (non commercial) : écartées. |
| SlimSAM (ONNX) | téléchargé hors dépôt | `Xenova/slimsam-77-uniform` (dérivé de Segment Anything, Meta) | Apache 2.0 | contours nets des objets qui en cachent d'autres |
| LaMa (ONNX) | téléchargé hors dépôt | `Carve/LaMa-ONNX` (LaMa, Samsung AI) | Apache 2.0 | reconstitution de ce que chaque plan cache |
| OpenCV, NumPy, onnxruntime | outils Python | PyPI | Apache 2.0 / BSD / MIT | traitement d'image, inférence |

Aucun modèle n'est livré avec l'application : ils ne servent qu'à la
préparation (`scripts/seoul/`). L'application ne charge que des images WebP.

### Fichiers produits (`public/lab/seoul/`, 1,7 Mo)

| Fichier | Contenu |
|---|---|
| `layer0.webp` à `layer3.webp` | les quatre plans (fond, milieu, proche, premier plan), RGBA ; chaque plan contient la photo avec ce qui est DEVANT lui retiré et reconstitué ; alpha = « ce plan ou plus proche » |
| `depth.webp` | profondeur de chaque plan (un canal par plan), sans perte |
| `masks.webp` | R néons et enseignes, G fenêtres, B sol mouillé, A ciel |
| `ids.webp` | R numéro d'enseigne, G numéro de fenêtre (sans perte), pour que chaque élément vive pour son compte |
| `still.webp` | image fixe de repli |
