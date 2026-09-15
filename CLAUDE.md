@AGENTS.md

# FocusFlow — Notes pour Claude

## Contexte du projet

Application web de productivité combinant un **timer Pomodoro** et un **lecteur multi-sources**
(catalogue de vidéos YouTube lofi/chill, playlists YouTube, Spotify Premium, streams/VOD Twitch).
Objectif : aide à la concentration, gratuit et public, déployé sur Vercel.

> ⚠️ Ce fichier décrit l'état **réel** du projet (bien au-delà du MVP initial). Le code fait foi ;
> mets ce document à jour quand l'architecture évolue.

## Analyse marché (résumé)

Concurrents proches : Lofidoro, Lofi Girl Extension, Pomofocus, Nesto, Foci, Lofizen.
Gap principal : aucune app ne combine proprement catalogue curated + Pomodoro solide + stats +
ambiances mixables dans une seule expérience bien maintenue.

## Stack technique

- **Framework :** Next.js **16** (App Router, Turbopack) + React **19** + TypeScript
- **Styles :** Tailwind CSS **v4** (tokens `foreground`/`background`/`card`, helper `cn()` dans `lib/utils`)
- **State :** Zustand **v5** + middleware `persist` (une clé `focusflow-*` par store)
- **Auth & sync :** Supabase (Google OAuth + tables `custom_videos`, `todos`, `user_playlists`,
  `profiles`, `work_sessions`, `projects`, `user_state`, `local_playlists`, + amis `public_profiles`/
  `friendships`/`friend_stats`). Tout passe par `lib/db.ts`/`lib/friends.ts`, **no-op si Supabase non
  configuré** (mode localStorage seul). ⚠️ Au **changement de compte** sur un navigateur, le localStorage
  est purgé avant merge (`resetLocalDataIfAccountChanged`) — sinon contamination entre comptes.
- **YouTube :** IFrame API (embed direct, aucune clé requise pour la lecture).
  - **Vraies playlists** (`PL/OL/UU/FL/LL/RDCLAK`) : `player.loadPlaylist({list, listType})` dans `onReady`
    + `setLoop(true)` (jamais `videoId`+`list` combinés dans le constructeur → sinon autoplay aléatoire).
  - **Mixes radio `RD…`** : personnalisés/non embarquables → résolus en liste de videoIds via la route
    `app/api/youtube/mix` (parse `ytInitialData`), puis joués via **file maison** (cf. ci-dessous).
  - **File maison** (mixes radio + **File FocusFlow**) : YouTube n'enchaîne pas de façon fiable une liste
    d'IDs arbitraires en embed → on gère la progression nous-mêmes (`onStateChange` ENDED → `loadVideoById`
    du suivant ; `queueRef`). Skip via cette file ou `nextVideo()`/`previousVideo()` (vraies playlists).
- **File FocusFlow :** liste ORDONNÉE de vidéos YouTube choisies par l'utilisateur (titres exacts,
  contrôle total), seule façon fiable d'avoir SES morceaux (les radios `RD…` étant personnalisées).
  `store/queueStore.ts` (+ `fetchVideoMeta` oEmbed), UI `components/QueuePanel.tsx` (onglet Bibliothèque),
  sélection via `sessionStore.selectQueue()` / flag `playQueue`. Lecture = file maison ci-dessus.
- **Spotify :** OAuth + Web Playback (Premium), helpers dans `lib/spotify.ts`
- **Twitch :** OAuth + embed live/VOD, helpers dans `lib/twitch.ts` (+ route `app/api/twitch/token`)
- **Audio :** sons de transition générés en **Web Audio API** (aucun fichier audio)
- **Notifications :** Web Notifications API
- **Coach IA (optionnel) :** route serveur `app/api/coach/route.ts` multi-fournisseur **Groq → Gemini → repli local**.
  Clés **uniquement côté serveur** (`GROQ_API_KEY` / `GEMINI_API_KEY`), jamais envoyées au client.
  Sans clé, le coach utilise le **planificateur heuristique local** (`lib/coach.ts`) — toujours gratuit.
- **Deploy :** Vercel (gratuit)

## Navigation (refonte ergonomie — Lot 2)

Navigation simplifiée à **4 destinations** (au lieu de 7 onglets) via une **nav persistante** :
**sidebar verticale** (desktop) + **barre d'onglets basse** (mobile) — `components/AppNav.tsx`,
pilotée par `store/navStore.ts` (`section` : accueil / ecouter / organisation / activite).
La section **Écouter** regroupe les 4 sources média (Catalogue · Ma bibliothèque · Spotify · Twitch)
derrière un **sous-sélecteur** (`MediaTab` dans `app/page.tsx`, `navStore.mediaSource`).
**Palette de commandes ⌘K / Ctrl+K** globale (`components/CommandPalette.tsx`, montée dans `layout.tsx`)
pour sauter à toute section/action au clavier. `app/page.tsx` dérive l'ancien `activeTab` de `navStore`
(blocs de contenu inchangés).

## Flux principal (routes)

`/` (accueil — 4 sections : **Aujourd'hui** (dashboard, défaut) / **Écouter** [Catalogue · Bibliothèque ·
Spotify · Twitch] / **Organisation** / **Activité**)
→ `/settings` (choix du preset Pomodoro + tâches Kanban + Coach + « enregistrer comme routine »)
→ `/session` (plein écran : lecteur + timer + tâches + post-its + respiration)
→ `/summary` (résumé + objectif + focus score + **réflexion/journal** + stats)
→ `/insights` (statistiques détaillées : focus par heure/jour, évolution du Focus Score, export CSV/JSON)
→ `/wrapped` (récap hebdo « Wrapped » + carte PNG partageable).
Routes API : `app/api/twitch/token`, `app/api/coach` (tâches **et** plans sprint),
`app/api/calendar/[token]` (flux ICS public, service role). Auth callbacks dans `app/auth/*`.

**Démarrer une session** depuis le dashboard renvoie au **Catalogue** (« Choisis ton ambiance ») pour
choisir le média, qui enchaîne sur `/settings`. Les **routines** appliquent leur média et vont direct à `/settings`.

## Fonctionnalités implémentées

**Cœur**
- Timer Pomodoro configurable (presets `classic` / `deep` / `custom` / **`flowtime`**, work / short-break /
  long-break, sessions avant pause longue)
- **Mode Flowtime** : chrono croissant sans limite, pause méritée = temps ÷ 5 (bornée 2–25 min) —
  `flowSeconds` / `finishFlow()` / `accumulateFlow()` dans `store/timerStore.ts`
- **Timer flottant** Picture-in-Picture (Document PiP, Chrome/Edge ; bouton masqué ailleurs) :
  mini-fenêtre toujours au premier plan avec pause / distraction / fin de flow — `components/PipTimer.tsx`
- Lecteur multi-sources : YouTube vidéos + playlists, Spotify, Twitch live/VOD
- Catalogue curated par mood + **bibliothèque perso** (vidéos & playlists custom, synchro Supabase)
- Tâches **Kanban** (statuts todo/in-progress/done, priorité, estimation & compteur de pomodoros)
- Post-its déplaçables pendant la session
- Profil (Google OAuth + nom/avatar custom), thèmes dark/light
- Notifications + sons de transition (Web Audio)

**Stats, historique & insights**
- Stats jour / semaine, streak, meilleur jour, totaux, **heatmap 17 semaines** (`statsStore`)
- Historique de lecture + **top lectures** (`playHistoryStore`)
- **Dashboard analytique** `/insights` : focus par heure/jour, évolution du Focus Score, précision
  d'estimation, comparaison semaine vs S-1, **export CSV/JSON** (`lib/export.ts`)
- **Récap hebdo « Wrapped »** `/wrapped` : minutes/sessions vs S-1, meilleur jour, heure de pointe,
  top lecture, badges, humeur ; **carte 1080×1350 en Canvas 2D natif** téléchargeable en PNG —
  `lib/wrapped.ts`, `components/WrappedShareCard.tsx`, bannière du lundi via `store/wrappedStore.ts`

**Focus & bien-être (méthode Pomodoro)**
- ~~Mixeur d'ambiances (bruits de fond)~~ **supprimé le 2026-07-09** à la demande de l'utilisateur
  (feature jugée inutile) : `lib/soundscapes.ts`, `store/soundscapeStore.ts`, `SoundscapeMixer.tsx`
  effacés ; champ `soundscape` retiré du type `Routine`. Ne pas la re-proposer.
- **Respiration guidée** box-breathing 4-4-4-4 pendant les pauses — `components/BreathingExercise.tsx`
- **Objectif quotidien** configurable (minutes **ou** pomodoros) + anneau + célébration —
  `store/goalStore.ts`, `components/GoalRing.tsx`
- **Distractions + Focus Score** (marquer les interruptions ; raccourci `D`, `Espace` = pause) —
  `store/distractionStore.ts`. Panneau d'aide « ? » + flash visuel dans la session.

**Gamification**
- **Succès / Badges** dérivés des stats — `lib/achievements.ts`, `store/achievementsStore.ts`
- **Gamification 2.0** : XP & niveaux, **jardin de focus** hebdo, **défis hebdomadaires** —
  `lib/progression.ts`, `components/ProgressionPanel.tsx` (onglet Activité)
- **Toasts** partagés (montés dans `app/layout.tsx`) — `components/Toast.tsx`

