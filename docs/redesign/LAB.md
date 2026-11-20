# LAB · six prototypes jetables (recadrage, 2026-11-20)

Route `/lab` (404 en production sauf `NEXT_PUBLIC_LAB=1`), un dossier par
prototype dans `app/lab/*`, la logique dans `lib/lab/*`. Chaque prototype joue
**la même séquence** sur une horloge simulée (25 min jouées en 25 s) :
entrée en scène, travail, distraction, fin de pomodoro, pause, reprise.
Captures et vidéos : `docs/redesign/shots/lab/` (`<slug>-d-0N-*.jpg`,
`<slug>-d.mp4`), montage : `lab-montage.mp4`. Script : `scripts/lab-shoot.mjs`.

**Sur la mesure de perf.** Le conteneur n'a pas de GPU : Chromium headless
rend en logiciel (SwiftShader). Les images par seconde mesurées (1 à 12 i/s
pour la 3D) ne disent donc rien d'un vrai laptop. Les chiffres utiles relevés
ici sont le **temps CPU par image** côté JavaScript, les **triangles** et les
**appels de dessin**, qui, eux, ne dépendent pas du GPU.

Le témoin : l'ancien concept (eau de nuit, `WaterScene`) n'est pas rejoué ici,
il sert de référence de ce que je fais par défaut (réflexes R1, R8, R9).

---

## 1 · Céladon — `/lab/celadon`

- **Technique jamais utilisée ici** : three.js **WebGPURenderer + TSL**
  (matériaux en nœuds, repli WebGL2 automatique), géométrie **tournée**
  (LatheGeometry sur un profil de maebyeong Goryeo dessiné à la main en
  Catmull-Rom), **cyclorama** de studio construit sommet par sommet.
- **Direction** : clair, chaud, matière. Céramique, studio photo, lumière
  key chaude / fill froide / rim. Typo Gowun Dodum (sans arrondie coréenne).
- **Mécanique** : l'émail céladon MONTE le long du vase avec le temps ; bord
  d'émail irrégulier avec coulures, craquelure (Voronoï F2-F1), terre crue
  mouchetée au-dessus. Fin de pomodoro : un tour de tournette. Pause : la
  lumière tombe vers le bleu du soir. Distraction : le vase est heurté et oscille.
