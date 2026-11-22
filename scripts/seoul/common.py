"""Outils communs de la préparation 2.5D (photo de Séoul).

Usage : les modèles ONNX sont téléchargés une fois dans SEOUL_MODELS
(voir README.md), les sorties vont dans public/lab/seoul/.
"""
import os
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts" / "seoul" / "source.webp"
OUT = ROOT / "public" / "lab" / "seoul"
WORK = Path(os.environ.get("SEOUL_WORK", "/tmp/seoul-work"))
MODELS = Path(os.environ.get("SEOUL_MODELS", "/tmp/seoul-models"))
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)


def load_rgb() -> np.ndarray:
    img = cv2.imread(str(SRC), cv2.IMREAD_COLOR)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def guided_filter(guide: np.ndarray, src: np.ndarray, r: int, eps: float) -> np.ndarray:
    """Filtre guidé (He et al.) en niveaux de gris : recolle les bords de `src`
    sur ceux de `guide` sans halo."""
    k = (2 * r + 1, 2 * r + 1)
    mean = lambda x: cv2.boxFilter(x, -1, k, borderType=cv2.BORDER_REFLECT)
    mi, mp = mean(guide), mean(src)
    cov = mean(guide * src) - mi * mp
    var = mean(guide * guide) - mi * mi
    a = cov / (var + eps)
    b = mp - a * mi
    return mean(a) * guide + mean(b)


def save_gray(path: Path, x: np.ndarray):
    cv2.imwrite(str(path), np.clip(x * 255 + 0.5, 0, 255).astype(np.uint8))
