# Refonte FocusFlow : rapport final

Branche `claude/redesign-identity-phase-0-0fpg4w`. Mission : `PROMPT.md`.
Ce rapport résume ce qui a été fait, pourquoi, ce qui a été vérifié et ce qui
ne l'a pas été.

## 1. Partie A : identité

### Le chemin (y compris les impasses)

| Étape | Résultat | Document |
|---|---|---|
| Phase 0 : audit | état des lieux, écarts YouTube / Spotify / Twitch, composants morts | `00-AUDIT.md` |
| Phase 1 : liste noire | réflexes interdits, puis mes propres réflexes (R1 à R18), puis clichés du thème | `01-ANTI-SLOP.md` |
| Phase 2 : concepts | Clepsydre (eau), abandonnée car trop proche de mes réflexes ; Céladon, abandonnée car hors thème | `02-CONCEPTS.md` |
| Lab 1 | 6 prototypes, 6 librairies nouvelles ; aucun n'était dans le thème imposé ensuite | `LAB.md` |
| Lab 2 | 6 prototypes « ville de nuit » modélisés en code ; jugés « prototype de jeu vidéo » | `LAB.md` |
| Lab 3 | réalisme : photo 2.5D (crédible), gaussian splats (aucune capture libre), 3D Poly Haven (se lit comme de la 3D) ; comparés à 3 vraies photos | `LAB.md`, `shots/lab3/` |
| Lab 4 | la capture TOKYO NIGHT que l'utilisateur avait déposée sur `master` (et que l'audit avait écartée à tort) : **« la fenêtre »** | `LAB.md`, `shots/lab4/` |

### Le résultat : « la ville qui ne dort pas »

- **Concept** : on travaille tard à sa fenêtre, en haut d'une tour ; chaque
  événement de la session est un événement de la ville (`02-CONCEPTS.md`).
- **Système** : nuit par défaut, petit matin en thème clair ; couleurs par rôle
  (sodium = maintenant, vert supérette = fait, néon blanc = texte, feu arrière =
  alerte, taxi = rare) ; Big Shoulders, Doto (afficheur à points), Atkinson
  Hyperlegible Next (`03-SYSTEM.md`).
- **La façade** : toutes les jauges et barres deviennent des tours dont les
  étages s'allument.
- **La scène** : `lib/city/TokyoRenderer.ts`, séquences par état
  (`04-3D-MOTION.md`).
