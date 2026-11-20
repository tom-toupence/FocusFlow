# 00 · Audit de FocusFlow (état au 2026-11-20, avant refonte)

> Phase 0 de la mission `docs/redesign/PROMPT.md`. Aucun code applicatif modifié.
> Objectif : qu'une personne qui n'a jamais ouvert le dépôt comprenne ce qu'est
> l'app, comment elle est faite, ce que l'utilisateur voit à chaque instant, et
> où la lecture YouTube diverge de Spotify et Twitch.
>
> Captures de référence : `docs/redesign/shots/before/` (92 écrans app en
> 1440 et 390 px, clair et sombre, plus splash et landing). Script :
> `scripts/shoot.mjs` (Playwright headless, attente explicite, deux profils de
> données semés dans les stores persistés).

---

## 1. Ce qu'est FocusFlow, en une minute

Une application web gratuite qui met dans **un seul écran plein écran** un
**minuteur Pomodoro** et **une source sonore et visuelle** : une vidéo YouTube
(le plus souvent un « Study With Me » filmé devant une ville d'Asie la nuit, ou
du lofi sur un paysage), une playlist YouTube, une playlist Spotify, ou un live
Twitch. Autour de ce cœur se sont greffés : tâches Kanban, statistiques,
objectif quotidien, série, gamification (XP, jardin, défis), planning hebdo
exporté en calendrier, projets à deadline, mode Sprint, journal d'humeur, coach
de planification (local ou IA côté serveur), récap hebdo « Wrapped » et un
système d'amis (présence, chat).

L'app fonctionne **sans compte** (tout en `localStorage` via Zustand `persist`)
et **sans clé côté client**. Supabase, s'il est configuré, ajoute la connexion
Google, la synchro multi-appareils et les amis.

### Le cœur émotionnel

Ce n'est pas un outil de productivité de bureau. Les captures, le catalogue et
la landing racontent tous la même scène : **quelqu'un travaille seul, tard,
devant une fenêtre sur une ville d'Asie éclairée**, la pluie sur Shibuya, le
pont illuminé de Séoul, un train de nuit vers Fuji. Le produit vend trois
choses, dans cet ordre :

1. **Une présence** : la ville filmée tourne pendant que tu travailles, tu n'es
   pas seul devant ta page blanche (et les amis « en focus » prolongent cette
   idée en vrai).
2. **Un rythme** : 25 min de travail, 5 min de pause, et la pause est un vrai
   changement d'état (la vidéo se fige, l'écran passe en « Repose-toi », une
   respiration guidée). Le Flowtime casse ce rythme volontairement : un chrono
   qui monte sans plafond et une pause « méritée ».
3. **Une trace** : chaque pomodoro laisse quelque chose (minutes, série, heatmap,
   plante du jardin, Wrapped). Le lendemain, il reste des preuves.

Tout ce qui sera conçu doit servir cette scène. Ce qui la dilue (tableaux de
bord denses, couleurs vives de SaaS, animations décoratives) l'abîme.

---

## 2. Stack et versions (package.json réel)

| Domaine | Choix | Version |
|---|---|---|
| Framework | Next.js App Router, Turbopack | 16.2.1 |
| UI | React | 19.2.4 |
| Langage | TypeScript | ^5 (`tsc --noEmit` : 0 erreur) |
| Styles | Tailwind CSS v4 + `tw-animate-css` + `shadcn/tailwind.css` | ^4 |
| Composants | `@base-ui/react`, `class-variance-authority`, shadcn (4 composants dans `components/ui/`) | |
| État | Zustand + `persist` (29 stores, une clé `focusflow-*` par store persisté) | ^5.0.12 |
| Animation app | `motion` (`motion/react`), 5 fichiers | ^12.43 |
| Animation landing | `gsap` + ScrollTrigger + SplitText, `@gsap/react`, `lenis` | ^3.15 / ^1.3 |
| Icônes | SVG inline (lucide-react est installé mais quasi inutilisé) | |
| Polices | Geist + Geist Mono via `next/font/google` | |
| Back optionnel | `@supabase/supabase-js` (14 tables, RLS) | ^2.100 |
| 3D | aucune dépendance installée. Le splash est un shader WebGL2 écrit à la main | |

