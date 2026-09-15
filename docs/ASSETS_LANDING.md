# Assets de la landing

## Photographies de Séoul (`public/seoul/`)

Six photos de Séoul la nuit, téléchargées depuis **Pexels** (licence libre :
usage commercial autorisé, sans attribution obligatoire, donc conforme à la
règle « tout reste gratuit » du projet). Servies par `next/image`, donc
converties en AVIF/WebP et mises en cache sur l'edge Vercel.

| Fichier | Pexels | Usage |
|---|---|---|
| `01-skyline-aerien.jpg` | 3142002 | fond du hero (plein cadre) |
| `02-skyline-nuit.jpg` | 38966645 | fond du manifeste, volet « musique » |
| `03-lotte-han.jpg` | 29343916 | cadre gauche du hero |
| `04-pont-illumine.jpg` | 18839145 | volet « trace » |
| `05-rue-enseignes.jpg` | 21418683 | cadre droit du hero, volet « minuteur » |
| `06-pont-skyline.jpg` | 10264353 | fond de l'action finale |

`01-skyline-aerien` vient de la **même série** (Ethan Brooke, Séoul) que la
photo historique `public/pexels-ethan-brooke-1123775-3142005.jpg`, ce qui garde
la continuité visuelle du projet.

Poids total : environ 3,5 Mo en source, largement réduit à la livraison par la
conversion AVIF de `next/image`.

## Les deux registres d'imagerie, à ne pas mélanger

- **Séoul porte l'atmosphère** : plein-cadres et volets du diaporama.
- **Les vignettes du catalogue portent le produit** : bande du catalogue et
  panneaux de sources, parce que ce sont littéralement les paysages que
  l'application propose (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`, via
  `data/videos.ts`).

Les sources externes (YouTube, Spotify, Twitch) sont représentées par leur
marque en SVG inline, jamais par une photo d'illustration.

## Typographie

- **Cormorant Garamond** (`next/font/google`, gratuite) : serif d'affichage,
  **réservée à la landing** via l'utilitaire `font-display`. Le site connecté
  reste intégralement en Geist : une serif dans une interface de productivité
  serait hors sujet.
- **Geist** et **Geist Mono** : corps de texte, chiffres et micro-labels.

## Ce dont je n'ai PAS besoin

- Pas de photos génériques (picsum, Unsplash sans rapport) : la règle
  d'imagerie du projet les bannit.
- Pas de vidéo : la sensation de déplacement vient de la parallaxe au scroll.
- Pas d'icônes : tout est en SVG inline, conformément aux conventions.
- Pas de logo : le wordmark actuel suffit.

## Historique

`public/pexels-ethan-brooke-1123775-3142005.jpg` (la photo d'origine, Séoul à
l'heure bleue depuis Namsan) **n'est plus référencée** par la landing, qui
utilise désormais les six photos ci-dessus. Le fichier est conservé : il a servi
de référence de direction artistique pendant toute la refonte.
