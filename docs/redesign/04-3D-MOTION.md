# 04 · 3D et motion (état final)

> Les versions précédentes de ce document (eau WebGL de la Clepsydre, ruelle
> procédurale) sont abandonnées ; leur histoire est dans `LAB.md`.

## La scène : `lib/city/TokyoRenderer.ts`

- **Matière** : capture photogrammétrique TOKYO NIGHT (CC BY 4.0), allégée en
  deux niveaux de détail (2,2 Mo / 249 k triangles ; 1,1 Mo / 79 k).
- **Cadrage** : focale ~50 mm, surplomb, tour au tiers gauche, montant de
  fenêtre et appui au premier plan. Variantes : portrait (focale courte),
  bandeau très large (focale longue, sans montant), lacet pour les pages qui
  posent leur texte à gauche.
- **Lumière** : celle de la capture (cuite), dont on extrait les sources par
  luminance pour les piloter ; brume en hauteur ambrée ; ciel fait main (halo
  de pollution lumineuse, nuages éclairés par dessous).
- **Post** : profondeur de champ pilotée, bloom à seuil, pluie sur la vitre
  (gouttes posées, gouttes qui glissent par à-coups, buée, réfraction), reflet
  de la lampe de la pièce, ACES, grain, vignette.

## Séquences (chaque état de l'app a la sienne)

| État | Plan | Durée, courbe |
|---|---|---|
| Arrivée | travelling avant, bascule de point vitre vers ville | 9 s ease-out ; point 4,5 s |
| Travail | respiration de caméra (période ~9 s), main en parallaxe douce | continu, amorti |
| Halte | vague d'extinction du fond vers nous ; point sur la vitre ; léger recul | 3,2 s ; 2,8 s retard 0,8 s |
| Reprise | rallumage de près en loin, retour du point | 2,6 s ; 2,4 s ease-out |
| Distraction | un quartier grésille (ratés irréguliers) | 1,2 s |
| Playlist prolongée | onde courte, un pâté s'allume | 1,6 s |
| Objectif | onde chaude depuis la tour, toute la ville | 5,5 s |
| Thème | nuit vers heure bleue | 1,4 s |

Courbes nommées (`lib/motion.ts`, `lib/city/tween.ts`) : jamais `linear` ni
`ease` par défaut. L'animateur des scènes est à l'horloge : une transition
dure sa durée même à faible fréquence d'images.

## Performance et replis

Import dynamique (jamais dans le paquet initial), boucle coupée hors écran et
onglet caché, densité de pixels plafonnée, effets à demi-résolution, modèle
mobile. Repli : image fixe rendue par la scène (nuit, petit matin), sans
WebGL2, avec `NEXT_PUBLIC_DISABLE_WEBGL=1` ou `prefs.sceneEffects = false`.
Reduced motion : une image par changement d'état, aucune boucle.

## Le reste du mouvement de l'app

`motion/react` : contrôles segmentés à indicateur qui glisse, cascade
d'entrée, pression tactile. Façades : fenêtre qui clignote (piste suivante),
étage qui grésille (distraction). Minuteur LED : les chiffres commutent, ils ne
glissent pas.