Baseline qualité : `tsc` 0 erreur ; `npm run lint` **4 erreurs, 9 avertissements
pré-existants** (summary, StatsSection, insights, TodoStatusDropdown). Le dev
server signale une **erreur d'hydratation** sur `<html className>` (le script
de thème retire `dark` avant hydratation) visible en badge « 1 Issue » sur
toutes les captures.

Polices, couleurs, rayons : `app/globals.css` contient encore la palette
shadcn par défaut (gris `oklch(… 0 0)`) + un accent `--focus` teal + la teinte
d'ambiance `--ambient` (couleur de la vidéo, posée par `AmbientProvider`).

### Équipe d'agents

`.claude/agents/` contient **5** agents (product-lead, backend-engineer,
state-architect, qa-tester, code-reviewer). Le `frontend-engineer` cité dans
CLAUDE.md **n'existe pas** dans le dossier.

### Contrainte d'environnement découverte

Depuis le conteneur de travail, **YouTube, ytimg et Spotify sont injoignables**
(proxy 403). Conséquences : les miniatures n'apparaissent pas sur les captures
(cartes du catalogue sur fond dégradé de couleur), la vidéo de session est
noire, `/api/youtube/*` répond `exception`. La refonte devra donc être validée
visuellement avec des **images de substitution interceptées par Playwright** et
la lecture testée avec un **faux `YT.Player`** (tests e2e déterministes, ce qui
est de toute façon souhaitable). La lecture réelle reste à valider par
l'utilisateur en `npm run dev`.

---

## 3. Assets existants

| Asset | Poids | Usage actuel | Remarque |
|---|---|---|---|
| `public/tokyo_night.glb` | **37,9 Mo**, 12 meshes, ~680 k sommets, 3 textures JPEG, `KHR_materials_unlit` | **Aucun** (non référencé) | Photogrammétrie Sketchfab « TOKYO NIGHT », licence CC-BY-4.0 (attribution obligatoire : Nikitos & 3130). Inutilisable tel quel sur le web (poids), devrait être décimé + Draco/Meshopt pour descendre sous 3 Mo. |
| `public/seoul/01…06.jpg` | 3,6 Mo au total | Landing | Pexels, licence libre. Six vues nocturnes de Séoul. |
| `public/pexels-ethan-brooke-…jpg` | 1,8 Mo | Non référencé | |
| `scripts/obj2glb.mjs`, `resize-skybox.mjs` | | Restes d'une ancienne scène 3D (voitures, skybox) supprimée | |
| Shader du `SplashIntro` | inline | Splash | WebGL2 maison : surface d'eau qui déforme le mot « FocusFlow », suit la souris (curseur masqué), onde de choc au clic puis **vague de révélation circulaire** depuis le clic. Replis statiques (reduced-motion, pas de WebGL2). **L'utilisateur veut garder cet effet goutte** (ajout au prompt). |
| `AmbientBackdrop` | | Accueil, settings | Deux disques `radial-gradient` flous de la couleur ambiante qui dérivent en 26-34 s. C'est littéralement un fond « aurora / blobs flous » (sera banni en phase 1). |

---

## 4. Carte des écrans et des états

Notation : chaque écran a été capturé (`shots/before/<nom>-<d|m>-<dark|light>.png`).

### 4.1 Entrée

| Écran | Fichier | États |
|---|---|---|
| **Splash** | `components/SplashIntro.tsx` (monté dans `layout.tsx`, à chaque chargement complet) | `show` (eau + wordmark + « Respire. Focus. Flow. »), `revealing` (onde puis cercle de révélation), `fading`, `done`. Repli statique. Ne se lève **que** sur clic/touche. |
| **Landing** | `components/LandingPage.tsx` (1 704 lignes, servie par `AuthGate` aux non-connectés **seulement si Supabase est configuré**) | Hero Séoul plein écran qui se referme en fenêtre (`Collapse`), horloge 21:00 → 01:00 suivant le scroll, quatre cycles pomodoro, pauses « respirées », travelling horizontal du catalogue, sources, minuteur jouable, trace (heatmap factice), fin « Il est 21:00 quelque part ». GSAP + Lenis + SplitText. Hauteur ≈ 13 700 px. |
| **Chargement auth** | `AuthGate` | spinner sur fond `#0d0d0f`. |
| **Onboarding** | `components/Onboarding.tsx` | modale 3 étapes (ambiance lofi/ambiance/nature → rythme → lancer), flag `prefs.onboarded`. |

### 4.2 Accueil (`app/page.tsx`, 1 798 lignes) et ses 4 sections

