# 03 · Système de design « Clepsydre de nuit »

> Source de vérité du code : `app/globals.css` (tokens), `lib/motion.ts`
> (mouvement), `components/ff/*` (composants de base), page interne
> **`/_design`** (vitrine de tout, dans le thème courant).
> Contrastes : `node scripts/contrast.mjs` (sort en erreur si une paire échoue).

## 1. Principe

Le temps de travail se lit comme une hauteur d'eau. Deux thèmes, deux
situations, pas une inversion :

| | Thème clair : **Papier du relevé** | Thème sombre : **Eau de nuit** (défaut) |
|---|---|---|
| Quand | le jour, on relit sa trace | le soir, on travaille |
| Fond | papier crème froid | encre bleu-noir à peine tiède (jamais `#000`) |
| Encre | graphite bleuté | blanc papier chaud |
| Signal | sodium brûlé (lisible sur papier) | sodium de lampadaire |

**Un seul signal fixe : le sodium**, la lumière orangée des lampadaires des
photos de Séoul. Il veut dire « maintenant, ce qui est mesuré » : trait de
niveau, minute en cours, onglet actif, bouton qui met le temps en marche.
**La couleur de la vidéo (`--reflet`, = `--ambient-raw`) n'est jamais un accent
d'interface** : c'est un reflet, posé sur l'eau et sous les médias.

## 2. Couleurs

Tokens (oklch) : `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`,
`--text`, `--text-2`, `--text-3`, `--on-text`, `--sodium`, `--sodium-text`,
`--on-sodium`, `--danger`, `--water`, `--water-deep`, `--reflet`.
Utilitaires Tailwind : `bg-bg`, `bg-surface`, `bg-surface-2`, `border-line`,
`border-line-strong`, `text-ink`, `text-ink-2`, `text-ink-3`, `text-on-ink`,
`bg-sodium`, `text-sodium-text`, `text-on-sodium`, `text-danger`, `bg-water`,
`bg-water-deep`, `bg-reflet`.

Règles :
- **Texte** : `ink` (titres, contenu), `ink-2` (secondaire), `ink-3` (méta).
  Fini les `text-foreground/35` : ces opacités échouaient en AA. `ink-3` passe
  4,5:1 sur toutes les surfaces dans les deux thèmes.
- **Sodium** en graphisme (traits, points, remplissage de bouton) ;
  **`sodium-text`** dès que c'est du texte (plus sombre sur papier).
- **Couleurs sémantiques conservées** : marques (Spotify `#1db954`, Twitch
  `#9146ff`), couleur choisie par l'utilisateur (projets, routines), pastilles
  d'humeur, rouge destructif. Toujours en petite surface (point, filet).
- **Interdit** : emerald/sky/violet/amber/orange décoratifs (254 occurrences à
  migrer en phase 6), dégradés colorés, verre translucide.

Contrastes vérifiés (extrait, ratio mini sur les 3 surfaces) :

| Paire | Papier | Eau de nuit | Seuil |
|---|---|---|---|
| ink / fond | 13,5 | 13,0 | 4,5 |
| ink-2 / fond | 7,4 | 8,3 | 4,5 |
| ink-3 / fond | 5,1 | 5,5 | 4,5 |
| sodium-text / fond | 5,7 | 9,4 | 4,5 |
| on-sodium / sodium | 4,9 | 9,2 | 4,5 |
| sodium (graphique) / fond | 4,5 | 9,0 | 3 |
| line-strong (bord de contrôle) / fond | 3,5 | 3,3 | 3 |
| danger / fond | 5,4 | 6,2 | 4,5 |

Compatibilité : les anciens noms shadcn (`--background`, `--foreground`,
`--card`, `--border`, `--focus`…) pointent vers les nouveaux tokens, pour que
l'app reste cohérente pendant la migration écran par écran. `--focus` devient
le sodium (même rôle, nouvelle couleur).

## 3. Typographie

