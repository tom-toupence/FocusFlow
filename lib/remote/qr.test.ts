import { describe, it, expect } from "vitest";
import { encodeQr, qrSvgPath } from "./qr";
import reference from "../__fixtures__/qr-reference.json";

// Le décodage réel a été vérifié avec OpenCV (QRCodeDetector) pour les versions
// 1 à 10 ; ici, la structure : taille, motifs de repère, ligne de synchronisation.
describe("encodeur QR", () => {
  it("choisit la plus petite version qui tient", () => {
    expect(encodeQr("A")).toHaveLength(21); // v1
    expect(encodeQr("https://focusflow.vercel.app/remote/ABC234")).toHaveLength(29); // v3
    expect(encodeQr("x".repeat(150))).toHaveLength(49); // v8 (version info)
  });

  it("dessine les trois repères et la synchronisation", () => {
    const m = encodeQr("https://focusflow.vercel.app/handoff/XYZ789");
    const n = m.length;
    const finderAt = (x0: number, y0: number) => {
      for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
        const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        expect(m[y0 + dy][x0 + dx]).toBe(d !== 2);
      }
    };
    finderAt(0, 0); finderAt(n - 7, 0); finderAt(0, n - 7);
    for (let i = 8; i < n - 8; i++) { expect(m[6][i]).toBe(i % 2 === 0); expect(m[i][6]).toBe(i % 2 === 0); }
    expect(m[n - 8][8]).toBe(true); // module sombre fixe
  });

  it("identique, module à module, à une matrice de référence (python-qrcode, même masque)", () => {
    for (const ref of reference as { text: string; mask: number; rows: string[] }[]) {
      const m = encodeQr(ref.text, { mask: ref.mask });
      expect(m.map((r) => r.map((c) => (c ? "1" : "0")).join(""))).toEqual(ref.rows);
    }
  });

  it("refuse un texte trop long", () => {
    expect(() => encodeQr("x".repeat(400))).toThrow();
  });

  it("SVG : zone calme de 4 modules", () => {
    const { size, d } = qrSvgPath(encodeQr("A"));
    expect(size).toBe(29);
    expect(d.startsWith("M4 4h1v1h-1z")).toBe(true);
  });
});
