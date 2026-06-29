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
  Playlists & mixes (`RD*`) chargés via **`player.loadPlaylist()` dans `onReady`** (jamais `videoId`+`list`
  combinés dans le constructeur → sinon autoplay aléatoire). Skip via `nextVideo()`/`previousVideo()`,
  boucle des vraies playlists via `setLoop(true)`. Voir `app/session/page.tsx` (interface `YTPlayer`).
- **Spotify :** OAuth + Web Playback (Premium), helpers dans `lib/spotify.ts`
- **Twitch :** OAuth + embed live/VOD, helpers dans `lib/twitch.ts` (+ route `app/api/twitch/token`)
- **Audio :** sons de transition et **ambiances** générés en **Web Audio API** (aucun fichier audio)
- **Notifications :** Web Notifications API
- **Coach IA (optionnel) :** route serveur `app/api/coach/route.ts` multi-fournisseur **Groq → Gemini → repli local**.
  Clés **uniquement côté serveur** (`GROQ_API_KEY` / `GEMINI_API_KEY`), jamais envoyées au client.
  Sans clé, le coach utilise le **planificateur heuristique local** (`lib/coach.ts`) — toujours gratuit.
- **Deploy :** Vercel (gratuit)

## Flux principal (routes)

`/` (accueil — onglets : **Aujourd'hui** (dashboard, défaut) / Catalogue / Ma bibliothèque / Spotify /
Twitch / Activité / **Organisation**)
→ `/settings` (choix du preset Pomodoro + tâches Kanban + Coach + « enregistrer comme routine »)
→ `/session` (plein écran : lecteur + timer + tâches + post-its + ambiances + respiration)
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
- **Mixeur d'ambiances** Web Audio (pluie / vagues / vent / bruit blanc / feu, superposables) —
  `lib/soundscapes.ts`, `store/soundscapeStore.ts`, `components/SoundscapeMixer.tsx`.
  ⚠️ Les couches **ne sont pas persistées** (`partialize` + `migrate`) : chaque session démarre à 0 ambiance.
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
│   ├── session/page.tsx        # Session plein écran (lecteur + timer + tâches + ambiances + respiration + distractions)
│   ├── summary/page.tsx        # Résumé + objectif + focus score + réflexion/journal + stats
│   ├── insights/page.tsx       # Statistiques détaillées + export CSV/JSON
│   ├── wrapped/page.tsx        # Récap hebdo « Wrapped » + carte PNG
│   ├── auth/*                  # Callbacks OAuth (Google, Spotify, Twitch) — Spotify gère access_denied
│   └── api/{twitch/token,coach,calendar/[token]}/route.ts   # secrets côté serveur uniquement
├── components/
│   ├── TodayDashboard.tsx · ProjectsSection.tsx · WeekPlanner.tsx · RoutinesManager.tsx · RoutineSaveModal.tsx
│   ├── SprintWizard.tsx · CalendarSync.tsx · PipTimer.tsx · WrappedShareCard.tsx
│   ├── JournalReflection.tsx · JournalTimeline.tsx · CoachModal.tsx · ProgressionPanel.tsx
│   ├── SoundscapeMixer.tsx · BreathingExercise.tsx · GoalRing.tsx · Toast.tsx · StatsSection.tsx
│   ├── StickyNote.tsx · TodoStatusDropdown.tsx · ProfilePanel.tsx · SpotifyPlayer.tsx · TwitchPlayer.tsx · …
├── store/                      # Zustand : timer, session, sessionSummary, stats, playHistory, notes,
│   │                           #   profile, theme, spotify, twitch, playlist, soundscape, goal,
│   │                           #   achievements, distraction, prefs, routine, project, plan, journal,
│   │                           #   sprint, wrapped
├── lib/                        # utils, supabase, db, sounds, soundscapes, achievements, spotify, twitch,
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

> **Plan grosse MAJ « ergonomie »** (validé) : Lot 1 ✅ playlists robustes ; à venir : Lot 2 navigation
> (sidebar + bottom-nav + ⌘K), Lot 3 lecteur unifié (Now Playing), Lot 4 insights enrichis,
> Lot 5 onboarding, Lot 6 suggestions intelligentes. Livraison coup par coup.

## Catalogue vidéos initial

Vidéos lofi/chill de référence (catalogue dans `data/videos.ts`) :
Lofi Girl (livestream 24/7), Driving in Seoul, Tokyo at Night, Rainy Coffee Shop, Study with Me,
Chillhop Raccoon — déclinées par mood (lofi, jazz, ambience, nature, synthwave, classical).
