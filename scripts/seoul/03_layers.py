"""3. Plans de profondeur et reconstitution de ce qu'ils cachent.

Quatre plans, du fond vers l'avant (seuils sur la profondeur relative) :
  0 fond (< 0.16)  1 milieu (< 0.30)  2 proche (< 0.55)  3 premier plan.
Chaque objet segmenté par SAM passe entier dans le plan de sa profondeur
médiane (contours nets). Les coupes à travers une surface continue (le sol,
un mur) restent douces : en rendu, le décalage dépend de la profondeur du
pixel, pas du plan, donc un sol coupé en deux bouge d'un seul tenant.

Plan k : couleur = photo dont tout ce qui est DEVANT k est retiré et
reconstitué par LaMa (Apache 2.0, ONNX, Carve/LaMa-ONNX), alpha = « k ou
plus proche ». Seule une bande de BAND px autour des silhouettes peut être
révélée par la parallaxe : c'est elle qu'on reconstitue (LaMa travaille
mieux sur des trous étroits).
Sorties : OUT/layerK.webp (RGBA), OUT/depthK.webp, WORK/layers_index.png.
"""
import glob

import cv2
import numpy as np
import onnxruntime as ort

from common import MODELS, OUT, WORK, load_rgb

T = [0.16, 0.30, 0.55]
BAND = 90          # px révélables au plus (amplitude max de la caméra ~ 40 px)
FRINGE = 5         # px de liseré de l'objet retiré avec lui (halo de couleur)

img = load_rgb()
H, W = img.shape[:2]
depth = np.load(WORK / "depth.npy")

layer = np.digitize(depth, T).astype(np.uint8)   # 0..3
for f in sorted(glob.glob(str(WORK / "obj_*.png"))):
    m = cv2.imread(f, 0) > 127
    layer[m] = np.digitize([np.median(depth[m])], T)[0]
cv2.imwrite(str(WORK / "layers_index.png"), layer * 85)

lama = ort.InferenceSession(str(MODELS / "lama.onnx"), providers=["CPUExecutionProvider"])

def lama_tile(rgb, hole):
    x = rgb.astype(np.float32).transpose(2, 0, 1)[None] / 255.0
    m = hole.astype(np.float32)[None, None]
    y = lama.run(None, {"image": x, "mask": m})[0][0].transpose(1, 2, 0)
    return np.clip(y if y.max() > 2 else y * 255, 0, 255)

def inpaint(rgb, hole):
    """LaMa par tuiles de 512 qui se recouvrent, fondues entre elles."""
    out = rgb.astype(np.float32).copy()
    acc = np.zeros((H, W, 3), np.float32)
    wsum = np.zeros((H, W, 1), np.float32)
    win = np.outer(np.hanning(512), np.hanning(512)).astype(np.float32)[..., None] + 1e-3
    ys = list(range(0, H - 512, 384)) + [H - 512]
    xs = list(range(0, W - 512, 384)) + [W - 512]
    for y0 in ys:
        for x0 in xs:
            hm = hole[y0:y0 + 512, x0:x0 + 512]
            if not hm.any():
                continue
            t = lama_tile(rgb[y0:y0 + 512, x0:x0 + 512], hm)
            acc[y0:y0 + 512, x0:x0 + 512] += t * win
            wsum[y0:y0 + 512, x0:x0 + 512] += win
    filled = np.where(wsum > 0, acc / np.maximum(wsum, 1e-6), out)
    out[hole] = filled[hole]
    return out.astype(np.uint8)

ker = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
d8 = (depth * 255).astype(np.uint8)
for k in range(4):
    front = (layer > k).astype(np.uint8)
    if k < 3 and front.any():
        hole = cv2.dilate(front, ker(FRINGE)) > 0
        visible = ~hole
        band = hole & (cv2.dilate(visible.astype(np.uint8), ker(BAND)) > 0)
        color = inpaint(img, band)
        # Profondeur derrière : celle du fond qui entoure le trou.
        dk = cv2.inpaint(d8, band.astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
    else:
        color, dk = img, d8
    # Alpha : « ce plan ou plus proche ». Bords nets sur les objets SAM,
    # adoucis (3 px) sur les coupes à travers une surface continue.
    a = (layer >= k).astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), 1.2) if k > 0 else np.ones_like(a)
    rgba = np.dstack([color, (a * 255).astype(np.uint8)])
    cv2.imwrite(str(OUT / f"layer{k}.webp"), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 88])
    cv2.imwrite(str(OUT / f"depth{k}.webp"), dk, [cv2.IMWRITE_WEBP_QUALITY, 95])
    cv2.imwrite(str(WORK / f"layer{k}_preview.jpg"), cv2.cvtColor(color, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print("plan", k, "part visible", round(float((layer == k).mean()) * 100, 1), "%")
