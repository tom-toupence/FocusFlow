Mission longue et autonome sur FocusFlow. Deux parties : (A) refonte totale de l'identité visuelle, landing + toute l'app connectée, avec du motion et de la 3D animée liés au thème ; (B) unification Spotify / YouTube et lecture continue. Budget d'effort : environ 2/3 pour A, 1/3 pour B. Tu n'as pas le droit d'aller vite : la vitesse produit du générique, et le générique est l'échec principal de cette mission. Chaque phase a une porte de qualité ; tu ne passes pas à la suivante tant qu'elle n'est pas franchie. Si tu penses avoir fini tôt, c'est que tu n'as pas assez itéré : retourne à la dernière boucle de critique.

Travaille sur une branche `redesign/identity`, un commit par phase, une todo list tenue à jour du début à la fin. Utilise l'équipe d'agents de `.claude/agents/` (product-lead pour arbitrer, state-architect pour la partie B, qa-tester pour valider, code-reviewer en GO/NO-GO à la fin de chaque partie).

# Ce qui change par rapport aux décisions passées

Lis CLAUDE.md, AGENTS.md et `docs/BRIEF_UX_REFONTE.md`, mais sache que CETTE mission lève explicitement les décisions de design passées :
- « Pas de three.js / pas de 3D » (brief de juillet) : LEVÉ. La 3D et le motion sont maintenant voulus.
- Le langage visuel actuel (accent unique `--focus`, landing « Une nuit à Séoul » en GSAP, Geist partout, angles droits sur la landing, densité 3/10, échelle de rayons) : tout est remis en question. Tu peux en garder une partie si elle survit honnêtement à l'exploration, mais tu dois le justifier, pas le subir.
- Le moteur d'animation par surface (motion/react dans l'app, GSAP sur la landing) : à re-trancher et justifier.

Ce qui reste NON négociable :
- Zéro emoji et zéro em-dash dans les textes visibles. Icônes en SVG inline.
- Gratuit, local-first, aucune clé API côté client, secrets côté serveur. Pas de dépendance payante.
- Les features refusées ne reviennent pas (soundscapes, Mode Strict, PWA offline, Focus Rooms, Smart Focus IA, capture rapide).
- Conventions : `"use client"` + pattern `mounted` pour les stores persistés, `lib/db.ts` pour la DB, Next.js 16 vérifié dans `node_modules/next/dist/docs/` avant d'écrire.
- Les pièges du lecteur YouTube de AGENTS.md (jamais `videoId` + `list` dans le constructeur, file maison pour mixes/playlists/File FocusFlow, garde `fetchingMoreRef`) restent vrais : la partie B ne doit pas les réintroduire.
- Checklist de livraison : `npx tsc --noEmit` 0 erreur, lint sans nouvelle erreur, `npm run build` vert, CLAUDE.md mis à jour (et nettoyé des sections de langage visuel devenues fausses).

# PHASE 0 : Comprendre (aucun code modifié)