| Famille | Rôle | Pourquoi elle, et pas une autre |
|---|---|---|
| **Hahmlet** (Hypertype, OFL) | titres (`font-display`, `font-heading`) | serif dessinée **conjointement pour le hangeul et le latin** : porte le fil coréen du concept (clepsydre de Sejong, Séoul) sans pastiche ni « police asiatique » décorative. Ce n'est pas la serif à la mode (Instrument Serif, Fraunces). |
| **Azeret Mono** (Displaay, OFL) | tout ce qui est **mesuré** (`font-mono`) : minuteur, durées, graduations, compteurs | dessinée pour les données et les instruments ; chiffres étroits et stables, lisibles de loin sur une vidéo. |
| **Atkinson Hyperlegible Next** (Braille Institute, OFL) | corps (`font-sans`) | conçue pour les basses visions : lisible **la nuit, écran baissé**. Seule raison valable de choisir une sans dans ce produit. |

Geist est retirée (police par défaut de Next.js, aucun argument propre au
produit). Toutes chargées par `next/font/google` (auto-hébergées, aucun appel
externe à l'exécution).

Échelle (px) : 11 · 12 · 13 · 14 · 15 · 17 · 20 · 26 · 32 · 42 · 56 ·
`clamp()` pour les titres d'écran. Règles :
- les titres d'écran en Hahmlet **300**, les titres de bloc en 400 ;
- **la mono est réservée aux mesures** (liste noire C15) : pas de titres de
  section en capitales mono espacées. Les anciens micro-labels deviennent des
  titres Hahmlet courts ou disparaissent ;
- chiffres toujours `tabular-nums` ;
- capitales uniquement pour les marqueurs de type de 10 px (« PLAYLIST »).

## 4. Espace, grille, rayons, élévation

- **Espacements** : base 4, échelle 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
  Les graduations de l'eau sont sur 8 (mineure) et 64 (majeure).
- **Grille** : contenu `max-w-6xl`, gouttière 16 px mobile, 32 px desktop. Le
  dashboard s'aligne sur une **échelle verticale du jour** (voir phase 6), pas
  sur une mosaïque.
- **Rayons** : `--r-hair` 2 px (instruments, tags), `--r-media` 4 px (vignettes :
  une fenêtre a des angles presque vifs), `--r-control` 6 px (boutons,
  champs), `--r-surface` 10 px (panneaux, modales). **Pas de pilule** hors
  points et gouttes.
- **Élévation** : 0 = posée (la plupart des surfaces, séparées par un filet ou
  par la valeur de fond), 1 = flottante (`--shadow-float` : menus, toasts),
  2 = modale (`--shadow-modal` + voile d'encre 72 %). En sombre, l'élévation
  se lit surtout par la surface plus claire.

## 5. Mouvement

Deux familles de temps, jamais mélangées dans un même geste :

| Token | Courbe | Durée | Usage |
|---|---|---|---|
| `ui` | `cubic-bezier(.25,.8,.3,1)` | 90 / 160 / 240 ms | réponse d'interface : survol, onglet, menu, modale |
| `fall` | `cubic-bezier(.55,0,.9,.4)` | 520 ms | chute d'une goutte (gravité) |
| `settle` | `cubic-bezier(.18,.9,.22,1.04)` | 900 ms | l'eau qui se pose (un léger dépassement, une seule fois) |
| `tide` | `cubic-bezier(.45,0,.55,1)` | 4 s | marée, respiration guidée |
| `spring` (motion) | raideur 380, amortissement 36 | | indicateurs qui glissent (trait de niveau des onglets) |

Le niveau d'eau qui suit le minuteur monte en **linéaire 1 s** : c'est le
temps réel, il ne doit pas être « embelli ».

**Chorégraphie**
1. Un seul événement d'eau à la fois (goutte, caillou, débordement). Un
   deuxième attend la fin du premier ou le remplace.
2. L'interface n'attend jamais l'eau : un clic répond en 160 ms, l'eau suit.
3. Décalage (stagger) seulement pour une **séquence dans le temps** (pistes
   d'une file) : 30 ms, 6 éléments au plus, le reste d'un bloc.
4. **Ne bougent jamais** : le texte en lecture, l'échelle graduée, la position
   des chiffres du minuteur, la navigation.
5. **Aucune boucle décorative.** Seules boucles admises : la surface d'eau tant
   qu'une lecture ou une session est active (processus réel), et l'attente
   d'un chargement de plus de 600 ms (`ff-wait`).
6. Tout est neutralisé par `prefers-reduced-motion` (classes `ff-*` dans
   `globals.css`, `tr()` / `useReducedMotion` côté motion) ; l'information reste
   donnée sans mouvement (niveau statique, texte).
7. Onglet caché : toute animation continue s'arrête (`data-tab-hidden` posé par
   `AmbientProvider`, `visibilitychange` côté WebGL).

**Moteur d'animation (re-tranché)** : **`motion/react` partout**, landing
comprise, plus des shaders WebGL2 écrits à la main pour l'eau. GSAP,
ScrollTrigger, SplitText et Lenis sont retirés à la réécriture de la landing :
- un seul modèle mental et un seul runtime pour toute l'app ;
- `useScroll` / `useTransform` de motion suffisent pour une landing qui
  avance avec le scroll **sans** scroll-jacking ni défilement amorti (Lenis
  détourne le défilement natif, liste noire E27) ;
- découper le texte en lignes masquées (SplitText) était l'un des tics de
  la landing actuelle : la nouvelle n'en a pas besoin ;
- trois dépendances de moins sur la landing (gain de poids mesuré en phase 7).

## 6. Composants de base (`components/ff/`)

| Composant | Rôle | Points d'attention |
|---|---|---|
| `Button` | `ink` (principal), `signal` (sodium : « Démarrer », « Reprendre »), `line`, `quiet`, `danger` ; tailles sm/md/lg | anneau de focus sodium, enfoncement de 1 px, pas de pilule |
| `IconButton` | carré, `label` obligatoire (aria-label + infobulle + raccourci) ; `tone="on-media"` sur vidéo | aplat opaque sur vidéo, jamais de verre |
| `Field` | champ avec libellé toujours présent, unité mono, indice / erreur reliés en `aria-describedby` | ligne d'encre basse qui passe au sodium au focus |
| `Segmented` | sous-navigation : libellés sur une ligne d'échelle, trait de niveau sodium qui glisse | rôle `tablist`, flèches / Début / Fin |
| `Gauge` | **la colonne** : niveau d'eau gradué, repère gravé (objectif), vases pleins (Flowtime), pulsations goutte / caillou | `role="meter"`, SVG/CSS seulement (posable sur une vidéo) |
| `MediaCard` | vignette 16:9 sur sa **ligne d'eau** à la couleur de la vidéo ; sélection = ligne sodium + « Choisie » | titres normalisés sans em-dash (`cleanTitle`) |
| `TrackRow` | ligne de relevé : position mono, titre, source, durée ; états `playing`, `played`, `suggestion` (« proche », retirable) | `aria-current` sur la piste en cours |
| `PlayerControls` | précédent / suivant / aléatoire / **Boucler ⇄ Prolonger** ; ne connaît que des capacités | une capacité absente reste à sa place, désactivée, avec sa raison |
| `Modal` | portalée sur `body`, voile d'encre, Échap, focus piégé et restitué | bottom-sheet sur mobile |
| `Skeleton`, `EmptyState`, `SectionTitle` | chargement immobile (respire après 600 ms), état vide = **colonne sèche** + phrase + geste | |
| `Toast` (existant, restylé) | bas d'écran, aplat d'encre, repère sodium (info) ou rouge (alerte), `aria-live` | ne couvre jamais le minuteur |
| `icons.tsx` | une seule famille SVG, trait 1,6 | `IconStone` (distraction), `IconExtend` (prolonger) |

Helpers : `lib/text.ts` (`cleanTitle`, `formatMinutes`, `formatClock`, `plural`),
`lib/motion.ts` (`EASE`, `DUR`, `T`, `tr`).
