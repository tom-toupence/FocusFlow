"""0. Réglages automatiques d'une scène (après 01_depth.py), pour ne pas placer
les points de segmentation à la main sur chaque photo.

- objets du premier plan : zones proches (profondeur haute) assez grandes,
  avec des points au cœur de chacune (maxima de la distance au bord) ;
- enseignes : zones lumineuses et saturées assez grandes ;
- seuils des plans : quantiles de la profondeur (hors ciel) ;
- sol : bas de l'image, s'il est proche.
Écrit objects.json et scene.json dans le dossier de la scène, sauf s'ils
existent déjà (une scène réglée à la main n'est jamais écrasée).
"""
import json

import cv2
import numpy as np

from common import SCENE_DIR, WORK, load_rgb

img = load_rgb()
H, W = img.shape[:2]
depth = np.load(WORK / "depth.npy")
hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
sat, val = hsv[..., 1] / 255, hsv[..., 2] / 255

def points_in(mask, n):
    """n points bien à l'intérieur d'une zone (maxima de distance au bord)."""
    dist = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
    pts = []
    for _ in range(n):
        y, x = np.unravel_index(np.argmax(dist), dist.shape)
        if dist[y, x] < 4:
            break
        pts.append([int(x), int(y), 1])
        cv2.circle(dist, (int(x), int(y)), int(max(dist[y, x] * 1.5, 12)), 0, -1)
    return pts

objects = {}
valid = depth > 0.03
qs = np.quantile(depth[valid], [0.30, 0.60, 0.86]) if valid.any() else np.array([0.2, 0.4, 0.6])

# Premier plan : proche et compact.
near = (depth > max(qs[2], 0.55)).astype(np.uint8)
near = cv2.morphologyEx(near, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats(near, 8)
order = sorted(range(1, n), key=lambda i: -stats[i][4])
for i in order[:8]:
    x, y, w, h, area = stats[i]
    if area < 0.002 * H * W or (w > 0.6 * W and h < 0.25 * H):   # pas le sol entier
        continue
    pts = points_in(lab == i, 3)
    if pts:
        objects[f"proche_{len(objects)}"] = pts

# Enseignes lumineuses.
bright = ((val > 0.65) & (sat > 0.45)).astype(np.uint8)
bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats(bright, 8)
order = sorted(range(1, n), key=lambda i: -stats[i][4])
k = 0
for i in order[:10]:
    if stats[i][4] < 0.002 * H * W:
        continue
    pts = points_in(lab == i, 2)
    if pts:
        objects[f"enseigne_{k}"] = pts
        k += 1

# Sol : bas de l'image, proche.
floor_mask = np.zeros((H, W), np.uint8)
floor_mask[int(H * 0.72):] = 1
floor_mask &= (depth > qs[1]).astype(np.uint8)
cnts, _ = cv2.findContours(floor_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
floor = []
if cnts:
    c = max(cnts, key=cv2.contourArea)
    hull = cv2.convexHull(c)[:, 0, :]
    floor = [[int(x), int(y)] for x, y in hull]

scene = {"thresholds": [round(float(q), 3) for q in qs], "floor": floor or [[0, H], [0, int(H * 0.85)], [W, int(H * 0.85)], [W, H]]}
for name, data in (("objects.json", objects), ("scene.json", scene)):
    p = SCENE_DIR / name
    if not p.exists():
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2))
print(f"{len(objects)} objets, seuils {scene['thresholds']}")
