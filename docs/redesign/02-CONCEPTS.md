# 02 · Exploration divergente

> Règle du jeu : chaque concept doit NAÎTRE d'une mécanique réelle de
> FocusFlow (cycle travail/pause, Flowtime sans plafond, file qui avance, fin
> de playlist qui se prolonge, distractions, objectif du jour, jardin, amis en
> focus, couleur de chaque vidéo, villes d'Asie la nuit). Deux invariants
> s'ajoutent : le **splash goutte d'eau est conservé** (ajout utilisateur), et
> **la vidéo est l'immersion en session** (la 3D ne la concurrence jamais).
>
> Chaque concept passe le test : « pourrait-il servir à n'importe quelle autre
> app ? ». Si oui, il est jeté et remplacé (c'est arrivé une fois, voir C0).

---

## C0 · Lucioles (JETÉ)

Idée : chaque minute de focus allume une luciole ; les amis en focus sont
d'autres essaims ; la nuit se peuple. Référence : les hotaru de juin au Japon.

**Test « autre app » : échoue.** Une nuée de points lumineux qui grandit avec
l'usage illustre aussi bien un tracker de sport, une app de méditation ou un
compteur de dons. Et c'est, à l'écran, une **sphère de particules** déguisée
(liste noire D17). Remplacé par C6.

---

## C1 · Clepsydre de nuit

**Métaphore.** Le temps de travail se mesure en **eau qui s'écoule**. Le nom
même du produit le dit : *Flow*. Une clepsydre est un instrument où l'on lit
le temps à la hauteur de l'eau ; on l'utilisait justement **la nuit**, quand le
cadran solaire ne sert plus à rien. La goutte du splash cesse d'être un effet
d'entrée : c'est **la première goutte** qui met l'horloge en marche.

**Pourquoi elle colle.**
- *Travail* : le bassin se remplit, une graduation par minute. *Pause* : la
  surface se calme et redescend. *Pause longue* : le bassin se vide.
- *Flowtime* : un vase **sans graduation finale**. Il continue de monter, et
  quand il déborde, l'eau passe dans un second vase (la pause méritée = le
  volume débordé ÷ 5, littéralement).
- *Distraction* : un caillou dans l'eau. Une onde part du bord, la surface met
  quelques secondes à se recalmer. Rien n'est puni, c'est visible.
- *Objectif du jour* : une **marque gravée** sur la colonne. Quand l'eau
  l'atteint, la marque s'éclaire.
- *File qui avance* : chaque changement de piste fait tomber une goutte.
- *Fin de playlist prolongée* : un **affluent** rejoint le bassin, l'eau ne
  s'arrête pas.
- *Amis en focus* : d'autres gouttes tombent au loin sur la même eau.
- *Couleur de la vidéo* : c'est le **reflet** de la ville sur l'eau.
- *Jardin, heatmap, Wrapped* : les **relevés** de la clepsydre (voir C2).

**La 3D.** Une surface d'eau sombre vue en incidence rasante, écrite en GLSL à
la main (extension du shader du splash). Elle reflète une bande de lumière à la
couleur de la vidéo. Réactions : lecture = petite houle ; pause = surface
lisse ; tick du minuteur = la ligne de niveau monte d'une graduation ; piste
suivante = goutte ; distraction = caillou au bord ; fin de pomodoro = la
colonne déborde puis se stabilise ; objectif atteint = la marque prend la
lumière ; ami en focus = goutte lointaine. Aucune réaction au son (impossible).

**Palette.** Nuit : encre bleu-noir à peine tiède (pas de noir pur), eau
`oklch(0.18 0.015 240)` ; lumière **sodium** (l'orange des lampadaires des
photos de Séoul) comme seul signal fixe ; le reflet prend la couleur de la
vidéo. Jour (thème clair) : le **papier** du relevé, crème froide, encre
graphite, sodium foncé.

**Typographie.**
- *Hahmlet* (Hypertype, OFL, Google Fonts) pour les titres : une serif dessinée
  **conjointement pour le hangeul et le latin**. Elle porte le fil coréen (la
  clepsydre de Sejong, Séoul) sans pastiche, et ce n'est pas la serif à la mode.
- *Azeret Mono* (Displaay, OFL) pour tout ce qui est **mesuré** : minuteur,
  graduations, durées. Elle a été dessinée pour les données et les
  instruments, ses chiffres sont étroits et stables.
- *Atkinson Hyperlegible Next* (Braille Institute, OFL) pour le corps : conçue
  pour les basses visions, donc lisible **la nuit à faible luminosité**, quand
  l'écran est baissé. C'est la seule raison valable de choisir une sans.

**Grille.** Une échelle verticale graduée (base 8 px, graduation majeure tous
les 64) court le long des pages ; les blocs s'y alignent comme des relevés sur
une perche de marée.

**Texture.** Aucune texture de décor. La seule « matière » est l'eau, et elle
n'apparaît que là où elle mesure.

**Motion.** Courbes d'eau : montée lente et linéaire (le temps réel), arrivée
amortie (oscillation qui s'éteint, une seule fois), chute de goutte en
accélération puis anneau. Durées longues pour l'eau (600 à 1 400 ms), courtes
pour l'interface (120 à 240 ms). **Ne bouge jamais** : le texte, l'échelle, la
position des chiffres du minuteur.

**Scène clé.** J'ouvre l'app : l'écran est une eau noire où dort le mot
FocusFlow (le splash). Je clique : la goutte tombe, l'onde s'élargit et
l'accueil apparaît dans le cercle. En haut, une fine colonne indique mon niveau
du jour face à la marque de l'objectif. Je choisis « Rainy Shibuya » : une
goutte tombe sur la carte, l'onde ouvre la vignette jusqu'au plein écran,
la vidéo prend le relais. Au bord droit, la colonne d'eau monte d'une
graduation par minute. Je marque une distraction : un frisson traverse la
colonne. À 25:00 elle déborde, la vidéo se fige, l'eau envahit l'écran,
calme : c'est la pause, et la respiration guidée **est** le niveau de l'eau qui
monte quatre secondes, tient, redescend.

**Références hors web.** Le *Jagyeongnu* de Jang Yeong-sil (Séoul, 1434), horloge
à eau qui frappait les heures toute seule ; la tour astronomique hydraulique de
Su Song (Kaifeng, 1088) ; la clepsydre de Ctésibios ; le nilomètre de Rodah ;
les repères de crue gravés sur les piles des ponts parisiens ; Hiroshi
Sugimoto, *Seascapes* (l'horizon d'eau comme seule composition).

**Test « autre app ».** Une horloge à eau qui déborde au bout de 25 minutes,
une pause qui est le volume débordé ÷ 5 : non, ça ne sert qu'à un minuteur de
travail avec pauses. Passe.

| Originalité | Adéquation | Lisibilité | Faisabilité / perf | Potentiel motion |
|---|---|---|---|---|
| 9 | 10 | 8 | 8 | 9 |

---

## C2 · Marégraphe

**Métaphore.** Un marégraphe enregistre la hauteur de la mer sur un tambour de
papier qui tourne : un stylet trace une courbe continue. FocusFlow devient
l'**enregistreur** de ta concentration. La journée est une bande de papier ; la
semaine, un rouleau.

**Pourquoi.** Le produit accumule déjà des traces (minutes, heures de pointe,
distractions, humeur). Le Flowtime est une marée qui monte sans plafond ;
les distractions sont des pics de sismographe ; l'objectif est le niveau de
référence (le « zéro hydrographique »).

**3D.** Le tambour enregistreur en 3D, papier qui défile, stylet qui trace en
direct pendant la session (sur le résumé, dans l'Activité). Réagit aux ticks,
aux distractions (pic), aux pauses (plat).

**Palette / typo.** Papier millimétré crème, encre bleue de stylo-plume, rouge
de graduation. *Azeret Mono* + *Newsreader*. Grille millimétrée.

**Motion.** Tout défile à vitesse constante, jamais d'accélération : le temps
est linéaire. Le stylet tremble légèrement à chaque événement.

**Scène clé.** Je lance une session : rien ne bouge sur la vidéo. En fin de
session, le résumé déroule la bande du jour avec mon pomodoro inscrit en vert,
mes deux distractions en pics. Je descends : la semaine en rouleau.

**Références.** Marégraphe totalisateur de Marseille (1885), kymographe de
Ludwig, sismographes de la *Japan Meteorological Agency*.

**Test « autre app ».** Un tracker de sommeil ou de dépense pourrait reprendre
le rouleau tel quel. **Échoue en partie** : le concept ne parle ni de la nuit
ni de la musique, il raconte la donnée, pas l'expérience. Il survit comme
*langage des relevés* dans une fusion.

| Originalité | Adéquation | Lisibilité | Faisabilité / perf | Potentiel motion |
|---|---|---|---|---|
| 7 | 6 | 9 | 9 | 5 |

---

## C3 · Quai de nuit

**Métaphore.** La file d'attente est un **tableau des départs**. Chaque titre
est un train, chaque vidéo a sa couleur de ligne (comme les lignes du métro de
Tokyo). Les pauses sont des arrêts en gare (« arrêt 5 min »), le Flowtime un
train sans terminus, la prolongation de playlist une correspondance.

**3D.** Palettes Solari à volets qui basculent à chaque changement de piste ;
quai en perspective.

**Palette / typo.** Noir de quai, jaune de signalétique, couleurs de lignes
issues de `getVideoColor`. *Shippori Antique* (gothique japonaise) + *Azeret
Mono* pour les horaires.

**Motion.** Volets qui claquent (mécanique, 60 ms par volet), défilement
horizontal du bandeau.

**Scène clé.** Je lance : le tableau affiche « Rainy Shibuya, voie 1, départ
21:00, arrivée 21:25 ». À la pause : « Arrêt 5 min ». À la fin de la file :
« Correspondance : 8 titres proches ».

**Références.** Tableaux Solari di Udine, signalétique de la JR East, plan du
métro de Tokyo (2004).

**Test « autre app ».** Le tableau à volets est devenu un motif d'UI répandu
(apps de voyage, landing pages de devs). **Ambigu.** Et le train ne dit rien de
la concentration : on attend un train, on ne travaille pas dedans.

| Originalité | Adéquation | Lisibilité | Faisabilité / perf | Potentiel motion |
|---|---|---|---|---|
| 6 | 6 | 8 | 7 | 7 |

---

## C4 · Façade

**Métaphore.** La ville la nuit est une façade de fenêtres éclairées : derrière
chacune, quelqu'un travaille. Chaque pomodoro terminé **allume une fenêtre** de
ton immeuble. Tes amis en focus sont les fenêtres d'en face qui s'allument en
même temps que la tienne. L'objectif du jour, c'est un étage entier allumé.

**Pourquoi.** C'est la phrase de la landing actuelle, « la nuit, tout le monde
travaille », rendue mesurable. Le jardin hebdomadaire devient l'immeuble de la
semaine.

**3D.** Une façade instanciée (grille de fenêtres) vue de biais ; distraction =
une fenêtre qui grésille ; pause = stores baissés ; ami en focus = fenêtre en
face. Couleur de la vidéo = lumière intérieure.

**Palette / typo.** Béton bleu nuit, lumière de fenêtres tungstène et néon de
la vidéo. *Pretendard* + mono.

**Motion.** Allumages secs, avec le délai d'un tube fluorescent.

**Scène clé.** Dashboard : mon immeuble, trois fenêtres allumées aujourd'hui,
celle de Léa en face qui s'allume. Je lance une session.

**Références.** Michael Wolf, *Architecture of Density* (Hong Kong) ; Gail
Albert Halaban, *Out My Window* ; Edward Hopper, *Nighthawks*.

**Test « autre app ».** Une app de coworking virtuel ou de « body doubling »
pourrait l'utiliser. **Ambigu**, mais l'idée des amis visibles est la plus
juste de toutes. Le néon de fenêtre est aussi déjà au cœur de la landing
actuelle (« Neon »), d'où un risque de redite.

| Originalité | Adéquation | Lisibilité | Faisabilité / perf | Potentiel motion |
|---|---|---|---|---|
| 7 | 8 | 7 | 7 | 6 |

---

## C5 · Temps de pose

**Métaphore.** Une session est une **photographie en pose longue**. Hiroshi
Sugimoto a photographié des salles de cinéma en laissant l'obturateur ouvert
toute la durée d'un film : l'écran devient un rectangle blanc. Ici, l'image de
la ville se « développe » au fil de la session : plus tu restes concentré, plus
la photo est exposée.

**Pourquoi.** Presets = vitesses d'obturation (25 min, 50 min) ; Flowtime = la
**pose B** (bulb), obturateur ouvert sans limite ; pause = obturateur fermé ;
distraction = un bougé dans l'image ; objectif atteint = exposition correcte
(l'histogramme centré).

**3D.** Shader d'accumulation de lumière : les traînées de la ville (couleur de
la vidéo) s'additionnent image par image, comme un tirage qui apparaît dans le
révélateur. À la fin, une « épreuve » de la session est générée (et pourrait
nourrir la carte Wrapped).

**Palette / typo.** Chambre noire : noir, rouge inactinique pour les signaux,
papier baryté pour le clair. *Söhne*-like (non libre) donc *Hanken Grotesk*.

**Motion.** Lent, cumulatif, irréversible : rien ne revient en arrière.

**Scène clé.** Je lance une session : l'accueil s'assombrit comme on ferme la
porte du labo. À la fin, la carte de résumé montre l'épreuve de ma session :
la lumière de Shibuya accumulée, un petit bougé là où j'ai décroché.

**Références.** Sugimoto, *Theaters* (1978-) ; la pose B ; le révélateur.

**Test « autre app ».** Non, très spécifique. Mais : la **lisibilité** est
faible (une photo plus ou moins exposée ne se lit pas comme du temps restant)
et la chambre noire rouge est un cliché de concept photo. Le rouge inactinique
sur noir frôle « dark + accent unique ».

| Originalité | Adéquation | Lisibilité | Faisabilité / perf | Potentiel motion |
|---|---|---|---|---|
| 9 | 7 | 5 | 6 | 7 |

---

## C6 · Wadokei (remplace C0)

**Métaphore.** L'horloge japonaise d'Edo (*wadokei*) comptait des **heures
temporelles** : leur durée changeait avec les saisons, les poids du mécanisme
étaient déplacés pour que six heures couvrent toujours la nuit. FocusFlow
mesure aussi un temps élastique : un pomodoro classique, un deep work, et un
Flowtime dont l'heure s'étire.

**3D.** Un cadran à index mobiles : les marques du cadran se déplacent selon le
preset ; la pause est une heure courte, la longue pause une heure longue.

**Palette / typo.** Laiton patiné, laque noire, papier washi. *Shippori Mincho*.

**Motion.** Mécanique, à échappement : le temps avance par crans (le tick).

**Scène clé.** Settings : je choisis Deep Work, les index du cadran glissent pour
que l'heure de travail occupe 50 graduations.

**Références.** Wadokei du musée Seiko (Tokyo) ; horloge à double foliot.

**Test « autre app ».** Non. Mais **skeuomorphe** (laiton, laque), difficile à
rendre sans tomber dans le décor « Japon traditionnel » et sans rapport avec la
ville de nuit des vidéos. Lisibilité médiocre pour un utilisateur qui ne
connaît pas l'objet.

| Originalité | Adéquation | Lisibilité | Faisabilité / perf | Potentiel motion |
|---|---|---|---|---|
| 8 | 6 | 4 | 6 | 6 |

---

## Tableau récapitulatif

| Concept | Orig. | Adéq. | Lisib. | Faisab. | Motion | Total /50 | Test « autre app » |
|---|---|---|---|---|---|---|---|
| C1 Clepsydre de nuit | 9 | 10 | 8 | 8 | 9 | **44** | passe |
| C2 Marégraphe | 7 | 6 | 9 | 9 | 5 | 36 | partiel |
| C3 Quai de nuit | 6 | 6 | 8 | 7 | 7 | 34 | ambigu |
| C4 Façade | 7 | 8 | 7 | 7 | 6 | 35 | ambigu |
| C5 Temps de pose | 9 | 7 | 5 | 6 | 7 | 34 | passe |
| C6 Wadokei | 8 | 6 | 4 | 6 | 6 | 30 | passe |

---

## Choix : C1 Clepsydre de nuit, enrichie de C2 et C4

**Le concept retenu est la Clepsydre de nuit**, avec deux emprunts précis :

- de **C2 (Marégraphe)**, le langage des **relevés** pour tout ce qui est
  historique (Activité, Insights, résumé, Wrapped) : la donnée passée se lit
  comme une trace de niveau d'eau tracée sur papier. C'est la même physique
  (une hauteur d'eau dans le temps), vue après coup. Le thème clair devient le
  « papier du relevé », le sombre « l'eau de nuit » : les deux thèmes ont une
  raison d'être différente, pas une simple inversion.
- de **C4 (Façade)**, uniquement l'idée sociale : **les amis en focus sont des
  gouttes qui tombent au loin sur la même eau**. Pas de façade dessinée.

**Pourquoi les autres perdent.**
- *Marégraphe* seul : juste pour les données, muet sur l'expérience vécue en
  session et sur la nuit.
- *Quai de nuit* : motif d'UI déjà vu ; le train évoque l'attente, pas l'effort.
- *Façade* : la meilleure idée sociale, mais visuellement trop proche de la
  landing actuelle (néon, fenêtres) et d'une app de coworking.
- *Temps de pose* : le plus poétique, mais on ne lit pas « combien de temps il
  reste » dans une photo plus ou moins claire. Pour un minuteur, c'est
  rédhibitoire.
- *Wadokei* : beau objet, illisible, et il tire vers le décor « Japon
  traditionnel » qu'on veut éviter.

**Ce que la Clepsydre a qu'aucun autre n'a** : elle **contient déjà** l'élément
que l'utilisateur veut garder (la goutte du splash), elle rend le Flowtime
lisible (le débordement), elle explique la pause par la physique (le bassin se
calme), et elle relie le nom du produit à ce qu'on voit.

### Ce que la refonte garde de l'existant, et pourquoi

- **Le splash goutte d'eau** : invariant, et désormais cœur du concept.
- **La couleur par vidéo** (`getVideoColor`) : elle devient le reflet sur l'eau,
  son rôle passe de décor à information (« quelle ville j'écoute »).
- **Le thème sombre par défaut** : la nuit est le cas d'usage principal.
- **L'accent unique comme règle** : survit, mais l'accent change (sodium au
  lieu du teal) et il a un sens (« maintenant / niveau mesuré »).
- **Les photos de Séoul de la landing** : elles survivent comme reflets de ville
  au-dessus de l'eau, dans la landing seulement.
- **Ce qui part** : Geist (aucun argument propre au produit), les fonds aurora,
  le verre translucide, les tuiles de stats, les angles droits dogmatiques de la
  landing, l'equalizer factice, la landing « Une nuit, quatre pomodoros » en
  tant que telle (sa structure en cycles inspire la nouvelle, mais la page est
  réécrite).

---

## Porte 2 : vérification contre la liste noire

| Point de la liste noire | Risque dans la Clepsydre | Parade décidée |
|---|---|---|
| A1 aurora / blobs | l'eau pourrait devenir un « fond qui ondule » | l'eau n'apparaît que là où elle **mesure** (colonne, pause, transitions, landing) ; jamais en fond décoratif d'une page de liste |
| A2 glassmorphism | contrôles sur vidéo | aplats opaques sombres ou texte avec ombre ; pas de verre à bordure blanche |
| A3 grain | « matière d'eau » | aucun grain ; l'eau est un shader qui bouge pour une raison |
| A4 dark + néon | sodium sur nuit | sodium **désaturé** (lampe à vapeur, pas fluo), et la couleur de la vidéo varie à chaque session : il n'y a jamais un seul néon |
| A5 glow | reflet lumineux | le reflet est une bande sur l'eau, pas un halo sous un bouton |
| B7 hero + 3 cartes | landing | landing en scènes d'eau, sans rangée de features ni paire de boutons |
| B8 bento | dashboard | dashboard ordonné par l'échelle graduée (temps), pas une mosaïque |
| B11 tuiles de stats | relevés | chiffres portés par des traces et des niveaux, pas par des boîtes |
| C13 police par défaut | | trois familles justifiées par le concept |
| C15 micro-labels mono partout | Azeret Mono | mono **réservée aux mesures** |
| D17 forme 3D abstraite | surface d'eau | c'est un phénomène nommé (l'eau d'une clepsydre) qui réagit à des événements réels |
| D18 clichés d'anime chill | Asie, nuit | aucune illustration ; le Japon/Corée viennent des vidéos et d'une référence technique (Jagyeongnu), pas d'images de cerisiers |
| D19 parallaxe de montagnes | | aucune couche de silhouettes |
| D22 faux visualiseur | eau qui bouge pendant la lecture | la houle signifie « lecture active », elle a la même amplitude quel que soit le son et l'aide le dit ; l'equalizer disparaît |
| E24 boucles décoratives | surface vivante | la houle ne tourne **que** pendant une lecture ou une session active, s'arrête onglet caché, absente en reduced-motion |
| F tons | « eau, flux, sérénité » | copy concret, gestes réels, pas de poésie zen |

Aucune violation non parée : **la porte 2 est franchie.**

---

## Arbitrage `product-lead` : GO avec conditions (intégrées)

Verdict de l'agent produit : **GO**. Ses conditions deviennent des règles de la
refonte :

1. **Le minuteur se lit en chiffres.** `TimerDigits` reste la lecture
   principale (position fixe, contraste AA sur la vidéo). La colonne d'eau est un
   repère secondaire. En pause, le compte à rebours reste lisible au-dessus de
   l'eau.
2. **Trois réactions de l'eau en session, pas dix** : le niveau (temps), la
   distraction (caillou) et le changement de piste (goutte). Le débordement de
   fin de pomodoro sert de transition vers la pause. Les autres réactions
   (affluent, gouttes des amis, marque d'objectif qui s'éclaire) vivent sur
   l'accueil, le résumé et les transitions. Le panneau d'aide « ? » explique ce
   que signifie l'eau.
3. **Aucun WebGL superposé à une vidéo qui joue.** Pendant le travail en mode
   vidéo, la colonne est en SVG/CSS. Le WebGL ne tourne que : splash, landing,
   transition catalogue vers session, overlay de pause (vidéo figée), session
   Spotify (pas de vidéo), résumé. Toujours en pause onglet caché, DPR plafonné,
   repli statique, rien en reduced-motion. Jamais de WebGL dans le PiP.
4. **Comportement de pause inchangé** : aujourd'hui la vidéo YouTube est mise en
   pause pendant la pause Pomodoro (`pauseVideo` sur `isBreak`). On garde : la
   pause est un vrai silence. La respiration 4-4-4-4 garde ses consignes en
   texte, et « Passer la pause » reste.
5. **Inventaire des features que le concept ne nomme pas, toutes conservées et
   restylées** : anneau d'objectif et sa célébration (devient la colonne avec
   sa marque gravée, la célébration reste), jardin hebdomadaire (repères
   journaliers de hauteur), XP et niveaux, défis, badges, Focus Score, pastilles
   d'humeur, post-its, Kanban en session, coach, PiP, Wrapped. Aucune
   suppression silencieuse.
6. **Suppressions assumées, à inscrire dans CLAUDE.md** : `AmbientBackdrop`
   (fond aurora), l'equalizer factice du Now Playing, la landing « Une nuit,
   quatre pomodoros » (réécrite), les composants morts (`VideoPlayer`,
   `PomodoroTimer`, `VideoCatalog`) seront supprimés s'ils restent orphelins.
7. **Pas de retour des features refusées par la bande** : aucun son d'eau
   (ni boucle ni goutte sonore : les sons de transition existants restent seuls),
   les amis restent une présence passive issue de `friend_stats` (pas d'espace
   partagé ni de minuteur synchronisé, donc pas de Focus Rooms) et restent
   absents de `/session`, la distraction reste manuelle (touche D, aucune
   détection via `visibilitychange`, donc pas de Mode Strict).
