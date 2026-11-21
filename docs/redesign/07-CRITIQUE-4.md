# 07 · Critique, tour 4 : les écrans jamais revus, la lecture, Lighthouse (2026-11-21)

Tour ajouté après la question « as-tu tout fini ? » : la réponse honnête était
non. Ce tour couvre ce que les trois premiers n'avaient pas regardé.
Captures : `shots/crit4/` (dark et light, desktop 1440 et mobile 390).

## Écrans

| Écran | Constat | Correction |
|---|---|---|
| 404 | page par défaut de Next, en anglais, fond blanc | `app/not-found.tsx` : une tour dont un étage reste éteint, « 404 » sur l'afficheur à points, texte français |
| Carte Wrapped (PNG) | violet, vert émeraude, police système fine, tiret cadratin dans le pied et les valeurs vides | panneau à points sodium, soirs allumés jour par jour (taxi = meilleur soir, l'événement rare), polices de l'app chargées avant le dessin, aucune valeur vide en tiret |
| Page Wrapped | cartes en dégradé à grands rayons, halo brun, « , » orphelins (remplacement mécanique des tirets cadratins) | relevés sous filet, panneau à points, les soirs allumés, rayons de signalétique |
| Relevé de session, petit matin | heatmap invisible : jeton `--water` resté en alias de `surface-2` ; mois qui se chevauchent | cases en vert supérette, légende « Éteint / Allumé », libellé de mois sauté s'il est à moins de 3 colonnes du précédent |
| Projets | barres pleines génériques ; « sur la bonne voie » et « en retard » tous deux en sodium | rangée de fenêtres (`.ff-row`), vert = sur la voie, feu arrière = en retard |
| Dashboard | rail horaire : texte quasi blanc sur `surface-2`, illisible en petit matin | blocs prévus en `line-strong`, filet sodium, texte `foreground` |
| Réglages | diagramme du cycle en `--water` | travail en sodium (le minuteur), pause en trait neutre |
| Kanban (session, réglages), menu de statut, planning | « Terminé » en sodium (= maintenant) au lieu du vert supérette (= fait), repéré sur la planche avant / après de la session | vert supérette partout pour ce qui est fait |
| `/_design` | boutons « Goutte » et « Caillou » | « Clignement », « Grésillement » (types `blink`/`buzz` dans `Gauge`) |
| Bibliothèque, Planning, Journal, Spotify, Twitch, Découvrir | conformes ; Découvrir reste sur ses squelettes quand YouTube est injoignable (réseau de l'environnement) | rien à corriger côté design |

Organisation : chaque sous-onglet répétait le sous-titre de la page dans son
propre en-tête. La page garde désormais un sous-titre stable, et chaque onglet
se décrit seul.

## Transition réglages vers session

Avant : un rectangle noir qui s'agrandit. Après (`lib/useExpandNavigate.ts`) :
la vignette devient la plaque sombre de l'afficheur. La rangée de 25 points
du minuteur s'allume ensuite en sodium, de gauche à droite, à l'endroit où se
trouvera la jauge, pendant le chargement de la session. La plaque réelle prend
le relais. Démo : `shots/crit4/video/transition-session.mp4`.

## Lecture (partie B)

Le panneau « À venir » montre les titres suivants et marque les suggestions.
On peut retirer un titre, ou demander des titres proches. Spotify ne permet pas
de retirer un titre de sa file : le libellé « Passer » trompait, il devient
« Écouter maintenant » (relecture `code-reviewer`).

## Lighthouse (build de production, Chromium SANS GPU)

| Page | Avant | Après |
|---|---|---|
| Accueil | perf 45, TBT 146 s | perf 79, TBT 246 ms |
| Réglages | perf 50, TBT 147 s | perf 90, TBT 81 ms |
| Wrapped | perf 51, TBT 147 s | perf 86, TBT 134 ms |
| Relevé | perf 58, CLS 0,199 | CLS corrigé (emplacement réservé du bandeau) |

Accessibilité 100, bonnes pratiques 96 à 100, SEO 100 sur les quatre pages.
Rapports JSON : `docs/redesign/lighthouse/`.

Cause du TBT : le splash attend un clic (voulu) et son shader plein écran
tournait sans fin. Sans GPU, chaque image coûtait environ 130 ms sur le fil
principal. Trois corrections, l'effet goutte restant intact :

1. résolution plafonnée à 1 pixel CSS, le shader comptant désormais en pixels
   CSS (ondes identiques quelle que soit la densité) ;
2. ralenti au repos (environ 20 images/s), puis l'eau se fige après 5 s sans
   mouvement (l'identité exclut les boucles décoratives) ; tout repart au
   premier mouvement ;
3. **rendu logiciel détecté** (`lib/gpu.ts` : SwiftShader, llvmpipe) : le
   splash et la ville passent à leur version fixe. C'est le bon choix pour une
   vraie machine sans accélération, pas seulement pour la mesure. Forcer
   l'animation pour une démo : `localStorage["focusflow-force-webgl"] = "1"`.

LCP (3,6 à 4,7 s) : la mesure inclut le splash qui attend le clic. Sur une
machine avec GPU, la ville et le splash restent à mesurer (pas de GPU ici).

## Développement

La CSP stricte faisait afficher une « Issue » permanente en dev (React
reconstruit ses piles d'appels avec `eval`). `'unsafe-eval'` est ajouté en
développement uniquement ; la production reste inchangée.
