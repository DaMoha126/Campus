# Étudia — démonstration gratuite

Cette version permet de tester Étudia en ligne avec des données entièrement fictives. Elle n'est pas destinée à recevoir des informations réelles sur des élèves, des parents ou des paiements.

- Render Free, 512 Mo, région Francfort, aucune base payante ni disque payant.
- Base PocketBase éphémère dans `/tmp/etudia-demo-data`.
- Les modifications peuvent disparaître lors des redémarrages, redéploiements et mises en veille. La démo initiale est alors recréée.
- Une première ouverture après une mise en veille peut demander une à plusieurs minutes.
- Configuration reproductible dans `render-demo.yaml` ; Dockerfile commun avec la version persistante.

## Accès de test

| Établissement fictif | Administration | Enseignant | Élève | Parent |
| --- | --- | --- | --- | --- |
| Collège Horizon | `DEMOADMIN` | `DEMOPROF` | `DEMOELEVE` | `DEMOPARENT` |
| Groupe scolaire Baobab | `DEMOADMIN2` | `DEMOPROF2` | `DEMOELEVE2` | `DEMOPARENT2` |
| Lycée Avenir | `DEMOADMIN3` | `DEMOPROF3` | `DEMOELEVE3` | `DEMOPARENT3` |

Déconnectez-vous pour visiter un autre établissement avec son compte. Un administrateur scolaire voit uniquement son établissement.
Le mot de passe commun est fourni séparément et conservé dans la variable secrète `ETUDIA_DEMO_PASSWORD`. Il ne figure pas dans les sources.

La démo contient 3 établissements fictifs, 12 classes, 120 élèves, 60 parents (deux enfants par parent), 18 enseignants et 9 membres du personnel : 3 directions, 3 agents de scolarité et 3 comptables. Chaque établissement dispose de 15 matières dans son catalogue et de 24 affectations couvrant 6 matières générales. Les emplois du temps comportent 20 cours par classe, du lundi au vendredi, soit 240 créneaux au total, sans conflit de professeur, de salle ou de classe.

Les bulletins sont calculés à partir de 2 880 notes sur les deux premiers trimestres : 300 évaluations au total, dont 12 brouillons. Les comptes élèves principaux illustrent une moyenne de 16/20 au premier trimestre et 17/20 au deuxième. La démo comporte aussi 216 devoirs (à venir et passés, dates relatives au lancement), 792 rendus, 216 séances de cahier de textes, 240 appréciations, 90 versements fictifs avec trois annulations, 480 échéances, 120 présences/retards/absences, 24 justifications en attente, 12 annonces et 21 messages privés.

Les élèves ont des noms complets distincts au sein de chaque établissement et les frères et sœurs partagent le nom de leur parent fictif. Tous les noms sont synthétiques, les emails utilisent le domaine invalide demo.invalid et aucun numéro de téléphone réel n’est utilisé. Les protections de connexion, les permissions et les contrôles d’origine restent actifs. Le compte technique PocketBase est aléatoire et n’est pas partagé.

Pour essayer la scolarité ou la comptabilité du premier établissement, utiliser respectivement les identifiants E1ADMIN2 et E1ADMIN3, avec le mot de passe privé de la démo déjà configuré. Ces comptes disposent de leurs rôles réels, sans droits de direction.

Le jeu est créé uniquement dans une base de démonstration vide : il ne remplace pas les données d’un établissement existant. La branche locale main est indépendante de cette démo.

## Variables du service gratuit

`ETUDIA_DEMO=1`, `ETUDIA_DATA_DIR=/tmp/etudia-demo-data`, `ETUDIA_DEMO_PASSWORD` (secret, au moins 12 caractères). `RENDER_EXTERNAL_HOSTNAME` est fourni par Render. Aucun domaine générique avec joker n'est autorisé.

Le mode démo refuse un répertoire de données qui ne commence pas par `/tmp/etudia-demo-`. Il n'efface jamais une base existante. L'initialisation s'exécute par la commande serveur `seed-demo`, après les migrations et avant l'ouverture du port HTTP. La base personnelle de l'installation Windows n'est jamais copiée.

## Coût et limites

Le service utilise exclusivement le plan Free. Aucun passage à une offre payante n'est automatique dans cette configuration. Les quotas et conditions de dépassement du compte Render s'appliquent ; avant des tests intensifs, vérifier les limites de dépenses du workspace si un moyen de paiement y est déjà enregistré. Aucune utilisation intensive n'est nécessaire pour tester cette démo.

Documentation officielle : https://render.com/docs/free