- **Ce que ça donne** : le plus beau du lab. On lit le temps du coin de l'œil
  (la hauteur d'émail), la matière est inattendue pour une app de focus.
- **Surprise** : le contraste terre mate / émail brillant suffit à faire
  comprendre « fait / pas encore fait » sans aucun chiffre.
- **Ce qui rate** : craquelure trop régulière et trop sombre (on dirait un
  dessin de cellules), le cyclorama ne se lit pas, le rendu du bord d'émail
  scintille un peu sous la caméra.
- **Perf** : 88 k triangles, 4 appels de dessin, **0,5 à 0,6 ms CPU/image**.

## 2 · Chiffres physiques — `/lab/blocks`

- **Technique** : **opentype.js** (contours réels des glyphes d'Archivo Black
  → ShapePath → ExtrudeGeometry biseautée) + **Rapier** (physique WASM, enveloppes
  convexes), caméra orthographique axonométrique, ombres franches.
- **Direction** : jouet de construction Bauhaus, bleu cobalt / vermillon /
  jaune sur fond os.
- **Mécanique** : chaque minute, le chiffre qui change bascule du socle ; à
  la fin du pomodoro, tout s'effondre en tas ; distraction = secousse du socle.
- **Ce que ça donne** : drôle, tactile, très loin de mes réflexes.
- **Ce qui rate** : **illisible**. Le minuteur devient un tas de chiffres ; la
  pile de chiffres tombés domine ce qui reste à faire. La caméra coupe les
  chiffres qui tombent. Deux couleurs seulement apparaissent (attribution par
  emplacement). Échec comme direction ; le principe « vraie typo extrudée »
  est à garder.
- **Découvert en route** : la CSP du site interdisait WebAssembly ;
  ajout de `'wasm-unsafe-eval'` (n'autorise pas `eval` JS). Et `ShapePath.toShapes()`
  a changé dans three 0.187 (règle pair-impair, plus d'argument d'orientation) :
  ma mémoire de l'API était fausse.
- **Perf** : 15 à 65 k triangles selon le tas, 9 à 27 appels, **1 à 5 ms CPU**
  (la physique pèse au moment de l'effondrement).

## 3 · Presse — `/lab/textmode`

- **Technique** : **textmode.js** (grille de caractères WebGL2, conversion
  d'image en glyphes, rendu instancié).
- **Direction** : éditoriale, papier journal, une seule encre + rouge
  d'imprimerie, tout l'écran est une grille de caractères.
- **Mécanique** : le pomodoro imprime la photo de Séoul ligne par ligne sous
  une tête d'impression qui crépite ; minutes en chiffres bloc ; distraction =
  ligne mal imprimée ; pause = page inversée.
- **Ce que ça donne** : la pause inversée est forte, la tête d'impression aussi.
- **Ce qui rate** : la photo de nuit, très sombre, se convertit mal (aplats de
  `@`) ; il a fallu trois essais de rampe et de plage de luminance ; les
  coordonnées (origine au centre) ne sont pas documentées clairement. Et
  l'ASCII est une **mode de 2025** : c'est un autre déjà-vu.
- **Perf** : 5 187 cellules, **0,1 à 0,3 ms CPU**.

## 4 · Riso — `/lab/riso`

- **Technique** : **Paper.js** (vectoriel, lissage, surimpression `multiply`).
  Chargé en UMD navigateur : le bundler serveur de Next suivait la branche
  Node de la lib (jsdom).
- **Direction** : impression risographique deux encres (rose fluo, bleu
  fédéral), papier crème, Bricolage Grotesque extra-grasse.
- **Mécanique** : un traceur dessine une courbe de niveau par minute ; 25
  courbes = la carte de la session ; distraction = la plume griffonne ; fin de
  pomodoro = la carte est « tirée » avec un défaut de repérage ; pause = un
  hachurage rose monte.
- **Ce que ça donne** : très graphique, très légère, la seule à 60 i/s même en
  logiciel. Le gros minuteur bleu en surimpression a de l'allure.
- **Ce qui rate** : 2D pure, alors que la demande est une vraie 3D ; la carte
  est petite et décentrée (canevas non redimensionné) ; la frise des tirages
  n'apparaît pas.
- **Perf** : quelques centaines de segments, **≈ 0,1 ms CPU**, 60 i/s.

## 5 · Maquette — `/lab/maquette`

- **Technique** : **postprocessing** (`TiltShiftEffect` + SMAA) sur un
  quartier généré en code (îlots, immeubles à gradins fusionnés à la main),
  fenêtres calculées dans le shader (aucune texture), lumière faite main
  (soleil, ciel, occlusion au pied).
- **Direction** : maquette d'architecte en plein jour pastel, vue d'avion.
- **Mécanique** : chaque minute allume une fenêtre du quartier ; fin de
  pomodoro : le quartier passe au soir, les fenêtres allumées restent ;
  distraction : une fenêtre clignote en rouge.
- **Ce que ça donne** : le passage au soir avec « mes » fenêtres allumées est
  le meilleur moment du lab côté récit (le travail du jour se voit).
- **Ce qui rate** : le flou de bascule est trop fort, c'est un effet à la mode
  qui fait « SimCity » ; le sol reste clair la nuit ; on ne trouve pas « sa »
  fenêtre.
- **Perf** : **0,6 à 1,3 ms CPU** (deux passes de post-traitement en plus).

## 6 · Compteur — `/lab/counter`

- **Technique** : objet **modélisé dans Blender 5.3 en script Python headless**
  (`scripts/blender/counter.py`, module `bpy` de PyPI) : boîtier biseauté,
  fenêtre et cavité par **booléens exacts**, quatre rouleaux portant les
  chiffres 0-9 en relief (police intégrée de Blender), axe, séparateur ;
  export `.glb` (568 Ko, ≈ 6 000 polygones). Dans three : matériaux réglés à
  la main, softbox (`RectAreaLight`), contre-jour, ombre VSM douce. Séquences
  `motion` : anticipation (recul) puis ressort sur chaque rouleau.
- **Direction** : design industriel, objet de bureau, gris chaud et orange
  (Braun ET66, compteurs Veeder-Root).
- **Mécanique** : à gauche les pomodoros du jour, à droite les minutes ;
  fin de pomodoro = les minutes remontent à 25 en cascade, le compteur de
  gauche claque d'un cran, le repère orange s'allume ; pause = l'objet se
  penche en arrière, la lumière s'adoucit ; distraction = petit choc.
- **Ce que ça donne** : le plus LISIBLE de tous, et le mouvement des rouleaux
  est satisfaisant.
- **Ce qui rate** : premier rendu raté (rouleaux trop en retrait, vernis qui
  renvoyait une teinte bleue et masquait les chiffres, chiffres trop grands) ;
  corrigé dans le modèle et l'éclairage. Surtout : un compteur rétro est un
  objet attendu dans les apps de focus (horloges à volets type Fliqlo). C'est
  un déjà-vu de catégorie.
- **Perf** : 21 k triangles, 30 appels, **0,5 à 1 ms CPU**.

---

## Le choix

| | Originalité | Lisibilité | Récit produit | 3D faite main | Perf | « Je l'aurais fait par défaut ? » |
|---|---|---|---|---|---|---|
| 1 Céladon | 9 | 7 | 9 | oui (tour, TSL) | bonne | **non** |
| 2 Chiffres | 8 | 2 | 5 | oui (extrusion) | moyenne | non |
| 3 Presse | 6 | 5 | 6 | non | excellente | non, mais mode 2025 |
| 4 Riso | 8 | 7 | 7 | non (2D) | excellente | non |
| 5 Maquette | 6 | 6 | 8 | oui (procédural) | bonne | non, mais effet à la mode |
| 6 Compteur | 6 | 10 | 6 | oui (Blender) | bonne | non, mais objet attendu |

**Direction retenue : Céladon**, l'atelier de céramique. C'est le plus
audacieux qui reste lisible et performant, et il ne ressemble à rien de ce que
j'aurais produit sans le lab : clair et chaud là où je fais sombre et froid,
matière là où je fais lumière, objet là où je fais plein écran, terre et
émail là où je fais encre et accent.

**Ce que la direction emprunte aux autres prototypes**
- Au **Compteur** : la leçon de lisibilité (le temps se lit d'abord en gros
  chiffres tabulaires) et la méthode de modélisation en script Blender pour
  les objets secondaires (le four, l'étagère).
- À la **Maquette** : le récit « le travail du jour reste visible » devient
  l'**étagère** des pièces cuites (une pièce par pomodoro).
- Aux **Chiffres** : la vraie typographie extrudée, réservée aux moments rares
  (objectif atteint, Wrapped).

**Ce qu'elle doit corriger**
- Craquelure plus fine et plus irrégulière, émail qui s'épaissit vraiment
  dans les creux (normale + courbure), bord sans scintillement.
- Ne jamais poser le vase par-dessus une vidéo qui joue.
- Prévoir un repli statique (rendu précalculé de la pièce) et le thème sombre
  (« le four la nuit »).
