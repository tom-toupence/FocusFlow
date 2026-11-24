"use client";
// QR code en SVG, généré localement (lib/remote/qr.ts, sans dépendance).
import { useMemo } from "react";
import { encodeQr, qrSvgPath } from "@/lib/remote/qr";

export default function QrCode({ text, size = 168, label, testId }: { text: string; size?: number; label: string; testId?: string }) {
  const { d, size: n } = useMemo(() => qrSvgPath(encodeQr(text)), [text]);
  return (
    <svg
      role="img"
      aria-label={label}
      data-testid={testId}
      data-url={testId ? text : undefined}
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="shrink-0 rounded-lg bg-white"
    >
      <path d={d} fill="#000" />
    </svg>
  );
}
