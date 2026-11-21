# 07 · Critique, tour 3 : accessibilité et performance (2026-11-21)

## Accessibilité

Outil : `scripts/a11y.mjs` (axe-core 4, règles WCAG 2.0/2.1 A et AA), sept
pages (accueil, réglages, session, résumé, insights, Wrapped, landing), thème
nuit et thème petit matin, `prefers-reduced-motion: reduce`.

| Avant | Règle | Correction |
|---|---|---|
| accueil | `aria-prohibited-attr` : `aria-label` sur un `div` sans rôle (marque de la barre latérale) | `role="img"` |
| accueil | `label-content-name-mismatch` : bouton « Aller à ⌘K » nommé « Aller à, palette… » | nom aligné sur le texte visible |
| réglages, session | `button-name` : bouton « + » d'ajout de tâche sans nom | `aria-label="Ajouter la tâche"` |
| réglages | `color-contrast` × 7-8 : durées grisées à 40 % hors « Personnalisé » | valeurs en contraste plein, réglages retirés (y compris au clavier : `disabled`, ils restaient atteignables), phrase d'explication |
| Wrapped | `color-contrast` × 6 : légendes à 50 % d'opacité | jeton `text-ink-3` (AA vérifié) |

**Après : 0 règle en défaut sur les 7 pages, dans les deux thèmes.**
Contrastes des jetons : `node scripts/contrast.mjs`, toutes les paires AA.

Mouvement réduit : les scènes ne bouclent plus (une image recalculée à chaque
changement d'état, événements appliqués sans animation), le travelling et la
respiration de caméra sont coupés, la pluie s'arrête, le tube de respiration ne
s'anime pas, les animations `.ff-*` sont neutralisées dans `globals.css`.

## Performance

Mesures sur le build de production (`next start`), corps de réponse décodés,
Chromium sans GPU (rendu logiciel).

| Page | Total | JS | Modèle 3D | FCP |
|---|---|---|---|---|
| Accueil | 1,5 Mo | 1,2 Mo | non | 140 ms |
| Réglages | 1,2 Mo | 0,9 Mo | non | 124 ms |
| Résumé (bandeau de ville), 1440 | 3,2 Mo | 1,8 Mo | 1,1 Mo | 132 ms |

- La ville n'est **jamais** dans le paquet initial : `next/dynamic` sans SSR,
  puis import dynamique du moteur (three + postprocessing ≈ 0,87 Mo décodés)
  et du modèle. Le premier affichage n'attend rien.
- Modèle : 2,2 Mo (249 k triangles) sur ordinateur, 1,1 Mo (79 k) sur mobile
  ou machine à 4 cœurs ou moins, contre 37,9 Mo pour l'original.
- Boucle de rendu coupée hors écran (IntersectionObserver) et onglet caché ;
  densité de pixels plafonnée (1 sur mobile, 1,5 sinon) ; bloom et profondeur
  de champ à demi-résolution.
- Repli statique : image rendue par la scène elle-même (130 Ko), utilisée sans
  WebGL2, avec `NEXT_PUBLIC_DISABLE_WEBGL=1` ou si l'utilisateur coupe les effets.
- **Non mesurable ici** : les 60 images/s. Le conteneur n'a pas de GPU (rendu
  logiciel à quelques images/s pour toute scène WebGL). À vérifier sur une
  machine réelle avec l'onglet Performance.
