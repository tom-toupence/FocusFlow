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

---

## Élimination après le cadrage du thème (2026-11-20)

Le thème imposé (la vie nocturne d'une mégapole asiatique, version cyberpunk)
élimine les prototypes qui ne le tiennent pas. Leur code est retiré du dépôt ;
captures et vidéos restent ici comme archive.

| Prototype | Verdict | Raison |
|---|---|---|
| 1 Céladon | **éliminé** | atelier de céramique : beau, mais aucune ville, aucune nuit |
| 2 Chiffres physiques | **éliminé** | jouet Bauhaus en plein jour, illisible |
| 3 Presse (textmode) | **éliminé** | papier journal ; l'ASCII est une mode 2025 et la photo de nuit se convertit mal |
| 4 Riso | **éliminé** | impression 2D sur papier, hors thème et sans 3D |
| 5 Maquette | **conservé et repris** | c'est déjà une ville et des fenêtres qui s'allument : il passe de nuit dans le lab 2 |
| 6 Compteur | **éliminé** | objet de bureau rétro, hors thème ; la méthode Blender en script est gardée |

Le module `lib/atelier` (Céladon) est également retiré. Dépendances
désinstallées : opentype.js, Rapier, textmode.js, Paper.js, @theatre/core.

---

# LAB 2 · la ville qui ne dort pas (2026-11-20)

Six prototypes, tous dans le thème imposé, chacun avec une librairie ou une
technique jamais utilisée dans le projet. Même séquence jouée (horloge simulée).
Captures et vidéos : `docs/redesign/shots/lab2/`, montage `lab2-montage.mp4`.
Polices locales (`public/lab/fonts`) : Big Shoulders (signalétique, Chicago),
Doto (afficheur à points), Atkinson Hyperlegible Next (texte).
Palette commune, sans un seul rose : sodium `#ff9a3c`, supérette `#53e0a1`,
néon blanc `#e9f2ff`, feu arrière `#ff3b2b`, taxi `#ffc21a`, asphalte `#0a0e13`.

## 2·1 Ruelle sous la pluie — `/lab/ruelle`
- **Nouveau** : troika-three-text (enseignes en typographie SDF dans la 3D),
  Reflector (sol mouillé), pluie et vapeur en shaders instanciés, bloom.
- **Modélisé en code** : baies de façades à retraits, enseignes en drapeau et
  colonnes de caissons empilés (un commerce par étage, mots réels), climatiseurs
  instanciés, câbles en chaînette, distributeur, lampadaire au sodium.
- **Mécanique** : panneau à LED au-dessus de la laverie = temps restant ;
  distraction = une enseigne grésille ; fin de pomodoro = les enseignes
  s'éteignent du fond vers nous (la halte), restent la supérette, le
  distributeur et le lampadaire ; reprise = amorçage des tubes de près en loin.
- **Ce que ça donne** : le prototype qui porte le mieux le thème. La halte se
  lit immédiatement (enseignes éteintes, pluie plus fine).
- **Ratés corrigés** : troika ne chargeait rien (son worker blob était bloqué
  par la CSP, `useWorker: false`) ; façades orangées et fenêtres en « maison de
  poupée » au premier jet ; extinction trop étalée.
- **Reste** : façades encore lisses, reflets peu étirés, distributeur peu lisible.
- **Perf** : 6 à 9 ms CPU par image en logiciel (texte SDF + bloom), à optimiser.

## 2·2 Supérette 24 h — `/lab/konbini`
- **Nouveau** : **manifold-3d** (booléens WASM) : coque, vitrine, porte,
  meubles d'étagères et distributeurs obtenus par soustractions.
- **Mécanique** : la rue s'assombrit avec la nuit, le magasin non ; fin de
  pomodoro = les portes automatiques s'ouvrent et la caméra traverse la rue :
  **la pause, c'est entrer dans la lumière** ; distraction = la porte s'entrouvre.
- **Ce que ça donne** : la meilleure idée de pause du lab.
- **Ratés** : murs teintés orange par le sodium, reflets du sol durs, bandeau
  qui chevauche l'interface.
- **Perf** : 0,6 à 1,3 ms CPU.

## 2·3 Tour de bureaux — `/lab/tour`
- **Nouveau** : **gpu-curtains** (WebGPU, plans synchronisés au DOM) : chaque
  vignette du catalogue devient une fenêtre (store, reflet, lumière).
- **Échec** : le WebGPU logiciel du conteneur perd son device même avec le
  shader par défaut ; rien n'a pu être vu. Surtout, gpu-curtains n'a **aucun
  repli WebGL** : pour un outil quotidien (Safari et Firefox encore partiels),
  c'est rédhibitoire. L'idée « les cartes sont des fenêtres » est gardée pour
  l'app, à faire en CSS.

## 2·4 Le dernier métro — `/lab/quai`
- **Nouveau** : **PixiJS v8** (2D WebGL, lueurs additives, flou), import
  `pixi.js/unsafe-eval` exigé par notre CSP stricte.
- **Mécanique** : le panneau d'affichage annonce le prochain train = temps
  restant ; les phares grandissent au fond du tunnel ; distraction = « RETARD
  +1 » ; fin de pomodoro = le train entre, portes ouvertes, la pause se passe
  dans sa lumière ; reprise = il repart, feux rouges.
- **Ce que ça donne** : **le panneau LED en Doto est la meilleure typographie
  de minuteur du lab** : signalétique réelle, lisible de loin, chiffres
  tabulaires. Le train, lui, est trop sommaire.
- **Perf** : ≈ 0,2 ms CPU.

## 2·5 Les toits au petit matin — `/lab/toits`
- **Nouveau** : **@thi.ng/geom** (emprises, parapets par `offset`, semis des
  équipements par `scatter`, cabanons en `roundedRect`).
- **Mécanique** : l'aube avance avec la session, les fenêtres des tours
  s'éteignent ; fin de pomodoro = le soleil passe au-dessus des tours.
- **Ce que ça donne** : la preuve que le **thème clair** a du sens (la même
  ville au petit matin). Mais rendu carton : aplats gris, fenêtres trop régulières.
- **Perf** : 0,7 à 2 ms CPU, 97 appels de dessin (à instancier).

## 2·6 Maquette de nuit — `/lab/maquette`
- Le prototype conservé du lab 1, passé de nuit : circulation instanciée
  (phares, feux arrière, taxis), fenêtres des amis en vert, bascule adoucie.
- **Ce que ça donne** : la vue d'ensemble « tu n'es pas seul » fonctionne.
- **Raté** : teinte bleu saturé à la halte (extrapolation du mélange).

## Direction retenue : « la ville qui ne dort pas »

Le meilleur de chaque prototype, organisé comme **une seule ville**, chaque
partie de l'app étant un lieu :

| Lieu | Où dans l'app | Venu de |
|---|---|---|
| **la ruelle** (3D héros) | landing, pause, session Spotify | 2·1 |
| **le panneau à LED** | minuteur de session, PiP, chiffres clés | 2·4 |
| **la supérette** | la pause longue : on entre dans la lumière | 2·2 |
| **les fenêtres allumées** | amis en focus, catalogue (cartes = fenêtres, en CSS) | 2·3, 2·6 |
| **le petit matin** | thème clair | 2·5 |

Pourquoi : c'est le plus audacieux qui reste lisible et performant, et ce
n'est pas ce que j'aurais fait sans le lab : une nuit à **plusieurs sources
colorées** (pas un fond et un accent), dense en objets modélisés, une
typographie de signalétique réelle, et un thème clair qui a sa propre heure.

---

# LAB 3 · le réalisme (2026-11-21)

## Pourquoi un lab 3

Retour utilisateur sur le lab 2 : « murs en aplats sans texture, enseignes
réduites à des carrés colorés, climatiseurs en cubes, sol sans matière, pluie
en traits blancs, aucun éclairage dirigé, aucun post-traitement. Ça ressemble à
un prototype de jeu vidéo, pas à une nuit en ville. » Il a raison : la
consigne « tout modéliser en code » produisait des boîtes. Nouvelle règle : le
réalisme vient des assets, de la matière, de la lumière et du post-traitement.
Le rendu procédural de la ruelle (`lib/city/CityRenderer.ts`) est abandonné ;
seule son INTERFACE (phase, panneau, événements) est conservée.

Barre de qualité imposée : chaque piste est comparée côte à côte avec trois
vraies photos de rues asiatiques de nuit sous la pluie. Si un œil non averti
voit tout de suite de la 3D amateur, ce n'est pas prêt.

Accès réseau : les banques d'assets étaient bloquées par l'environnement ; un
environnement dédié (Poly Haven, ambientCG, Wikimedia Commons, Hugging Face,
jsDelivr) a été créé pour ce lab.

## Piste A · 2.5D photographique : RETENUE

- **Matière** : une vraie photo de ruelle la nuit (Wikimedia Commons, CC BY 4.0),
  choisie sur planche contact parmi 56 candidates (critères : point de fuite
  central, peu de personnes et lointaines, aucune lanterne, aucun portique,
  pas de néon rose, enseignes réelles).
- **Profondeur** : Depth Anything V2 Small (Apache 2.0) exécuté hors ligne
  (onnxruntime, CPU). Cartes très propres sur les trois photos testées.
- **Préparation** (`scripts/city/prep_photo.py`) : masque du sol (tracé à la
  main pour la ruelle, c'est une décision de direction artistique), masque
  émissif, liste des enseignes (composantes connexes, triées du fond vers
  nous), carte de débord lumineux floutée.
- **Rendu** (`lib/city/PhotoRenderer.ts`) : un seul passage WebGL2, aucune
  librairie. Parallaxe par profondeur lissée, travelling d'entrée de 8 s,
  respiration à 9 s, main en parallaxe douce. Pluie en trois couches
  occultées par la profondeur et visibles seulement devant les lumières,
  avec réfraction. Sol mouillé : traînées verticales des sources, impacts.
  Brume colorée par les sources. Étalonnage nuit / heure bleue, ACES, grain,
  vignette, aberration discrète.
- **Événements** : halte = les vraies enseignes s'éteignent du fond vers nous,
  la lumière qu'elles jetaient disparaît, la caméra recule ; distraction = une
  enseigne grésille ; playlist prolongée = une enseigne s'allume ; objectif =
  deux phares traversent au bout de la ruelle, leur reflet file sur le sol ;
  panneau LED projeté en perspective sur une vraie enseigne de la photo.
- **Itérations** : (1) image à l'envers (double retournement de texture) ;
  (2) panneau LED inversé ; (3) phares en halo fantôme, remplacés par deux
  points et un halo court ; (4) **bandes répétées sur le sol** : le reflet
  copiait la photo entière à pas fixe ; corrigé en ne reflétant que les
  sources, en tramant le pas par pixel et en lissant la profondeur de la
  parallaxe ; (5) sol pas assez miroir face aux références, renforcé.
- **Comparaison** : `shots/lab3/compare-A.jpg`. Verdict : tient face aux trois
  photos réelles. Ce qui trahit encore : le panneau LED un peu trop propre, la
  pluie fine invisible sur image fixe (visible en vidéo `a-alley.mp4`).
- **Perf** : 7 i/s en rendu logiciel dans ce conteneur (aucun GPU) pour un
  seul passage plein écran ; sur GPU réel ce shader est très en dessous du
  budget de 16 ms. Poids : 0,95 Mo (photo 1920, version mobile 1024, masques,
  débord). Repli statique naturel : la photo elle-même.

## Piste B · gaussian splatting : NON VIABLE AUJOURD'HUI

Spark (`@sparkjsdev/spark`) est disponible sur npm. Mais aucune capture de rue
de nuit sous licence libre n'existe sur Hugging Face (recherches « splat »,
« gaussian splatting city », « 3dgs night » : objets, personnes, tests
d'intérieur, aucune licence claire). Une capture faite par nous suppose de
filmer une vraie rue, hors de portée ici. À reprendre si une capture CC0 de
rue de nuit apparaît, ou si l'utilisateur en fournit une.

## Piste C · 3D temps réel, assets Poly Haven : ÉCARTÉE

- **Matière** : kit « hidden alley » de Poly Haven (CC0) : façade modulaire,
  rideaux métalliques, climatiseurs, escalier de secours, gouttières,
  boîtiers, applique ; asphalte PBR complet ; HDRI de nuit. Compressé en glb
  (meshopt, WebP 1K) : 7,9 Mo.
- **Éclairage et rendu** : applique au sodium avec ombres, vitrine froide en
  lumière rectangulaire, contre-jour chaud au bout, caissons biseautés à
  face émissive qui éclairent le mur, sol à flaques au-dessus d'un miroir,
  pluie éclairée par les sources, SSAO, bloom à seuil, AgX, profondeur de
  champ, grain, vignette.
- **Deux passes** : la première surexposée, la seconde maîtrisée.
- **Comparaison** : `shots/lab3/compare-C.jpg`. Verdict : se lit
  immédiatement comme de la 3D. Façade néoclassique européenne (corniches,
  encadrements moulurés) hors thème, caissons trop propres, asphalte sec à
  flaques noires, objets qui flottent. Atteindre la crédibilité de A
  demanderait un kit urbain asiatique (inexistant en CC0) et des semaines
  d'éclairage précalculé. À perf égale, A est très au-dessus et 8 fois plus
  léger.

## Décision

**Piste A, 2.5D photographique**, branchée derrière l'interface `CityScene`
existante. La landing, la halte, le mode Spotify et le résumé n'ont pas à
changer. Les fenêtres vertes des amis n'existent pas dans une photo : les amis
en focus restent affichés par l'interface (tiroir Amis).