1. Lis tout le code : `app/`, `components/`, `store/`, `lib/`, `data/videos.ts`, `supabase/schema.sql`, les assets (`public/tokyo_night.glb`, `public/seoul/`, le shader du `SplashIntro`, `AmbientBackdrop`).
2. Lance `npm run dev`, parcours chaque écran et chaque état. Captures via Playwright en headless (installe-le en devDependency si besoin) en 1440 px et 390 px. Rappel de CLAUDE.md : les captures de l'extension Chrome sont en retard sur le DOM ; Playwright avec attente explicite est la référence.
3. Écris `docs/redesign/00-AUDIT.md` : stack et versions, liste exhaustive des écrans / composants / états (vide, chargement, erreur, lecture, pause, pause Pomodoro, Flowtime, fin de file, splash, onboarding, modals, drawer amis, PiP, Wrapped…), le cœur émotionnel du produit (se concentrer seul la nuit devant un paysage d'Asie, le rythme travail/pause), et une cartographie précise des écarts entre le flux YouTube (file maison, Now Playing, shuffle/loop, recos de fin) et le flux Spotify (`SpotifyPlayer.tsx`, UI séparée) et Twitch.

Porte 0 : quelqu'un qui n'a jamais vu le code doit comprendre l'app en lisant l'audit.

# PARTIE A : DESIGN

## Phase 1 : Liste noire anti-slop

Écris `docs/redesign/01-ANTI-SLOP.md` : tout ce qui fait « site généré par IA en 2025-2026 », interdit. Au minimum : dégradés violet-bleu / aurora / blobs flous ; glassmorphism et cartes translucides à bordure blanche 10 % ; hero centré titre + sous-titre gris + 2 boutons puis 3 cartes de features ; bento grids génériques ; Inter/Geist/Poppins par défaut sans raison ; look shadcn non retravaillé ; sphère de particules, globe wireframe, torus, orb iridescent ; grain partout ; icônes dans des carrés arrondis colorés ; fade-in + translateY sur chaque bloc ; dark + un accent néon ; texte marketing creux ; « lofi girl » et clichés d'anime chill ; parallax de couches de montagnes. Ajoute 10 interdits de ton cru. Relis cette liste à chaque critique.

## Phase 2 : Exploration divergente

Dans `docs/redesign/02-CONCEPTS.md`, au moins 6 concepts radicalement différents, chacun NÉ des mécaniques réelles de FocusFlow : le cycle travail/pause, le Flowtime qui monte sans limite, la file qui avance, la fin de playlist qui se prolonge, les distractions, l'objectif du jour, le jardin de focus, les amis « en focus » en même temps que toi, la couleur dominante de chaque vidéo (`getVideoColor`, encore sous-exploitée), les paysages d'Asie la nuit.

Pour chaque concept : la métaphore centrale et pourquoi elle colle au produit ; ce que représente la 3D et comment elle réagit aux états de l'app ; palette, typographie (vraies polices nommées, gratuites, et pourquoi), grille, texture ; langage de motion (courbes, durées, ce qui ne bouge jamais) ; une scène clé décrite en détail (j'ouvre l'app, je lance une session : que se passe-t-il ?) ; et le test « ce concept pourrait-il servir à n'importe quelle autre app ? », si oui il est jeté et remplacé.

Va chercher des références hors du web design : scénographie, instruments de mesure, horlogerie, cartographie, signalétique de nuit, architecture, design sonore, phénomènes naturels. Cite-les.

Note chaque concept sur originalité, adéquation produit, lisibilité, faisabilité/perf, potentiel motion. Choisis un concept (ou une fusion argumentée), explique pourquoi les autres perdent.

Porte 2 : si le concept retenu viole un seul point de la liste noire, recommence la sélection.

## Phase 3 : Système de design

`docs/redesign/03-SYSTEM.md` + code : tokens dans `globals.css` (couleurs clair ET sombre avec contrastes WCAG AA vérifiés, typo, espacements, rayons, élévations), tokens de motion (easings nommés, durées, règles de chorégraphie), composants de base reconstruits (boutons, inputs, segmented controls, cartes média, rangées de piste, contrôles de lecteur, barre de progression, toasts, modals portalées, squelettes, états vides). Une page interne `/_design` qui montre tout.

## Phase 4 : 3D et motion

- Choisis la techno et justifie (React Three Fiber + drei, Three.js brut, OGL, shaders GLSL maison comme celui du splash…). Les shaders écrits à la main sont encouragés : c'est ce qui sort le plus du déjà-vu. `public/tokyo_night.glb` existe : utilise-le seulement s'il sert le concept.
- Contrainte dure : impossible d'analyser l'audio (iframes YouTube/Twitch et SDK Spotify cross-origin, audio-analysis Spotify dépréciée). Aucun faux visualiseur qui prétend réagir au son. La réactivité vient des événements réels : play/pause, changement de piste, tick du timer, passage travail/pause, distraction, fin de pomodoro, objectif atteint, couleur de la vidéo, ami qui passe en focus.
- En session, la vidéo 4K EST l'immersion : la 3D ne doit jamais lui faire concurrence. Décide où elle vit (landing, accueil, transitions, settings, résumé, session en mode Spotify sans vidéo, pauses…) et documente ce choix.
- Perf : une vidéo tourne pendant la session, donc 60 fps sur un laptop moyen, lazy-load de la 3D, pause quand l'onglet est caché ou la scène hors écran, DPR plafonné, repli statique soigné sans WebGL ou sur mobile faible, `prefers-reduced-motion` respecté partout.

## Phase 5 : Landing

Réécris `components/LandingPage.tsx` selon le concept. Elle raconte le produit par la mise en scène, pas par une liste de features. Scroll avec intention, copy concret et spécifique. Le splash d'entrée doit être cohérent avec la nouvelle identité (le refaire ou l'adapter).

## Phase 6 : Toute l'app connectée

Applique l'identité à CHAQUE écran et état de l'audit, sans exception : accueil et ses 4 sections, Écouter (Catalogue, Découvrir, Bibliothèque, Spotify, Twitch), Organisation et ses sous-onglets, Activité / Insights / Wrapped (y compris la carte Canvas PNG), `/settings`, `/session`, `/summary`, onboarding, drawer et chat d'amis, ⌘K, PiP, modals, toasts, 404, thème clair ET sombre. La session et les transitions entre écrans (notamment catalogue vers session) sont la vitrine.

## Phase 7 : Critique (au moins 3 tours)

À chaque tour : captures Playwright de tous les écrans en 1440 et 390 px, clair et sombre, plus les animations clés à plusieurs instants ; tu REGARDES réellement les images ; tu écris une critique sévère de directeur artistique dans `docs/redesign/07-CRITIQUE-N.md` (hiérarchie, rythme, cohérence, finitions, ce qui fait encore template, violations de la liste noire) ; tu corriges tout ; tu recommences. Ajoute un audit d'accessibilité (contrastes, focus, clavier, ARIA) et de perf (Lighthouse, poids du bundle 3D).

