# 07 · Critique, tour 2 (2026-11-21)

Écrans pas encore vus au tour 1 : activité (aperçu, statistiques), insights,
palette ⌘K, accueil du premier lancement, session ; puis mobile.
Planches : `shots/crit2/avant.jpg`, `apres.jpg`, `apres-mobile.jpg`.

## Constats

| # | Écran | Constat | Gravité |
|---|---|---|---|
| 1 | Insights, statistiques | Graphiques en barres génériques (boîtes grises pleines, gros blocs orange) : la façade de la jauge n'y est pas | forte |
| 2 | Activité | « Jardin de focus » : des plantes, hors du thème de la ville la nuit | moyenne |
| 3 | Activité, succès, carte de chaleur | Progression en sodium alors que le système réserve le sodium à « maintenant » et le vert supérette à « fait » | moyenne |
| 4 | Mobile | Nom de l'app souligné par l'ancien trait de niveau de l'eau | moyenne |
| 5 | Session | « En cours de lecture » vide tant que YouTube ne répond pas ; aucune explication si le lecteur ne charge jamais | moyenne (corrigé dans l'adaptateur) |
| 6 | ⌘K, premier lancement | Conformes (contrôles sobres, palette respectée) | |

## Corrections

1. Utilitaire `.ff-floors` : un masque répété transforme toute barre en tour
   à étages, quelle que soit sa couleur. Appliqué aux graphiques d'insights et
   de statistiques (vert supérette = focus, sodium = heure de pointe et
   aujourd'hui, feu arrière = score bas).
2. « Les soirs allumés » : chaque soir de focus allume un immeuble, un étage
   par palier (25 min, 1 h, 2 h). Données et règles inchangées
   (`lib/progression`), seule l'image change.
3. Le jeton `--focus` passe au vert supérette (il ne servait qu'à la
   progression, aux succès et à la carte de chaleur). Contrastes revérifiés.
4. Mobile : petite tour à fenêtres + nom en enseigne (Big Shoulders 800).
5. L'adaptateur YouTube publie le titre dès sa création et un message clair
   au bout de 15 s si le lecteur ne répond pas.
