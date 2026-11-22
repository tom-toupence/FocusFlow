# Préparation de la rue de nuit en 2.5D (projection caméra)

Une vraie photo devient une scène en profondeur (projection caméra, comme en
motion design). Les scripts s'exécutent une fois ; leurs résultats sont
commités dans `public/lab/rue/`. Licences : `docs/redesign/ASSETS.md`.

```bash
pip install numpy opencv-python onnxruntime   # déjà présents dans l'environnement cloud
export RUE_MODELS=/chemin/modeles RUE_WORK=/chemin/travail RUE_SCENE=pont
mkdir -p "$RUE_MODELS" && cd "$RUE_MODELS"
curl -L -o depth_small.onnx https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx
curl -L -o sam_encoder.onnx https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/vision_encoder.onnx
curl -L -o sam_decoder.onnx https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/prompt_encoder_mask_decoder.onnx
curl -L -o lama.onnx https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx
cd - && cd scripts/rue
python3 01_depth.py && python3 02_segment.py && python3 03_layers.py && python3 04_masks.py && python3 05_pack.py
```

| Étape | Ce qu'elle fait | Pourquoi |
|---|---|---|
| `01_depth.py` | Depth Anything V2 Small à 1022 x 686, moyenne avec le miroir, filtre guidé doux | la profondeur brute est fiable en structure ; un filtre trop fin recopiait la texture des LED dans la profondeur (les enseignes ondulaient) |
| `02_segment.py` | SlimSAM, quelques points par objet (passants, enseignes sur pied, panneau néon) | contours nets là où la profondeur bave |
| `03_layers.py` | 4 plans par seuils de profondeur, chaque objet SAM entier dans un plan ; LaMa reconstitue une bande de 90 px derrière les silhouettes | la caméra ne révèle jamais plus de ~30 px ; LaMa travaille mieux sur des trous étroits |
| `04_masks.py` | néons (lumineux et saturés, hors sol), fenêtres (petites lumières dans le haut), sol (polygone de la rue), ciel ; numéros par composante | chaque enseigne grésille, chaque fenêtre s'éteint pour son compte ; les gros blocs d'enseignes collées sont découpés |
| `05_pack.py` | regroupe les 4 profondeurs dans une texture | une texture au lieu de quatre |

Une scène = un dossier `scenes/<nom>/` : `source.jpg`, `objects.json` (points
SAM par objet) et `scene.json` (seuils des plans, polygone du sol). Lancer les
cinq étapes avec `RUE_SCENE=<nom>` ; sorties dans `public/lab/rue/<nom>/`.
Chaque objet segmenté reçoit une profondeur unique (sa médiane) : un carton
découpé à sa distance, dont le bord reste net quand la caméra bouge.

Rendu (`lib/rue/`) : chaque plan est une grille de sommets poussés à leur
profondeur (z = 1 / mix(1/9, 1, d)) et vue par une caméra en perspective qui
avance, dérive et tourne ; plans dessinés du fond vers l'avant, tampon de
profondeur vidé entre deux plans ; triangles de raccord étirés jetés.
