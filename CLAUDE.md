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
- **YouTube :** IFrame API (embed direct, aucune clé requise pour la lecture)
- **Spotify :** OAuth + Web Playback (Premium), helpers dans `lib/spotify.ts`
- **Twitch :** OAuth + embed live/VOD, helpers dans `lib/twitch.ts` (+ route `app/api/twitch/token`)
- **Audio :** sons de transition et **ambiances** générés en **Web Audio API** (aucun fichier audio)
- **Notifications :** Web Notifications API
- **Deploy :** Vercel (gratuit)

## Flux principal (routes)

`/` (accueil : onglets Catalogue / Ma bibliothèque / Spotify / Twitch / Activité)
→ `/settings` (choix du preset Pomodoro + tâches Kanban de la session)
→ `/session` (plein écran : lecteur + timer + tâches + post-its + ambiances)
→ `/summary` (résumé de session + stats). Auth callbacks dans `app/auth/*`.

## Fonctionnalités implémentées

**Cœur**
- Timer Pomodoro configurable (presets `classic` / `deep` / `custom`, work / short-break / long-break,
  sessions avant pause longue)
- Lecteur multi-sources : YouTube vidéos + playlists, Spotify, Twitch live/VOD
- Catalogue curated par mood + **bibliothèque perso** (vidéos & playlists custom, synchro Supabase)
- Tâches **Kanban** (statuts todo/in-progress/done, priorité, estimation & compteur de pomodoros)
- Post-its déplaçables pendant la session
- Profil (Google OAuth + nom/avatar custom), thèmes dark/light
- Notifications + sons de transition (Web Audio)

**Stats & historique**
- Stats jour / semaine, streak, meilleur jour, totaux, **heatmap 17 semaines**
- Historique de lecture + **top lectures** (`playHistoryStore`)

**Features récentes (ajoutées autour de la méthode Pomodoro)**
- **Mixeur d'ambiances** Web Audio (pluie / vagues / vent / bruit blanc / feu, superposables) —
  `lib/soundscapes.ts`, `store/soundscapeStore.ts`, `components/SoundscapeMixer.tsx`
- **Respiration guidée** box-breathing 4-4-4-4 pendant les pauses — `components/BreathingExercise.tsx`
- **Objectif quotidien** configurable (minutes **ou** pomodoros) + anneau de progression + célébration —
  `store/goalStore.ts`, `components/GoalRing.tsx`
- **Succès / Badges** dérivés des stats — `lib/achievements.ts`, `store/achievementsStore.ts`
- **Distractions + Focus Score** (marquer les interruptions, raccourci `D`) — `store/distractionStore.ts`
- **Toasts** partagés (montés globalement dans `app/layout.tsx`) — `components/Toast.tsx`

## Roadmap (idées non implémentées)

Voir **`docs/FUTURE_FEATURES.md`** pour le détail priorisé (grosses features) :
Focus Rooms collaboratives temps réel, dashboard analytique + export, coach IA (découpage de tâches),
intégrations Calendar/Notion/Todoist, bloqueur de distractions (PWA + extension), gamification 2.0
(XP / jardin de focus), marketplace d'ambiances.

## Préférences utilisateur

- App **gratuite** pour tout le monde, pas de monétisation dans un premier temps
- **Open source** (GitHub) — optionnel mais recommandé
- Fonctionne **sans compte** (localStorage) ; Supabase ajoute la sync multi-appareils sans être obligatoire
- Priorité produit : **timer + lecteur ensemble** dans la même vue plein écran

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
│   ├── page.tsx                # Accueil : onglets catalogue/bibliothèque/spotify/twitch/activité
│   ├── settings/page.tsx       # Choix preset Pomodoro + Kanban des tâches
│   ├── session/page.tsx        # Session plein écran (lecteur + timer + tâches + ambiances + respiration)
│   ├── summary/page.tsx        # Résumé de session + objectif + focus score + stats
│   ├── auth/*                  # Callbacks OAuth (Google, Spotify, Twitch)
│   └── api/twitch/token/route.ts
├── components/
│   ├── SoundscapeMixer.tsx · BreathingExercise.tsx · GoalRing.tsx · Toast.tsx   # features récentes
│   ├── StatsSection.tsx · StickyNote.tsx · TodoStatusDropdown.tsx · ProfilePanel.tsx
│   ├── SpotifyPlayer.tsx · TwitchPlayer.tsx · ThemeToggle.tsx · …
├── store/                      # Zustand : timer, session, sessionSummary, stats, playHistory,
│   │                           #   notes, profile, theme, spotify, twitch, playlist,
│   │                           #   soundscape, goal, achievements, distraction, prefs
├── lib/                        # utils, supabase, db, sounds, soundscapes, achievements, spotify, twitch
└── data/
    └── videos.ts               # Catalogue curated + helpers (moods, extraction d'ID YouTube)
```

## Catalogue vidéos initial

Vidéos lofi/chill de référence (catalogue dans `data/videos.ts`) :
Lofi Girl (livestream 24/7), Driving in Seoul, Tokyo at Night, Rainy Coffee Shop, Study with Me,
Chillhop Raccoon — déclinées par mood (lofi, jazz, ambience, nature, synthwave, classical).
