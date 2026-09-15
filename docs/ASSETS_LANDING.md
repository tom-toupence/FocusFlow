# Assets de la landing

Ce que la landing utilise, et ce qui reste éventuellement à fournir.

Règle du projet inchangée : **tout reste gratuit**, et **aucune photo
générique**. Le produit s'illustre avec ses propres contenus.

---

## Ce qui existe déjà (rien à fournir)

| Asset | Source | Utilisé par |
|---|---|---|
| `public/pexels-ethan-brooke-1123775-3142005.jpg` | Séoul à l'heure bleue, Pexels (licence gratuite) | fond de page (`CityBackdrop`) |
| Vignettes du catalogue | `https://i.ytimg.com/vi/<id>/hqdefault.jpg`, via `data/videos.ts` | hero, balade, boulevard, sources |
| Marques YouTube / Spotify / Twitch | SVG inline dans `LandingPage.tsx` | section Sources |
| **La ville de la balade** | **générée par le code** (`CityScene.tsx`) | section `CityWalk` |

La balade n'a besoin d'**aucun asset**. Immeubles, façades, fenêtres allumées,
lampadaires, chaussée, couchant et ligne de crête sont tous dessinés à
l'exécution : les textures sont peintes dans des `<canvas>` au montage, et la
géométrie est procédurale avec un générateur pseudo-aléatoire à graine (donc
identique à chaque visite). Le poids ajouté est celui de `three` seul,
lui-même chargé à part pour ne pas retarder le hero.

Les seules images de la scène sont les **vignettes du catalogue**, montées en
écrans géants sur les façades. `i.ytimg.com` renvoie
`access-control-allow-origin: *`, ce qui est indispensable pour en faire des
textures WebGL ; c'est vérifié, et une vignette qui échouerait est simplement
ignorée sans casser la scène.

---

## Ce qui pourrait encore aider (tout est facultatif)

### 1. Une capture de l'application en session

Le hero montre aujourd'hui une reconstitution de l'écran de session (anneau
réel, vraie vignette du catalogue). Une **capture vidéo de 4 à 6 secondes** de
l'app en fonctionnement, en boucle et sans son, serait plus honnête et plus
convaincante qu'une reconstitution, aussi fidèle soit-elle.

Format : `public/session-loop.webm`, 1280 × 800, VP9, moins de 1,5 Mo.

### 2. Une police d'affichage

Le projet utilise **Geist + Geist Mono**, neutres et honnêtes. Pour une
signature typographique plus marquée, une police d'affichage gratuite
suffirait : **General Sans**, **Satoshi** ou **Cabinet Grotesk** (Fontshare,
licence gratuite y compris commerciale). À réserver aux titres ; le corps de
texte et les chiffres restent en Geist.

### 3. Des façades photographiées (seulement si la ville procédurale lasse)

La ville de la balade est générée. Si tu veux plus de caractère, 3 ou 4 photos
de **façades nocturnes cadrées de face** (fenêtres allumées, sans passants
identifiables) remplaceraient les textures peintes, sans changer une ligne de
la scène : il suffirait de substituer `facadeTexture()`.

Format : 512 × 1024, JPEG qualité 80, moins de 150 Ko pièce, dans
`public/facades/`.

---

## Ce dont je n'ai PAS besoin

- Pas de photos de banque d'images (picsum, Unsplash génériques) : la règle
  d'imagerie du projet les bannit, et elles font immédiatement « site de
  voyage ».
- Pas de vidéo de marche : la balade est modélisée, pas filmée.
- Pas d'icônes : tout est en SVG inline, conformément aux conventions.
- Pas de logo : le wordmark actuel suffit.
