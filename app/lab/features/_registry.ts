import type { ComponentType } from "react";
import { PausesEnMusique, Reprise, RepriseDashboard, RadioCommune, Promesse, Revue } from "./_mocks-a";
import { EcranVerrouille, SerieADeux, LienSession } from "./_mocks-b";
import { TitresQuiMarchent, GoBlocs } from "./_mocks-c";

export interface MockEntry { slug: string; name: string; pitch: string; effort: "S" | "M" | "L"; value: number; screens: ComponentType[] }

export const MOCKS: MockEntry[] = [
  { slug: "systeme", name: "FocusFlow dans le système", pitch: "Le minuteur dans l'onglet, l'écran verrouillé et les touches média.", effort: "S", value: 4.5, screens: [EcranVerrouille] },
  { slug: "reprise", name: "Reprendre là où tu t'es arrêté", pitch: "Une note de reprise et la vidéo au bon endroit.", effort: "S", value: 4.5, screens: [Reprise, RepriseDashboard] },
  { slug: "pauses-en-musique", name: "Pauses en musique", pitch: "Des fondus au lieu de coupures, et une musique à soi pendant les pauses.", effort: "M", value: 4.5, screens: [PausesEnMusique] },
  { slug: "go-blocs", name: "Go sur tous les blocs", pitch: "Un bloc planifié se lance en un clic quand son heure arrive.", effort: "S", value: 3.5, screens: [GoBlocs] },
  { slug: "lien", name: "Partager par lien", pitch: "Une session, une playlist ou une routine dans un lien, sans serveur.", effort: "S", value: 3.5, screens: [LienSession] },
  { slug: "titres-qui-marchent", name: "Tes titres qui marchent", pitch: "Les morceaux avec lesquels tu te concentres le mieux, en playlist.", effort: "M", value: 4, screens: [TitresQuiMarchent] },
  { slug: "serie-a-deux", name: "Série à deux (et jour de repos)", pitch: "Une série commune avec un ami, et un jour off toléré.", effort: "M", value: 4, screens: [SerieADeux] },
  { slug: "revue", name: "Revue du dimanche", pitch: "Trois minutes guidées pour clore la semaine et préparer la suivante.", effort: "M", value: 4, screens: [Revue] },
  { slug: "promesse", name: "Promesse aux amis", pitch: "Annoncer un objectif du soir à ses amis, qui voient s'il est tenu.", effort: "M", value: 3.5, screens: [Promesse] },
  { slug: "radio-commune", name: "Radio commune", pitch: "Tout le monde écoute la même chose au même moment, sans serveur.", effort: "M", value: 3.5, screens: [RadioCommune] },
];
