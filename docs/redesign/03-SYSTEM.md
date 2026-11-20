# 03 · Système de design : « la ville qui ne dort pas »

> Historique : la Clepsydre (abandonnée, réflexes) puis Céladon (abandonné,
> hors thème) ont précédé ce système. Le thème est imposé : la vie nocturne
> d'une mégapole asiatique, version cyberpunk, comme décor du travail la nuit.
> Les valeurs exactes (tokens, polices) sont fixées par le **lab 2**
> (`LAB.md`) puis inscrites ici et dans `app/globals.css`.

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

## 2. Palette (rôles, valeurs fixées au lab 2)

| Rôle | Source dans la ville | Usage dans l'UI |
|---|---|---|
| **Sodium** | lampadaires orangés | « maintenant » : minuteur en marche, action qui lance le temps |
| **Supérette** | vert froid des enseignes 24 h | « fait / en focus » : progression, objectif, amis en focus |
| **Néon blanc** | tubes froids, caissons | texte principal sur la nuit, éléments actifs |
| **Feu arrière** | rouge des taxis et voitures | alerte, distraction, destructif |
| **Taxi** | jaune des taxis | rare : objectif atteint, événement |
| **Asphalte** | bleu-noir mouillé | fonds de nuit, jamais noir pur |
| **Béton du matin** | gris chaud humide | fonds du thème clair |

## 3. Typographie (principes ; familles fixées au lab 2)

- **Affichage et chiffres** : inspirés de la signalétique de nuit (enseignes,
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
