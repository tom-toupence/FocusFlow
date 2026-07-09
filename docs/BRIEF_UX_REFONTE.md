# Brief — Refonte « expérience » de FocusFlow (à donner à un mode plan)

> Écrit le 2026-07-09. Ce document remplace l'ancienne idée de « lobby three.js » (abandonnée après
> discussion : trop lourd, contre-productif pour une app utilisée quotidiennement, et le contenu —
> de belles vidéos 4K — EST déjà l'immersion). La nouvelle mission : rendre le site **giga moderne,
> fluide et épuré** via des interactions et de l'ergonomie, pas via du 3D.
>
> **Toi qui lis ça en mode plan** : ta tâche est de transformer les idées du §D en un plan
> d'implémentation par lots, en respectant le contexte (§A), les contraintes (§B) et les
> non-objectifs (§C). Tout n'est pas à faire : choisis, découpe, priorise.

---

## A. Contexte projet (résumé — le détail est dans `CLAUDE.md`)

- **FocusFlow** : timer Pomodoro + lecteur multi-sources (catalogue YouTube curated « study with me »
  / lofi paysages à dominante Asie, playlists YouTube, Spotify, Twitch) dans une même vue plein écran.
  Gratuit, local-first (Zustand `persist`, Supabase optionnel via `lib/db.ts` no-op).
