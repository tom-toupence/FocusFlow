<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Guide de contribution pour les agents (FocusFlow)

> Lis `CLAUDE.md` pour le contexte produit complet. Ce fichier résume les **règles
> d'ingénierie** à respecter par tout agent qui touche au code.

## Avant de coder
- **Next.js 16 / React 19 / Tailwind v4** : vérifie l'API réelle dans `node_modules/next/dist/docs/`
  avant d'écrire (params de route = `Promise`, `"use client"` obligatoire pour Zustand, etc.).
- Le projet est **local-first** : toute écriture DB passe par `lib/db.ts` (no-op sans Supabase).
  Ne jamais appeler `supabase` directement depuis un composant.
- Tout doit rester **gratuit** : pas de dépendance payante, pas de clé API obligatoire côté client.

## Pendant
- Composants `"use client"` + Zustand `persist` ; lire un store persisté via le pattern `mounted`
  (`useEffect` au montage) pour éviter les mismatchs d'hydratation.
- Icônes **SVG inline** (jamais d'images/lib d'icônes), styles via tokens Tailwind + `cn()`.
- Dates locales via `localToday()` / `localDate()` (`YYYY-MM-DD`).
- Secrets (clés API) **uniquement côté serveur** (routes `app/api/*`).

## Lecteur YouTube (IFrame API) — pièges connus
- **Ne jamais** combiner `videoId` + `list` dans les `playerVars` du constructeur : le player
  joue la seed puis l'autoplay « vidéos liées » (= aléatoire hors playlist). Charger une playlist
  ou un mix (`RD*`) **via `player.loadPlaylist({ list, listType: "playlist" })` dans `onReady`**.
- Skip = `player.nextVideo()` / `player.previousVideo()`. Boucle des vraies playlists via
  `setLoop(true)` (inutile pour les radios `RD*`, infinies par nature).
- Toute méthode IFrame utilisée doit être déclarée dans l'interface `YTPlayer` de `app/session/page.tsx`.

## Avant de livrer (checklist obligatoire)
1. `npx tsc --noEmit` → **0 erreur**.
2. `npm run lint` → ne pas **ajouter** de nouvelle erreur (le repo a des erreurs pré-existantes
   dans `TodoStatusDropdown.tsx` & co — ne pas les imputer à ta PR).
3. `npm run build` si tu touches au routing/SSR.
4. Mettre à jour `CLAUDE.md` (section « Fonctionnalités » + journal de session) quand l'archi évolue.

## Équipe d'agents (`.claude/agents/`)
Des sous-agents spécialisés sont définis pour faire évoluer l'app. Les invoquer pour les tâches
correspondantes (voir leur frontmatter `description`). Toujours faire relire une feature par
`code-reviewer` avant de considérer le travail terminé.
