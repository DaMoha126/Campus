# Étudia — performances, sécurité et livraison du 4 novembre 2026

La démo optimisée est active sur https://etudia-demo.onrender.com. Version du code : `80dcf169af457bc045425698673d97c958cdd86b`, branche `codex/etudia-demo`. Déploiement Render `dep-dbljhi6gekts738jhrig`, statut **live** vérifié le 4 novembre à 13 h 56 UTC.

## Résultat

Le stockage de 1 600 élèves par établissement a été vérifié dans une base isolée comportant deux établissements. Les ralentissements principaux ont été réduits. La recette fonctionnelle passe, mais la capacité de 1 000 requêtes simultanées n’est pas validée. Les bulletins restent coûteux sous forte concurrence.

## Modifications livrées

- Chargement des données par écran ; l’export JSON récupère explicitement les données complètes autorisées.
- Notes chargées par classe par défaut. Le changement de classe recharge aussi les élèves et évaluations ; le choix explicite « Toutes les classes » conserve la vue globale.
- Bulletins : chargement du périmètre de la classe, avec historique des transferts nécessaire à l’impression collective. 1 200 notes au lieu de 48 000 dans la fixture administrative.
- Calcul des rangs par index et agrégation en un parcours, au lieu de rescanner toutes les notes pour chaque élève et matière. Calculs du navigateur également indexés pour l’impression d’une classe.
- Élèves et parents : inscriptions et contacts filtrés dès la requête. Les notes nominatives des camarades restent privées ; seuls les rangs agrégés utiles sont renvoyés.
- Accueil administratif compact : compteurs d’absences et messages, sans téléchargement de tout l’annuaire ni du registre d’absences.
- Gestion du chargement, nouvel essai après erreur et protection contre les réponses tardives lors d’un changement d’écran ou de compte.
- Correction d’erreurs détectées pendant la validation : appel du compteur PocketBase, filtres vides et dépassement de profondeur SQL pour les grands ensembles d’identifiants.
- Benchmark reproductible, borné et réservé à une base locale fictive. Arrêt de l’escalade après un palier trop lent ; limites de débit conservées et attente entre scénarios pour éviter de les confondre avec la latence.

## Tests exécutés

**23 tests réussis, 0 échec, 0 ignoré**, localement et sur GitHub Actions, avec PocketBase 0.40.5 et un vrai Chromium/Playwright.

[Exécution fonctionnelle et navigateur](https://github.com/DaMoha126/Campus/actions/runs/41841925439)

Couverture : comptes, rôles, inscriptions, paiements et concurrence, transferts, notes et publication, moyennes pondérées, ex æquo, absences/dispenses, bulletins, emplois du temps, impressions, exports, import CSV, erreurs réseau et navigation. Les assertions comparent aussi les réponses complètes et celles chargées par module.

Après déploiement : API de santé HTTP 200 ; fichiers `school.js` et `app.js` servis identiques aux fichiers vérifiés ; accès anonyme à l’API scolaire refusé avec HTTP 401. Les parcours authentifiés ont été vérifiés sur la base isolée, pas avec des comptes réels sur Render.

## Mesures de charge indépendantes sur GitHub

[Exécution de charge et artefacts](https://github.com/DaMoha126/Campus/actions/runs/41841925220) — **1 192 requêtes mesurées, toutes HTTP 200 et conformes aux assertions de données**.

Deux établissements de 1 600 élèves, 80 classes au total, 96 000 notes, 3 200 inscriptions et 3 200 paiements. Base SQLite après essais : environ **30,8 Mo**. Les dix écritures autorisées ont été conservées après redémarrage ; les écritures entre établissements ont été refusées.

Temps **p95**, plage entre les deux établissements, en millisecondes :

| Écran / rôle | 1 requête | 10 simultanées | 50 simultanées | 100 simultanées |
|---|---:|---:|---:|---:|
| Accueil direction | 16–17 | 65–72 | 366–371 | 1 024–1 025 |
| Accueil élève | 14 | 81–83 | 438–473 | 859–889 |
| Bulletins direction | 229–233 | 1 544–1 553 | 8 222–8 295 | Non exécuté après le palier lent |
| Bulletins élève | 112–116 | 827–846 | 4 561–4 605 | 8 727–9 396 |

Le chargement complet destiné notamment à l’export administratif reste lourd : environ 8,85 Mo, 1,70–1,76 seconde seul et 10,30–10,43 secondes à dix requêtes simultanées. Les écrans usuels utilisent désormais leurs périmètres réduits.

**Intégrité réussie ne signifie pas objectif de latence atteint** : les références indicatives de 2 secondes seul et 5 secondes sous concurrence ne passent pas sur tous les scénarios. Les paliers administratifs de bulletins à 100 ont donc été arrêtés avant exécution. Aucun essai à 1 000 n’a été lancé.

[Mesures détaillées et contrôles](RAPPORT_CHARGE_CI_2026-11-04.md)

## Vérification de sécurité

Contrôles réussis sur données fictives : accès anonyme et jetons forgés, comptes désactivés, séparation des établissements et rôles, notes non publiées, confidentialité des camarades, identifiants/modules malformés, affectation massive de champs, injections et XSS, contrôles d’origine, montants et dates invalides, rejeu de paiements et opérations concurrentes. Les contrôles légitimes ont été rejoués après correction.

Les charges ont visé uniquement PocketBase sur l’interface locale de la fixture. Aucun test de charge n’a visé Render ou un service tiers. Les fichiers temporaires de la fixture locale ont été supprimés après les essais.

Cette livraison ne constitue pas un audit exhaustif des dépendances ou de toutes les attaques. Les versions et sommes de contrôle sont fixées pour reproduire les essais ; aucune certification d’absence de vulnérabilité n’est revendiquée.

## Données et limites restantes

- Aucun changement de schéma ni migration de données métier n’a été nécessaire. Les 3 200 élèves du benchmark n’ont pas été ajoutés à la démo publique.
- La démo Render a régénéré son jeu fictif de trois établissements au déploiement. Son hébergement gratuit reste sans disque durable : ce n’est pas une solution de conservation de vraies données scolaires.
- Les établissements ont été sollicités successivement. Les élèves utilisent un pool de dix comptes ; 100 requêtes ne représentent donc pas 100 personnes distinctes.
- Une vague par palier ne prouve ni une charge soutenue ni un engagement de disponibilité. Le p95 des petits échantillons est descriptif.
- Les mesures sont celles du serveur API, sans coût réseau mobile ni temps de rendu. Un runner GitHub ne représente pas le serveur gratuit Render ni ses démarrages à froid.
- Pour une forte charge réelle, il reste notamment à réduire les annuaires et exports globaux, déplacer les agrégations de bulletins vers des calculs moins coûteux et valider l’hébergement avec un stockage durable.

Rôles mobilisés : coordination/intégration, réalisation et architecture, interface/design, tests de charge, validation fonctionnelle et sécurité. La démo est utilisable pour les parcours vérifiés ; une mise en production à forte concurrence reste à qualifier.
