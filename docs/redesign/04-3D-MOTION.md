# 04 · 3D et mouvement

## 1. Techno retenue : WebGL2 brut, shaders écrits à la main

| Option | Poids ajouté | Verdict |
|---|---|---|
| React Three Fiber + drei | ~150 Ko gzip (three + r3f + drei partiel) | rejeté : pour **un seul quad plein écran**, c'est un moteur de scène entier ; et le registre « R3F + drei » est celui des sphères et des orbes de la liste noire |
| Three.js brut | ~120 Ko gzip | rejeté pour la même raison : aucun maillage, aucune lumière, aucun chargeur ne sert |
| OGL | ~10 Ko | possible, mais n'apporte rien qu'on ne fasse en 200 lignes |
| **WebGL2 brut + GLSL maison** | **~6 Ko** (`lib/water/*`) | **retenu** : même technique que le splash existant (que l'utilisateur veut garder), cohérence de rendu, contrôle total du budget |

La scène est **entièrement analytique** : un quad plein écran, un lancer de rayon
sur un plan d'eau, une échelle de marée intersectée comme un plan vertical,
une rive faite de lumières procédurales. Aucune texture, aucun modèle à
télécharger. C'est de la 3D au sens propre (caméra en perspective, plan,
réflexion de Fresnel, normales calculées depuis un champ de hauteur), sans
géométrie.

### `public/tokyo_night.glb` : non utilisé

Photogrammétrie de 37,9 Mo (680 k sommets, CC-BY-4.0). Il ne sert pas le
concept : une ville en 3D entrerait en concurrence directe avec les vidéos 4K,
qui sont déjà « la ville ». Même décimé et compressé (Draco, < 3 Mo), il
imposerait three.js et un temps de chargement incompatible avec un lancement
quotidien. Le fichier reste dans `public/` (non référencé, donc jamais
téléchargé par un visiteur) ; il est recommandé de le retirer du dépôt pour
alléger les clones, décision laissée à l'utilisateur. Les scripts
`obj2glb.mjs` / `resize-skybox.mjs` sont des restes d'une scène supprimée.

## 2. La scène : la clepsydre de nuit

- **L'eau** : plan en incidence rasante ; champ de hauteur = houle (3 sinus) +
  anneaux amortis (8 au plus) + un frémissement minimal (l'eau n'est jamais
  morte, même en pause : 2,5 mm).
- **L'échelle de marée** : une mire graduée plantée dans l'eau, avec son
  reflet. C'est l'objet qui mesure. Le niveau de l'eau y monte et y descend.
- **La rive** : des lumières de ville en grappes irrégulières, chaudes,
  teintées par la **couleur de la vidéo** (le reflet).
- **Le lampadaire au sodium** hors champ : son reflet trace un **chemin de
  lumière** sur l'eau. C'est lui qui rend visibles la houle, les gouttes et
  les cailloux ; c'est aussi le signal sodium du système, dans la scène.
- **Aucune** sphère, particule, orbe, montagne, silhouette de personnage.

## 3. Ce qui fait réagir l'eau (événements réels uniquement)

| Événement de l'app | Réaction | API |
|---|---|---|
| tick du minuteur (travail) | le niveau monte sur l'échelle (ressort amorti vers la cible) | `level` |
| pause Pomodoro | respiration guidée = le niveau monte 4 s, tient, descend 4 s, tient | `level` piloté par la phase |
| lecture active / en pause | houle présente / surface lisse | `swell` |
| changement de piste | une goutte au loin | `drop()` |
| distraction (touche D) | un caillou près du bord, onde plus serrée | `stone()` |
| fin de pomodoro | débordement : l'eau dépasse la cible puis se pose | `overflow(to)` |
| couleur de la vidéo / pochette Spotify | la rive et la lueur d'horizon changent de teinte (fondu 0,7 s) | `reflet` |
| ami qui passe en focus (accueil uniquement) | une goutte lointaine | `drop()` |
| clic sur l'eau (splash, landing) | goutte à l'endroit du clic | `drop(x, y)` |

