# FocusFlow — Vision : les grosses features à venir

> Ce document propose des **features de grande ampleur** (chacune ≈ un chantier conséquent),
> de l'ordre de **~50 % de fonctionnalités nouvelles** par rapport à l'app actuelle.
> Ce sont des **idées détaillées et priorisées**, pas une implémentation.
>
> Contexte actuel (déjà livré) : timer Pomodoro multi-presets, lecteur multi-sources
> (YouTube vidéos/playlists, Spotify, Twitch), tâches Kanban, stats & heatmap, post-its,
> profil Supabase, thèmes, **mixeur d'ambiances Web Audio**, **respiration guidée**,
> **objectif quotidien**, **succès/badges**, **distractions & Focus Score**.

---

## Vue d'ensemble & priorisation

| # | Feature | Impact | Effort | Dépend de | Statut |
|---|---------|--------|--------|-----------|--------|
| 1 | Focus Rooms collaboratives (temps réel) | 🔥🔥🔥 | XL | Supabase Realtime | À faire |
| 2 | Dashboard analytique + rapports & export | 🔥🔥 | L | Sync comptes | ✅ **Livré** (`/insights`) |
| 3 | Coach IA & découpage de tâches | 🔥🔥🔥 | L | Clé Groq/Gemini (gratuit) | ✅ **Livré** (local + IA) |
| 4 | Intégrations agenda/tâches (Calendar, Notion, Todoist) | 🔥🔥 | L | OAuth apps | ◐ **Partiel** (export calendrier ICS livré) |
| 5 | Bloqueur de distractions (PWA + extension) | 🔥🔥 | XL | Extension navigateur | À faire |
| 6 | Gamification 2.0 : XP, niveaux, jardin de focus | 🔥🔥 | M | Badges existants | ✅ **Livré** (onglet Activité) |
| 7 | Marketplace d'ambiances & playlists communautaires | 🔥 | L | Comptes + storage | À faire |