- **Landing** réécrite autour de la scène ; **splash** : effet goutte conservé
  (demande de l'utilisateur), texture devenue une flaque qui reflète l'enseigne.
- **Session** : minuteur en panneau LED, halte dans la ville (respiration en
  tube néon), mode Spotify avec la ville en fond.
- **Tous les écrans** repris : vocabulaire de l'eau retiré, couleurs génériques
  (dont un rose fuchsia interdit) remplacées, titres du catalogue sans noms de
  lieux, pays jamais affiché.

### Critique (4 tours)

`07-CRITIQUE-1.md` (jauges, minuteur, palette, vocabulaire), `07-CRITIQUE-2.md`
(graphiques, gamification, mobile), `07-CRITIQUE-3.md` (accessibilité,
performance), `07-CRITIQUE-4.md` (écrans jamais revus : 404, carte et page
Wrapped, heatmap du relevé, projets, rail horaire, `/_design` ; transition
réglages vers session ; Lighthouse). Planches dans `shots/crit1/`,
`shots/crit2/`, `shots/crit4/`.

### Avant / après, écran par écran

Planches côte à côte (avant à gauche, après à droite, nuit, 1440 px) dans
`shots/compare/`. Captures brutes : `shots/before/` (audit, phase 0) et
`shots/after/` (fin de refonte), produites par `scripts/shoot.mjs` avec les
mêmes données de démonstration.

| Écran | Ce qui a changé |
|---|---|
| Landing | page marketing générique remplacée par la nuit qui avance devant la fenêtre ; chaque section déclenche un événement de la ville |
| Splash | effet goutte conservé ; flaque sur l'asphalte qui reflète l'enseigne |
| Aujourd'hui | façades à la place des anneaux et barres, rail horaire, couleurs par rôle |
| Écouter (catalogue, découvrir, bibliothèque, Spotify, Twitch) | titres sans noms de lieux, cartes de média sobres, « Titres proches » sur les playlists Spotify |
| Organisation (projets, planning, sprint, routines, journal) | rangées de fenêtres, statuts aux bonnes couleurs |
| Activité, insights | barres en tours (`.ff-floors`), plus de fuchsia ni d'arc-en-ciel |
| Wrapped (page et carte PNG) | panneau à points, soirs allumés, taxi pour le meilleur soir |
| Réglages | durées lisibles hors « Personnalisé », cycle en sodium, transition vers la session |
| Session | minuteur en panneau LED, halte dans la ville, « À venir », contrôles selon les capacités de la source |
| Relevé | bandeau de ville, heatmap visible, chiffres en relevés sous filet |
| 404 | page à l'identité (était celle de Next, en anglais) |

### Désactiver la 3D

- **Pour soi** : profil, « Affichage », décocher « Ville animée en 3D » (une
  image fixe la remplace partout).
- **Automatique** : `prefers-reduced-motion`, absence de WebGL2, ou rendu
  logiciel détecté (`lib/gpu.ts` : SwiftShader, llvmpipe), car ce rendu
  gèlerait l'interface ; le splash passe aussi à sa version fixe.
- **Pour tout le déploiement** : variable `NEXT_PUBLIC_DISABLE_WEBGL=1`.
- **Forcer l'animation** (démo sur machine sans GPU) :
  `localStorage["focusflow-force-webgl"] = "1"`.

## 2. Partie B : lecture

- **Interface unique** (`lib/playback/types.ts`) : un `PlayerAdapter` par
  source, état observable, capacités déclarées. La session ne pilote plus que
  l'adaptateur ; 400 lignes de logique YouTube sorties de `app/session/page.tsx`
  vers `lib/playback/youtube.ts`.
- **Écarts corrigés** : Twitch n'était pas mis en pause pendant la halte ;
  shuffle et boucle n'existaient que pour YouTube (désormais aussi Spotify) ;
  volume commun ; « en cours de lecture » unifié pour les trois sources ; une
  vidéo illisible ne bloque plus la file.
- **Interface complète** : `seek`, `getSuggestions`, `enqueue`,
  `removeUpcoming`, file à venir, piste normalisée (`Track`, avec
  `suggested`). La page de session ne distingue plus les sources :
  `useSessionMedia` (résolution des mixes RD et playlists PL, historique) et
  `SessionMedia` (lecteur, habillage) ; adaptateurs dans
  `lib/playback/{youtube,spotify,twitch}.ts`. Page passée de 1 055 à 880 lignes.
- **« À venir »** en session : prochains titres, suggestions marquées,
  retirer (YouTube) ou écouter maintenant (Spotify, qui n'a pas de retrait),
  titres proches à la demande. **Hors session**, « Titres proches » sur les
  cartes Spotify (ouverture dans Spotify : les autorisations demandées
  n'incluent pas la modification de playlist, choix voulu).
- **Cas limites** : playlist PL non résolue = lecteur natif ; mix RD non
  résolu = vidéo de départ en boucle ; vidéo illisible = titre suivant ;
  prolongation bornée à 10 s ; YouTube muet 15 s = message ; jeton Spotify
  rafraîchi, Premium manquant = message ; suggestions vides (réseau, quota) =
  message ; titre retiré jamais réintroduit.
- **Lecture continue** (`lib/playback/continuation.ts`) : graines réparties sur
  toute la playlist plus la dernière jouée, fusion en alternance, dédoublonnage,
  repli en boucle si rien de neuf ; boucle activée = reprise en tête.
  YouTube : mix radio par graine, borné à 10 s. Spotify : l'endpoint
  `recommendations` étant fermé aux nouvelles applications depuis novembre 2024,
  titres phares des artistes échantillonnés, mis en file au début du dernier
  titre, une tentative par fin. Les suggestions des modals de playlist
  utilisent le même échantillonnage.

## 3. Vérifications

| Vérification | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run lint` | 4 erreurs, 8 avertissements, toutes antérieures à la refonte (base : 4 et 9) |
| `npm run build` | vert |
| `npm test` (Vitest) | 33 tests : file (dont retrait), continuation, adaptateurs YouTube (file à venir, suggestions, ajout), Spotify (capacités, relais, pas de retrait) et Twitch (live, VOD, pause avant prêt) |
| `npm run test:e2e` (Playwright) | 13 tests : lecture continue, boucle, contrôles unifiés, mix RD, playlist PL et repli natif, playlist locale, Twitch (pause pendant la halte), « À venir » (retrait, suggestion marquée), navigation, thème petit matin, réglages, zéro emoji et tiret cadratin |
| Lighthouse (production, sans GPU) | accessibilité 100, SEO 100, bonnes pratiques 96 à 100 ; performance 79 à 90 (45 à 51 avant le correctif du splash), TBT 81 à 246 ms (146 s avant) ; voir `07-CRITIQUE-4.md` |
| `npm run test:a11y` (axe-core) | 0 défaut WCAG 2.1 AA sur 7 pages, deux thèmes |
| `node scripts/contrast.mjs` | toutes les paires AA |
| Relecture `code-reviewer` | A : GO conditionnel, 4 points corrigés ; B (interface de lecture complète) : GO, 2 points corrigés (« Passer » trompeur sur Spotify, titre retiré réintroduit) et 4 suggestions appliquées |

## 4. Non vérifié (limites de l'environnement)

- **Images par seconde** : aucun GPU dans le conteneur (rendu logiciel). Les
  60 images/s sont à vérifier sur une vraie machine.
- **Spotify et YouTube réels** : réseau bloqué ici ; la logique est testée avec
  des lecteurs simulés. La prolongation Spotify (top-tracks + file d'attente)
  n'a pas été essayée contre l'API réelle.
- **Rendu visuel exact** sur Safari et Firefox.

## 5. À décider par l'utilisateur

- Fusionner la PR (ouverte à ta demande sur la branche).
- Retirer les labs (`app/lab`, `lib/lab`, `public/lab`) et leurs dépendances de
  développement (pixi.js, gpu-curtains, manifold-3d, troika, @thi.ng, tweakpane)
  si l'historique de la recherche ne doit pas rester dans le dépôt. Ils sont
  exclus de la production.
- CSP : `'wasm-unsafe-eval'` (décodeur meshopt des modèles) et `blob:`
  (textures des modèles) sont nécessaires en production.

Déjà fait : `public/seoul/`, la photo Pexels historique, les SVG par défaut et
les composants morts (`VideoPlayer`, `PomodoroTimer`, `VideoCatalog`) sont
supprimés.
- Environnement cloud « focusflow (assets libres) » créé pour accéder aux
  banques d'assets (hôtes ajoutés : Poly Haven, ambientCG, Wikimedia, Hugging
  Face, jsDelivr) ; il peut être supprimé dans les réglages Claude Code.