Nav persistante `AppNav` : rail vertical desktop (logo « F », 4 icônes + libellés,
pastille qui glisse) et barre basse mobile. En-tête : titre de section en
micro-label, bouton ⌘K, « + Créer » (`CreateMenu`), avatar (`ProfilePanel`),
bascule de thème.

| Section | Contenu | États remarquables |
|---|---|---|
| **Aujourd'hui** (`TodayDashboard.tsx`) | salut horodaté, carte « Reprendre » (vidéo la plus jouée + prochaine tâche), objectif (anneau) + série + focus du jour, semaine en barres, rail horaire du jour, projet actif, sprint, routines, récap/réflexion, bannière Wrapped du lundi | **vide** (premier jour : invitations), **plein**, **squelette** d'hydratation. Sur la capture, les barres de la semaine ne sont pas visibles (animation `motion` en cours ou hauteur nulle) : à vérifier. |
| **Écouter** | sous-sélecteur segmenté `MediaTab` : **Catalogue · Découvrir · Ma bibliothèque · Spotify · Twitch** | |
| · Catalogue | « Choisis ton ambiance », filtres de mood, grille de ~55 cartes `aspect-video` | sans miniature : dégradé de `getVideoColor`. Carte sélectionnée : bordure blanche + point. |
| · Découvrir (`DiscoverPanel`) | recherche YouTube + sections « Parce que tu as écouté X » (mix RD des top titres) | vide (chips de thèmes), chargement, résultats, erreur réseau silencieuse |
| · Ma bibliothèque | File d'attente (`QueuePanel`), Mes playlists (locales), Playlists YouTube, Vidéos | chaque bloc a son état vide et son bouton Ajouter ; modals `AddVideoModal`, `AddPlaylistModal`, `NewLocalPlaylistModal`, `LocalPlaylistModal`, `PlaylistTracksModal` |
| · Spotify | connexion OAuth PKCE, profil, grille de playlists, avertissement Premium, mode « Spotify Connect » (piloter un autre appareil) pour Firefox (`AccountsPanel`) | déconnecté, connecté non-Premium, `access_denied` en mode dev |
| · Twitch | connexion, chaînes suivies en live, saisie d'une chaîne / VOD | |
| **Organisation** | `SubTabs` : Projets · Planning · Sprint · Routines · Journal | Projets (budget, rythme), Planning (`WeekPlanner`, `CalendarSync` modal webcal/ics), Sprint (`SprintWizard` formulaire → aperçu → valider), Routines (`RoutinesManager`), Journal (`JournalTimeline`). Tous ont un état vide. |
| **Activité** | `SubTabs` : Aperçu · Statistiques · Wrapped | Aperçu (`ProgressionPanel` niveau/XP, jardin, défis, objectif, stats, 7 jours, top lectures, écoutes récentes, succès, heatmap 17 semaines, tâches accomplies), Statistiques (`InsightsContent`), Wrapped (`WrappedContent` + `WrappedShareCard` Canvas 1080×1350) |

### 4.3 Parcours de session

| Écran | Fichier | États |
|---|---|---|
| **Configuration** `/settings` | `app/settings/page.tsx` (777 l.) | vignette du média choisi, 4 presets (Classic, Deep Work, Flowtime, Personnalisé), durées, Kanban des tâches + Coach (`CoachModal`), « Démarrer la session », « Enregistrer comme routine » (`RoutineSaveModal`) |
| **Session** `/session` | `app/session/page.tsx` (**1 292 lignes**) | voir 4.4 |
| **Résumé** `/summary` | `app/summary/page.tsx` | tuiles de session, Focus Score, distractions, réflexion (humeur à 5 pastilles + réussites/blocages), accomplissements, objectif, stats globales, heatmap. **Non migré** vers l'accent unique : orange, bleu ciel, violet, vert coexistent ; contient « aucune — impeccable ! » (em-dash visible). |
| `/insights`, `/wrapped` | wrappers de `InsightsContent` / `WrappedContent` | |
| 404 | défaut Next.js | **non stylée** |

### 4.4 La session, état par état

Fond : la source média en plein écran (iframe YouTube sans contrôles, ou
`SpotifyPlayer`, ou `TwitchPlayer`), vignette radiale, halo `--ambient` qui
pulse à chaque changement de piste, liseré de progression de 2 px en haut.