> **Livrés** : Dashboard analytique (#2 → `/insights`), Gamification 2.0 (#6), Coach IA (#3 → Groq/Gemini
> avec repli local), et — session 2026-06-10 — **5 nouvelles grosses features** : mode **Flowtime**,
> **timer flottant Picture-in-Picture**, **récap hebdo « Wrapped »** (`/wrapped` + carte PNG),
> **synchro calendrier auto** (flux ICS `webcal://`, iPhone/Google Calendar, partie « Calendar » du #4),
> **mode Deadline/Sprint** (plan jour-par-jour par le coach + bouton « Go »).
> Refusées par l'utilisateur (2026-06-10) : Mode Strict, PWA offline, Focus Rooms, Smart Focus, capture rapide.

---

## 1. Focus Rooms collaboratives (temps réel)

**Pitch.** Des salles de focus partagées : plusieurs personnes lancent un Pomodoro
synchronisé, voient la présence des autres, leurs tâches en cours et un chat léger.
C'est le « body-doubling » qui marche si bien sur Study-With-Me et Discord, mais
intégré nativement à FocusFlow.

**Cœur fonctionnel.**
- Créer/rejoindre une room via code ou lien (`/room/[code]`).
- **Timer synchronisé** piloté par l'hôte (ou voté), même cycle work/break pour tous.
- Liste de présence en temps réel : avatar, statut (focus / pause), pomodoros du jour.
- Mur de tâches « en cours » optionnel (chacun partage sa tâche active).
- Chat minimaliste + réactions, désactivable pour les rooms « silencieuses ».
- Rooms publiques thématiques (Étude, Dev, Écriture) et rooms privées entre amis.

**Technique.**
- **Supabase Realtime** (Postgres changes + Presence + Broadcast) — déjà dans la stack.
- Nouvelle table `rooms` + `room_members` + `room_events`; RLS par membre.
- Source horloge serveur (timestamp d'échéance partagé) pour éviter les dérives client.
- Réutilise `timerStore` en mode « contrôlé » (l'état vient de la room, pas du local).

**Pourquoi maintenant.** C'est le différenciateur produit le plus fort vs Pomofocus/Lofi
Girl, et il transforme l'app solo en réseau social de productivité.

---

## 2. Dashboard analytique avancé + rapports & export

**Pitch.** Passer des stats actuelles (heatmap, top lectures) à un vrai **tableau de bord**
analytique avec tendances, comparaisons et rapports exportables.

**Cœur fonctionnel.**
- Page `/insights` dédiée : focus par heure de la journée, par jour de semaine,
  par projet/tag, évolution du **Focus Score** et de la précision d'estimation
  (pomodoros estimés vs réels — les champs `pomodoroEstimate`/`pomodorosUsed` existent déjà).
- **Rapports hebdo/mensuels** générés automatiquement (« Tu as fait 18 % de plus que
  la semaine dernière, tes meilleures heures sont 9h-11h »).
- **Export CSV / JSON / PDF** des sessions et des stats.
- Objectifs hebdomadaires/mensuels en plus du quotidien déjà livré.
- Email récap hebdomadaire (via Supabase Edge Function + cron).

**Technique.**
- Étendre `statsStore` + `playHistoryStore` (déjà persistés) ; agrégations côté client
  pour le MVP, puis vues SQL/Edge Functions pour le multi-appareils.
- PDF via génération côté client (canvas) ou Edge Function.

---

## 3. Coach IA & découpage automatique des tâches

**Pitch.** Un assistant qui transforme un objectif flou (« réviser l'examen de bio »)
en **plan de tâches Pomodoro estimées**, et qui coache l'utilisateur au fil des sessions.

**Cœur fonctionnel.**
- Champ « Décris ton objectif » → l'IA propose une liste de sous-tâches avec
  **estimation en pomodoros** par tâche, alimentant directement le Kanban existant.
- Suggestions de re-planification quand les estimations dérapent (« cette tâche t'a pris
  3 pomodoros au lieu d'1, je décale le reste »).
- Résumé de fin de journée / de semaine rédigé par l'IA à partir des stats.
- Suggestions d'ambiance selon le type de tâche (deep work → vagues + bruit brun).

**Technique.**
- **API Claude** (`claude-opus-4-8` pour la qualité de planification, `claude-haiku-4-5`
  pour les petites suggestions à faible latence/coût).
- Appels via une **Edge Function** Supabase pour ne jamais exposer la clé API au client.
- Tool-use structuré : l'IA renvoie un JSON `{ tasks: [{ text, pomodoroEstimate }] }`
  inséré tel quel via `addTodo`.

> ℹ️ Voir `/claude-api` (skill) pour les ids de modèles, le tool-use et la mise en cache.

---

## 4. Intégrations agenda & gestionnaires de tâches

**Pitch.** FocusFlow devient le point d'exécution de ce qui est déjà planifié ailleurs.

**Cœur fonctionnel.**
- **Google Calendar** : importer les événements du jour comme blocs de focus ;
  écrire en retour les sessions réalisées (« Focus : 3 pomodoros » sur l'agenda).
- **Notion / Todoist** : importer des tâches comme todos de session, cocher en retour.
- « Planifie ma journée » : poser des blocs Pomodoro sur des créneaux libres de l'agenda.

**Technique.**
- OAuth (le projet gère déjà Google, Spotify, Twitch — même pattern de callback
  dans `app/auth/*`).
- Connecteurs isolés dans `lib/integrations/*`, synchro via Edge Functions.

---

## 5. Bloqueur de distractions (PWA + extension compagnon)

**Pitch.** Pendant un Pomodoro de focus, bloquer activement les sites distractifs —
le chaînon manquant entre « lancer un timer » et « rester concentré ».

**Cœur fonctionnel.**
- Liste noire/blanche de sites, activée automatiquement pendant le focus, levée en pause.
- Mode strict (impossible d'arrêter avant la fin) optionnel.
- Statistiques « tentatives bloquées » intégrées au **Focus Score** existant.
- Notifications/rappels recentrage si l'onglet perd le focus trop longtemps.

**Technique.**
- **Extension navigateur** (Manifest V3) communiquant avec l'app via `postMessage` /
  un petit backend ; l'app reste la source de vérité de l'état du timer.
- Volet **PWA** : installable, notifications, fonctionnement hors-ligne du timer.

---

## 6. Gamification 2.0 : XP, niveaux & jardin de focus

**Pitch.** Étendre les badges déjà livrés en une vraie boucle de progression motivante.

**Cœur fonctionnel.**
- **XP & niveaux** : chaque pomodoro/objectif rapporte de l'XP ; paliers déblocables
  (thèmes, ambiances, avatars).
- **Jardin / ville de focus** façon Forest : un élément visuel qui pousse à chaque
  session complétée et se fane si on abandonne — récompense émotionnelle.
- **Défis & ligues** entre amis (classement hebdo de temps de focus), opt-in.
- Quêtes hebdomadaires (« 5 jours d'affilée », « 1 deep work »).

**Technique.**
- S'appuie sur `achievementsStore` + `statsStore` existants ; nouveau `progressionStore`.
- Le jardin = composant SVG/Canvas piloté par le nombre de sessions.

---

## 7. Marketplace d'ambiances & playlists communautaires

**Pitch.** Ouvrir le catalogue : les utilisateurs partagent leurs mixes d'ambiances
(réglages du mixeur Web Audio) et leurs playlists curatées.

**Cœur fonctionnel.**
- Publier un **preset d'ambiance** (combinaison pluie/vagues/vent + volumes) ou une
  playlist, avec titre, tags d'humeur (concentré/créatif/détendu) et aperçu.
- Parcourir/voter/cloner les presets de la communauté en un clic.
- Collections officielles « curated » par mood (rejoint la roadmap V2 tags par mood).

**Technique.**
- Tables `shared_soundscapes` / `shared_playlists` + RLS ; le mixeur sérialise déjà
  son état (`useSoundscapeStore.layers`) — il suffit de l'exposer en import/export.

---

## Fondations transverses à prévoir

Ces chantiers UI s'appuient sur des bases communes à renforcer :

- **Comptes & sync multi-appareils complète** : la couche Supabase (`lib/db.ts`) existe
  déjà en no-op ; généraliser la synchro à *tous* les stores (goal, distractions, succès,
  ambiances) avec résolution de conflits offline-first.
- **PWA / offline-first** : service worker, installation, notifications natives.
- **Internationalisation** : l'app est en français ; extraire les chaînes pour l'i18n.
- **Accessibilité** : navigation clavier complète, ARIA, respect de `prefers-reduced-motion`
  (notamment pour la respiration guidée et le jardin de focus).

---

### Ordre de déploiement recommandé

1. **Coach IA (#3)** — fort effet « waouh », effort maîtrisé, valorise les estimations déjà en place.
2. **Dashboard & rapports (#2)** — capitalise sur les données déjà collectées.
3. **Focus Rooms (#1)** — le différenciateur produit, à lancer une fois la base comptes solide.
4. **Intégrations (#4)** & **Gamification 2.0 (#6)** en parallèle.
5. **Bloqueur de distractions (#5)** & **Marketplace (#7)** pour fidéliser sur le long terme.
