import type { ComponentType } from "react";
import { PausesEnMusique, Reprise, RepriseDashboard, RadioCommune, Promesse, Revue } from "./_mocks-a";
import { EcranVerrouille, SerieADeux, LienSession } from "./_mocks-b";
import { TitresQuiMarchent, GoBlocs } from "./_mocks-c";
import { UnePhrase, Telecommande, Ancrage, Melodie } from "./_mocks-v2a";
import { Agenda } from "./_mocks-v2b";
import { CaleVideo, DernierTrain, Comparaison, PrevenirPause, Passage } from "./_mocks-v2c";
import { TelephonePosition, Fenetres, MorceauxMixes, AutreEcran, Seuil, SeuilEnCours, SpotifySansPremium, TitrePourToi, RienPerdu, Coller, OrganisationDeuxVues } from "./_mocks-v3";

export interface MockEntry { slug: string; name: string; pitch: string; effort: "S" | "M" | "L"; value: number; screens: ComponentType[]; wave?: 1 | 2 | 3; audace?: number; status?: "oui" | "non" }

export const MOCKS: MockEntry[] = [
  // Vague 3 (en attente de réponse), triée par audace puis valeur
  { wave: 3, audace: 4.5, slug: "telephone-position", name: "Le téléphone se pilote par sa position", pitch: "Retourné, le focus démarre et l'écran devient noir sans couper la musique ; repris en main, pause.", effort: "M", value: 4, screens: [TelephonePosition] },
  { wave: 3, audace: 4.5, slug: "fenetres", name: "Les fenêtres allumées", pitch: "Pendant ta pause, chaque ami encore au travail est une fenêtre allumée dans ta rue.", effort: "M", value: 3, screens: [Fenetres] },
  { wave: 3, audace: 3.5, slug: "morceaux-mixes", name: "Les morceaux dans les mixes", pitch: "Suivant saute au morceau suivant d'un mix d'une heure, et on garde un passage comme un vrai titre.", effort: "M", value: 4, screens: [MorceauxMixes] },
  { wave: 3, audace: 3.5, slug: "autre-ecran", name: "Sur l'autre écran", pitch: "La session s'ouvre en plein écran sur le second moniteur, d'un clic.", effort: "S", value: 3.5, screens: [AutreEcran] },
  { wave: 3, audace: 3, slug: "seuil", name: "La session sans antichambre", pitch: "Plus de page Réglages : on choisit ambiance, rythme et tâche dans la session, même en cours.", effort: "L", value: 5, screens: [Seuil, SeuilEnCours] },
  { wave: 3, audace: 3, slug: "spotify-sans-premium", name: "Ta playlist Spotify, sans Premium", pitch: "Un lien Spotify collé est rejoué titre par titre depuis YouTube.", effort: "M", value: 4.5, screens: [SpotifySansPremium] },
  { wave: 3, audace: 3, slug: "titre-pour-toi", name: "Un titre pour toi", pitch: "Glisser un morceau dans la file d'un ami, qui passe à la fin de son titre en cours.", effort: "S", value: 3, screens: [TitrePourToi] },
  { wave: 3, audace: 2.5, slug: "rien-perdu", name: "Rien n'est perdu", pitch: "Commencé il y a 10 min, levé à 14:52, Terminer par erreur : tout se rattrape en un geste.", effort: "S", value: 4, screens: [RienPerdu] },
  { wave: 3, audace: 2.5, slug: "coller", name: "Coller pour lancer", pitch: "Ctrl V n'importe où avec un lien YouTube, Spotify ou Twitch, et la session part.", effort: "S", value: 4, screens: [Coller] },
  { wave: 3, audace: 2, slug: "organisation-deux-vues", name: "Organisation en deux vues", pitch: "Cinq sous-onglets deviennent Semaine et Projets et tâches, et les tâches ont enfin une page.", effort: "M", value: 3.5, screens: [OrganisationDeuxVues] },
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
