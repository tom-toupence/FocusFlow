# Plan d'implémentation : features validées (2026-11-24)

Ordre choisi pour que chaque lot s'appuie sur le précédent. Chaque lot : `tsc` à 0 erreur, lint au niveau
baseline, `npm test`, build, relecture `code-reviewer`, commit séparé.

| Lot | Contenu | Dépend de | Supabase | État |
|-----|---------|-----------|----------|------|
| 0 | **La session survit à la navigation** : minuteur sur échéance (`endsAt`), session en cours persistée, rattrapage au retour, pastille « Session en cours » + ⌘K « Retour à la session », « Reprendre » n'écrase plus une session | | non | **livré** (relu GO, build + e2e verts) |
| P | **Logique pure** : `lib/agendaFit.ts`, `lib/icsRead.ts`, `lib/radio.ts`, `lib/quickLaunch.ts`, `lib/videoSchedule.ts` + tests | | non | **livré** (85 tests) |
| 1 | **FocusFlow dans le système** (V1 n°1) : titre d'onglet, Media Session (métadonnées, temps restant, play/pause/suivant), élément audio silencieux qui « possède » la session média quand le son vient d'un iframe | 0 | non | en cours |
| 2 | **Lancer en une phrase** (V2 n°8) : ⌘K comprend la phrase, résolution affichée, lancement direct de `/session` ; « Relancer comme la dernière fois » | 0, P | non | en cours |
| 3 | **Dernier train** (V2 n°9) : heure d'arrêt dans `/settings`, durées des cycles issues du plan, objectif atteignable | 0, P | non | à faire |
| 4 | **Agenda** (V2 n°3) : URL iCal privée (locale), route `app/api/calendar/import` (lit sans stocker ni journaliser), proposition visible de raccourcir le cycle, invitation à reprendre après la réunion | 3 | non | à faire |
| 5 | **Calé sur la vidéo** (V2 n°1) : chapitres YouTube via la page watch (route existante + `lib/ytParse.ts`), annotation `schedule` du catalogue, minuteur piloté par `currentTime` | 0, P | non | à faire |
| 6 | **Radio commune** (V1 n°10) : onglet Radio, programme déterministe, lecture à la bonne seconde, « N amis écoutent » si connecté | 0, P | bonus | à faire |
| 7 | **Téléphone télécommande** (V2 n°5) puis **Emporter la session** (V2 n°2) : canal Supabase Realtime broadcast (clé anon, code aléatoire court), routes `/remote/[code]` et `/handoff/[code]` | 0, 1 | **requis** (config app, pas de compte) | à faire |

| 8 | **Les fenêtres allumées** (V3 n°2, variante de l'utilisateur) : chaque ami = une fenêtre fixe de la rue de nuit (pause, mode Spotify), allumée si connecté, plus vive en focus, éteinte hors ligne ; liste des amis avec leur fenêtre et ce qu'ils écoutent | 6 | **requis** pour voir des amis (sans compte : rue inchangée) | en cours |

## Ce qui ne peut pas être vérifié dans le conteneur

- **Téléphone réel** (écran verrouillé, touches média, iOS) : à valider sur appareil.
- **Lots 6 et 7** : il faut `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ Realtime activé)
  pour tester les canaux et la présence entre comptes ; la demande de l'utilisateur pour la Radio est
  de **tester avec plusieurs comptes et vérifier les erreurs en prod**.
- **Calé sur la vidéo** : vérifier les horodatages des vidéos annotées (accès YouTube depuis le conteneur limité).
