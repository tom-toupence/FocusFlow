# Tests à faire à la main (ce que le conteneur ne peut pas vérifier)

Tout le reste est couvert par les tests : `npm test` (369) et `npm run test:e2e` (46, sur un build).

## Sans rien configurer (ordinateur)
1. **Onglet** : lancer une session, changer d'onglet. L'onglet FocusFlow affiche « 18:42 · Focus » et le temps continue.
2. **Touches média** : depuis un autre onglet, lecture/pause du clavier arrête minuteur ET musique ; suivant passe au titre suivant.
3. **Session qui survit** : quitter /session pendant un pomodoro, revenir par la pastille « Session en cours » ou ⌘K « Retour à la session ».
4. **⌘K** : « 50 min » + un titre du catalogue, Entrée : la session démarre direct.
5. **Dernier train** : choisir une heure d'arrêt dans les réglages, vérifier « Arrêt à … » sous le minuteur.
6. **Calé sur la vidéo** : ouvrir une vidéo Abao in Tokyo ou study with japan ; si elle a des chapitres, le bouton « Calé sur la vidéo » apparaît et la pause tombe avec celle de la vidéo. Sinon, l'annoter (`schedule` dans `data/videos.ts`).
7. **Radio** : onglet Radio, « Rejoindre », puis ouvrir la même radio sur un 2e appareil : même vidéo, même seconde.
8. **Agenda** : coller l'adresse iCal privée (Google : Paramètres de l'agenda, « Adresse secrète au format iCal ») dans le profil, Tester, puis créer une réunion dans 20 min et lancer une session : le pomodoro est raccourci.

## Sur téléphone
9. **Écran verrouillé** (Android Chrome, iPhone Safari) : lancer une session, verrouiller. Minuteur, titre et miniature visibles ; lecture/pause pilote les deux. **iPhone** : vérifier que la musique YouTube ne se coupe pas (sinon passer `SILENT_AUDIO_WORKAROUND` à false dans `lib/useMediaSession.ts`).

## Avec Supabase configuré (+ Realtime activé)
10. **Télécommande** : en session, bouton Télécommande, scanner le QR, comparer le code de confirmation à 4 chiffres des deux côtés, Autoriser ; Pause / Distraction / Suivant depuis le téléphone.
11. **Emporter la session** : « Continuer sur le téléphone », Autoriser ; le téléphone reprend au même temps et au même titre (« Toucher pour reprendre » sur iPhone), l'ordinateur s'arrête.
12. **Ta rue** (2 comptes amis) : A en pause sur la façade, B se connecte : sa fenêtre s'allume ; B lance une session : plus vive ; B ferme : éteinte sous 2 min.
13. **Radio entre amis** : B rejoint la radio, A voit « 1 ami écoute en ce moment ».
