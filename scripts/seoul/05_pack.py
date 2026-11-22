"""5. Regroupe les quatre profondeurs de plan dans une seule texture RGBA
(R = plan 0 ... A = plan 3), sans perte, et retire les fichiers séparés."""
import cv2
import numpy as np

from common import OUT

d = [cv2.imread(str(OUT / f"depth{k}.webp"), cv2.IMREAD_GRAYSCALE) for k in range(4)]
pack = np.dstack(d)  # RGBA
cv2.imwrite(str(OUT / "depth.webp"), cv2.cvtColor(pack, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 101])
for k in range(4):
    (OUT / f"depth{k}.webp").unlink()
(OUT / "depth.png").unlink(missing_ok=True)
