@AGENTS.md

# FocusFlow — Notes pour Claude

## Contexte du projet

Application web de productivité combinant un **timer Pomodoro** et un **catalogue de vidéos YouTube lofi/chill**.
Objectif : aide à la concentration, gratuit et public, déployé sur Vercel.

## Analyse marché (résumé)

Concurrents proches : Lofidoro, Lofi Girl Extension, Pomofocus, Nesto, Foci, Lofizen.
Gap principal : aucune app ne combine proprement catalogue curated + Pomodoro solide + stats + ambiances mixables dans une seule expérience bien maintenue.

## Stack technique

- **Framework :** Next.js (App Router) + TypeScript
- **Styles :** Tailwind CSS
- **State :** Zustand
- **YouTube :** YouTube IFrame API (embed direct, aucune clé API requise pour la lecture)
- **Persistence :** localStorage (MVP) → Supabase en V2
- **Notifications :** Web Notifications API + sons
- **Deploy :** Vercel (gratuit)

## Architecture des features

### MVP (implémenté en premier)
- Timer Pomodoro configurable (travail / pause courte / pause longue)
- Catalogue de vidéos lofi/chill curatés avec lecteur YouTube embarqué
- Timer + vidéo ensemble dans la même vue principale
- Todo list de session (tâches pendant les sessions)
- Notifications fin de session

### V2 (prévu)
- Mixeur d'ambiances (superposer pluie + café + lofi)
- Stats & streaks (sessions complétées, temps total, jours consécutifs)
- Ajout de vidéos custom par URL YouTube
- Thèmes visuels (dark/aesthetic/clair)
- Tags par mood (concentré, créatif, détendu)

### V3 (futur)
- Comptes utilisateurs + sync multi-appareils (Supabase)
- Focus rooms collaboratives
- Extension Chrome compagnon
- Intégrations Notion/Todoist/Google Calendar

## Préférences utilisateur

- App **gratuite** pour tout le monde, pas de monétisation dans un premier temps
- **Open source** (GitHub) — optionnel mais recommandé
- Pas de comptes dans le MVP, localStorage suffit
- Priorité MVP : **timer + lecteur vidéo ensemble** dans la même vue

## Structure des fichiers clés

```
focusflow/
├── app/
│   ├── layout.tsx          # Layout global, thème dark
│   ├── page.tsx            # Page principale (timer + player + todos)
│   └── globals.css
├── components/
│   ├── PomodoroTimer.tsx   # Timer avec states work/short-break/long-break
│   ├── VideoPlayer.tsx     # Lecteur YouTube IFrame
│   ├── VideoCatalog.tsx    # Catalogue/sélection de vidéos
│   └── TodoList.tsx        # Todo list de session
├── store/
│   ├── timerStore.ts       # Zustand : état du timer
│   └── sessionStore.ts     # Zustand : todos + vidéo sélectionnée
└── data/
    └── videos.ts           # Liste curated des vidéos lofi/chill
```

## Catalogue vidéos initial

Vidéos lofi/chill de référence à inclure :
- Lofi Girl (24/7 livestream)
- Driving in Seoul Lofi
- Tokyo at Night — Lofi
- Rainy Coffee Shop Ambience
- Study with Me — Lofi Hip Hop
- Chillhop Raccoon (Chillhop Music)
