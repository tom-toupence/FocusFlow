"""4. Masques d'effets.

masks.webp (RGB, 8 bits) : R = néons et enseignes (intensité lumineuse),
G = fenêtres, B = sol mouillé. Pas d'alpha : WebP jette la couleur des
pixels transparents, un ciel presque nul effaçait tous les masques.
ids.webp (sans perte) : R = numéro d'enseigne (1..255), G = numéro de
fenêtre, B = ciel ; chaque élément grésille ou s'allume pour son compte.

Détection :
- enseignes : pixels lumineux et saturés (HSV), hors sol (sinon les reflets
  grésilleraient sans leur source), regroupés en composantes connexes ;
- fenêtres : lumières peu saturées ou cyan, petites, dans le haut de l'image
  et dans les plans lointains (bâtiments) ;
- sol : polygone de la rue, moins les objets posés dessus ;
- ciel : lointain et en haut de l'image.
"""
import glob

import cv2
import numpy as np

from common import OUT, WORK, load_rgb, save_gray, scene

img = load_rgb()
H, W = img.shape[:2]
depth = np.load(WORK / "depth.npy")
hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
hue, sat, val = hsv[..., 0], hsv[..., 1] / 255, hsv[..., 2] / 255
yy = np.mgrid[0:H, 0:W][0]

# Sol : la rue entre les trottoirs, jusqu'au point de fuite.
floor = np.zeros((H, W), np.uint8)
poly = np.array(scene()["floor"], np.int32)
cv2.fillPoly(floor, [poly], 1)
objects = np.zeros((H, W), bool)
for f in glob.glob(str(WORK / "obj_*.png")):
    objects |= cv2.imread(f, 0) > 127
floor = (floor > 0) & ~objects
floor_soft = cv2.GaussianBlur(floor.astype(np.float32), (0, 0), 6)

# Enseignes.
bright = (val > 0.62) & (sat > 0.42)
bright |= val > 0.9
bright &= floor_soft < 0.5
bright = cv2.morphologyEx(bright.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats(bright, 8)
sign_ids = np.zeros((H, W), np.uint8)
emissive = np.zeros((H, W), np.float32)
win_ids = np.zeros((H, W), np.uint8)
windows = np.zeros((H, W), np.float32)
sid = wid = 0
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area < 30:
        continue
    m = lab == i
    cyan = np.median(hue[m])
    small = area < 1600
    is_window = small and y < 0.6 * H and np.median(depth[m]) < 0.45 and (np.median(sat[m]) < 0.5 or 80 <= cyan <= 105) and w < 160
    if is_window:
        wid = wid % 255 + 1
        win_ids[m] = wid
        windows[m] = val[m]
    else:
        emissive[m] = val[m]
        if area > 6000:
            # Gros bloc (plusieurs enseignes collées) : découpé en cellules de
            # 140 px, chaque morceau de tube vit pour son compte.
            cell = (yy[m] // 140) * 64 + (np.mgrid[0:H, 0:W][1][m] // 140)
            for c in np.unique(cell):
                sid = sid % 255 + 1
                sub = np.zeros((H, W), bool)
                sub[m] = cell == c
                sign_ids[sub] = sid
        else:
            sid = sid % 255 + 1
            sign_ids[m] = sid

# Les enseignes segmentées par SAM forment chacune UN élément (elles
# s'allument et s'éteignent d'un bloc), prioritaire sur le découpage.
for f in sorted(glob.glob(str(WORK / "obj_enseigne_*.png"))):
    om = cv2.imread(f, 0) > 127
    sid = sid % 255 + 1
    sign_ids[om & (emissive > 0)] = sid

# Halo doux autour des enseignes : le grésillement touche aussi leur lueur.
emissive = np.maximum(emissive, cv2.GaussianBlur(emissive, (0, 0), 3) * 0.8)
sign_ids = cv2.dilate(sign_ids, np.ones((5, 5), np.uint8))
sky = ((depth < 0.06) & (yy < 300)).astype(np.float32)
sky = cv2.GaussianBlur(sky, (0, 0), 8)

masks = np.dstack([emissive, windows, floor_soft, sky])
masks8 = np.clip(masks * 255 + 0.5, 0, 255).astype(np.uint8)
cv2.imwrite(str(OUT / "masks.webp"), cv2.cvtColor(masks8[..., :3], cv2.COLOR_RGB2BGR), [cv2.IMWRITE_WEBP_QUALITY, 90])
ids = np.dstack([sign_ids, win_ids, masks8[..., 3]])
cv2.imwrite(str(OUT / "ids.webp"), cv2.cvtColor(ids, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_WEBP_QUALITY, 101])  # 101 = sans perte
print("enseignes", sid, "fenêtres", wid)
for c, name in enumerate(["emissive", "windows", "floor", "sky"]):
    save_gray(WORK / f"mask_{name}.png", masks[..., c])
