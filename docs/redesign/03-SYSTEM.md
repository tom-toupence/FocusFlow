# 03 · Système de design : « la ville qui ne dort pas »

> Historique : la Clepsydre (abandonnée, réflexes) puis Céladon (abandonné,
> hors thème) ont précédé ce système. Le thème est imposé : la vie nocturne
> d'une mégapole asiatique, version cyberpunk, comme décor du travail la nuit.
> Valeurs fixées par le lab 2 (`LAB.md`, direction « la ville qui ne dort pas »).

## 1. Principes

1. **Le thème vit dans le décor, la lumière et la matière**, pas sur les
   contrôles. L'interface reste un outil quotidien : sobre, lisible, rapide.
2. **Deux heures de la même ville** :
   - sombre (défaut) : **la nuit** ; plusieurs sources colorées, jamais « un
     fond noir et un accent » ;
   - clair : **le petit matin** ; ciel lavé, béton humide, enseignes qui
     s'éteignent une à une, lumière froide et douce.
3. **Le temps de la session est la nuit qui avance** ; travail et pause ont
   deux ambiances distinctes et lisibles.
4. **Aucune écriture décorative** : pas de faux caractères asiatiques, pas de
   noms de villes, pas de néon rose ni de magenta + cyan.

## 2. Palette

| Rôle | Nuit | Petit matin | Source dans la ville | Usage dans l'UI |
|---|---|---|---|---|
| **Sodium** | `#ff9a3c` | `#b5550f` | lampadaires orangés | « maintenant » : minuteur en marche, action qui lance le temps |
| **Supérette** | `#53e0a1` | `#11734a` | vert froid des enseignes 24 h | « fait / en focus » : progression, objectif, amis en focus |
| **Néon blanc** | `#e9f2ff` | `#1d232b` | tubes froids, caissons | texte principal sur la nuit, éléments actifs |
| **Feu arrière** | `#ff5a4a` | `#b32418` | rouge des taxis et voitures | alerte, distraction, destructif |
| **Taxi** | `#ffc21a` | `#8a6200` | jaune des taxis | rare : objectif atteint, événement |
| **Asphalte** | `#0b1016` | `#e4e2dd` | bleu-noir mouillé | fonds de nuit, jamais noir pur |
| **Béton du matin** | `#141a22` | `#efeeea` | gris chaud humide | fonds du thème clair |

## 3. Typographie

- **Big Shoulders** (City of Chicago, OFL, axes poids et taille optique) : titres et enseignes. Dessinée pour la signalétique d'une ville ; condensée, lisible de loin.
- **Doto** (OFL) : le minuteur et les grands chiffres, comme un panneau d'affichage à LED de quai ; chiffres tabulaires, uniquement en grand.
- **Atkinson Hyperlegible Next** (Braille Institute, OFL) : tout le texte courant et l'interface ; conçue pour la lisibilité basse vision.
- Principes : inspirés de la signalétique de nuit (enseignes,
  panneaux de quai, écrans d'information) : condensés, très lisibles de loin,
  chiffres tabulaires, hiérarchie franche.
- **Texte courant** : une sans de grande lisibilité, sans effet.
- **Écrans** (minuteur sur la vidéo, panneaux d'horaires) : une écriture
  d'afficheur est admise pour les chiffres seulement, si elle reste lisible.

## 4. Mouvement

Inchangé dans son principe (voir 04-3D-MOTION et `lib/motion.ts`) : chaque
animation est un plan chorégraphié (intention, anticipation, action,
dépassement maîtrisé, repos), easings nommés, jamais `linear` ni `ease` par
défaut, aucune boucle décorative ; la pluie, la vapeur et le grésillement d'une
enseigne sont des phénomènes du décor, joués avec retenue et coupés en
reduced-motion.
