# Assets de la landing

Ce que la landing utilise aujourd'hui, et ce qu'il faudrait fournir pour
atteindre le niveau des références (davidecattaneo.it, jesperlandberg.com,
edolus.com).

La règle du projet ne change pas : **tout doit rester gratuit**, et **aucune
photo générique**. Le produit s'illustre avec ses propres contenus.

---

## Ce qui existe déjà (rien à fournir)

| Asset | Source | Utilisé par |
|---|---|---|
| `public/pexels-ethan-brooke-1123775-3142005.jpg` | Séoul à l'heure bleue, Pexels (licence gratuite) | fond de page (`CityBackdrop`) **et** la balade (`CityWalk`), même fichier donc même cache |
| Vignettes du catalogue | `https://i.ytimg.com/vi/<id>/hqdefault.jpg`, tirées de `data/videos.ts` | hero, balade, boulevard, sources |
| Marques YouTube / Spotify / Twitch | SVG inline dans `LandingPage.tsx` | section Sources |

---

## Ce qui manque, par ordre d'impact

### 1. La séquence d'images de la balade (le plus gros écart)

**C'est la limite actuelle.** `CityWalk` fait aujourd'hui grossir une photo
fixe. Une photo qui grossit donne un **zoom**, jamais un **déplacement** : le
point de fuite ne bouge pas, les façades ne défilent pas. Les sites de
référence n'ont pas ce problème parce qu'ils scrubent soit une séquence
d'images, soit une scène 3D.

La technique attendue (Apple, Locomotive) : une suite de JPEG/WebP dessinée
image par image dans un `<canvas>`, dont l'index est piloté par ScrollTrigger.
C'est du GSAP pur, sans WebGL.

**À fournir :**

- Une vidéo de **marche en vue subjective, de nuit, en ville** (steadycam ou
  stabilisée), 6 à 10 secondes utiles, sans coupe.
- Sources gratuites et réutilisables : **Pexels Videos** ou **Coverr**
  (licence permettant l'usage commercial, sans attribution). Chercher
  « night city walk pov », « walking street night », « tokyo night walk ».
  À défaut, une prise de vue perso convient très bien.
- Je m'occupe de l'extraction des frames. Format cible :
  - `public/walk/0001.webp` … `public/walk/0120.webp`
  - 120 frames (24 fps × 5 s), **1600 × 900**, WebP qualité 72
  - budget : environ **80 Ko par image, soit 10 Mo au total**, préchargés
    pendant le hero et affichés seulement une fois prêts (repli : la version
    actuelle)

> Si 10 Mo te paraît trop pour une landing, on descend à 60 frames en 1280 × 720
> (~3 Mo). C'est moins fluide mais tout à fait acceptable.

### 2. Les couches de profondeur de la photo de Séoul (alternative légère)

Si tu ne veux pas de séquence vidéo, on peut fabriquer une vraie parallaxe à
partir de la photo existante, découpée en 4 PNG à fond transparent :

1. `sky.png` : ciel + couchant
2. `ridge.png` : la ligne de crête des montagnes
3. `far.png` : les tours du fond
4. `near.png` : les immeubles du premier plan

Chaque couche se déplace alors à une vitesse différente au scroll : on obtient
un vrai relief là où il n'y a aujourd'hui qu'un zoom. Un détourage correct
suffit, ça ne demande pas de précision au pixel (les couches sont sombres et se
recouvrent).

### 3. Une police d'affichage (facultatif)

Les trois références tiennent beaucoup à leur typographie. Le projet utilise
**Geist + Geist Mono**, qui sont neutres et honnêtes. Si tu veux une signature
plus marquée, une seule police d'affichage suffirait, en gratuit :
**General Sans**, **Satoshi** ou **Cabinet Grotesk** (Fontshare, licence
gratuite y compris commerciale). À réserver aux titres, le corps de texte et
les chiffres restent en Geist.

### 4. Un vrai enregistrement d'écran de session (facultatif)

Aujourd'hui le hero montre une reconstitution de l'écran de session (anneau
réel + vraie vignette du catalogue). Une **capture vidéo de 4 à 6 secondes**
de l'application en fonctionnement, en boucle et sans son, serait plus honnête
et plus convaincante qu'une reconstitution, aussi fidèle soit-elle.

Format : `public/session-loop.webm`, 1280 × 800, VP9, moins de 1,5 Mo.

---

## Ce dont je n'ai PAS besoin

- Pas de photos de banque d'images (picsum, Unsplash génériques) : la règle
  d'imagerie du projet les bannit, et elles font immédiatement « site de
  voyage ».
- Pas d'icônes : tout est en SVG inline, conformément aux conventions.
- Pas de logo : le wordmark actuel suffit.