Porte finale A : tu t'arrêtes seulement quand une critique complète ne trouve plus rien de significatif. Puis relecture `code-reviewer`.

# PARTIE B : FONCTIONNEL

## Phase 8 : Une seule interface de lecture

Aujourd'hui `app/session/page.tsx` mélange les flux (`isSpotifyMode`, `isTwitchMode`, file maison YouTube), le Now Playing et le cluster shuffle/loop/skip n'existent que pour YouTube, et Spotify garde son UI propre dans `SpotifyPlayer.tsx`. Le refactor « MediaController » avait été volontairement reporté : c'est maintenant le travail.

- Conçois une interface commune (ex. `MediaSource` / `PlayerAdapter`) : load, play, pause, seek, next, previous, état, volume, shuffle, loop, événements fin de piste / changement d'état / erreur, `getSuggestions(seeds)`, et un modèle de piste normalisé (id, titre, artistes ou chaîne, durée, miniature, source).
- Adaptateurs YouTube (en reprenant tel quel le comportement de la file maison et des pièges connus), Spotify, et Twitch (live : documente ce qui ne s'applique pas, par exemple next/suggestions, et comment l'UI le montre proprement).
- L'UI (Now Playing, cluster de contrôles, volume, file, suggestions) consomme UNIQUEMENT l'abstraction. Plus de branches `if spotify / else youtube` dans les composants. Sortir la logique du player de la page de session de 1300 lignes.

## Phase 9 : Lecture continue et suggestions partout

1. Lecture auto du titre suivant : identique sur YouTube et Spotify.
2. Fin de playlist alors que la session n'est pas terminée (timer ou Flowtime encore actif) : l'app ajoute de nouveaux titres cohérents avec L'ENSEMBLE de la playlist, pas seulement le dernier titre comme aujourd'hui (`fetchMixVideos(RD<dernier>)` dans la branche loop off), puis continue sans coupure.
   - Côté YouTube : utilise `fetchRadioRecommendations` (round-robin sur plusieurs seeds) semé sur un échantillon représentatif de toute la playlist, dédoublonné contre tout ce qui a déjà été joué pendant la session.
   - Côté Spotify : détecte la vraie fin de playlist et ajoute à la file. Vérifie d'abord ce que l'app Spotify du projet peut appeler : Spotify a coupé fin 2024 plusieurs endpoints pour les nouvelles apps (recommendations, related artists, audio features). Confirme ce qui marche, et prévois un repli documenté (top tracks des artistes récurrents de la playlist, recherche par artiste, endpoint de file `/me/player/queue`).
   - Clarifie et documente l'interaction avec le bouton boucle (boucle activée = on reboucle ; désactivée = on prolonge), et applique la même règle aux deux sources.
   - Montre-le dans l'UI avec soin (un état « la session continue avec des titres proches » prévu dans le design de la partie A), avec possibilité de retirer ou passer une suggestion.
3. Suggestions à la demande (Découvrir, recos par playlist) disponibles aussi pour les playlists Spotify, avec la même UI.
4. Cas limites : playlist vide, titre indisponible ou bloqué par région, quota, réseau perdu, token Spotify expiré, compte non Premium, changement de source en cours de session, ENDED redondants.

## Phase 10 : Tests et vérification

Tests unitaires (adaptateurs, logique de file, sélection des suggestions, API mockées) et scénarios end-to-end Playwright : playlist jouée jusqu'au bout puis prolongée, enchaînement auto, boucle on/off, sur chaque source. Compare avec l'audit de phase 0 : aucune régression des playlists YouTube, mixes RD, File FocusFlow, playlists locales. tsc, lint, build verts. Relecture `code-reviewer`.

# Livrable final

`docs/redesign/REPORT.md` : le concept retenu et pourquoi, captures avant / après de chaque écran, ce qui a été fait en partie B avec les choix d'API et leurs limites, compromis assumés, reste à faire, comment désactiver la 3D. CLAUDE.md mis à jour avec le nouveau langage visuel et un journal de session.

# Règles de conduite

Ne me pose pas de question pour les décisions de design : décide, justifie dans les docs, avance. Arrête-toi et demande uniquement pour l'irréversible ou le coûteux (migration SQL Supabase, suppression de données, nouveau service, clé manquante). Ne supprime aucune feature sans la documenter. Entre « rapide » et « juste », choisis « juste ».

# Ajout de l'utilisateur (2026-11-20)

On garde l'effet goutte d'eau au début (le shader du `SplashIntro` : surface d'eau, onde de choc au clic, vague de révélation). Phase 5 : le splash est ADAPTÉ à la nouvelle identité (texture, typographie, couleurs, cohérence avec la landing), jamais remplacé par autre chose. Ce mécanisme devient un invariant de la refonte.