**Aucune réaction au son**, aucune analyse audio (impossible, et ce serait
mentir). La houle a la même amplitude quel que soit le morceau ; elle signifie
« lecture en cours », et le panneau d'aide le dit.

## 4. Où vit la 3D, et où elle ne vit pas

| Lieu | 3D ? | Pourquoi |
|---|---|---|
| Splash | oui (shader existant, conservé et restylé en phase 5) | invariant demandé par l'utilisateur |
| Landing | oui | elle raconte le produit par la scène |
| Session, travail, **vidéo** | **non** : colonne SVG (`Gauge`) | la vidéo 4K est l'immersion ; un second contexte GPU au-dessus d'une iframe vidéo coûte des images et distrait |
| Session, **pause** Pomodoro | oui, plein écran | la vidéo est figée : l'eau prend le relais, la respiration guidée devient le niveau de l'eau |
| Session **Spotify** (pas de vidéo) | oui, plein écran derrière la pochette | il n'y a pas d'image : l'eau reflète la couleur de la pochette, une goutte à chaque titre |
| Session Twitch | non | c'est une vidéo |
| Transition catalogue → session | non (CSS : découpe circulaire + anneaux SVG depuis le clic) | moment court, on évite de créer un contexte juste avant l'iframe |
| Résumé | oui, bandeau | l'eau se pose au niveau de la session terminée |
| Accueil, listes, Organisation, Activité | non (SVG) | écrans de travail quotidien, lus de près : la colonne SVG suffit |
| PiP | non | fenêtre minuscule, toujours au premier plan |

Une seule scène WebGL montée à la fois (règle).

## 5. Budget de performance

- **Chargement paresseux** : `WaterScene` n'est importé qu'en `next/dynamic`
  (`ssr: false`) par les écrans qui l'utilisent. Le moteur fait ~6 Ko.
- **DPR plafonné** : 1,5 (1 sur pointeur grossier / mobile).
- **Résolution adaptative** : si l'intervalle moyen entre images dépasse 20 ms
  sur 45 images, l'échelle interne baisse par pas de 15 % (jusqu'à 50 %) ; elle
  remonte sous 14 ms.
- **Arrêt** quand l'onglet est caché (`visibilitychange`) ou la scène hors
  écran (`IntersectionObserver`). Pas de `requestAnimationFrame` inutile.
- **Contexte** : `powerPreference: "low-power"`, sans antialiasing, sans alpha.
- **Coût shader** : 3 évaluations du champ de hauteur par pixel (normale par
  différences finies), 8 anneaux au plus. Pas de boucle de raymarching.

## 6. Replis

- **Sans WebGL2** ou erreur de compilation : `StaticWater`, la même composition
  en CSS (ciel, ligne de rive pointillée, eau dégradée, échelle graduée).
- **`prefers-reduced-motion`** : une seule image dessinée, plus aucune
  animation ; le niveau saute à sa valeur, gouttes et cailloux ignorés.
  L'information reste portée par le texte (chiffres, consignes).
- **Mobile faible** : DPR 1 + résolution adaptative.

## 7. Désactiver la 3D

- Pour un utilisateur : préférence **« Effets d'eau »** (`prefsStore.waterEffects`,
  persistée), réglable dans le profil. Désactivée, chaque scène devient
  l'image fixe.
- Pour tout un déploiement : variable **`NEXT_PUBLIC_DISABLE_WEBGL=1`**.

## 8. Le mouvement hors 3D

Voir `03-SYSTEM.md § Mouvement` : moteur **`motion/react`** partout (landing
comprise), animations CSS `ff-*` pour les gestes simples, aucune boucle
décorative. Les quatre gestes signature de l'identité :

1. **La goutte** (splash, transition catalogue → session, changement de piste) :
   chute en `fall`, anneau qui s'élargit en `settle`.
2. **Le niveau** (minuteur, objectif, résumé) : montée linéaire au rythme du
   temps réel, arrivée amortie seulement quand une valeur est atteinte.
3. **Le caillou** (distraction) : onde serrée et brève, qui se recalme.
4. **Le débordement** (fin de pomodoro) : seul moment où l'eau dépasse sa
   cible, une fois, puis se pose.
