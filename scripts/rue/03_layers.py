"""3. Plans de profondeur et reconstitution de ce qu'ils cachent.

Quatre plans, du fond vers l'avant, par seuils sur la profondeur relative
(scene.json) : 0 fond, 1 milieu, 2 proche, 3 premier plan.
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

from common import MODELS, OUT, WORK, load_rgb, scene

T = scene()["thresholds"]   # fond | milieu | proche | premier plan
BAND = 150         # px révélables au plus par la caméra (travelling et avancée)
FRINGE = 5         # px de liseré de l'objet retiré avec lui (halo de couleur)

img = load_rgb()
H, W = img.shape[:2]
depth = np.load(WORK / "depth.npy")

layer = np.digitize(depth, T).astype(np.uint8)   # 0..3
for f in sorted(glob.glob(str(WORK / "obj_*.png"))):
    m = cv2.imread(f, 0) > 127
    if not m.any():
        continue
    # Seuls les objets « plats » deviennent des cartons : un masque trop grand
    # ou qui couvre beaucoup de profondeurs (le sol entier, par exemple) est
    # laissé à la profondeur estimée, sinon il perdrait sa perspective.
    p10, p90 = np.percentile(depth[m], [10, 90])
    if m.mean() > 0.06 or p90 - p10 > 0.15:
        continue
    med = float(np.median(depth[m]))
    layer[m] = np.digitize([med], T)[0]
    # Un objet segmenté = un carton découpé à sa distance : profondeur unique.
    # Sinon la pente douce de la profondeur sur son bord est jetée comme un
    # raccord étiré et la silhouette s'effiloche quand la caméra bouge.
    depth[m] = med
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
    # Au-delà de sa silhouette (vers le fond), un plan garde la profondeur de
    # son bord : sinon, en vraie perspective, les triangles à cheval sur la
    # silhouette relieraient l'objet au fond et s'étireraient en traînées.
    if k > 0:
        outside = (layer < k).astype(np.uint8)
        _, lab = cv2.distanceTransformWithLabels(outside, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        inside = outside == 0
        ys, xs = np.nonzero(inside)
        lut = np.zeros(lab.max() + 1, np.uint8)
        lut[lab[ys, xs]] = dk[ys, xs]
        dk = np.where(inside, dk, lut[lab]).astype(np.uint8)
    # Alpha : « ce plan ou plus proche ». Bords nets sur les objets SAM,
    # adoucis (3 px) sur les coupes à travers une surface continue.
    a = (layer >= k).astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), 1.2) if k > 0 else np.ones_like(a)
    # Alpha jamais nul : WebP jette la couleur des pixels totalement
    # transparents, et le filtrage bilinéaire ferait des liserés sombres.
    rgba = np.dstack([color, np.maximum((a * 255).astype(np.uint8), 1)])
    cv2.imwrite(str(OUT / f"layer{k}.webp"), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 88])
    cv2.imwrite(str(OUT / f"depth{k}.webp"), dk, [cv2.IMWRITE_WEBP_QUALITY, 95])
    cv2.imwrite(str(WORK / f"layer{k}_preview.jpg"), cv2.cvtColor(color, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print("plan", k, "part visible", round(float((layer == k).mean()) * 100, 1), "%")