- **Stack** : Next.js 16 (App Router) + React 19 + TS + Tailwind v4 + Zustand v5. Déployé sur Vercel.
- **Navigation** : 4 sections (Aujourd'hui / Écouter / Organisation / Activité) via sidebar desktop +
  bottom-nav mobile (`AppNav.tsx`, `navStore`), palette ⌘K. Flux : `/` → `/settings` → `/session`
  (plein écran) → `/summary` → `/insights` · `/wrapped`.
- **Atout inexploité** : chaque vidéo du catalogue a une couleur dominante (`color` dans
  `data/videos.ts`, helper `getVideoColor()`) — presque pas utilisée dans l'UI aujourd'hui.
- Vient d'être fait : refonte catalogue (~55 vidéos Asie vérifiées), suppression de la feature
  « bruits de fond » (soundscapes), correctifs moods/coach. Build + tsc verts.

## B. Contraintes techniques (non négociables)

1. **Gratuit et léger** : pas de dépendance payante ni lourde. Préférer CSS/WAAPI/View Transitions ;
   `framer-motion` acceptable si vraiment justifié (à trancher au plan). **Pas de three.js.**
2. **Perf d'abord** : une vidéo YouTube tourne déjà pendant la session — les animations doivent être
   compositor-friendly (transform/opacity), 60 fps, `prefers-reduced-motion` respecté partout,
   rien qui tourne quand l'onglet est caché.
3. ⚠️ **On ne peut PAS analyser l'audio en temps réel** : le son vient d'iframes YouTube/Twitch et du
   SDK Spotify (cross-origin → `AnalyserNode` impossible ; l'API audio-analysis Spotify est dépréciée).
   Toute idée « réactive à la musique » doit donc être **pseudo-réactive** (animation organique à base
   de bruit/sinusoïdes lentes qui *semble* vivre avec la musique) ou **réactive aux événements réels**
   (lecture/pause, changement de piste, tick du timer, distraction, fin de pomodoro).
4. Conventions repo : `"use client"` + pattern `mounted` pour les stores persistés (hydratation),
   SVG inline uniquement, tokens Tailwind + `cn()`, secrets côté serveur. Checklist : `tsc` 0 erreur,
   lint sans NOUVELLE erreur, build si routing touché, `CLAUDE.md` à jour, relecture `code-reviewer`.
5. Ne rien casser : la lecture média (playlists YouTube, mixes `RD…`, file FocusFlow) vient d'être
   stabilisée — ne pas toucher à la logique du player, seulement à son habillage.

## C. Non-objectifs

- Pas de lobby/scène 3D, pas de gamification supplémentaire, pas de nouvelles features métier.
- Features déjà refusées par l'utilisateur (ne pas re-proposer) : Mode Strict, PWA offline,
  Focus Rooms, Smart Focus IA, capture rapide.
- Pas de refonte du contenu des sections — on améliore le *feel*, les transitions, l'ergonomie.

## D. Le vivier d'idées (à trier/découper au plan)

### D1. Couleur d'ambiance vivante — l'idée signature ⭐ (impact fort / effort moyen)
La couleur de la vidéo sélectionnée (`getVideoColor`) teinte toute l'app :
- Fond de l'accueil et de `/settings` en **dégradé animé très lent** (2 couleurs dérivées, animation
  type « aurora » en CSS pur, ~20 s par cycle) qui **cross-fade** quand on change de vidéo.
- En session : halo/glow discret de la même teinte autour du lecteur et derrière le timer.
- Pendant les pauses : la teinte glisse vers une variante plus froide/douce → l'app « respire » au
  rythme des phases sans un seul chiffre de plus à l'écran.
C'est la version honnête de « l'animation qui suit la musique » : l'ambiance visuelle suit *le média
choisi* et *la phase de travail*, pas le signal audio (impossible, cf. §B3).

### D2. Pseudo-réactivité musicale (impact moyen / effort faible-moyen)
- **Now Playing vivant** : le badge titre/source existant gagne un petit **equalizer animé** (3-4
  barres SVG animées par des sinusoïdes déphasées, pas par l'audio) qui ne bouge que si la lecture
  est active, se fige en pause. Illusion très convaincante, coût quasi nul.
- **Pulse au changement de piste** (file FocusFlow / mixes) : le titre glisse (slide + fade), le halo
  D1 fait une pulsation unique. Événement réel → réaction réelle.
- Optionnel : intensité de l'animation liée au *mood* (lofi = lent, ambience = très lent, nature = ondulation).

### D3. Transitions de navigation « app native » (impact fort / effort moyen)
- Transitions animées entre les 4 sections (fade + léger slide directionnel) — View Transitions API
  ou animation CSS orchestrée ; à trancher au plan selon le support Next 16.
- **Transition continue catalogue → session** : au clic sur « Démarrer », la carte vidéo s'étend
  visuellement vers le plein écran (shared-element, ou simulation : scale de la vignette + fade)
  au lieu d'un changement de page sec. C'est LE moment « wow » utile du produit.
- Entrée en session cinématique : le chrome (nav, contrôles) apparaît en cascade 300 ms, puis
  **s'efface après ~4 s d'inactivité souris** (déjà partiellement le cas ? à vérifier) — ne reste que
  la vidéo + le timer.

### D4. Le timer comme objet d'ambiance (impact moyen / effort faible)
- **Progression ambiante** : un fin liseré de progression (2 px, teinte D1) qui avance le long du
  bord supérieur de l'écran pendant le pomodoro — on *sent* l'avancement sans lire les chiffres.
- Chiffres du chrono qui basculent en **glissement vertical** (style odometer, CSS only) au lieu de
  changer sèchement.
- Fin de pomodoro : bloom doux plein écran de la teinte d'ambiance + son de transition existant
  (pas de confetti criard).

### D5. Micro-interactions transverses (impact moyen / effort faible, à saupoudrer)
- Nombres animés (count-up) sur les stats du dashboard et `/summary`.
- Anneau d'objectif (`GoalRing`) qui se remplit avec un léger overshoot élastique au montage.
- Hover states du catalogue : zoom image 1.03 + la couleur de la carte irradie légèrement (D1).
- Boutons primaires avec micro-press (scale 0.97) ; toasts qui glissent avec spring.
- Kanban : drag & drop avec réordonnancement animé (FLIP) si non existant.

### D6. Ergonomie « zéro friction » (impact fort / effort variable — bien pour un lot ultérieur)
- **« Reprendre » en un clic** sur l'accueil : un seul gros bouton qui restaure dernière ambiance +
  dernier preset et lance `/session` directement (la carte « session habituelle » existe déjà —
  la promouvoir en action principale).
- Raccourcis clavier visibles au survol (tooltips `D`, `Espace`, `⌘K`) + une touche pour
  masquer/afficher tout le chrome en session (mode ultra-zen).
- Skeletons/placeholders animés au chargement des vignettes YouTube (au lieu de sauts de layout).

## E. Ce qu'on attend du plan

1. Regrouper ces idées en **2-3 lots** livrables indépendamment (ex. Lot A = D1+D2, Lot B = D3+D4,
   Lot C = D5+D6), chacun se terminant build vert + review `code-reviewer`.
2. Trancher les choix techniques : View Transitions vs CSS orchestré, framer-motion ou pas (justifier
   le poids), où centraliser la « teinte d'ambiance » (probablement un petit store ou une CSS var
   `--ambient` posée au niveau du layout).
3. Prévoir le fallback `prefers-reduced-motion` pour CHAQUE animation dès la conception.
4. Critères de réussite : aucune régression de lecture média, Lighthouse perf ≥ existant,
   interactions fluides sur un laptop moyen, l'app doit paraître « premium et calme », pas « animée ».
