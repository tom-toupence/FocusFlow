# 01 · Liste noire anti-slop

> À relire avant chaque critique (phases 2, 5, 6, 7). Un seul point violé suffit
> à renvoyer un écran en atelier. « Mais c'est joli » n'est pas une défense :
> le générique est joli, c'est précisément son problème.
>
> Chaque interdit est suivi de **ce qu'on vérifie** concrètement, pour que la
> liste soit un outil de relecture et pas une liste de vœux.

## A. Fonds, matières, lumière

1. **Dégradés violet → bleu, aurora, blobs flous qui dérivent.**
   Vérif : aucun `radial-gradient` flouté animé en fond de page ; aucun
   dégradé dont les extrémités sont deux teintes saturées froides. L'actuel
   `AmbientBackdrop` et l'aurore de la pause sont **condamnés**.
2. **Glassmorphism** : cartes translucides `backdrop-blur` à bordure blanche
   8-20 %. Vérif : `backdrop-blur` autorisé uniquement là où il sert la
   lisibilité **sur de la vidéo** (et même là, préférer un aplat opaque ou une
   ombre portée de texte). Jamais de bordure `white/10` comme décor.
3. **Grain partout.** Vérif : pas de calque de bruit plein écran posé « pour la
   texture ». Une texture n'est admise que si elle **représente** quelque
   chose (papier d'un carnet, trame d'un écran de signalisation…).
4. **Dark mode + un seul accent néon** (cyan, vert acide, magenta) sur noir.
   Vérif : l'accent n'est pas une couleur fluorescente posée sur `#0a0a0a` ;
   le thème sombre a sa propre température, pas « le clair inversé ».
5. **Halo / glow coloré derrière les éléments importants** (bouton, minuteur,
   chiffre). Vérif : pas de `box-shadow` coloré diffus sous un CTA.
6. **Ombres portées douces partout** (`shadow-lg shadow-black/40` sur chaque
   carte). Vérif : l'élévation est un système à 3 niveaux max, et la plupart
   des surfaces n'en ont aucune.

## B. Mise en page

7. **Hero centré** titre + sous-titre gris + 2 boutons (plein / contour), puis
   **3 cartes de features** avec icône. Vérif : la landing n'a ni rangée de
   trois cartes « features », ni paire de boutons sous un titre centré.
8. **Bento grid générique** : tuiles arrondies de tailles variées sans logique
   autre que « remplir la grille ». Vérif : chaque bloc du dashboard a une
   raison de position (heure, séquence, priorité) qu'on peut énoncer.
9. **Icônes dans des carrés arrondis colorés** (pastille teintée 40 × 40 avec
   un pictogramme au centre). Vérif : aucune `rounded-xl bg-x/10` contenant
   une icône seule comme décor de carte.
10. **Le « look shadcn » non retravaillé** : gris `oklch(… 0 0)`, rayon 10 px,
    bordures 1 px gris clair, boutons noirs pleins, inputs gris. Vérif : la
    palette shadcn par défaut de `globals.css` disparaît ; les composants de
    base sont redessinés.
11. **Rangées de stats en tuiles** (« 25 min · 5 j · 253 sessions » dans quatre
    boîtes identiques). Vérif : un chiffre a une forme (aiguille, marque,
    longueur, position) plutôt qu'une boîte.
12. **Sections empilées à même rythme** (titre, paragraphe, visuel, répété
    huit fois). Vérif : le rythme vertical varie avec intention.

## C. Typographie

13. **Inter, Geist, Poppins, Manrope, DM Sans par défaut**, sans raison.
    Vérif : chaque famille a une justification écrite liée au concept. Geist
    peut survivre seulement si l'argument tient.
14. **Titres géants à chasse serrée + corps gris 60 %** comme seule hiérarchie.
    Vérif : la hiérarchie utilise aussi la position, le blanc, le contraste de
    famille, pas seulement la taille.
15. **Micro-labels mono en capitales très espacées partout** (le tic de 2025).
    Vérif : les labels mono sont réservés aux données mesurées (heures,
    durées, compteurs), pas à chaque titre de section.
16. **Dégradé sur le texte** (`bg-clip-text`). Interdit.

## D. Imagerie et 3D

17. **Sphère de particules, globe wireframe, torus, orb iridescent, knot,
    blob métallique qui respire.** Vérif : la 3D représente un objet ou un
    phénomène nommé dans le concept, jamais une forme abstraite « tech ».
