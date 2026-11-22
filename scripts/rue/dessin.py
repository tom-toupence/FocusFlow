"""Traitement « dessin » optionnel (scene.json "dessin": 0..1).

Donne aux photos le rendu illustré des photos HDR de la rotation : aplats
(lissage qui préserve les bords), contraste local fort, saturation un peu plus
franche sans changer les teintes, léger trait sur les contours nets. Les zones
lisses (ciel, brume) gardent leur dégradé. Appliqué aux couleurs des plans
seulement : profondeur et masques restent calculés sur la photo d'origine.
Entrée et sortie en BGR.
"""
import cv2, numpy as np, sys
def dessin(bgr, a=1.0):
    # 1. aplats : lissage qui préserve les bords (texture -> zones peintes)
    flat = cv2.edgePreservingFilter(bgr, flags=cv2.RECURS_FILTER, sigma_s=40, sigma_r=0.25)
    # 2. contraste local fort (rendu HDR / illustration)
    det = cv2.detailEnhance(flat, sigma_s=12, sigma_r=0.2)
    lab = cv2.cvtColor(det, cv2.COLOR_BGR2LAB)
    l, A, B = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(l)
    out = cv2.cvtColor(cv2.merge([l, A, B]), cv2.COLOR_LAB2BGR)
    # 3. saturation un peu plus franche, sans changer les teintes
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.18, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    # 4. léger trait d'encre sur les contours nets
    g = cv2.cvtColor(flat, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(g, 60, 140)
    e = cv2.GaussianBlur(e, (3, 3), 0).astype(np.float32)[..., None] / 255
    out = (out.astype(np.float32) * (1 - 0.35 * e)).clip(0, 255)
    # 5. les zones lisses (ciel, brume, eau calme) gardent un dégradé propre :
    # le contraste local y dessinerait des courbes de niveau.
    gs = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    m = cv2.GaussianBlur(gs, (0, 0), 6)
    sd = np.sqrt(np.maximum(cv2.GaussianBlur(gs * gs, (0, 0), 6) - m * m, 0))
    w = np.clip((sd - 4) / 10, 0, 1)
    w = cv2.GaussianBlur(w, (0, 0), 8)[..., None]
    soft = cv2.GaussianBlur(bgr, (0, 0), 1.2).astype(np.float32)
    hs = cv2.cvtColor(soft.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hs[..., 1] = np.clip(hs[..., 1] * 1.18, 0, 255)
    soft = cv2.cvtColor(hs.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    out = out * w + soft * (1 - w)
    return cv2.addWeighted(out.clip(0, 255).astype(np.uint8), a, bgr, 1 - a, 0)