**Organisation (onglets « Aujourd'hui » & « Organisation »)**
- **Tableau de bord « Aujourd'hui »** (command center) — `components/TodayDashboard.tsx`
- **Routines de session** : capturer durées + ambiance + média + tâches, relancer en 1 clic —
  `store/routineStore.ts`, `lib/routines.ts`, `components/RoutineSaveModal.tsx` + `RoutinesManager.tsx`
- **Projets & deadlines** : budget de pomodoros, rythme/jour calculé, suivi ; le **projet actif**
  s'incrémente à chaque pomodoro terminé — `store/projectStore.ts`, `components/ProjectsSection.tsx`
- **Planning hebdo (time-blocking)** : blocs de focus par jour, prévu vs réalisé —
  `store/planStore.ts` (synchro Supabase `plan_blocks`), `components/WeekPlanner.tsx`
- **Synchro calendrier auto (export-only)** : abonnement `webcal://…/api/calendar/<token>` →
  les blocs apparaissent sur iPhone/Google Calendar avec rappel −10 min (VALARM). Nécessite
  login + `SUPABASE_SERVICE_ROLE_KEY` (serveur) ; sinon repli **téléchargement `.ics`** —
  `lib/ics.ts`, `components/CalendarSync.tsx`, table `calendar_feeds`
- **Mode Deadline/Sprint** : objectif + date limite → le coach (IA ou local `lib/sprint.ts`)
  génère blocs jour-par-jour (préfixés 🏃, donc poussés au calendrier) + tâches Kanban + mood
  musical ; bouton **« Go »** (dashboard) qui applique média du mood + preset et lance `/session` ;
  recalcul si blocs manqués — `store/sprintStore.ts`, `components/SprintWizard.tsx`
- **Journal & humeur** : réflexion post-session (😞→😄 + réussites/blocages), corrélation humeur ↔ focus —
  `store/journalStore.ts`, `components/JournalReflection.tsx` (résumé) + `JournalTimeline.tsx`

**Coach de planification**
- Objectif texte → tâches Pomodoro estimées, ajoutées au Kanban — `components/CoachModal.tsx`
- **Local** par défaut (`lib/coach.ts`, heuristique, gratuit/hors-ligne) ; **IA** si une clé serveur est
  configurée (`app/api/coach/route.ts` : Groq puis Gemini, sinon repli local).

## Roadmap (idées non implémentées)

Voir **`docs/FUTURE_FEATURES.md`**. **Déjà livré** : dashboard analytique (`/insights`), gamification 2.0,
coach (local + IA via free tier), Flowtime, timer PiP, Wrapped hebdo, synchro calendrier ICS, mode Sprint.
**Restant** : Focus Rooms temps réel (Supabase Realtime), intégrations Notion/Todoist, bloqueur de
distractions (PWA + extension), marketplace d'ambiances.
**Refusées par l'utilisateur (2026-06-10)** : Mode Strict / détection auto de distraction, PWA offline,
Focus Rooms (à réessayer ?), Smart Focus IA, capture rapide d'idées.

## Préférences utilisateur

- App **gratuite** pour tout le monde, pas de monétisation dans un premier temps
- **Open source** (GitHub) — optionnel mais recommandé
- Fonctionne **sans compte** (localStorage) ; Supabase ajoute la sync multi-appareils sans être obligatoire
- Priorité produit : **timer + lecteur ensemble** dans la même vue plein écran

## Équipe d'agents (`.claude/agents/`)

Des sous-agents spécialisés sont définis pour faire évoluer l'app. À invoquer selon la tâche
(voir le `description` de chacun) ; **toujours faire relire une feature par `code-reviewer`** avant de la
considérer terminée.

| Agent | Rôle |
|-------|------|
| `product-lead` (opus) | Cadrage produit, découpage roadmap, build-vs-skip (connaît les features refusées) |
| `frontend-engineer` | UI React/Tailwind, composants, animations, a11y |
| `backend-engineer` | Routes `app/api/*`, Supabase via `lib/db.ts`, OAuth, coach/sprint IA, ICS, secrets serveur |
| `state-architect` | Stores Zustand (`persist`/`partialize`/`migrate`) + logique pure `lib/` |
| `qa-tester` | Validation empirique : typecheck/lint/build + scénarios manuels |
| `code-reviewer` | Relecture read-only (correction, hydratation, local-first, secrets, conventions) |

Flux type d'une feature : `product-lead` (spec) → `state-architect`/`backend-engineer`/`frontend-engineer`
(implémentation) → `qa-tester` (validation) → `code-reviewer` (GO/NO-GO).

## Conventions de code

- Composants **`"use client"`** + Zustand `persist` ; lire un store persisté côté UI via le pattern
  `mounted` (`useEffect` au montage) pour éviter les mismatchs d'hydratation (cf. `StatsSection.tsx`).
- Écritures DB optionnelles : appeler les helpers de `lib/db.ts` (no-op sans Supabase), jamais Supabase
  en direct depuis un composant.
- Icônes **SVG inline** (pas d'images), styles via tokens Tailwind + `cn()`.
- Dates locales : helper `localToday()` / `localDate()` (format `YYYY-MM-DD`).

### Langage visuel (refonte 2026-08-22)

- **Deux surfaces, deux langages assumés.** La **landing** (`LandingPage.tsx`) est sombre et
  cinématique (night city, blancs/noirs écrits en dur) : elle n'utilise **jamais** les tokens
  `foreground`/`background`. Le **site connecté** vit entièrement sur les tokens et suit le thème.
- **Un seul accent dans l'app** : token `--focus` (utilitaires `text-focus` / `bg-focus` /
  `border-focus`), défini clair et sombre dans `globals.css`. Tout le reste s'exprime en niveaux de
  `foreground`. Restent légitimes car **sémantiques** : couleurs de marque (Spotify/Twitch), couleur
  choisie par l'utilisateur (projets, routines), pastilles d'humeur, rouge destructif.
- **Échelle de rayons** : panneaux/tuiles `rounded-2xl`, cartes média `rounded-xl`, contrôles
  `rounded-lg`/`rounded-xl`. Ne pas mélanger.
- **Micro-labels** : `font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/35` (unifié
  partout). Les **chiffres** sont en `font-mono tabular-nums`.
- **Sous-navigations** = contrôle segmenté avec indicateur qui glisse (`motion` `layoutId`) :
  `SubTabs`, `MediaTab`, rail `AppNav`. Un `layoutId` par instance (cf. `useId()` dans `SubTabs`).
- **Mouvement motivé uniquement** : cascade d'entrée (hiérarchie), barres/jauges qui poussent (le
  chiffre devient forme), pression tactile au clic. Toujours dégradé via `useReducedMotion()` ou
  `motion-safe:`. Pas d'animation en boucle décorative dans l'app (la landing, elle, est
  volontairement très animée).
- **Moteur d'animation unique : `motion/react`.** Ne pas ajouter GSAP : `CityBackdrop` et la landing
  pilotent déjà le scroll avec `useScroll`, deux moteurs se disputeraient les frames.
- **Position du pointeur = MotionValue, jamais un `useState`** (sinon re-render de l'arbre à chaque
  pixel parcouru).
- **Densité du dashboard : basse (3/10)** — voir l'en-tête de `TodayDashboard.tsx`. Avant d'ajouter
  une tuile, se demander laquelle retirer.
- **Zéro em-dash (`—`) dans les textes visibles** (et toujours zéro emoji) : virgule, point, ou
  passage à la ligne.

## Structure des fichiers clés

```
focusflow/
├── app/
│   ├── layout.tsx              # Layout global (thème, SupabaseProvider, AuthGate, ToastHost)
│   ├── page.tsx                # Accueil : onglets Aujourd'hui/Catalogue/Biblio/Spotify/Twitch/Activité/Organisation
│   ├── settings/page.tsx       # Preset Pomodoro + Kanban + Coach + enregistrer routine
│   ├── session/page.tsx        # Session plein écran (lecteur + timer + tâches + respiration + distractions)
│   ├── summary/page.tsx        # Résumé + objectif + focus score + réflexion/journal + stats
│   ├── insights/page.tsx       # Statistiques détaillées + export CSV/JSON
│   ├── wrapped/page.tsx        # Récap hebdo « Wrapped » + carte PNG
│   ├── auth/*                  # Callbacks OAuth (Google, Spotify, Twitch) — Spotify gère access_denied
│   └── api/{twitch/token,coach,calendar/[token]}/route.ts   # secrets côté serveur uniquement
├── components/
│   ├── TodayDashboard.tsx · ProjectsSection.tsx · WeekPlanner.tsx · RoutinesManager.tsx · RoutineSaveModal.tsx
│   ├── SprintWizard.tsx · CalendarSync.tsx · PipTimer.tsx · WrappedShareCard.tsx
│   ├── JournalReflection.tsx · JournalTimeline.tsx · CoachModal.tsx · ProgressionPanel.tsx
│   ├── BreathingExercise.tsx · GoalRing.tsx · Toast.tsx · StatsSection.tsx
│   ├── StickyNote.tsx · TodoStatusDropdown.tsx · ProfilePanel.tsx · SpotifyPlayer.tsx · TwitchPlayer.tsx · …
├── store/                      # Zustand : timer, session, sessionSummary, stats, playHistory, notes,
│   │                           #   profile, theme, spotify, twitch, playlist, goal,
│   │                           #   achievements, distraction, prefs, routine, project, plan, journal,
│   │                           #   sprint, wrapped
├── lib/                        # utils, supabase, db, sounds, achievements, spotify, twitch,
│   │                           #   coach, routines, export, progression, sprint, ics, wrapped
└── data/
    └── videos.ts               # Catalogue curated + helpers (moods, extraction d'ID YouTube)
```

## Variables d'environnement