18. **« Lofi girl »** et les clichés d'anime chill : fille au casque à la
    fenêtre, chat sur le bureau, chambre violette, néons roses, cerisiers
    stylisés, Mont Fuji en vecteur. Vérif : zéro illustration de personnage.
19. **Parallax de couches de montagnes** (silhouettes superposées qui glissent
    à des vitesses différentes). Interdit, même « en 3D ».
20. **Mockup flottant incliné** d'un écran d'app avec ombre et reflet.
21. **Photos de stock** de bureaux, laptops, mains sur clavier, tasses.
22. **Faux visualiseur audio** : barres qui dansent en prétendant suivre le son
    (l'audio est cross-origin, cf. PROMPT). L'equalizer actuel du Now Playing
    est un mensonge visuel : il disparaît ou devient explicitement un indicateur
    « lecture en cours » non musical.

## E. Mouvement

23. **Fade-in + translateY de 20 px sur chaque bloc** au scroll ou au montage.
    Vérif : le mouvement d'entrée existe seulement quand il dit quelque chose
    (séquence, provenance, causalité).
24. **Animations en boucle décoratives** (pulse, shimmer, float, gradient qui
    tourne). Vérif : chaque boucle correspond à un processus réel en cours
    (le temps qui passe, une lecture active).
25. **Ressorts qui rebondissent sur tout** (overshoot élastique sur chaque
    bouton, toggle, modal). L'élastique est un accent, pas une langue.
26. **Curseur custom qui suit la souris avec retard** et boutons magnétiques
    comme signature. (Le splash masque le curseur parce que l'eau le
    remplace : c'est la seule exception, motivée.)
27. **Scroll-jacking** qui empêche de lire à son rythme, sections épinglées
    à rallonge. Toute section épinglée doit pouvoir être traversée vite.
28. **Compteurs qui défilent de 0 à N** à chaque affichage d'un chiffre.

## F. Ton et contenu

29. **Texte marketing creux** : « Boostez votre productivité », « L'outil
    ultime », « Pensé pour vous », « Concentrez-vous sur ce qui compte ».
30. **Liste de features déguisée en promesse** (« Timer. Musique. Stats. Le
    tout en un. »).
31. **Emoji et em-dashes** dans le texte visible (règle produit permanente).

### Dix interdits de ton, crus

1. Pas de « Boostez », « Supercharge », « Level up », « Next-level ».
2. Pas de triplet rythmé creux en titre (« Respire. Focus. Flow. »). Le splash
   actuel le fait : à réécrire.
3. Pas de deuxième personne enthousiaste qui tutoie comme un coach de salle
   (« Allez, on s'y met, champion ! »). Le tutoiement reste, la claque dans le
   dos part.
4. Pas de félicitations automatiques pour rien (« Bravo ! », « Impeccable ! »,
   « Bien joué ! » après une session de zéro minute).
5. Pas de promesses chiffrées invérifiables (« 3× plus productif »).
6. Pas de jargon produit anglais plaqué (« workflow », « deep work game
   changer », « vibe ») quand le français a le mot.
7. Pas de phrase qui pourrait figurer telle quelle sur le site d'une autre app
   (test : remplacer « FocusFlow » par « Notion » ; si la phrase marche
   encore, elle est jetée).
8. Pas d'excuses ou de flou dans les erreurs (« Oups, quelque chose s'est
   mal passé »). Dire ce qui s'est passé et quoi faire.
9. Pas de « ✨ IA » ni de vocabulaire magique autour du coach : il propose un
   découpage, il ne « crée » rien.
10. Pas de lyrisme sur la nuit qui oublie le produit : chaque phrase
    d'ambiance doit renvoyer à un geste réel (lancer, marquer une
    distraction, prendre sa pause).

---

## Grille de relecture rapide (à coller dans chaque critique)

- [ ] Aucun fond aurora / blob / dégradé froid saturé
- [ ] Aucun verre translucide décoratif
- [ ] Pas de hero centré + 2 boutons + 3 cartes
- [ ] Pas de tuiles de stats identiques
- [ ] Typo justifiée par le concept
- [ ] 3D = objet ou phénomène du concept, réagit à des événements réels
- [ ] Aucune animation en boucle sans processus réel derrière
- [ ] Aucun faux visualiseur audio
- [ ] Copy concret, spécifique, sans em-dash ni emoji
- [ ] Le test « une autre app pourrait-elle l'utiliser ? » répond non


---

## G. Mes réflexes par défaut (ajout après recadrage, 2026-11-20)

> Liste honnête de ce que je refais à chaque projet quand on me laisse
> faire. Elle a été écrite APRÈS avoir produit les phases 3 à 6 : la colonne
> de droite dit où je suis tombé dedans. Tout ce qui est coché « produit » est
> à refaire ou à justifier par le lab, pas par l'habitude.

| # | Réflexe | Produit dans cette refonte ? |
|---|---|---|
| R1 | **Fond sombre + un seul accent chaud** (ici « sodium » sur bleu-nuit), et je l'habille d'une histoire pour le rendre légitime | oui : tout le système « Eau de nuit » |
| R2 | **Serif d'affichage légère** pour faire « éditorial » (Hahmlet 300, chasse resserrée) + sans très lisible pour le corps | oui : landing, titres de toute l'app |
| R3 | **Mono pour les chiffres** et les durées, « parce que c'est un instrument » | oui : minuteur, mesures, graduations |
| R4 | **Filets fins et feuilles sans boîtes** (border-t 1 px, sections « relevé ») présentés comme l'anti-bento, alors que c'est mon autre gabarit par défaut | oui : dashboard, résumé, landing |
| R5 | **Texte aligné à gauche sur un plein cadre sombre** avec un voile en dégradé pour la lisibilité : le hero « cinéma » | oui : landing, hero et toutes les sections |
| R6 | **Un seul bouton plein + un lien discret** à côté, en croyant esquiver le hero à 2 boutons | oui : landing, dashboard, réglages |
| R7 | **Indicateur qui glisse** (layoutId) sous l'onglet actif | oui : Segmented, rail |
| R8 | **Shader plein écran « scène nocturne »** : eau, horizon, lumières lointaines, vignette. C'est le même registre que les héros « aurora » que j'interdis, en plus sophistiqué | oui : WaterScene, landing, résumé |
| R9 | **Raymarching analytique sur un plan** pour éviter de modéliser : aucune géométrie, aucun objet, juste un quad et du bruit. C'est de la « 3D » qui évite la 3D | oui : lib/water |
| R10 | **Métaphore scientifique ou technique** (instrument, relevé, échelle de marée) plaquée sur une app pour légitimer un style sobre | oui : concept Clepsydre / Marégraphe |
| R11 | **Rayons « presque vifs » 2-10 px** et cartes à bordure fine | oui : tokens, MediaCard, modales |
| R12 | **Layouts symétriques et colonnes centrées max-w-6xl / 3xl** | oui : toutes les pages |
| R13 | **Fade et cascade d'entrée** (staggerChildren, ff-rise) même quand je dis les limiter | oui : dashboard, modales |
| R14 | **Palette désaturée « bon goût »** : encre bleu-noir, crème, gris chauds, aucune couleur franche | oui : les deux thèmes |
| R15 | **Composants « système » shadcn-like** renommés (Button ink/line/quiet, Field à ligne basse) | oui : components/ff |
| R16 | **Grille fine / graduations en fond** comme décor de « précision » | oui : graduations partout, échelle du splash |
| R17 | **Animations CSS keyframes génériques** (scale + opacity pour une « goutte ») au lieu d'un vrai plan chorégraphié | oui : ff-drop, ff-stone |
| R18 | **Copy en phrases courtes assertives** de manifeste (« La ville est déjà allumée. ») | oui : landing |

### Ce qui en découle

- Le concept « Clepsydre de nuit » est **suspendu** : il est né de mes
  réflexes R1, R8, R9, R10, R14. Il ne revient que s'il gagne le lab face à des
  directions qui n'en ont aucun.
- Le splash goutte d'eau reste (demande explicite), mais sa texture et sa
  palette suivront la direction gagnante.
- Nouvelle question à poser avant chaque écran : **« Est-ce que j'aurais
  produit ça par défaut ? »** Si oui, on change.
- Ajouts à la liste noire, applicables dès maintenant :
  - un fond sombre + un accent unique comme base du système (R1) ;
  - une serif légère d'affichage choisie « pour l'élégance » (R2) ;
  - un shader plein écran comme héros (R8) et toute « 3D » sans objet modélisé (R9) ;
  - toute primitive posée telle quelle (sphère, tore, boîte, nœud), modèle
    Sketchfab ou pack low-poly comme élément principal ;
  - une animation `linear` ou `ease` par défaut, ou une rotation infinie ;
  - un éclairage « HDRI par défaut + metalness 1 ».
