"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAmbientStore } from "@/store/ambientStore";

/**
 * Fond « aurora » : 2 blobs radial-gradient très doux animés en transform
 * seul (~26-34 s par cycle). background-image n'étant pas transitionnable,
 * le changement de teinte se fait en crossfadant 2 couches en opacity.
 * À monter en premier enfant d'une racine `relative isolate` (le -z-10 le
 * place au-dessus du bg-background de la racine, sous le contenu).
 */
export default function AmbientBackdrop() {
  const hex = useAmbientStore((s) => s.hex);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Couche courante + précédente (max 2) pour le crossfade.
  const [layers, setLayers] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayers((prev) => (prev[prev.length - 1] === hex ? prev : [...prev.slice(-1), hex]));
  }, [hex]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ contain: "strict" }}
      aria-hidden
    >
      {layers.map((h, i) => (
        <div key={h} className={cn("absolute inset-0", i > 0 && "anim-ambient-in")}>
          <div
            className="anim-aurora absolute rounded-full opacity-25 dark:opacity-45"
            style={{
              left: "-12%",
              top: "-22%",
              width: "70vmax",
              height: "70vmax",
              background: `radial-gradient(circle at center, ${h} 0%, transparent 65%)`,
            }}
          />
          <div
            className="anim-aurora-slow absolute rounded-full opacity-20 dark:opacity-35"
            style={{
              right: "-18%",
              bottom: "-28%",
              width: "80vmax",
              height: "80vmax",
              background: `radial-gradient(circle at center, color-mix(in oklab, ${h} 70%, #6b7a99) 0%, transparent 60%)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
