# 07 · Critique, tour 1 (2026-11-21)

Captures Playwright, 1440 et 390, nuit et petit matin : accueil, catalogue,
bibliothèque, organisation, statistiques, réglages, résumé, session.
Planches : `shots/crit1/avant-*.jpg` puis `apres-1.jpg`.

Question posée à chaque écran : « Est-ce que j'aurais produit ça par
défaut ? » et « Est-ce que ça appartient à la ville la nuit ? »

## Constats

| # | Écran | Constat | Gravité |
|---|---|---|---|
| 1 | Accueil, résumé | La jauge est encore une colonne d'eau graduée (Clepsydre abandonnée) | forte |
| 2 | Catalogue | « Choisis ta ville », « sa lumière teinte l'eau » : vocabulaire de l'eau, et « ville » prête à confusion avec la règle « aucun nom de ville » | forte |
| 3 | Réglages, accueil | « sans trait », « avant le trait » : vocabulaire de l'eau | moyenne |
| 4 | Titres | `font-light` hérité : Big Shoulders sort en maigre, pas en enseigne | moyenne |
| 5 | Résumé | Bandeau très large : surtout du ciel, montant de fenêtre envahissant | moyenne |
| 6 | Session | Minuteur en chiffres fins glissants (odomètre) : rien d'un panneau | forte |
| 7 | Session, Spotify, statistiques | Couleurs génériques restantes (émeraude, ambre, rouge, **rose fuchsia** interdit) | forte |
| 8 | Barre latérale | Marque = petite échelle de marée | moyenne |
| 9 | Catalogue (capture) | Miniatures cassées : règle de capture trop large (pas un bug de l'app) | outil |

## Corrections

1. `Gauge` réécrite en **façade** : les étages d'une tour s'allument (vert
   supérette = fait, sodium = l'étage en cours, uniquement pour aujourd'hui) ;
   la semaine devient une ligne de toits. Même interface, aucun appel cassé.
2. Catalogue : « Choisis ce qui joue derrière ».
3. « sans échéance », « avant l'objectif ».
4. Règle globale : titres `font-light` ramenés à 650.
5. Bandeau : focale longue, pas de montant, regard abaissé vers la tour.
6. Minuteur de session : plaque sombre, chiffres à points Doto en sodium,
   rangée de 25 points qui s'allument, « Pomodoro N ». Odomètre supprimé
   (un afficheur à points ne glisse pas, il commute).
7. Rouge et ambre de distraction → feu arrière ; bouton de pause Flowtime →
   vert de la halte ; avertissement Spotify → sodium ; statistiques → vert
   supérette et sodium.
8. Marque : une petite tour à fenêtres, la même façade que la jauge.
9. Script de capture corrigé (ordre des règles réseau).
