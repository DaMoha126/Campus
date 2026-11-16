# Étudia — livraison et performances vérifiées le 16 novembre 2026

## Version livrée

Démo : https://etudia-demo.onrender.com  
Code actif : `251560ea473f3aff46f7633977b56af93cda32db`, branche `codex/etudia-demo`.  
Déploiement Render : `dep-dbt29bu7bikc73crafng`, statut **live**, terminé le 15 novembre à 21:33:57 UTC et confirmé le 16 novembre.

Le dépôt contient aussi une version locale SQLite plus récente sur `main`. Cette livraison concerne exclusivement la démo PocketBase ; la version locale et ses données ont été préservées.

## Corrections

- Rangs des élèves calculés par agrégation SQL, avec pondérations, barèmes, coefficients, périodes et ex æquo conservés.
- Seuls les rangs agrégés et les notes des enfants autorisés sont renvoyés aux familles. Aucun cache périmé : une correction ou dépublication est prise en compte dès la requête suivante.
- Les notes autorisées sont sérialisées en JSON dans SQLite, ce qui évite les conversions répétées de milliers d’objets entre PocketBase et JavaScript.
- Les requêtes partent des évaluations autorisées et utilisent l’index existant des notes. Le plan évite un parcours des 48 000 notes de l’établissement pour ouvrir un seul bulletin.
- Le chargement administratif global conserve son ancien chemin pour les grands exports. Aucun changement de schéma, nouvel index ou migration des données métier.

## Validation fonctionnelle et sécurité

**24 tests réussis, 0 échec, 0 ignoré**, localement et en CI, avec PocketBase 0.40.5 et un vrai navigateur Chromium/Playwright.

[Tests fonctionnels et navigateur](https://github.com/DaMoha126/Campus/actions/runs/43763930314)

Nouveaux contrôles : comparaison avec une référence JavaScript indépendante sur 180 notes générées, plusieurs enfants/classes/périodes, pondérations, notes zéro, absences/dispenses, ex æquo, texte Unicode, publication et modification immédiates, transferts et références corrompues entre établissements.

La revue indépendante a contrôlé les paramètres SQL liés, l’isolation dans toutes les jointures, les listes vides et les grandes listes d’enfants. Aucun contournement d’accès n’a été identifié dans le périmètre testé. Les scénarios existants couvrent aussi les comptes désactivés, jetons forgés, rôles, XSS, injections, paiements et opérations concurrentes. Ce travail ne constitue pas un audit exhaustif des dépendances ni une garantie d’absence de failles.

Les diagnostics de plans SQL sur une base synthétique ont servi à choisir l’optimisation. Les résultats de performance ci-dessous proviennent des API PocketBase réelles en CI, et non de cette simulation.

Rôles mobilisés : coordination/intégration, réalisation SQL, tests de régression et revue de sécurité indépendante. Interface inchangée ; les parcours navigateur existants ont été rejoués.

## Résultats de charge

[Exécution finale et artefacts](https://github.com/DaMoha126/Campus/actions/runs/43763930308)

**1 392 requêtes mesurées : toutes HTTP 200, avec vérification des données et de leur isolation.** Deux établissements fictifs de 1 600 élèves chacun, 96 000 notes au total. Les écritures autorisées et leur conservation après redémarrage passent ; les écritures entre établissements sont refusées.

Temps p95, plage entre les deux établissements :

| Bulletin | Requêtes simultanées | CI du 4 novembre | CI finale du 15 novembre |
|---|---:|---:|---:|
| Élève | 1 | 112–116 ms | 14–16 ms |
| Élève | 10 | 827–846 ms | 76–80 ms |
| Élève | 50 | 4 561–4 605 ms | 522–551 ms |
| Élève | 100 | 8 727–9 396 ms | 1 081–1 158 ms |
| Direction | 10 | 1 544–1 553 ms | 584–641 ms |
| Direction | 50 | 8 222–8 295 ms | 3 031–3 121 ms |
| Direction | 100 | Non exécuté après palier lent | 6 145–6 301 ms |

Ces exécutions utilisent le même scénario mais des runners distincts : les valeurs décrivent les essais, sans garantir un facteur d’accélération en production.

[Annexe des mesures et contrôles](RAPPORT_CHARGE_CI_2026-11-16.md)

## Limites restantes

- La référence indicative de 5 secondes sous concurrence n’est pas atteinte pour les bulletins administratifs à 100 requêtes. Les annuaires administratifs et exports globaux restent coûteux.
- Les vagues utilisent dix comptes élèves réutilisés et un compte direction. Il s’agit de requêtes simultanées, pas de 100 personnes distinctes ; les établissements sont testés successivement.
- Une vague par palier ne prouve pas une charge soutenue. Le p95 des très petits échantillons est descriptif.
- **1 000 requêtes simultanées ne sont pas validées.** Les limites de débit sont conservées ; aucun test de charge n’a visé Render ou un tiers.
- Le runner CI ne représente pas l’hébergement gratuit Render, la connexion mobile ou le temps de rendu. Les parcours authentifiés ont été vérifiés sur base isolée.
- Aucun élève fictif du benchmark n’a été ajouté à la démo publique. L’hébergement gratuit reste sans stockage durable et ne convient pas à la conservation de vraies données scolaires sans solution de persistance et sauvegarde.

La vérification du 16 novembre a également constaté un démarrage à froid de l’hébergement gratuit : la régénération des données fictives peut prendre plusieurs minutes avant que l’API réponde.

La démo est utilisable pour les parcours vérifiés. La mise en production à forte charge reste à qualifier.
