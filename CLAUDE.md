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
  `profiles`, `work_sessions`). Tout passe par `lib/db.ts`, qui est **no-op si Supabase non configuré**
  (mode localStorage seul).
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
