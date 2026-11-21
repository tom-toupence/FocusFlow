"""Prépare une photo de nuit pour la scène 2.5D (lib/city/photo).

Entrées : photo.jpg + photo-depth.png (Depth Anything V2 Small, profondeur
inverse relative : clair = proche). Sorties dans <out>/ :
  photo.jpg / photo-m.jpg  la photo (1920 et 1024 px)
  data.png                 R = profondeur, G = sol (mouillable), B = émissif
  glow.jpg                 lumière des enseignes floutée (débord, bloom)
  blobs.json               enseignes détectées : centre, rayon, profondeur, couleur
Usage : python3 prep_photo.py photo.jpg depth.png out/ [--horizon 0.45]
"""
import sys, json, os
import numpy as np, cv2

src, dep, out = sys.argv[1:4]
horizon = float(sys.argv[sys.argv.index("--horizon") + 1]) if "--horizon" in sys.argv else 0.4
os.makedirs(out, exist_ok=True)
img = cv2.imread(src, cv2.IMREAD_COLOR)
H, W = img.shape[:2]
d = cv2.imread(dep, cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0
d = cv2.resize(d, (W, H), interpolation=cv2.INTER_CUBIC)
ds = cv2.GaussianBlur(d, (0, 0), 2)

# ── Sol : pour chaque colonne, depuis le bas, tant que la profondeur décroît
# régulièrement (le sol s'éloigne) sans saut (un objet posé), on est au sol.
gy = np.diff(ds, axis=0, prepend=ds[:1])          # >0 : plus proche en descendant
gx = np.abs(np.diff(ds, axis=1, prepend=ds[:, :1]))
plane = (gy > 0.00015) & (gy < 0.02) & (gx < 0.01)
ground = np.zeros_like(d, dtype=np.uint8)
ymin = int(H * horizon)
for x in range(W):
    col = plane[:, x]
    y = H - 1
    miss = 0
    while y > ymin:
        if col[y]:
            miss = 0
        else:
            miss += 1
            if miss > 6:
                break
        ground[y, x] = 255
        y -= 1
ground = cv2.morphologyEx(ground, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
ground = cv2.medianBlur(ground, 21)
ground = cv2.GaussianBlur(ground, (0, 0), 6)
# Direction artistique : sol tracé à la main (polygone normalisé), prioritaire.
if "--ground" in sys.argv:
    pts = [tuple(map(float, p.split(","))) for p in sys.argv[sys.argv.index("--ground") + 1].split(";")]
    poly = np.zeros_like(ground)
    cv2.fillPoly(poly, [np.array([(int(x * W), int(y * H)) for x, y in pts], np.int32)], 255)
    # Le polygone ne garde que ce qui est vraiment au sol (objets posés exclus par la profondeur).
    near_obj = (cv2.GaussianBlur(gx, (0, 0), 3) > 0.004).astype(np.uint8) * 255
    poly = cv2.bitwise_and(poly, cv2.bitwise_not(near_obj))
    ground = cv2.GaussianBlur(poly, (0, 0), 5)

# ── Émissif : très lumineux, ou lumineux et saturé (tubes, caissons).
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
v, s = hsv[..., 2] / 255, hsv[..., 1] / 255
em = np.clip((v - 0.6) / 0.25, 0, 1) * np.clip((v * (0.5 + s)) - 0.38, 0, 1) * 2.4
em = np.clip(em, 0, 1) * (1 - ground / 255.0)   # les reflets du sol ne sont pas des sources
em8 = (em * 255).astype(np.uint8)
em8 = cv2.GaussianBlur(em8, (0, 0), 1.2)

# ── Enseignes : composantes connexes de l'émissif dilaté.
mask = cv2.dilate((em8 > 90).astype(np.uint8), np.ones((7, 7), np.uint8))
n, lab, stats, cent = cv2.connectedComponentsWithStats(mask, 8)
blobs = []
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area < W * H * 0.00012:
        continue
    m = lab[y:y + h, x:x + w] == i
    col = img[y:y + h, x:x + w][m].mean(axis=0)[::-1]
    blobs.append({
        "x": round((x + w / 2) / W, 4), "y": round((y + h / 2) / H, 4),
        "r": round(max(w / W, h / H) * 0.6 + 0.004, 4),
        "depth": round(float(d[y:y + h, x:x + w][m].mean()), 3),
        "color": "#%02x%02x%02x" % tuple(int(c) for c in col),
    })
blobs.sort(key=lambda b: b["depth"])  # du fond vers nous

# ── Débord de lumière : couleur des sources, très floutée.
glow = img.astype(np.float32) * (em[..., None])
glow = cv2.GaussianBlur(glow, (0, 0), W * 0.012) * 1.8 + cv2.GaussianBlur(glow, (0, 0), W * 0.004)
glow = np.clip(glow, 0, 255).astype(np.uint8)

data = np.dstack([em8, ground, (d * 255).astype(np.uint8)])  # BGR → R=d, G=sol, B=émissif
cv2.imwrite(f"{out}/data.png", cv2.resize(data, (W // 2, H // 2), interpolation=cv2.INTER_AREA))
cv2.imwrite(f"{out}/glow.jpg", cv2.resize(glow, (W // 4, H // 4), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
cv2.imwrite(f"{out}/photo.jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 84, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
cv2.imwrite(f"{out}/photo-m.jpg", cv2.resize(img, (1024, int(1024 * H / W)), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 80])
json.dump({"w": W, "h": H, "blobs": blobs[:60]}, open(f"{out}/blobs.json", "w"))
print(f"{len(blobs)} enseignes, sol {ground.mean() / 2.55:.1f} %")
