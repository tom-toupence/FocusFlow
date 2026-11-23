"use client";

/**
 * Fond de l'app connectée : la rue de nuit du jour, celle de la landing.
 *
 * C'est le lien entre les deux surfaces. Une PHOTO FIXE (still.webp), jamais
 * le moteur WebGL : on travaille des heures sur ces écrans, un rendu 3D
 * continu viderait la batterie pour un décor. Elle est voilée à ~86 % pour que
 * tout le texte garde son contraste ; seules les lumières de la rue passent.
 *
 * Thème sombre uniquement (une rue de nuit sous une interface claire serait un
 * contresens) et désactivable dans le profil (`prefs.streetBackdrop`).
 * La rue change chaque jour (même rue pour toute la journée, sur tous les
 * écrans). À monter en premier enfant d'une racine `relative isolate`.
 */
import { useEffect, useState } from "react";
import { usePrefsStore } from "@/store/prefsStore";
import { RUE_SCENES, rueStill } from "@/lib/rue/scenes";

/** La rue du jour : stable sur la journée locale. */
export function streetOfTheDay(date = new Date()) {
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
  return RUE_SCENES[((day % RUE_SCENES.length) + RUE_SCENES.length) % RUE_SCENES.length];
}

export default function AmbientBackdrop() {
  const enabled = usePrefsStore((s) => s.streetBackdrop);
  const [scene, setScene] = useState<ReturnType<typeof streetOfTheDay> | null>(null);
  // Choisie au montage seulement (le rendu serveur ne connaît pas la date locale).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setScene(streetOfTheDay()), []);

  if (!scene || !enabled) return null;

  return (
    <div className="fixed inset-0 -z-10 hidden dark:block pointer-events-none" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={rueStill(scene.id)} alt="" className="absolute inset-0 h-full w-full object-cover motion-safe:animate-[rueFade_1.6s_ease-out]" />
      <div className="absolute inset-0 bg-night/[0.9]" />
      <div className="absolute inset-0 bg-gradient-to-b from-night/30 via-transparent to-night/70" />
      <p className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-2 right-3 max-w-[60vw] truncate font-mono text-[9px] uppercase tracking-[0.16em] text-white/25 pointer-events-auto">
        {scene.label} · {scene.href ? <a href={scene.href} target="_blank" rel="noopener noreferrer" className="hover:text-white/60">{scene.credit}</a> : scene.credit}
      </p>
    </div>
  );
}