Voir `.env.local.example`. Toutes **optionnelles** (l'app marche en localStorage seul, coach local) :
`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` (sync), `SUPABASE_SERVICE_ROLE_KEY` (flux calendrier ICS, serveur
uniquement), `NEXT_PUBLIC_SPOTIFY_*`, `NEXT_PUBLIC_TWITCH_*` + `TWITCH_CLIENT_SECRET`,
`GROQ_API_KEY` (coach IA gratuit, recommandé) / `GEMINI_API_KEY` (+ `GROQ_MODEL` / `GEMINI_MODEL` optionnels).

## Journal de session — 2026-06-10 (récap des ajouts)

Grosse session d'extension. Tout est **gratuit / local-first** (Zustand + `persist`), build vert à chaque étape.

1. **5 features Pomodoro** : mixeur d'ambiances Web Audio, respiration guidée, objectif quotidien
   (minutes/pomodoros), succès/badges, distractions + Focus Score. Système de **toasts** partagé.
2. **Gamification 2.0** : XP & niveaux, jardin de focus, défis hebdo (`lib/progression.ts`, `ProgressionPanel`).
3. **Dashboard analytique** `/insights` + **export CSV/JSON** (`lib/export.ts`).
4. **Refonte UX session** : contrôles regroupés (cluster d'icônes + pills), badge/flash de distraction,
   panneau d'aide « ? », raccourcis `D` (distraction) et `Espace` (pause).
5. **Coach de planification** : local heuristique (`lib/coach.ts`), puis **route serveur multi-fournisseur**
   `app/api/coach` (Groq → Gemini → repli local). Clés serveur uniquement. Gemini free tier souvent
   limité/0 en UE → **Groq recommandé** (gratuit, sans CB). Schéma JSON Gemini en MAJUSCULES (`OBJECT`…).
6. **UX Spotify** : capture de `access_denied` au callback (mode développement) → message clair
   « demande à l'admin de t'ajouter dans le Dashboard » au lieu d'un retour silencieux.
7. **5 grosses features d'organisation** : Tableau de bord « Aujourd'hui », Routines de session,
   Projets & deadlines, Planning hebdo (time-blocking), Journal & humeur. Nouveaux onglets
   **Aujourd'hui** (défaut) et **Organisation**. « Démarrer une session » passe par le Catalogue
   pour laisser choisir le média.

Détail des grosses features à venir et de ce qui reste : `docs/FUTURE_FEATURES.md`.

## Journal de session — 2026-06-10 (2e vague : 5 grosses features validées Oui/Non)

Propositions soumises une par une à l'utilisateur ; refusées : Mode Strict, PWA offline, Focus
Rooms, Smart Focus, capture rapide. Validées et livrées (build + lint verts à chaque étape) :

1. **Flowtime** (4e preset) : chrono croissant, « Pause méritée » = temps ÷ 5 borné 2–25 min.
   `timerStore` : `flowSeconds` / `flowMinutesTotal` / `flowBreakTotal`, actions `finishFlow()`
   (banque les minutes + lance la pause) et `accumulateFlow()` (sortie mi-flow). Stats/XP/projets
   crédités des minutes réelles.
2. **Timer flottant PiP** (`PipTimer.tsx`) : Document Picture-in-Picture (Chrome/Edge), portal
   React dans la fenêtre PiP + copie des stylesheets ; bouton masqué si API absente.
3. **Wrapped hebdo** : `/wrapped` (semaine passée/en cours), agrégats dans `lib/wrapped.ts`,
   carte PNG 1080×1350 dessinée en Canvas 2D natif (zéro dépendance). Bannière du lundi sur le
   dashboard tant que non vue (`wrappedStore.lastSeenWeekStart`).
4. **Synchro calendrier (export-only, voulu minimal par l'utilisateur)** : `plan_blocks` +
   `calendar_feeds` (token secret) dans Supabase, route publique `app/api/calendar/[token]`
   (client **service role**, params Next 16 = `Promise`), ICS avec VALARM −10 min et
   X-PUBLISHED-TTL 30 min. UI `CalendarSync.tsx` (modal webcal:// + instructions iPhone/Google,
   repli téléchargement .ics sans compte). `planStore.addBlock` retourne désormais l'id.
5. **Mode Deadline/Sprint** : `app/api/coach` accepte `{type:"sprint"}` → JSON
   `{days[], tasks[], mood}` validé/borné ; repli local `lib/sprint.ts` (répartition uniforme +
   mood par mots-clés). `SprintWizard.tsx` (Organisation) : formulaire → aperçu → valider
   (blocs 🏃 dans le planning → calendrier, tâches au Kanban). Carte sprint sur le dashboard avec
   **bouton « Go »** : vidéo aléatoire du catalogue dans le mood du coach + preset deep/classic
   selon la durée du bloc → `/session` direct. Recalcul des blocs manqués ; `sessionStore.addTodo`
   retourne l'id.

## Journal de session — 2026-06-29 (fix playlist YouTube + équipe d'agents)

1. **Fix lecture des playlists / mixes YouTube** (`app/session/page.tsx`) : le constructeur passait
   `videoId` **et** `list` simultanément → le player jouait la vidéo seed puis l'autoplay « vidéos
   liées » (aléatoire, hors playlist). Pour les **vraies playlists** (`PL/OL/UU/FL/LL/RDCLAK`) : corrigé
   via **`player.loadPlaylist({ list, listType:"playlist" })` dans `onReady`** + `setLoop(true)`.
2. **Mixes radio `RD…` (Lot 1, grosse MAJ)** : ces radios sont **personnalisées et non embarquables**
   (l'API IFrame renvoie des recommandations génériques ≠ les morceaux). Solution : nouvelle route
   serveur **`app/api/youtube/mix`** qui fetch la page watch et parse `ytInitialData`
   (`playlistPanelVideoRenderer.videoId`) → liste ordonnée de videoIds (≈25), sans clé API ni login.
   Côté session, résolution à chaque démarrage (state local `mixIds`, non persisté = frais) puis lecture
   comme **file contrôlable** via `loadPlaylist(idsArray)` + `setLoop(true)`. Repli : vidéo de départ en
   boucle + toast si la résolution échoue. Helpers `isRadioMix()` / `fetchMixVideoIds()` dans
   `store/playlistStore.ts` ; note honnête dans `AddPlaylistModal` (`app/page.tsx`).
3. **Skip de titres** : boutons précédent/suivant dans le cluster de contrôles de session (mode
   playlist), branchés sur `nextVideo()` / `previousVideo()`. Interface `YTPlayer` étendue
   (`nextVideo`, `previousVideo`, `loadPlaylist` forme objet **ou** tableau, `setLoop`).
4. **Équipe d'agents** créée dans `.claude/agents/` : `product-lead`, `frontend-engineer`,
   `backend-engineer`, `state-architect`, `qa-tester`, `code-reviewer` (cf. section « Équipe d'agents »).
   `AGENTS.md` enrichi avec le guide d'ingénierie + pièges du lecteur YouTube.

> **Plan grosse MAJ « ergonomie »** : **tous les lots livrés** ✅ — Lot 1 playlists robustes ;
> Lot 1bis File FocusFlow ; Lot 2 navigation (sidebar + bottom-nav + ⌘K, 7→4 sections) ; Lot 3 Now
> Playing (badge titre/source) ; Lot 4 insights enrichis (XP/niveau + humeur↔focus) ; Lot 5 onboarding ;
> Lot 6 suggestions intelligentes.

## Journal de session — 2026-06-29 (suite : File FocusFlow + Lot 2 navigation)

- **Mixes radio `RD…` (suite)** : `loadPlaylist([ids])` ET le playerVar `playlist` jouent la 1ʳᵉ vidéo
  puis repartent en autoplay aléatoire. **Fix définitif** : file maison (`onStateChange` ENDED →
  `loadVideoById`). ⚠️ Les radios `RD…` restent **personnalisées au compte** → on ne récupère que la
  version *publique* du mix (titres ≠ ceux du compte). C'est une limite YouTube (aucune API n'expose
  le contenu d'une radio perso).
- **File FocusFlow** (réponse au besoin « mes titres exacts ») : `queueStore` + `QueuePanel`
  (ajout par URL, reorder, skip, boucle) ; lecture 100% contrôlée. Voir section Stack/YouTube.
- **Lot 2 — refonte navigation** : `navStore` (4 sections) + `AppNav` (sidebar desktop / bottom-nav
  mobile) + `CommandPalette` ⌘K (global). 7 onglets → 4 destinations ; « Écouter » regroupe les sources.
  `app/page.tsx` dérive `activeTab` de `navStore` (contenu inchangé). Header allégé (titre de section
  + bouton ⌘K + profil/thème). Build + tsc verts, lint au niveau baseline.
- **Lot 3 — Now Playing** : badge réactif (titre + source/position) en haut de la session pour les
  sources YouTube (file/mix/playlist/vidéo), via `currentTrackIndex` synchronisé avec la file maison.
  Spotify/Twitch conservent leur UI propre (refactor MediaController complet **non fait** volontairement
  pour ne pas régresser la lecture média tout juste stabilisée).
- **Lot 4 — Insights** (`app/insights/page.tsx`) : ajout du **bandeau XP/niveau** (`lib/progression`)
  et de la section **Humeur ↔ focus** (journal × minutes). Le reste (estimation, heures, jours,
  Focus Score, semaine) existait déjà.
- **Lot 5 — Onboarding** : `components/Onboarding.tsx` (overlay 3 étapes ambiance→rythme→lancer),
  flag `prefs.onboarded`, monté dans `app/page.tsx` (après l'AuthGate).
- **Lot 6 — Suggestions** : `lib/suggestions.ts` (`topRepeatedVideo`) → carte « Reprendre ta session
  habituelle » dans `TodayDashboard` (1 clic relance la vidéo la plus jouée).

## Journal de session — 2026-07-21 (volume · shuffle/loop · Découvrir · splash)

1. **Volume auto-hide** (`app/session/page.tsx`) : panneau **vertical sous le bouton** (dropdown),
   toujours monté (transition CSS opacity/translate propre), auto-masqué après 2,5 s sans
   interaction (`armVolumeHide`), `tabIndex=-1` quand caché.
2. **Playlists PL… résolues en file maison** : nouvelle route `app/api/youtube/playlist`
   (parse `playlistVideoRenderer` → `{videos:[{id,title}]}`, ~100 premiers titres) ; helpers de
   parsing partagés extraits dans **`lib/ytParse.ts`** (mix/route.ts refactoré, renvoie aussi les
   `titles`). En session : playlist résolue → `buildManualQueue` (comme mixes/file), **repli
   lecteur natif** si la résolution échoue. « Now Playing » affiche le **titre réel** de la piste
   (states `trackTitles`/`currentTrackId`/`queueTotal` — pas de refs au render, règle
   `react-hooks/refs`). Modal **« Voir les titres »** sur les cartes playlist
   (`components/PlaylistTracksModal.tsx`) avec ajout par titre à la File (pas de reorder par
   playlist : l'ordre custom passe par la File FocusFlow, décision assumée).
3. **Shuffle + boucle** : `store/playbackPrefsStore.ts` (`focusflow-playback`, loop true par défaut).
   Boutons dans le cluster session (file maison uniquement, gate `mounted`). Shuffle Fisher-Yates
   togglable en cours de lecture (piste courante en tête, dé-shuffle → ordre d'origine).
   **Loop off** : fin de file → append d'un **mix RD du dernier titre** (dédupliqué) + toast
   « titres similaires » ; garde anti-double-avancement sur les ENDED redondants (`fetchingMoreRef`).
4. **Onglet « Découvrir »** (5ᵉ source de Écouter, `navStore.mediaSource="discover"` + ⌘K) :
   `components/DiscoverPanel.tsx` — sections « Parce que tu as écouté X » (mix RD du top média) et
   « Autour de tes thèmes » (nouvelle route `app/api/youtube/search`, parse `videoRenderer`, filtre
   < 10 min). Mots-clés extraits localement des titres écoutés (`lib/recommendations.ts`,
   stopwords FR/EN), affinés par le **coach IA si clé** (`app/api/coach` étendu `{type:"music"}`
   → `{queries:[{label,query}]}`). Cartes : Lire (→ ajoute en custom + `/settings`) / + File /
   + Bibliothèque. Vidéos déjà connues exclues.
5. **Splash d'arrivée** (`components/SplashIntro.tsx`, monté dans `layout.tsx`) : wordmark
   « FocusFlow » dessiné en canvas → texture du shader **Water** de
   **`@paper-design/shaders-react`** (WebGL, Apache 2.0, gratuit) — effet goutte d'eau/caustiques,
   ~2,8 s puis fondu ; skip clic/touche ; joué à **chaque chargement complet** (pas en nav SPA) ;
   repli statique si `prefers-reduced-motion` ou WebGL2 absent.

Relecture `code-reviewer` passée (fix du double avancement + bouton boucle masqué en repli natif).

### Correctifs même jour (retours utilisateur)

- **⚠️ La page `/playlist` ne sert PLUS les vidéos** (ytInitialData quasi vide côté serveur,
  constaté empiriquement 2026-07). Route `app/api/youtube/playlist` réécrite en 2 temps :
  **flux RSS** `feeds/videos.xml?playlist_id=…` (≤15 titres, donne une seed fiable) puis
  **page watch `?v=<seed>&list=…`** → `playlistPanelVideoRenderer` (≤200 titres). Le client passe
  `startVideoId` comme seed si connu. Les mixes RD marchent toujours via la page watch
  (mon test « cassé » utilisait un live comme seed — cas particulier).
- **« + Playlist » (extras)** : `SavedPlaylist.extraVideos` — titres recommandés ajoutés par
  l'utilisateur à une playlist (une playlist YouTube n'étant pas modifiable, ils sont **joués à la
  suite** des titres résolus en session). Actions `addExtraVideo`/`removeExtraVideo`
  (sync via `upsertPlaylist`). **⚠️ SQL requis** : `alter table user_playlists add column if not
  exists extra_videos jsonb default '[]'::jsonb;` — sans la colonne, l'upsert échoue (log) et la
  sync des playlists ne passe plus, le local reste OK.
- **Modal « Voir les titres »** enrichi : titres résolus (+ File), extras (retirables), section
  **« Recommandations liées »** (mix RD semé sur le 1er titre) avec + Playlist / + File.
- **Splash interactif** : Paper Shaders **remplacé par un shader WebGL2 maison** (zéro dépendance,
  `@paper-design/shaders-react` désinstallé) — vagues ambiantes lentes, **clic = onde de choc**
  (anneau amorti, 8 max) puis fondu après 750 ms ; auto-fondu après 3,5 s ; touche = skip.
  **La déformation suit la souris** (lerp) et le **curseur système est masqué** (`cursor-none`) :
  c'est l'ondulation de l'eau qui matérialise la position du pointeur.
  Repli statique conservé (reduced-motion / pas de WebGL2).
- **« Voir les titres » déplacé** : le bouton était dans l'overlay « Démarrer » de la carte
  playlist (`aspect-video` étroite) → clipé, et le clic retombait sur la carte = lancement de
  session. Il est maintenant un **bouton d'angle dédié en haut à droite** (icône liste, toujours
  visible, à côté du badge « Playlist »).

## Journal de session — 2026-07-23 (système d'amis + fix contamination comptes)

**Système d'amis** (online-only, drawer latéral droit façon launcher Riot/Fortnite) :
- **Drawer global** `components/FriendsDrawer.tsx` (monté dans `layout.tsx`) : languette bord droit +
  panneau qui glisse, **ouvert par défaut sur desktop** (effet au montage, `matchMedia ≥768px`), fermé
  sur mobile ; **masqué sur `/session`** (« sauf pendant la vidéo ») et si `!supabase`. Store
  `store/friendsDrawerStore.ts` (ouvrable aussi via CreateMenu, ⌘K, lien `?add=<code>`).
- **Contenu** `components/FriendsPanel.tsx` : leaderboard hebdo (moi + amis, tri minutes/pomodoros/série),
  bloc « en focus maintenant » (temps réel), demandes reçues, ajout par code, mon code + « copier le lien ».
- **Données** : 3 tables Supabase (`public_profiles` identité+code, `friendships` graphe, `friend_stats`
  agrégats partagés + statut focus). RLS **lecture croisée amis** via fonctions `is_friend`/`has_link`
  (SECURITY DEFINER, anti-récursion). Confidentialité stricte : les amis ne voient QUE des agrégats +
  « en focus » ; jamais le contenu/tâches/journal/projets (restés own-row).
- **RPC SECURITY DEFINER** (anti-énumération/usurpation) : `ensure_public_profile`, `send_friend_request`
  (code = capability, requester forcé serveur), **`accept_friend_request`** (⚠️ pas d'UPDATE direct sur
  `friendships` — sinon on pouvait forger une amitié « accepted » sans consentement et lire les stats de
  la victime, faille trouvée en revue). `invite_code` masqué au niveau **colonne** (grant SELECT partiel).
- **Présence** : `friend_stats.in_focus`/`focus_heartbeat` posés au montage de `/session` + heartbeat 60 s
  + cleanup ; ami « en focus » si heartbeat < 2 min (`isActivelyFocusing`). **Realtime** `postgres_changes`
  sur `friend_stats` (respecte la RLS) → leaderboard + présence en direct. `lib/friends.ts` (accès no-op
  sans Supabase), `store/friendsStore.ts` (publie mes agrégats via subscribe stats/succès, débounce ;
  `initFriends`/`teardownFriends` au login/logout dans `SupabaseProvider`).
- ⚠️ **SQL requis** : ré-exécuter `supabase/schema.sql` (bloc friends inclus) **et** activer Realtime sur
  `friend_stats` (le script tente `alter publication supabase_realtime add table friend_stats`, sinon
  Database > Replication à la main). Clés client = anon key + RLS uniquement.

**Fix contamination multi-comptes (bug signalé : mêmes stats/playlists entre 2 comptes)** :
Cause = le `localStorage` (stores `focusflow-*`) est partagé par tous les comptes du navigateur et n'était
jamais purgé au changement de compte → le merge au login (`Math.max`/union par id) **conservait** les
données du compte précédent. Fix dans `SupabaseProvider.tsx::resetLocalDataIfAccountChanged` : au login,
si un **autre** propriétaire (`focusflow-data-owner`) détenait le local, on **vide TOUS les stores
synchronisés** (stats, projets, vidéos custom, todos, playlists YouTube + locales, planning + les petits
via `resetPersonalStores`) **avant** le merge distant, et on coupe les subs amis. **1ʳᵉ connexion (pas de
propriétaire) → pas de purge** (les données anonymes rejoignent le compte, local-first voulu).
`lib/stateSync.ts` : logique de propriétaire retirée (centralisée dans le provider), expose `resetPersonalStores()`.

## Journal de session — 2026-07-23 (responsivité mobile complète)

Passe complète de responsivité tactile (viewport 375-430 px). Le hub/pages secondaires étaient déjà
largement responsives (grilles `grid-cols-2 sm:…`, bottom-nav `AppNav`, bottom-sheets AddToMenu/CreateMenu) ;
le chantier a porté sur la **session** (le seul écran cassé) et les **fonctionnalités tactiles**.

1. **Infra** : `export const viewport` avec **`viewportFit: "cover"`** (`app/layout.tsx`) — active les
   `env(safe-area-inset-*)` déjà codés (iPhone à encoche). Toast clampé `max-w-[min(24rem,calc(100vw-2rem))]`.
2. **Session mobile** (`app/session/page.tsx`, uniquement layout, zéro logique) : le **timer sort de son
   centrage absolu** sous `md` (passe en flux à droite de la top bar) ; les **contrôles migrent en barre
   fixe en bas** de l'écran (`fixed bottom-0 md:static`, `overflow-x-auto` des icônes, `pb-[max(...,safe-area)]`) —
   Pause/Tâches toujours atteignables au pouce ; volume s'ouvre **vers le haut** sur mobile ; panneaux
   tâches/aide en pleine largeur + scroll ; post-it/bandeau Twitch remontés au-dessus de la barre ; overlay
   de pause scrollable + tailles réduites.
3. **Tactile** (le seul vrai code) : **`StickyNote`** migré souris → **Pointer Events** (`setPointerCapture`,
   `touch-action:none`) → déplaçable au doigt, + clamp au viewport au montage (récupère les post-its « perdus »).
   Toutes les suppressions **hover-only** (`opacity-0 group-hover`) passées en **`sm:opacity-0 sm:group-hover`**
   (visibles par défaut sur mobile) : WeekPlanner, JournalTimeline, TaskPlanner, TodoList, backlog, cartes
   vidéo/playlist, settings kanban ; bouton ▶ des LocalPlaylistCard idem. **Palette ⌘K** accessible sur mobile
   (bouton loupe du header en icône seule). **TodoStatusDropdown** clampé au bord droit.
4. **Modals** : `max-h-[85vh] overflow-y-auto` sur AddVideo/AddPlaylist/CalendarSync ; **ProfilePanel** pleine
   largeur + scroll sous `sm` ; **kanban** (`TodoList`, settings) et grille date/heure du **SprintWizard**
   empilés en 1 colonne sur mobile ; entête **WeekPlanner** en `flex-col sm:flex-row` ; CoachModal liste `flex-1 min-h-0`.
5. **Finitions** : titres `text-2xl sm:text-3xl` ; grilles Succès/All-time de `StatsSection` en `grid-cols-2/1 sm:grid-cols-3`.

Pattern tactile-safe retenu : `sm:opacity-0 sm:group-hover:opacity-100` + Pointer Events (jamais `draggable`
HTML5 ni events souris seuls). `md:` partout = desktop strictement inchangé. tsc/build verts.

## Catalogue vidéos (refonte 2026-07-06)

Catalogue recentré sur **2 formats uniquement** : « Study With Me » scéniques (vue sur un beau
paysage) et **lofi/ambient sur paysages**, avec **dominante Asie** (préférence utilisateur forte) +
quelques touches Europe. ~55 vidéos dans `data/videos.ts`, **tous les IDs vérifiés via oEmbed**.
Piliers : Abao in Tokyo (16 SWM), study with japan (Osaka), Hatsu (Tokyo), Sean Study
(Shanghai/Canton/Londres), Abao Vision (drives lofi Kyoto/Fuji/Tokyo), + Corée (Jeju), Taïwan,
Hong Kong, Vietnam (Ha Long), Thaïlande, Singapour, Bali, Népal, Guilin. Quelques walks seulement
(Rambalac Gion/Atami, HK night walk). Moods réellement utilisés : `lofi` / `ambience` / `nature`
(les chips du catalogue sont dérivées des moods présents via `catalogueMoods` dans `app/page.tsx` ;
`jazz`/`synthwave`/`classical` restent dans le type pour les vidéos custom). `lib/sprint.ts` et
`Onboarding.tsx` ne pointent plus que vers des moods présents.
**Supprimés** : cafés/cheminées/cozy, jazz lounges, city pop/synthwave, NYC/Dubaï, sons purs (vagues).

## Journal de session — 2026-07-22 (refonte UX musique, lots 6-8 : AddToMenu, Découvrir, playlists locales)

Suite du plan « Refonte UX musique » (lots 6/6bis/7/8, fondations `localPlaylistStore`/`lib/playback.ts`
déjà livrées) :

1. **`components/AddToMenu.tsx`** (nouveau) : menu « ＋ » réutilisable partout dans le volet musique
   (Découvrir, recherche, titres de playlist) — Lire (optionnel) · File d'attente · Ma bibliothèque ·
   Ajouter à une playlist locale (avec coches « déjà ajouté ») · Nouvelle playlist… (nom inline, créer
   + ajouter en un geste). Popover desktop / bottom-sheet mobile, toasts systématiques. Lit lui-même
   `queueStore`/`sessionStore`/`localPlaylistStore` pour ses états.
2. **Découvrir refondu** (`DiscoverPanel.tsx`) : cartes avec actions **toujours visibles** (miniature
   cliquable + `[▶ Lire] [AddToMenu]` sous le titre, plus d'overlay hover-only) ; **recherche intégrée**
   en tête (`fetchSearchVideos`, debounce 400 ms) qui bascule le panneau en mode résultats ; état vide
   (aucun historique + pas de recherche) avec **chips de thèmes cliquables** (Lofi, Anime OST, Piano,
   Game OST, Study with me) qui remplissent la recherche.
3. **`PlaylistTracksModal.tsx`** : les 3 catégories de lignes (titres résolus, extras, recommandations
   liées) utilisent désormais `AddToMenu` ; les recos gardent l'entrée contextuelle « Cette playlist »
   (extras via `addExtraVideo`). `TrackRow` exporté.
4. **`QueuePanel.tsx`** : renommé « Ma file de lecture » → **« File d'attente »** (sous-texte : « Lue en
   session — remplacée quand tu lances une playlist. ») + bouton **« Sauvegarder en playlist »**
   (prompt inline → `createPlaylist` + `addTrack` par titre + toast).
5. **`components/LocalPlaylistModal.tsx`** (nouveau, clone structurel de `PlaylistTracksModal`) : nom
   éditable inline (crayon), bouton **▶ Lire** (`playLocalPlaylist`), titres avec ↑/↓/retirer, état vide
   pédagogique. Section « Recommandations pour cette playlist » ajoutée au lot 9 (cf. entrée suivante).
6. **Bibliothèque restructurée** (`app/page.tsx`) : ordre des onglets Écouter =
   **Catalogue | Découvrir | Ma bibliothèque | Spotify | Twitch** ; badge bibliothèque =
   `customVideos + playlists + localPlaylists`. 4 blocs toujours visibles : **File d'attente** ·
   **Mes playlists** (grille, carte « ＋ Nouvelle playlist » en tête + `LocalPlaylistCard` — mosaïque
   4 miniatures, ▶ au survol, menu ⋯ renommer/supprimer inline) · **Playlists YouTube** (renommée,
   ex-« Playlists ») · **Vidéos**. Chaque section a son propre bouton « Ajouter » et son propre état
   vide (fini le grand écran bloquant « bibliothèque vide »). `NewLocalPlaylistModal` (mini-modal nom
   seul) + `LocalPlaylistModal` montés en bas de page (`openLocalPlaylistId`).
7. **CommandPalette** : entrée « Créer une playlist » (ouvre Ma bibliothèque, où la carte de création
   est visible).

`npx tsc --noEmit` et `npm run build` verts.

## Journal de session — 2026-07-22 (suite : lots 1-5 & 9 — modals, splash, SYNC, IA globale, coach 2.0)

1. **Fix modals** : `.anim-section-in` passé de `both` à `backwards` (globals.css) — un fill-mode `both`
   conservait un `transform` permanent sur le wrapper de section → les overlays `fixed` descendants
   (SprintWizard, CalendarSync) s'ancraient sur la colonne centrale (fond « bizarre » avec bande claire).
   Les deux modals passent aussi par **`createPortal(document.body)`** + scrim `bg-black/70` harmonisé.
   ⚠️ Règle : tout nouveau modal DANS une section de `app/page.tsx` doit être portalé ou hoisté.
2. **Splash — vague de révélation** (`SplashIntro.tsx`) : canvas WebGL2 en `alpha:true`, phases
   `show → revealing → fading → done`. Clic = onde de choc puis (450 ms après) **révélation circulaire
   depuis le clic** (uniform `u_reveal`/`u_revealCenter`, bord ondulant par modulation angulaire,
   alpha prémultiplié → le site apparaît DANS le cercle), puis fondu court du résidu. Touche/idle 3,5 s
   = révélation depuis le centre. Replis conservés.
3. **SYNC MULTI-APPAREILS (gros morceau)** — cause racine des stats absentes sur un autre PC :
   `recordSession` n'appelait JAMAIS `upsertWorkSession` (table vide → merge login no-op). Corrigé.
   - `projectStore` synchronisé (nouvelle table `projects`, upsert dans add/update/logPomodoro).
   - **`lib/stateSync.ts`** : table KV **`user_state`** (jsonb par clé) pour routines / journal / goal /
     play_history / distractions / achievements / sprint. Merge par type au login (union par id pour les
     listes, max par date pour les compteurs, remote-wins pour les objets), puis `store.subscribe` →
     push debouncé 2 s. Flag `applying` anti-boucle. `notesStore`/`prefsStore` volontairement locaux.
   - **`supabase/schema.sql` réécrit COMPLET et idempotent** : corrige l'existant (table `profiles`
     absente !, colonnes `todos` manquantes → upserts qui échouaient en silence, `extra_videos`) +
     nouvelles tables `projects`, `user_state`, `local_playlists`, RLS partout. À ré-exécuter tel quel.
4. **Refonte IA globale** : `navStore` étendu (`orgTab`, `activityTab`, `pendingCreate`/`requestCreate`/
   `consumeCreate`) ; **`SubTabs`** générique ; **Organisation en sous-onglets** (Projets | Planning |
   Sprint | Routines | Journal — fini le scroll fourre-tout) ; **Activité = hub** (Aperçu | Statistiques |
   Wrapped — contenus extraits en `InsightsContent`/`WrappedContent`, routes /insights et /wrapped
   conservées en wrappers) ; **bouton global « ＋ Créer »** dans le header (`CreateMenu.tsx` : Session /
   Projet / Sprint / Bloc planning / Tâche / Routine — ouvre directement le bon formulaire via
   `pendingCreate`) ; CommandPalette enrichie (sous-onglets + créations).
5. **Playlists locales** : `store/localPlaylistStore.ts` (+ table `local_playlists`, merge updatedAt par
   id dans SupabaseProvider), lecture via `lib/playback.ts::playLocalPlaylist` (charge la File d'attente
   + `selectQueue()` — zéro changement dans `/session`).
6. **Coach musical 2.0** (`/api/coach` type "music") : prompt d'**interprétation** (univers anime/jeu/
   film, genres, artistes — généraliser, pas répéter), sortie `{label, query, reason?}` (max 5, reason
   ≤ 90 car. affichée + badge « ✦ IA » dans Découvrir), entrée enrichie `{titles, channels?, moods?,
   scope?: "playlist", playlistName?}`. `lib/recommendations.ts` : `fetchAiQueries(input, {force})` avec
   **cache sessionStorage 30 min** (quota), `buildLocalQueries` enrichi (dictionnaire d'univers regex +
   tokens des chaînes). **Recos par playlist** (PlaylistTracksModal + LocalPlaylistModal) : coach scope
   playlist → 2 recherches fusionnées, repli mix RD du 1er titre.
7. **Correctifs recherche/recos (retour utilisateur)** : la route `/api/youtube/search` accepte un
   param `min` (durée minimale en s, défaut 600) — la **recherche directe de Découvrir passe `min=0`**
   pour trouver des morceaux de 3-4 min (le filtre 10 min ne vaut que pour les recos). Les **ancres du
   repli local** de `buildLocalQueries` sont désormais **neutres** (« music mix », « playlist »…) au
   lieu de coller « lofi » à tous les thèmes — le lofi n'apparaît que via le dictionnaire d'univers ou
   le repli sans historique.

## Journal de session — 2026-07-24 (amis : présence « en ligne », rich presence, chat, cloche LoL)

Extension du système d'amis (toujours **online-only / anon key + RLS**, aucun secret client) :

1. **Présence « en ligne » globale** (distincte de « en focus ») : `components/PresenceProvider.tsx`
   (monté dans `layout.tsx`) publie un heartbeat `online`/`online_heartbeat` toutes les **45 s** tant
   que l'app est ouverte (n'importe quelle page) + `online:false` au `pagehide`/démontage. Un ami est
   « en ligne » si `online && heartbeat < 90 s` (`isOnline()` dans `lib/friends.ts`, focus ⇒ en ligne).
2. **Rich presence (ce qu'il fait / écoute)** : nouveau champ `friend_stats.activity` (texte **en clair,
   éphémère** — jamais persisté, jamais de contenu privé). Publié par `/session` :
   `« En focus · <titre écouté> »` / `« En pause »` / `« Flowtime · … »` / `« … · Spotify/Twitch »`,
   **effacé à la sortie** (`activity:null` dans le cleanup de présence). Affiché sous le nom de l'ami.
3. **Chat direct entre amis** : table `friend_messages` (RLS : lisible par les 2 interlocuteurs
   seulement ; **INSERT gated par `is_friend`** → on ne peut écrire qu'à un ami ; UPDATE `read_at` par le
   destinataire), **Realtime** dessus. `lib/friends.ts` (`fetchConversation`/`sendMessage`/
   `markConversationRead`/`fetchUnreadCounts`/`subscribeMessages`), `store/chatStore.ts` (1 conversation
   ouverte, `unread` par ami, `initChat`/`teardownChat` branchés dans `initFriends`/`teardownFriends`).
   UI `components/FriendChat.tsx` : fenêtre qui glisse par-dessus le panneau (bulles moi/lui, statut live,
   envoi Enter). Badge non-lus (bleu ciel) sur chaque ami + sur la languette.
4. **Cloche de demandes façon League of Legends** : `components/FriendRequests.tsx` (cloche + pastille
   rouge dans l'en-tête du drawer → popover Accepter/Refuser). L'ancien bloc inline « Demandes reçues »
   du panneau est **retiré** (tout passe par la cloche).
5. **Liste d'amis refondue (launcher)** : `FriendsPanel` groupe les amis **En focus → En ligne → Hors
   ligne**, chaque rangée **cliquable → ouvre le chat**, affiche l'activité en clair + le badge non-lus.
   En-tête du drawer : « N en ligne » + cloche.

> ⚠️ **SQL requis** : ré-exécuter `supabase/schema.sql` (ajoute les colonnes `online/online_heartbeat/
> activity` à `friend_stats` — `add column if not exists` — et la table `friend_messages` + RLS) **et**
> activer **Realtime sur `friend_messages`** (le script tente `alter publication supabase_realtime add
> table friend_messages`, sinon Database > Replication à la main).

### Correctifs même jour (retours utilisateur — UI amis)

- **ProfilePanel → modale CENTRÉE** (`createPortal(document.body)`, `z-[120]`) : avant, ouvert en
  dropdown `z-50` il passait **derrière** le tiroir Amis (`z-[60]`) et n'était plus cliquable. Désormais
  scrim + carte centrée au-dessus de tout (sauf ⌘K `z-[200]`).
- **Tiroir Amis moins « carré »** (`FriendsDrawer.tsx`) : **carte flottante arrondie** (`top-2 right-2
  bottom-2 rounded-2xl`, marges) au lieu d'un rectangle plein bord-à-bord ; **la croix de fermeture est
  remplacée par un chevron** (« ranger sur le côté ») ; header allégé (divider discret). Push du contenu
  ajusté `md:pr-[320px]` (`FriendsLayoutShell`).
- **Fix bulles de chat toutes noires au 1er rendu** (`FriendChat.tsx`) : l'alignement dépendait de
  `getCurrentUserId()` **capté une fois** au montage → `null` si l'auth n'était pas encore résolue, donc
  tous les messages tombaient dans la branche « lui » (bulle sombre) jusqu'à un remount. Corrigé sans
  `meId` : en 1-à-1, un message est « à moi » ssi `senderId !== openFriendId`.

### Refonte moteur de recommandations (retour utilisateur — 2026-07-24)

Les recos par **mots-clés** (`fetchSearchVideos` + coach IA `type:"music"`) renvoyaient surtout des
**compilations d'1 h** (YouTube les classe en tête), et tout filtre de durée (plancher OU plafond)
« n'avait plus de sens ». Pivot vers des recos **par mix radio YouTube** (`RD<videoId>`), qui suivent
le **style/artiste** du morceau et renvoient des titres de **durée naturelle**, SANS aucun filtre :
- `lib/recommendations.ts::fetchRadioRecommendations(seedIds, exclude, limit)` — fusionne en round-robin
  les mix RD de plusieurs seeds (dédoublonne). Importe `fetchMixVideos` (pas de cycle : playlistStore
  n'importe pas recommendations).
- **Découvrir** (`DiscoverPanel`) : une section « Parce que tu as écouté X » **par top titre YouTube
  écouté** (`getTopPlays`, jusqu'à 4, seeds dédoublonnés entre sections). Plus de section « thèmes ».
- **Recos par playlist** (`PlaylistTracksModal`, `LocalPlaylistModal`) : mix RD **semé sur les vidéos
  de la playlist** (round-robin sur les 3 premières).
- La **barre de recherche libre** de Découvrir reste sur `fetchSearchVideos(q, 0)` (toutes durées).
- `fetchAiQueries`/`buildLocalQueries` conservés (dormants) ; param `max` de `/api/youtube/search`
  retiré (revert du plafond). Ex. attendu : un titre Daft Punk → d'autres Daft Punk / même style ;
  une chanson de 2 min → des chansons ; un mix lofi d'1 h → du lofi.

## Journal de session — 2026-07-28 (splash au clic · landing page · zéro emoji)

Retours utilisateur « UX moins générée par IA » :

1. **Splash sans auto-révélation** (`SplashIntro.tsx`) : suppression du timer `IDLE_MS` — le site ne se
   découvre plus tout seul après quelques secondes, il faut **cliquer** (onde de choc + vague de
   révélation). Touche/clic aussi pour le repli statique (pas de WebGL). Plus aucun déclenchement auto.
2. **Landing page complète** (`components/LandingPage.tsx`, montée par `AuthGate` à la place de l'ancien
   `LoginScreen`) : header collant, hero (mockup de session animé), 6 cartes de fonctionnalités, « en 3
   étapes », CTA + footer, connexion Google intégrée. Thème sombre fixe. **Section stack technique
   retirée** à la demande, ton marketing allégé (pas de dégradé arc-en-ciel, pas d'« eyebrows »).
3. **ZÉRO emoji dans tout le projet** (règle produit) :
   - `Toast` n'affiche plus d'emoji (champ `emoji` retiré du type → petit repère d'accent coloré) ;
     tous les `emoji:` des appels `toast()` supprimés.
   - **Data sets dé-emojifiés** : humeurs `MOODS` → `{value,label,color}` (pastille colorée au lieu des
     visages) ; `Achievement` → champ `emoji` retiré (icône SVG trophée) ; défis `Challenge` → `emoji`
     retiré ; jardin de focus → point vert qui grossit (plus de 🌱🌷🌳) ; **routines** → champ `emoji`
     remplacé par `color` (sélecteur de pastilles ; fallback couleur pour les anciennes routines) ;
     onboarding moods sans emoji ; Wrapped (carte Canvas + page) en texte/labels.
   - Tous les emoji décoratifs des titres/labels/boutons retirés (👋🎉🔥💡🍅✦✨🏃⚠️☕⬇⬆…), remplacés
     par du texte ou des **SVG inline** (HelpRow de session, PiP, dashboard…). Préfixes fonctionnels
     `🏃`/`🍅` retirés des labels sprint (`lib/sprint.ts`) et du SUMMARY ICS (`lib/ics.ts`) — vérifié
     qu'aucune logique ne dépendait d'un préfixe emoji.
   - **Conservés** : `✓`/`✗` (coches monochromes fonctionnelles), pas des emoji.
   > Convention : **ne plus introduire d'emoji** dans l'UI. Icônes = SVG inline, statuts = couleur/texte.

`npx tsc --noEmit` et `npm run build` verts (erreurs lint pré-existantes inchangées : summary.tsx:94,
StatsSection.tsx:53, insights.tsx:102).


## Journal de session — 2026-08-22 (refonte UI globale : landing minimaliste + app dynamique)

Deux directions distinctes et assumées (cf. « Langage visuel » dans les conventions).

1. **Landing entièrement refaite** (`components/LandingPage.tsx`), direction **night city, très
   interactive** (dials : variance 8-9 / motion 8 / densité 3). Le fond reste `CityBackdrop`
   (photo de ville en `fixed`, la **nuit tombe au scroll** : la photo descend, le couchant s'efface,
   les fenêtres s'allument, un rail d'heure avance) — fichier **restauré** après une première
   tentative claire/éditoriale abandonnée.
   Chorégraphie, entièrement en **`motion/react`** (pas de GSAP : deux moteurs de scroll sur la même
   page se disputeraient les frames) :
   - **halo qui suit le curseur** dans le hero et **carte de session inclinée en 3D** vers le
     pointeur — via `useMotionValue`/`useSpring`, **jamais** de `useState` pour la position ;
   - **boutons magnétiques** (`Magnetic`) ; nav en **pilule flottante** ;
   - **manifeste scrubé** : les mots s'allument un par un au fil du scroll (`ScrubbedText`/`Word`) ;
   - **pile d'étapes** : chaque carte se colle en haut (`sticky`) et la précédente recule
     (`StepStack`/`StepCard`) ;
   - **accordéon horizontal** des 4 sources (replié en vertical sous `md`) ;
   - **marquee** des lieux du catalogue (`.anim-marquee`, une seule de la page) ;
   - bento `grid-flow-dense` 4×2 (une tuile 2×2 + quatre 1×1, zéro cellule vide).
   Hero : H1 en `clamp()` sur `max-w-5xl`, 2 lignes, avec une **image en pilule DANS le titre**.
   ⚠️ La landing n'utilise PAS les tokens de thème (blancs/noirs écrits en dur, elle est sombre par
   nature). La police serif (Instrument Serif) de la tentative précédente a été retirée ;
   il reste **Geist + Geist Mono**.
2. **Accent unique du site connecté** : token `--focus` (`globals.css`, clair + sombre) exposé en
   `--color-focus`. Migrés dessus : `GoalRing`, heatmap + barres 7 jours + succès de `StatsSection`,
   XP/jardin/défis de `ProgressionPanel`, dashboard. Fin de l'arc-en-ciel emerald/violet/sky/orange
   pour le décoratif ; les couleurs **sémantiques** (marques, projets, humeurs) sont conservées.
3. **Dashboard `TodayDashboard` réécrit** en bento asymétrique (grille 12 colonnes) :
   objectif (5 col) + **semaine en barres** (7 col, `getLast7Days`, aujourd'hui en accent) avec
   3 métriques nues sous filet ; carte « Reprendre » avec la **vraie miniature YouTube** ; sprint ;
   **rail horaire du jour** (blocs placés de 6h à 24h + curseur « maintenant ») ; prochaine tâche ;
   projet actif ; routines en pastilles ; récap + réflexion. Entrée en cascade et pression tactile
   via `motion/react` (`useReducedMotion` partout). Ajout d'un **squelette d'hydratation**
   (`DashboardSkeleton`) au lieu du `return null`.
4. **Navigation** : `AppNav` et `SubTabs`/`MediaTab` passent en contrôles segmentés avec indicateur
   qui glisse (`layoutId`) ; filet d'accent sur le rail desktop. Filtres de mood du catalogue en
   pastilles bordées. En-tête de section en micro-label mono.
5. **Micro-labels unifiés** : les 53 occurrences de `uppercase tracking-widest` du projet passent en
   `font-mono uppercase tracking-[0.14em]`.
6. **Passe « densité 3 » sur le dashboard** (retour utilisateur : « tout est très paqué ») : gaps
   `gap-8/10`, tuiles `rounded-3xl p-7/8`, anneau d'objectif à 132 px, barres de semaine à 144 px,
   chiffres à 28 px, **2 métriques au lieu de 3** (l'heure de pointe redescend en ligne de contexte),
   rail horaire plus haut, et `<main>` de `app/page.tsx` en `py-8 sm:py-12`.

`npx tsc --noEmit` et `npm run build` verts ; `npm run lint` au niveau baseline (4 erreurs
pré-existantes : summary, StatsSection, insights, TodoStatusDropdown).
**Vérification navigateur non faite** (extension Chrome indisponible dans cette session) : le rendu
visuel reste à valider à l'œil.


## Journal de session — 2026-08-22 (2e passe : landing 3D « night city » + dashboard réorganisé)

Retour utilisateur sur la 1re passe : la landing « n'était pas raccord » (photos picsum aléatoires →
effet site de voyage, un phare pour illustrer Twitch), et le dashboard restait trop dense.

1. **Landing refaite de zéro** (`components/LandingPage.tsx`), archétypes « Ethereal Glass » +
   « Z-Axis Cascade », dials imposés variance 9 / motion 8 / densité 3.
   - **RÈGLE D'IMAGERIE, à tenir** : plus AUCUNE photo générique (picsum banni de la page). Toutes les
     images viennent des **vraies vignettes YouTube du catalogue** (`data/videos.ts` →
     `https://i.ytimg.com/vi/<id>/hqdefault.jpg`, IDs vérifiés 200). Le produit s'illustre lui-même.
     Les sources externes (YouTube/Spotify/Twitch) ne sont PAS illustrées par des photos mais par
     **leur marque en SVG inline + un fragment de leur interface** (file d'attente, lignes de
     playlist, badge Live + chat).
   - **Scène 3D** dans le hero (`HeroScene`) : vraie perspective `preserve-3d`, satellites en
     profondeur via la prop `z` de motion (⚠️ **jamais** `transform: translateZ()` en CSS brut :
     motion recompose `transform` et l'écraserait), dérive en boucle, orientation vers le curseur.
   - **Carrousel 3D du catalogue** (`Carousel3D`) : 12 vidéos réelles disposées en cylindre
     (`rotateY(i·step) translateZ(430px)`), **tirable à la souris/au doigt** (Pointer Events +
     `requestAnimationFrame` pour la dérive, `useMotionValue` → aucun state par frame).
   - **Minuteur jouable** (`TryPomodoro`) : un vrai Pomodoro fonctionnel sur la landing (3 presets,
     lecture/pause/reset) — la démo la plus honnête possible.
   - Aussi : nav en île de verre, CTA « island » (icône nichée + magnétisme), double-bezel sur toutes
     les cartes, heatmap déterministe (⚠️ pas de `Math.random` au rendu, sinon mismatch SSR),
     marquee des pays du catalogue, entrées au scroll en montée + flou.
2. **Dashboard réorganisé** (`components/TodayDashboard.tsx`) autour d'**UNE décision**. Le défaut
   corrigé : cinq façons concurrentes de lancer une session, toutes de poids visuel égal, au milieu
   d'une dizaine de tuiles pairs. Nouvelle structure : **1. la décision** (carte unique, une seule
   action primaire choisie par priorité sprint > reprise > choisir une ambiance, la prochaine tâche
   affichée dedans, les autres chemins en liens discrets) → **2. l'état** (objectif + série + focus
   du jour, en bande typographique sans cartes) → **3. le contexte** (semaine en barres, rail horaire)
   → **4. le reste** (projet, routines, réflexion, récap, poids visuel réduit sous un filet).
   Ajout d'anneaux de focus clavier (`FOCUS_RING`) et d'un état vide pédagogique pour le planning.
3. Police serif retirée (plus utilisée) ; il reste **Geist + Geist Mono**.

`npx tsc --noEmit` et `npm run build` verts ; `npm run lint` = les 4 mêmes erreurs pré-existantes
(auth/twitch/callback, summary, StatsSection, TodoStatusDropdown), aucune nouvelle.
**Vérification navigateur toujours pas faite** (pas d'extension Chrome dans la session) : rendu à
valider à l'œil.


### Correctifs landing (retours utilisateur sur capture, même jour)

- **Diversité du catalogue** : le hero, le carrousel, la grille « Catalogue », la file d'attente et le
  fond Twitch ne piochaient que dans les 30 premières entrées (= Japon). Ils tirent désormais sur des
  **listes d'ids explicites, un pays par carte** (Hong Kong, Corée, Chine, Taïwan, Vietnam, Japon,
  Norvège, Suisse, Royaume-Uni, Indonésie, Thaïlande, Népal). ⚠️ Ne pas revenir à un `slice()` sur
  `defaultVideos` : le tableau est trié par pays, un slice donne toujours le même.
- **Carrousel 3D** : les cartes se chevauchaient et montraient leur **dos en miroir**. Corrigé par
  (1) un rayon calculé — corde `2·R·sin(180°/N)` > largeur de carte + marge, soit R=560 pour 10 cartes
  de 272 px ; (2) `backfaceVisibility: "hidden"` sur chaque carte ; (3) l'anneau **reculé de son propre
  rayon** (`z: -radius`) pour que la carte de devant retombe à taille réelle au lieu d'exploser sous la
  perspective. Les **caches latéraux en dégradé sont supprimés** (ils se lisaient comme deux rectangles
  noirs sur la photo).
- **Défilement des pays retiré** (il coupait mal et se lisait à peine).
- **Halo du curseur rendu GLOBAL** : c'était une couche interne au hero, il s'éteignait donc net au
  premier scroll. Il est maintenant une couche `fixed` alimentée par la position dans le viewport.
- **Hero** : le timer **recule d'un plan** (`z:-90`) et les trois satellites passent devant
  (`z: 60/95/130`), avec fonds plus opaques et ombre portée — ils étaient masqués derrière l'écran.
  L'avatar d'ami n'est plus une vignette de vidéo (ça ne voulait rien dire) mais un monogramme.
- **Lisibilité** : nouveau **voile de lecture** `fixed` sous le contenu, dont l'opacité monte au scroll
  (0 → 0.86 sur les 12 premiers pourcents) — la ville reste visible dans le hero, tout le texte qui suit
  repose sur un fond stable. Toutes les opacités de texte remontées d'un cran (plus aucun `text-white/25`
  ni `/35`). **Heatmap refaite** : cases de 14 px, échelle à 5 paliers plus francs, initiales des jours
  et légende « moins / plus ».


### Landing : bande infinie + « la page est un pomodoro » (même jour)

- **Carrousel remplacé par une BANDE INFINIE** (`CatalogueBelt` / `BeltCard`). L'anneau fermé était
  une impasse : dès qu'on masquait les dos de cartes, la moitié arrière disparaissait et le cadre se
  vidait. Désormais les cartes défilent sur un axe horizontal, se replient modulo la longueur de la
  bande (`((i·SLOT - offset) mod SPAN) - SPAN/2`), s'inclinent d'autant plus qu'elles s'éloignent du
  centre (`rotateY` borné ±46°, `z` négatif) et s'effacent avant le raccord. **Le cadre est toujours
  plein**, le pas `SLOT = largeur + 52` garantit l'absence de chevauchement. Chaque carte calcule sa
  place via `useTransform` sur une MotionValue partagée : zéro re-render par frame, même en glissant.
- **Idée maîtresse : la landing EST un pomodoro** (`SessionClock`, dans la nav). Le compteur part de
  25:00 en haut de page et atteint 00:00 en bas : parcourir la page, c'est dérouler une session.
  **Si le visiteur lance le minuteur jouable de la section démo, celui-ci prend le relais** et la nav
  bascule sur son temps à lui (libellé « cette page » → « ta session »). Arrivé à zéro, le libellé
  passe à « pause méritée » et le CTA final **sonne** (deux ondes qui s'échappent du bouton).
  ⚠️ Deux règles tenues ici : (1) le minuteur alimente la nav par une **MotionValue**, jamais par un
  state remonté — sinon toute la page se re-rendrait à chaque seconde ; (2) `SessionClock` ne fait pas
  commuter `useTransform` d'une source à l'autre entre deux rendus, il **s'abonne explicitement** à la
  bonne source dans un effet.
- Micro-motion perpétuelle réservée à un usage sémantique : le point qui bat dans l'horloge ne bat que
  lorsqu'une vraie session tourne.

## Journal de session — 2026-09-15 (refonte landing : passage à GSAP)

**Décision d'architecture, à connaître avant de toucher à la landing.** La règle
« moteur d'animation unique : `motion/react`, ne pas ajouter GSAP » (section
« Langage visuel ») vaut toujours pour **le site connecté**. La **landing fait
désormais exception** et tourne à 100 % sur **GSAP + ScrollTrigger**, à la
demande de l'utilisateur. `LandingPage.tsx` et `CityBackdrop.tsx` n'importent
plus `motion/react` du tout : la règle « un seul moteur de scroll par page » est
donc respectée, c'est juste que ce moteur n'est pas le même sur les deux
surfaces. Ne pas réintroduire `motion/react` dans ces deux fichiers.

Dépendances ajoutées : `gsap` (3.15) + `@gsap/react` (2.1). Depuis GSAP 3.13
tous les plugins sont gratuits, y compris ceux utilisés ici : **ScrollTrigger**,
**ScrollSmoother**, **ScrambleTextPlugin**.

### ⚠️ Le piège qui a coûté le plus cher : `refreshPriority`

**Dans GSAP, un `refreshPriority` PLUS ÉLEVÉ se rafraîchit EN PREMIER.** Avec
l'échelle inverse (épinglages en négatif), les deux sections épinglées étaient
mesurées en dernier, donc après tout ce qui se trouve plus bas dans la page :
**chaque déclencheur situé sous le catalogue démarrait 2128 px trop tôt**, très
exactement la distance d'épinglage. Symptômes : le catalogue se superposait à la
section précédente, l'index de chapitres éclairait le mauvais titre, les
révélations se jouaient hors écran. Ni `ScrollTrigger.refresh()`, ni deux
appels de suite n'y changeaient quoi que ce soit. L'échelle `PRIO` en tête de
`LandingPage.tsx` est donc **décroissante**, du haut de la page vers le bas, et
`below` vaut 0 parce que `ScrollTrigger.batch()` n'expose pas `refreshPriority`.

Autres pièges rencontrés, tous commentés dans le code :
- Les effets React s'exécutent **enfant d'abord** : les épinglages existent
  avant l'effet du parent, d'où un `ScrollTrigger.refresh()` explicite en fin de
  `useGSAP` de `LandingPage` (+ un second sur `document.fonts.ready`).
- **Ne jamais mesurer une section épinglée** : une fois figée, son rectangle ne
  bouge plus. L'index de chapitres lit des **ancres de flux** (`[data-anchor]`,
  hauteur nulle) via la chaîne des `offsetTop` (et non `getBoundingClientRect`,
  faussé par la transformation de ScrollSmoother).
- Avec `containerAnimation`, les bornes en **pourcentage** se mesurent dans
  l'espace de la piste et non du viewport : utiliser les **mots-clés**
  (`"left right"`, `"left center"`).
- `ScrollSmoother` transforme `#smooth-content` : tout ce qui est
  `position: fixed` doit rester **hors** de `#smooth-wrapper`, et le fond de
  page est porté par la **racine** (un fond opaque sur `#smooth-content`
  masquait entièrement la photo de la ville).
- Un `stagger` prolonge un tween bien après sa `duration` : en positionner un
  autre au milieu les fait se chevaucher.

### Chorégraphie (neuf blocs, neuf techniques distinctes)

Direction tirée de la photo de fond (Séoul à l'heure bleue, vue de Namsan) et
des références envoyées par l'utilisateur (davidecattaneo.it, jesperlandberg.com).

1. **Hero** : titre découpé en mots, chacun dans son masque, timeline d'entrée.
2. **Manifeste** : les mots s'allument un par un au scrub (`opacity` étagée).
3. **La balade** (`CityWalk`, épinglée) : la rue se rapproche pendant que six
   écrans du catalogue surgissent du fond et s'écartent vers les bords.
4. **Le boulevard** (`Boulevard`, épinglée) : travelling horizontal
   (`containerAnimation`), sol en perspective en CSS pur, chaque carte pivote
   en traversant le cadre.
5. **Les sources** : révélation en volet découpé (`clip-path`), via `batch`.
6. **Le parcours** : un trait qui se dessine et dépose ses étapes au passage.
7. **La trace** : heatmap en `stagger` de grille + chiffres qui se comptent.
8. **L'index de chapitres** : repère qui suit le scroll, libellé recomposé au
   `ScrambleTextPlugin` au changement de chapitre.
9. **L'horloge de la nav** : la page EST un pomodoro (25:00 en haut, 00:00 en
   bas) ; le minuteur jouable prend le relais dès qu'on le lance. Un seul
   `gsap.ticker`, écriture directe dans le DOM, zéro re-render.

**Abandonné sur retour utilisateur** : une transition en grille de blocs qui se
refermait en volet. Techniquement correcte, mais « ça ressemble à un
calendrier ». Ne pas la reproposer.

### Reste à faire

- **Vérification visuelle fine non faite** : l'onglet d'inspection automatisée
  est en arrière-plan, donc `requestAnimationFrame` y est bridé et GSAP avance
  au ralenti. La géométrie a été validée numériquement (positions
  d'épinglage, bornes de déclencheurs, opacités), pas le rendu à l'oeil.
- **Assets manquants** pour atteindre le niveau des références : voir
  **`docs/ASSETS_LANDING.md`**. Le plus gros écart est la balade, qui fait
  aujourd'hui grossir une photo fixe (donc un zoom) là où il faudrait une
  séquence d'images scrubée (donc un déplacement).

### Suite même jour — la balade devient une vraie ville modélisée (`three`)

Retour utilisateur : « la balade dans la ville est nulle, y'a pas de
modélisation, c'est juste bugué ». Les deux reproches étaient fondés.

**Le bug.** La balade faisait grossir une photo pendant que des vignettes
passaient en CSS 3D. À `z: 640` sous une `perspective: 1000px`, le facteur
d'échelle est `1000 / (1000 - 640)` = **2,78** : une carte de 368 px devenait
1430 px de large et partait à 4164 px hors de l'écran. Les vignettes étaient
donc soit minuscules au loin, soit géantes et hors cadre.

**Le fond du problème.** Même corrigée, l'approche ne pouvait pas marcher :
une image plate qui grossit donne un **zoom**, jamais un **déplacement**. Le
point de fuite ne bouge pas, aucune façade n'est dépassée. Sans géométrie, il
n'y a pas de balade.

**La réponse :** `components/CityScene.tsx`, une avenue nocturne **modélisée en
three.js** (MIT, donc gratuit, conforme à la règle du projet), pilotée par le
`ScrollTrigger` épinglé de `CityWalk` :
- deux rangées d'immeubles sur trois profondeurs, en trois `InstancedMesh`
  (un appel de dessin chacun), hauteurs et largeurs procédurales à graine fixe ;
- façades, halos de lampadaires, marquage au sol et couchant **peints dans des
  `<canvas>`** au montage : la scène n'a besoin d'aucun fichier ;
- les **vignettes du catalogue montées en écrans géants sur les façades**
  (contenu réel du produit ; `i.ytimg.com` renvoie bien le CORS nécessaire aux
  textures WebGL, vérifié) ;
- `MeshBasicMaterial` partout : une ville de nuit n'est que de l'émissif, donc
  aucune lumière à calculer. Brouillard pour masquer le fond, pixel ratio
  plafonné, boucle de rendu sur `gsap.ticker` ;
- la caméra **tangue** (indexé sur la distance parcourue, pas sur le temps,
  pour rester calé au scrub) : c'est ce tangage qui distingue une balade d'un
  travelling sur rail ;
- repli honnête (liste des lieux) sous `prefers-reduced-motion` **et** sans
  WebGL ; `three` est chargé en `dynamic(ssr:false)` pour ne pas retarder le hero.

**Pièges de scène corrigés, tous commentés dans le fichier :**
- les immeubles étaient placés par leur AXE, donc une façade large de 13 sur un
  axe à 14 avançait jusqu'à x=7,5, à l'intérieur d'une chaussée large de 22 :
  les immeubles se tenaient dans la rue et avalaient les écrans. Ils sont
  désormais placés par leur **face intérieure** ;
- les UV d'une boîte s'étirent avec ses dimensions : sans `repeat` sur **les
  deux axes**, les fenêtres devenaient des tirets horizontaux ;
- en fusion additive, un halo unique partagé entre lampadaires et écrans
  transformait la rue en taches orange : deux matériaux distincts ;
- le plan de couchant, trop clair et trop grand, se lisait comme un mur de
  brume grise bouchant la perspective.

`docs/ASSETS_LANDING.md` est à jour : **la balade ne demande aucun asset**, tout
est généré. Ce qui reste demandé y est marqué facultatif.

### Suite même jour — la ville devient le décor de TOUTE la page

Retours utilisateur : « le site n'est pas du tout fluide », « la partie balade
n'est pas bien incrustée », « la ville est moche ». Les trois étaient fondés.

**Fluidité.** Mesuré d'abord : le coût JavaScript par frame était dérisoire
(0,25 à 1,24 ms, rendu WebGL inclus). Ce n'était donc pas la 3D mais la
**composition**. Deux causes, toutes deux introduites par moi :
1. une couche **`mix-blend-screen` en plein écran** dans le fond photo (le
   navigateur recompose tout le viewport à chaque frame de scroll) ;
2. **`ScrollSmoother`**, qui déporte le scroll sur le fil principal là où le
   scroll natif se fait sur le compositeur. Sur une page déjà chargée en
   couches, il amplifiait la saccade au lieu de l'adoucir.
Les deux sont **supprimés**. `backdrop-blur-2xl` de la nav passe en
`backdrop-blur-sm` (un flou d'arrière-plan fixe se recalcule à chaque frame).

**Incrustation.** Le problème était structurel, pas cosmétique : une scène 3D
enfermée dans une section, au milieu d'une page photographique, ne partage ni
la lumière ni les couleurs du reste. **La scène est donc devenue le décor de la
page entière** (`World` dans `LandingPage.tsx`) : le scroll fait marcher la
caméra du premier au dernier écran, et tout le contenu se lit par-dessus. Il
n'y a plus de raccord à faire. Une section vide de deux écrans
(`[data-open-sky]`) donne le cadre à la ville seule, et le voile de lecture
**se retire puis revient** sur cette plage.

⚠️ **`components/CityBackdrop.tsx` est supprimé** (photo de Séoul + couche de
fusion). Récupérable dans l'historique Git. `public/pexels-*.jpg` n'est plus
utilisé par la landing.

**Beauté.** La ville procédurale est refaite en quatre principes, tous
commentés dans `CityScene.tsx` : **silhouettes** (immeubles quasi noirs, seules
les fenêtres existent), **brouillard exponentiel dense** (la profondeur se lit
seule, le fond se dissout dans le ciel), **bloom** (`UnrealBloomPass` à demi-
résolution : c'est lui qui fait qu'une ville de nuit en temps réel cesse d'avoir
l'air d'un jeu de 2005), et **une seule couleur chaude** sur un indigo froid.
S'ajoutent des retraits en gradins au sommet des tours (sinon la skyline est une
rangée de boîtes) et un ciel en dégradé accroché à la caméra.

**La nuit tombe en marchant** : brouillard, ciel et **couleur du matériau des
façades** sont interpolés au fil de la descente, donc les fenêtres s'allument
pendant que le ciel s'éteint. Une ligne de code, et c'est tout le propos du
produit.

**Rendu à la demande** : si la position de scroll n'a pas changé, pas une frame
n'est dessinée. À l'arrêt, le coût GPU de la page est nul.

Dépendance ajoutée : `three` 0.186 (MIT), chargée en `dynamic(ssr:false)` pour
ne pas retarder le hero. Repli (ciel dégradé fixe) sans WebGL et sous
`prefers-reduced-motion`.

### Suite même jour — la ville remodelée D'APRÈS LA PHOTO

Retour utilisateur : « l'idée de la ville est giga mal modélisée, regarde
l'ancienne photo ». Fondé, et l'écart était grossier : la photo du projet est
une **vue plongeante sur une vallée de tours depuis Namsan**, avec trois plans
de montagnes et un couchant derrière la crête. J'avais modélisé un **canyon
symétrique vu du trottoir**. Ce n'était pas le même plan, pas le même point de
vue, pas le même sujet.

La scène est donc refaite **plan par plan d'après la photo** (relevé détaillé en
tête de `CityScene.tsx`) : ciel d'heure bleue avec nuages, bande orange, trois
crêtes en perspective atmosphérique, vallée dense d'immeubles sur une trame de
rues avec carte de hauteurs, deux tours de premier plan qui cadrent, boulevard
avec filés de phares blancs et rouges, tissu bas dont **on voit les toits**.

**Le scroll est devenu une DESCENTE** : on démarre sur le cadrage de la photo,
très au-dessus du boulevard, et on descend en avançant jusqu'au niveau de la
rue. Le pas (tangage, roulis) n'apparaît que dans le dernier tiers, quand on est
assez bas pour marcher.

Pièges de rendu procédural rencontrés, tous commentés dans le fichier, et tous
trouvés à l'écran et non au raisonnement :
- **les toits** : en vue plongeante, une boîte dont la face supérieure porte la
  texture de façade trahit immédiatement le pavé. Deux matériaux par immeuble,
  dans l'ordre des groupes de `BoxGeometry` ;
- **le dégradé du ciel** : le plan de fond dépasse largement le champ de la
  caméra, on n'en voit que la portion v ∈ [0,34 ; 1]. Des arrêts répartis sur
  toute la hauteur donnaient un ciel presque entièrement orange ;
- **les crêtes invisibles** : dessinées trop bas dans la texture, elles se
  projetaient sous le niveau du sol. Il n'en restait qu'une sur trois ;
- **les fréquences du profil de crête** se lisent par rapport à la largeur de la
  texture : à `x * 0,003`, la sinusoïde ne parcourt pas une demi-période sur
  1024 px et la montagne devient une ligne droite ;
- **la forme des montagnes** : un bruit aléatoire par point donne des dents de
  scie, une somme de sinus donne des dunes. La bonne réponse est le bruit
  « ridged » (`1 - |sin|`), dont les maxima sont anguleux et les minima
  arrondis, soit la signature d'une ligne de crête ;
- **les nuages** : une ellipse nette se lit comme un dessin animé. Elles sont
  floutées au `ctx.filter` et très aplaties.

Ajouté par-dessus le rendu (skill `high-end-visual-design`) : **grain argentique
et vignettage** en couches fixes `pointer-events-none`. C'est ce qui fait
basculer une image de synthèse du côté de la photo plutôt que du jeu vidéo, pour
zéro coût de calcul.

### Suite même jour — refonte complète sur référence validée (forgeautomotive.co.uk)

L'utilisateur a fourni une référence et l'a validée sans ambiguïté : « c'est
exactement le type de design que je veux en GSAP ». La landing est donc
**entièrement refaite dans ce vocabulaire**, relevé section par section :

- noir profond et grain fin, rien d'autre comme fond ;
- **serif d'affichage en très grand, centrée** (Cormorant Garamond, gratuite,
  chargée par `next/font`), pour tout ce qui parle ;
- la même serif en **MOT FANTÔME** derrière les paragraphes, très basse
  opacité, comme un filigrane de chapitre ;
- **boutons RECTANGULAIRES à filet**, capitales très espacées, remplissage qui
  arrive par la gauche en `scaleX`. Plus aucune pilule ;
- photographie plein cadre, alternée avec des panneaux cadrés ;
- **barre de progression de lecture** en bas de l'écran ;
- chrome minuscule : horloge à gauche, nom au centre, action à droite.

> ⚠️ **SYSTÈME DE FORMES : tout est à angle droit sur la landing.** Aucun
> `rounded-*`, hormis les points et anneaux, ronds par nature. C'est le choix le
> plus lourd de conséquences de la direction, et il se tient de bout en bout. Ne
> pas y réintroduire de coins arrondis. Le site connecté, lui, garde son échelle
> de rayons (`rounded-2xl` / `xl` / `lg`).

**Structure** : hero photographique dominé par l'image (titre serif par-dessus,
composition à trois cadres qui déborde sous le bord) → manifeste plein cadre
dont la seconde ligne s'allume mot par mot → catalogue en travelling horizontal
épinglé → **diaporama épinglé numéroté 01/03** (cadre net à gauche, LA MÊME
IMAGE floutée en fond, mot fantôme, compteur) → sources en quatre panneaux →
minuteur jouable → trace → action finale.

**Le sentiment de balade** ne vient plus d'une scène 3D mais de la **parallaxe
continue** : chaque photographie plein cadre dérive plus lentement que la page
(`yPercent` scrubé, sur-cadrage `scale: 1.18` obligatoire sans quoi la dérive
découvrirait le bord). C'est ce décalage, et lui seul, qui donne l'impression
d'avancer DANS quelque chose. S'y ajoute une vraie séquence d'arrivée : la photo
se détend depuis un sur-cadrage, les mots montent derrière leur masque, la
composition se lève.

⚠️ **`components/CityScene.tsx` et la dépendance `three` ont été SUPPRIMÉS.**
La ville 3D procédurale contredisait ce langage photographique et typographique,
et elle avait été rejetée deux fois. Récupérable dans l'historique Git.

**Photographies** : six vraies photos de Séoul la nuit (Pexels, licence libre)
dans `public/seoul/`, détaillées dans `docs/ASSETS_LANDING.md`. Deux registres à
ne pas mélanger : **Séoul porte l'atmosphère**, **les vignettes du catalogue
portent le produit**.

Piège rencontré : une couche photographique en `-z-10` passe DERRIÈRE le fond de
`main` si sa section ne crée pas de contexte d'empilement. `isolate` sur la
section est obligatoire. Et des voiles `from-black ... to-black` pleins, doublés
d'un vignettage à 0,9, recouvraient la photo en entier : les voiles doivent
asseoir le texte, pas effacer l'image.

### Suite même jour — analyse technique de la référence, et les effets qui bougent

Retour utilisateur : « je préférais l'ancienne font », et « j'aimerais un truc
plus dynamique, genre comme ce site où tu bouges ». J'ai donc analysé
forgeautomotive.co.uk **dans son DOM**, et non à l'allure des captures.

**Ce que la référence utilise réellement (relevé) :**

| Indice trouvé | Conclusion |
|---|---|
| `window.Lenis` présent, pas de GSAP global | défilement amorti par **Lenis**, pas ScrollSmoother |
| **22 noeuds `data-trail`** : un conteneur plein écran + 20 vignettes 259x324 à opacité 0 | **traînée d'images au curseur** |
| `data-car` portant des `matrix()` pilotées en JS | **parallaxe de pointeur** sur la composition du hero |
| `data-cinematic-words`, titre découpé en 13 enfants | révélation mot par mot |
| polices `geistsans` + `editorial` | **ils utilisent Geist** pour le corps de texte |

**Les quatre sont repris dans `LandingPage.tsx` :**

1. **`SmoothScroll` (Lenis, MIT, ~2 ko)**. ⚠️ Ne PAS revenir à `ScrollSmoother` :
   il enveloppe la page dans un conteneur transformé de douze mille pixels de
   haut, ce qui casse `position: fixed`, complique les épinglages et déporte
   tout sur le fil principal. Lenis interpole la position de scroll native,
   donc rien ne casse. Il pousse ses mises à jour dans `ScrollTrigger.update`
   et c'est `gsap.ticker` qui bat la mesure pour les deux, avec
   `lagSmoothing(0)` (sans quoi l'amortissement fait un bond après chaque
   hoquet).
2. **`ImageTrail`** : bouger la souris sur le premier écran laisse une traînée
   de paysages **du catalogue**. Douze éléments recyclés en anneau (aucune
   allocation pendant le mouvement), émission cadencée par la DISTANCE
   parcourue et non par le temps, et armement uniquement sur pointeur fin.
3. **Parallaxe de pointeur** sur les trois cadres du hero, à des amplitudes
   différentes, via `gsap.quickTo` (jamais un state React : l'arbre se
   re-rendrait à chaque pixel).
4. **Boutons magnétiques**, titres découpés en mots, parallaxe de scroll sur
   chaque photographie plein cadre.

**La police revient à Geist partout** (la serif Cormorant a été retirée, ainsi
que son chargement dans `layout.tsx` et son token dans `globals.css`). Le
titrage tient par la taille, la graisse légère et la chasse resserrée, pas par
un changement de famille. La référence fait d'ailleurs pareil.

> ⚠️ **« Commencer » n'apparaît qu'à TROIS endroits** : bandeau, hero, action
> finale. Il y en avait six, ce qui banalisait l'action et hachait la lecture.
> Ne pas en rajouter à chaque section.

### Suite même jour — refonte de la COUCHE DE MOUVEMENT (SplitText)

Retour utilisateur : « la traînée n'est pas dingue, on ne voit pas du GSAP comme
je t'ai envoyé, refacto tout ». Fondé. Le diagnostic, à garder en tête :

> **C'était de l'animation POSÉE SUR une page, pas une page CONSTRUITE par son
> animation.** Concrètement : des fondus vers le haut de 0,95 s sur 36 px. Ça se
> lit comme « une page correcte », jamais comme une pièce animée.

Trois principes désormais tenus partout dans `LandingPage.tsx` :

1. **RIEN N'APPARAÎT, TOUT ARRIVE.** Chaque texte passe par le composant
   **`Lines`** : découpage en LIGNES par **SplitText** (gratuit depuis GSAP
   3.13), chaque ligne montant derrière un masque (`mask: "lines"`). C'est la
   signature visuelle du GSAP soigné, et c'est ce qui manquait le plus.
   `autoSplit: true` est indispensable : sans lui les lignes sont calculées sur
   la police de repli et les masques tombent au mauvais endroit. L'animation est
   créée DANS `onSplit` et **retournée**, ce qui laisse SplitText la nettoyer et
   la resynchroniser à chaque redécoupage.
2. **DU POIDS.** `EASE = "power4.out"`, `DUR = 1.2`, `STAGGER = 0.085`, et de
   grandes distances (une ligne monte de 118 % de sa hauteur). Les BLOCS
   (panneaux, cadres, grilles) se dévoilent en `clip-path` par le bas plutôt
   qu'en opacité, et le découpage est figé à la fin (`clipPath: "none"`) pour ne
   laisser aucun coût de composition résiduel.
3. **LES SECTIONS SE PASSENT LE RELAIS** (`[data-recede]`) : les plein-cadres
   reculent et s'effacent pendant que la suivante arrive par-dessus. On traverse
   des plans, on ne fait pas défiler une liste.

**Traînée d'images densifiée** : pas ramené de 145 à **78 px** (à 145 px on
obtenait trois vignettes éparses, c'est-à-dire rien), vignettes agrandies à
17rem, et surtout une **entrée nette (0,55 s) contre une sortie longue (1,1 s)**.
C'est cet écart qui fait un ruban ; deux durées égales ne donnent qu'un
clignotement.

⚠️ **Piège React 19** : `createElement(tag, { ref })` déclenche
`react-hooks` « Cannot access refs during render ». `Lines` utilise donc du JSX
avec un **ref de rappel**, jamais `createElement` avec un ref.