| État | Ce qu'on voit |
|---|---|
| **Travail, lecture** | en haut à gauche « Terminer » + carte **Now Playing** (equalizer factice + titre + « File · 3/12 » ou chaîne) ; au centre le minuteur (chiffres qui glissent, `TimerDigits`) + « Focus · N sessions » ; à droite le cluster (précédent / suivant / aléatoire / boucle si file maison, distraction, PiP, volume, aide) + « Pause » + « N tâches ». Mobile : contrôles en barre fixe basse. Panneau Kanban ouvert par défaut. Post-it en bas à gauche. |
| **Mode zen** | après 4 s sans souris (ou touche H) le chrome s'efface, il reste vidéo + minuteur. |
| **Pause utilisateur** (Espace) | même écran, vidéo en pause, bouton « Reprendre ». |
| **Pause Pomodoro** courte / longue | overlay presque opaque `#0a0a0c/95`, aurore floue de la couleur ambiante (glissée vers le froid), « Repose-toi », compte à rebours vert (courte) ou bleu ciel (longue), barre, respiration guidée 4-4-4-4, « Passer la pause », « Terminer ». Contient « Session N terminée — bien joué. » (em-dash visible). Bloom plein écran à la transition. |
| **Flowtime** | le minuteur monte, barre en `animate-pulse`, « Flow · pause méritée ≈ N min », bouton vert « Pause méritée (N min) ». |
| **Distraction** (D) | pastille ambre sur l'icône, « +1 » qui s'envole. |
| **Fin de file, boucle off** | toast « Fin de la liste · La lecture continue avec des titres similaires ». |
| **Erreur mix / playlist** | toast ambre, repli vidéo seule ou lecteur natif. |
| **Spotify** | pochette floue en fond + pochette 224 px au centre ; **UI propre** en bas à gauche (titre, volume vert, précédent, suivant, logo) ; avertissement Firefox ; spinner « Connexion Spotify… » ; erreur + « Réessayer ». |
| **Twitch** | iframe plein écran, bandeau « Contenu réservé aux abonnés ? Ouvrir sur Twitch ». |
| **PiP** | `PipTimer` : Document Picture-in-Picture (Chrome/Edge) avec minuteur, pause, distraction, fin de flow. Bouton masqué ailleurs. |

### 4.5 Transverses

| Élément | Fichier |
|---|---|
| Palette ⌘K | `CommandPalette.tsx` (z 200) |
| Toasts | `Toast.tsx` (repère coloré `accent`, sans emoji) |
| Drawer amis + chat + cloche de demandes | `FriendsDrawer.tsx`, `FriendsPanel.tsx`, `FriendChat.tsx`, `FriendRequests.tsx` (masqués sans Supabase, sur `/session`, et fermés sur mobile) |
| Profil | `ProfilePanel.tsx` (modale portalée z 120) |
| Post-its | `StickyNote.tsx` (Pointer Events) |
| Composants morts | `VideoPlayer.tsx`, `PomodoroTimer.tsx`, `VideoCatalog.tsx` ne sont importés par aucune page (seulement entre eux). |

---

## 5. Langage visuel actuel, et ce qui ne tient pas

Constats faits sur les captures, pas sur la doc :

1. **Le site connecté n'a pas d'identité.** C'est la palette shadcn grise + un
   teal. Sans la vidéo, rien n'évoque la nuit, l'Asie ou le rythme. Les tuiles
   `rounded-2xl` à bordure 6 % sur fond quasi noir sont le look « dashboard
   sombre » le plus répandu de 2025.
