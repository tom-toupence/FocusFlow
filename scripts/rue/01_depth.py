"""1. Carte de profondeur : Depth Anything V2 Small (Apache 2.0, ONNX).

Inférence à 1022 px de large, hauteur au format de la photo (multiples de 14), moyenne avec l'image en miroir
(moins de bruit), puis léger recalage des bords par filtre guidé sur la photo.
Sortie : WORK/depth.npy (1 = proche, 0 = loin), OUT/depth.png.
"""
import cv2
import numpy as np
import onnxruntime as ort

from common import MODELS, OUT, WORK, guided_filter, load_rgb, save_gray

img = load_rgb()
H, W = img.shape[:2]
sess = ort.InferenceSession(str(MODELS / "depth_small.onnx"), providers=["CPUExecutionProvider"])

IW = 1022                                   # multiple de 14
IH = int(round(IW * H / W / 14)) * 14       # même format que la photo

def infer(rgb):
    x = cv2.resize(rgb, (IW, IH), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255.0
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    return sess.run(None, {"pixel_values": x})[0][0]

d = (infer(img) + infer(img[:, ::-1].copy())[:, ::-1]) / 2   # disparité relative
d = cv2.resize(d, (W, H), interpolation=cv2.INTER_CUBIC)
d = (d - np.percentile(d, 0.5)) / (np.percentile(d, 99.5) - np.percentile(d, 0.5))
d = np.clip(d, 0, 1).astype(np.float32)
np.save(WORK / "depth_raw.npy", d)

gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
# Une passe douce (eps élevé) : recale les grands bords sans recopier la
# texture des LED dans la profondeur (sinon la parallaxe fait onduler les
# enseignes). Les contours nets viennent de la segmentation (02_layers.py).
r = guided_filter(gray, d, 12, 2e-2)
r = np.clip(r, 0, 1)
np.save(WORK / "depth.npy", r)
save_gray(OUT / "depth.png", r)
save_gray(WORK / "depth_raw.png", d)
print("depth", r.shape, float(r.min()), float(r.max()))
