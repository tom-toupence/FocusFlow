# 03 · Système de design « Céladon, l'atelier » (révisé après le lab)

> La version précédente (« Clepsydre de nuit ») est abandonnée : elle venait de
> mes réflexes (01-ANTI-SLOP § G). Ce document décrit le système issu du lab.
> Source de vérité du code : `app/globals.css` (tokens), `lib/motion.ts`
> (mouvement), `components/ff/*` (composants), `lib/atelier/*` (3D),
> page interne `/_design`. Contrastes : `node scripts/contrast.mjs`.

## 1. Principe

L'interface est l'**atelier** ; la 3D est la **pièce** qui s'y fabrique. Le
temps de travail fait monter l'émail ; les pauses passent au four ; l'histoire
se range sur l'étagère. Le système graphique est fait de **matières** (terre,
émail, oxyde de fer, lueur de four), pas d'un fond et d'un accent.

| | Jour, « l'atelier » (défaut) | Nuit, « le four la nuit » |
|---|---|---|
| Fond | os, lumière de verrière | charbon chaud, jamais noir pur ni bleu |
| Texte | oxyde de fer | os |
| Fait / émaillé | céladon profond | céladon lumineux |
| En cours / cuit maintenant | lueur de four, en petite surface | lueur de four plus vive |
| Neutres | terres (crue, sombre) | terres assombries |

Le **thème clair redevient le défaut** : c'est l'atelier en plein jour, et
c'est le contraire de mon réflexe R1. La nuit reste disponible.

## 2. Couleurs (tokens)

`--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--text`,
`--text-2`, `--text-3`, `--on-text`, `--glaze` (céladon : fait, progression),
`--glaze-deep`, `--glaze-text`, `--kiln` (four : maintenant, signal rare),
`--kiln-text`, `--on-kiln`, `--clay`, `--clay-dark`, `--danger`, `--reflet`
(couleur de la vidéo, teinte l'émail des pièces).

Règles :
- le **céladon** dit « fait / émaillé / en progression » (barres, niveau,
  onglet actif) ;
- la **lueur de four** dit « maintenant, en train de cuire » : le bouton qui
  lance le temps, le minuteur en marche, la pièce au four. Jamais en décor ;
- les **terres** remplacent les gris : bordures, surfaces creusées, textes
  secondaires ;
- couleurs sémantiques conservées en petite surface : marques Spotify et
  Twitch, couleurs choisies par l'utilisateur, humeurs, rouge destructif.

## 3. Typographie

| Famille | Rôle | Raison |
|---|---|---|
| **Bricolage Grotesque** (OFL) | titres, grands chiffres (minuteur, mesures) | grotesque à pièges d'encre, axes de largeur et de taille optique, dessin légèrement irrégulier comme une pièce tournée ; `tnum` vérifié |
| **Gowun Dodum** (OFL) | interface, texte courant, légendes | humaniste arrondie coréenne et latine, douceur d'argile, lisible petit ; `tnum` vérifié |

- Plus aucune mono (réflexe R3) : les chiffres sont en Bricolage tabulaire.
- Plus aucune serif légère (réflexe R2).
- Les grands chiffres utilisent l'axe de largeur (condensé) pour tenir sur la
  vidéo sans masquer l'image.

## 4. Formes, espace, élévation

- **Rayons** : la terre est ronde. Surfaces `16px`, contrôles `999px` pour les
  actions principales (galet), `10px` pour les champs ; vignettes média `12px`.
  C'est un changement assumé par rapport aux angles vifs précédents (R11).
- **Composition** : asymétrique. Les écrans s'organisent autour d'un **objet**
  (la pièce, l'étagère) placé hors centre, le texte vit dans l'espace restant.
  Pas de colonne centrée `max-w` par défaut (R12).
- **Élévation** : les surfaces sont posées comme des pièces sur une table :
  une ombre de contact courte et chaude (`--shadow-rest`), une ombre portée
  plus large pour ce qui flotte (`--shadow-lift`).

## 5. Mouvement (chorégraphie)

Chaque animation est un **plan** : intention, anticipation, action,
dépassement maîtrisé, retour au repos, temps de pause. Easings nommés dans
`lib/motion.ts` et en CSS ; jamais `linear` ni `ease` par défaut ; aucune
rotation infinie.

| Nom | Courbe | Usage |
|---|---|---|
| `wheel` | ressort raide 220 / 17 | la tournette : départ, élan, arrivée avec un dépassement |
| `throw` | `cubic-bezier(.2,.8,.2,1)` + anticipation `cubic-bezier(.4,0,1,1)` 120 ms | une pièce posée : petit creux puis montée |
| `glaze` | `cubic-bezier(.45,0,.55,1)` | l'émail qui monte, la lumière du four |
| `drip` | `cubic-bezier(.55,0,.9,.4)` | une goutte, une coulure (gravité) |
| `settle` | ressort doux 120 / 20 | ce qui se pose (étagère, carte) |
| `ui` | `cubic-bezier(.25,.8,.3,1)` 160-240 ms | réponses d'interface |

**Séquences d'état** (écrites en code avec `motion`, voir 04-3D-MOTION) :
entrée en scène, repos vivant (la pièce respire à peine : 0,6 % d'échelle sur
6 s, seulement pendant une lecture), session lancée, distraction (picot),
fin de pomodoro (tour + four), pause (refroidissement), fin de playlist
prolongée (seconde couche), objectif atteint (sceau).

Références hors web : la tournette du potier, les fours de Gangjin, les
génériques de Saul Bass (formes simples, rythme), ManvsMachine et Buck (objets
en studio), l'horlogerie (échappement : un cran net, puis repos).

## 6. Composants

Les composants `components/ff/*` sont repris sous ce système : boutons
galets (four pour l'action qui lance le temps, terre pour les autres),
champs à fond de terre creusée, sous-navigation par **pastille d'émail** qui
coule d'un onglet à l'autre, cartes média posées comme des carreaux,
rangées de piste, contrôles de lecture, modales posées sur la table,
états vides représentés par **une pièce crue non émaillée**.