2. **Deux fonds d'aurore** (`AmbientBackdrop`, overlay de pause) : blobs flous
   qui dérivent. Sur les captures pleine page ils laissent une coupure franche
   (le calque fixe s'arrête à 900 px).
3. **La couleur de la vidéo (`getVideoColor`) est sous-exploitée** : elle teinte
   un dégradé de carte, un halo et l'aurore. Elle ne structure rien.
4. **Incohérences d'accent** : 254 utilisations de classes emerald / sky /
   violet / amber / orange… Le résumé, la pause (vert/bleu), Flowtime (vert),
   les colonnes Kanban (ambre/vert) ignorent le `--focus`.
5. **La landing et l'app sont deux produits** (le choix était assumé) : la
   landing est photographique, angles droits, GSAP ; l'app est grise, arrondie,
   motion. Aucun fil conducteur ne passe de l'une à l'autre, à part le splash.
6. **La landing est lourde** : ~13 700 px, beaucoup d'effets superposés
   (traînée d'images, aimants, parallaxe, néon, collapse, respiration, horloge,
   travelling, minuteur), un en-tête qui documente une « référence validée »
   (forgeautomotive) et un ton marketing par endroits. Sur captures headless,
   Playwright met plus de 30 s à capturer certaines positions : signe d'un fil
   principal saturé.
7. **Typo** : Geist partout, micro-labels mono très espacés. Propre mais
   générique, c'est la police par défaut de Next.js.
8. **Em-dashes visibles** : dans le code (pause, résumé, toasts, aide de
   session, tooltip de la boucle « Boucle désactivée — … ») et dans les titres
   du catalogue (« Study With Me — Rainy Shibuya »), qui sont des données.
   Les titres de catalogue sont du contenu YouTube ; la règle s'applique au
   texte que nous écrivons, mais l'affichage pourra normaliser le séparateur.
9. **Session** : beaucoup de verre sombre `bg-black/50 backdrop-blur` à bordure
   blanche 15-20 %, pilules, cluster d'icônes dans une capsule. Le minuteur,
   qui est l'objet principal, est petit (30 px) et sans présence.

---

## 6. Lecture média : cartographie précise des écarts

### 6.1 Où vit la logique

| Source | Logique | UI |
|---|---|---|
| YouTube (vidéo, playlist PL…, mix RD…, File FocusFlow, playlist locale chargée dans la File) | **dans `app/session/page.tsx`** : `initPlayer`, `buildManualQueue`, `advance`, `skipTrack`, effet de shuffle, `queueRef`, `originalOrderRef`, `fetchingMoreRef`, résolution `mixIds` / `playlistTracks`, `nowPlaying` | même fichier : Now Playing + cluster |
| Spotify | `components/SpotifyPlayer.tsx` (SDK Web Playback, `doPlay` sérialisé avec retries 404/401/403, refresh PKCE, watchdog 5 s, `setShuffle` + `setRepeat("context")`) | **même composant** : son propre fond, son propre Now Playing, son propre volume, ses propres boutons |
| Twitch | `components/TwitchPlayer.tsx` (embed v1, volume) | bandeau + lien dans la page de session |

La page de session choisit la source par priorité implicite :
`isSpotifyMode` (URI + token) > `isTwitchMode` > file > playlist > vidéo.
L'AmbientProvider applique, lui, Twitch > Spotify > … : **les deux priorités
divergent** (si une chaîne Twitch ET une playlist Spotify sont sélectionnées,
la session joue Spotify mais teinte en violet Twitch).

### 6.2 Tableau d'écarts

| Capacité | YouTube file maison | YouTube natif (repli PL) | YouTube vidéo seule | Spotify | Twitch live | Twitch VOD |
|---|---|---|---|---|---|---|
| Lecture/pause liée au minuteur | oui (`playVideo/pauseVideo` sur `isBreak`/`isRunning`) | oui | oui | oui (`shouldPlay`) | **non** : le live continue pendant les pauses | **non** |
| Suivant / précédent | oui, index maison | `nextVideo()` | — | oui, mais **boutons dans SpotifyPlayer** | n/a | n/a |
| Enchaînement auto | oui (ENDED → `loadVideoById`) | YouTube | boucle `playlist=id` | Spotify (contexte) | n/a | non (fin = noir) |
| Aléatoire | oui, togglable en direct (`playbackPrefsStore.shuffle`) | non | n/a | **préférence séparée** `spotifyStore.shuffle` (défaut `true`), appliquée une fois au démarrage, **aucun bouton en session** | n/a | n/a |
| Boucle | `playbackPrefsStore.loop` (défaut `true`), bouton en session | forcé `setLoop(true)`, bouton masqué | toujours | **toujours** `repeat=context`, pas de bouton, ignore la préférence | n/a | n/a |
| Fin de liste, boucle off | `fetchMixVideos(RD<dernier titre>)` : prolonge avec la radio **du seul dernier titre**, toast | n/a | n/a | **rien** (repeat context reboucle) | n/a | n/a |
| Now Playing | badge en haut à gauche (titre, `File · i/n`, equalizer) | titre de la playlist | titre + chaîne | **autre composant**, en bas à gauche, avec pochette | aucun | aucun |
| Volume | panneau vertical du cluster | idem | idem | **slider horizontal vert dans SpotifyPlayer** | panneau du cluster | idem |
| Recos à la demande | Découvrir, recos de playlist (`fetchRadioRecommendations`) | idem | idem | **aucune** | — | — |
| Erreurs | toast + repli | — | — | messages dans le composant (Premium, session expirée, Firefox) | bandeau abonnés | idem |
| Historique (`buildPlayEntry`) | « File FocusFlow » ou titre playlist | titre playlist | vidéo | nom de playlist | chaîne | « VOD id » |
| Présence amis (`activity`) | titre de la piste | titre playlist | titre vidéo | « Spotify » seulement | « Twitch » | « Twitch » |

### 6.3 Pièges connus à préserver (AGENTS.md)

- Jamais `videoId` + `list` dans le constructeur (autoplay « vidéos liées »).
- Vraies playlists en repli natif : `loadPlaylist({list, listType})` dans `onReady` + `setLoop(true)`.
- File maison pour mixes RD, playlists résolues et File FocusFlow : YouTube
  n'enchaîne pas une liste d'IDs arbitraires (ni `loadPlaylist([ids])` ni le
  playerVar `playlist`).
- `fetchingMoreRef` : garde contre les ENDED redondants pendant la résolution
  de la prolongation (sinon double avancement).
- Toute méthode IFrame utilisée doit être déclarée dans `YTPlayer`.
- Spotify : un seul `doPlay` à la fois (`playInFlightRef`), 404 transitoire
  après l'enregistrement du device, shuffle seulement sur device actif, refresh
  token tournant (PKCE), watchdog.

### 6.4 Défauts constatés dans le flux actuel

1. La prolongation YouTube suit **le dernier titre uniquement**, d'où une
   dérive rapide de style.
2. Si la résolution de la prolongation échoue, `advance` reboucle (index modulo)
   sans prévenir : correct, mais l'UI ne dit rien.
3. `skipTrack("next")` sur le dernier titre en boucle off **reboucle** au lieu
   de prolonger (seul ENDED déclenche la prolongation) : comportement incohérent
   entre « titre fini » et « je passe ».
4. Spotify ne détecte pas la fin de playlist et n'a ni shuffle ni boucle
   pilotables en session ; deux préférences de shuffle coexistent.
5. Twitch ne s'arrête pas pendant les pauses Pomodoro.
6. La page de session mélange orchestration du minuteur, présence, historique,
   et trois lecteurs : 1 292 lignes, refs miroirs dans tous les sens.

---

## 7. Données et back

- **Stores** (29) : timer, session, sessionSummary, stats, playHistory, notes,
  profile, theme, spotify, twitch, playlist, localPlaylist, queue,
  playbackPrefs, goal, achievements, distraction, prefs, routine, project, plan,
  journal, sprint, wrapped, nav (non persisté), ambient, friends/chat/drawer.
- **Supabase** (`supabase/schema.sql`, idempotent, 14 tables) : profiles,
  custom_videos, todos, user_playlists, work_sessions, projects, user_state (KV
  jsonb), local_playlists, plan_blocks, calendar_feeds, public_profiles,
  friendships, friend_stats, friend_messages. Tout passe par `lib/db.ts` /
  `lib/friends.ts` (no-op sans configuration).
- **Routes serveur** : `api/coach` (Groq → Gemini → local), `api/calendar/[token]`
  (ICS, service role), `api/twitch/token`, `api/youtube/{mix,playlist,search}`
  (parse de pages YouTube, sans clé).

La refonte ne nécessite **aucune migration SQL** a priori (partie A purement
visuelle ; partie B côté client et routes existantes). Si une migration
devenait nécessaire, elle serait soumise à l'utilisateur.

---

## 8. Ce qu'il faut retenir pour la suite

- La matière première forte existe : **les vidéos elles-mêmes, leur couleur, le
  rythme travail/pause, la nuit**. L'identité doit naître de là.
- Le site connecté est l'endroit où l'identité manque le plus ; la landing a
  une direction mais trop d'effets.
- La session est la vitrine et le point le plus fragile techniquement : la
  refonte visuelle doit y aller de pair avec l'extraction du lecteur (partie B)
  pour ne pas re-coder deux fois la même UI.
- Le splash goutte d'eau est conservé et doit devenir la porte d'entrée de la
  nouvelle identité, pas un corps étranger.
