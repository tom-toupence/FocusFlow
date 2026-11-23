"""2. Segmentation des objets qui en cachent d'autres : SlimSAM (Apache 2.0,
ONNX, Xenova/slimsam-77-uniform), un ou plusieurs points par objet.

La profondeur seule bave sur les bords ; SAM donne des contours nets que
03_layers.py combine avec la profondeur pour ranger chaque objet dans un plan.
Sortie : WORK/obj_<nom>.png (masques binaires pleine résolution).
"""
import json
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from common import MODELS, SCENE_DIR, WORK, load_rgb

# Points par objet, en pixels de la photo : [x, y, 1 = sur l'objet / 0 = hors],
# dans objects.json (propre à chaque photo).
OBJECTS = json.loads((SCENE_DIR / "objects.json").read_text())

img = load_rgb()
H, W = img.shape[:2]
S = 1024 / max(H, W)
h, w = round(H * S), round(W * S)
x = cv2.resize(img, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32)
x = (x - [123.675, 116.28, 103.53]) / [58.395, 57.12, 57.375]
pad = np.zeros((1024, 1024, 3), np.float32)
pad[:h, :w] = x
enc = ort.InferenceSession(str(MODELS / "sam_encoder.onnx"), providers=["CPUExecutionProvider"])
dec = ort.InferenceSession(str(MODELS / "sam_decoder.onnx"), providers=["CPUExecutionProvider"])
emb, pos = enc.run(None, {"pixel_values": pad.transpose(2, 0, 1)[None]})

for f in WORK.glob("obj_*.png"):
    f.unlink()
for name, pts in OBJECTS.items():
    p = np.array([[[[px * S, py * S] for px, py, _ in pts]]], np.float32)
    l = np.array([[[lab for _, _, lab in pts]]], np.int64)
    iou, masks = dec.run(None, {"input_points": p, "input_labels": l, "image_embeddings": emb, "image_positional_embeddings": pos})
    best = int(np.argmax(iou[0, 0]))
    m = cv2.resize(masks[0, 0, best], (1024, 1024), interpolation=cv2.INTER_LINEAR)[:h, :w]
    m = cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR) > 0
    cv2.imwrite(str(WORK / f"obj_{name}.png"), (m * 255).astype(np.uint8))
    print(f"{name:20s} iou={iou[0,0,best]:.2f} aire={m.mean()*100:.1f}%")
