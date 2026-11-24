import type { ComponentType } from "react";
import { PausesEnMusique, Reprise, RepriseDashboard, RadioCommune, Promesse, Revue } from "./_mocks-a";
import { EcranVerrouille, SerieADeux, LienSession } from "./_mocks-b";
import { TitresQuiMarchent, GoBlocs } from "./_mocks-c";
import { UnePhrase, Telecommande, Ancrage, Melodie } from "./_mocks-v2a";
import { Agenda } from "./_mocks-v2b";
import { CaleVideo, DernierTrain, Comparaison, PrevenirPause, Passage } from "./_mocks-v2c";

export interface MockEntry { slug: string; name: string; pitch: string; effort: "S" | "M" | "L"; value: number; screens: ComponentType[]; wave?: 1 | 2; status?: "oui" | "non" }

export const MOCKS: MockEntry[] = [
  { wave: 1, status: "oui", slug: "systeme", name: "FocusFlow dans le système", pitch: "Le minuteur dans l'onglet, l'écran verrouillé et les touches média.", effort: "S", value: 4.5, screens: [EcranVerrouille] },
  { wave: 1, status: "non", slug: "reprise", name: "Reprendre là où tu t'es arrêté", pitch: "Une note de reprise et la vidéo au bon endroit.", effort: "S", value: 4.5, screens: [Reprise, RepriseDashboard] },
  { wave: 1, status: "non", slug: "pauses-en-musique", name: "Pauses en musique", pitch: "Des fondus au lieu de coupures, et une musique à soi pendant les pauses.", effort: "M", value: 4.5, screens: [PausesEnMusique] },
  { wave: 1, status: "non", slug: "go-blocs", name: "Go sur tous les blocs", pitch: "Un bloc planifié se lance en un clic quand son heure arrive.", effort: "S", value: 3.5, screens: [GoBlocs] },
  { wave: 1, status: "non", slug: "lien", name: "Partager par lien", pitch: "Une session, une playlist ou une routine dans un lien, sans serveur.", effort: "S", value: 3.5, screens: [LienSession] },
  { wave: 1, status: "non", slug: "titres-qui-marchent", name: "Tes titres qui marchent", pitch: "Les morceaux avec lesquels tu te concentres le mieux, en playlist.", effort: "M", value: 4, screens: [TitresQuiMarchent] },
  { wave: 1, status: "non", slug: "serie-a-deux", name: "Série à deux (et jour de repos)", pitch: "Une série commune avec un ami, et un jour off toléré.", effort: "M", value: 4, screens: [SerieADeux] },
  { wave: 1, status: "non", slug: "revue", name: "Revue du dimanche", pitch: "Trois minutes guidées pour clore la semaine et préparer la suivante.", effort: "M", value: 4, screens: [Revue] },
  { wave: 1, status: "non", slug: "promesse", name: "Promesse aux amis", pitch: "Annoncer un objectif du soir à ses amis, qui voient s'il est tenu.", effort: "M", value: 3.5, screens: [Promesse] },
  { wave: 1, status: "oui", slug: "radio-commune", name: "Radio commune", pitch: "Tout le monde écoute la même chose au même moment, sans serveur.", effort: "M", value: 3.5, screens: [RadioCommune] },
  // Vague 2 (en attente de réponse)
  { wave: 2, slug: "cale-video", name: "Calé sur la vidéo", pitch: "Le minuteur se synchronise sur le rythme incrusté dans les vidéos Study With Me.", effort: "M", value: 4.5, screens: [CaleVideo] },
  { wave: 2, slug: "agenda", name: "Le minuteur qui connaît ton agenda", pitch: "Le pomodoro se raccourcit pour finir avant ta réunion, et reprend après.", effort: "L", value: 4.5, screens: [Agenda] },
  { wave: 2, slug: "passage", name: "Emporter la session sur le téléphone", pitch: "Un QR et la session continue sur le téléphone, même titre à la même seconde.", effort: "L", value: 4, screens: [Passage] },
  { wave: 2, slug: "une-phrase", name: "Lancer en une phrase", pitch: "« 50 min rapport lofi kyoto » dans ⌘K, et la session démarre.", effort: "M", value: 4, screens: [UnePhrase] },
  { wave: 2, slug: "dernier-train", name: "Dernier train", pitch: "Une heure d'arrêt, et les cycles se recalculent pour finir pile.", effort: "S", value: 4, screens: [DernierTrain] },
  { wave: 2, slug: "telecommande", name: "Téléphone télécommande", pitch: "Le téléphone pilote la session de l'ordinateur, sans compte.", effort: "M", value: 3.5, screens: [Telecommande] },
  { wave: 2, slug: "comparaison", name: "Estimer par comparaison", pitch: "On estime une tâche en la plaçant entre deux tâches déjà mesurées.", effort: "M", value: 3.5, screens: [Comparaison] },
  { wave: 2, slug: "melodie", name: "La mélodie de la journée", pitch: "Chaque fin de pomodoro joue la note suivante d'une phrase qui se résout à l'objectif.", effort: "S", value: 3, screens: [Melodie] },
  { wave: 2, slug: "ancrage", name: "Ancrage sonore", pitch: "Un morceau réservé à chaque projet, joué en premier, jamais ailleurs.", effort: "S", value: 3, screens: [Ancrage] },
  { wave: 2, slug: "prevenir-pause", name: "Prévenir à sa pause", pitch: "Un message à un ami en focus part au début de sa pause.", effort: "M", value: 3, screens: [PrevenirPause] },
];
