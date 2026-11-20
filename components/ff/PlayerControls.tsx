"use client";

// Contrôles de lecture, communs à TOUTES les sources (YouTube, Spotify, Twitch).
// Purement présentationnel : il ne connaît que des capacités et un état, jamais
// une source. Une capacité absente (ex. « suivant » sur un live Twitch) n'est
// pas cachée en silence : le bouton reste à sa place, désactivé, et son libellé
// dit pourquoi. La grille ne saute donc pas d'une source à l'autre.
//
// Boucle / prolongation : un seul interrupteur à deux états NOMMÉS.
//   « Boucler »   → la file recommence au début
//   « Prolonger » → en fin de file, des titres proches de toute la file s'ajoutent
import { IconButton } from "@/components/ff/Button";
import { IconExtend, IconLoop, IconNext, IconPrev, IconShuffle } from "@/components/ff/icons";
import { cn } from "@/lib/utils";

export interface PlayerCaps {
  skip: boolean;
  shuffle: boolean;
  loop: boolean;
  /** Raison affichée quand une capacité manque (« Indisponible sur un live »). */
  reason?: string;
}

export interface PlayerControlsProps {
  caps: PlayerCaps;
  shuffle: boolean;
  loop: boolean;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onLoop: () => void;
  tone?: "ink" | "on-media";
  className?: string;
}

export function PlayerControls({
  caps, shuffle, loop, onPrev, onNext, onShuffle, onLoop, tone = "on-media", className,
}: PlayerControlsProps) {
  const why = (ok: boolean, label: string) => (ok ? label : `${label} : ${caps.reason ?? "indisponible pour cette source"}`);
  return (
    <div role="group" aria-label="Lecture" className={cn("flex items-center gap-0.5", className)}>
      <IconButton tone={tone} label={why(caps.skip, "Titre précédent")} disabled={!caps.skip} onClick={onPrev}>
        <IconPrev size={16} />
      </IconButton>
      <IconButton tone={tone} label={why(caps.skip, "Titre suivant")} disabled={!caps.skip} onClick={onNext}>
        <IconNext size={16} />
      </IconButton>
      <IconButton
        tone={tone}
        label={why(caps.shuffle, shuffle ? "Lecture aléatoire activée" : "Lecture aléatoire")}
        active={caps.shuffle ? shuffle : undefined}
        disabled={!caps.shuffle}
        onClick={onShuffle}
      >
        <IconShuffle size={17} />
      </IconButton>
      <IconButton
        tone={tone}
        label={why(caps.loop, loop ? "Boucler la file (cliquer pour prolonger avec des titres proches)" : "Prolonger avec des titres proches (cliquer pour boucler)")}
        disabled={!caps.loop}
        onClick={onLoop}
      >
        {loop ? <IconLoop size={17} /> : <IconExtend size={17} />}
      </IconButton>
    </div>
  );
}
