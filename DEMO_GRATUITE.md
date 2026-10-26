# Étudia — démonstration gratuite

Cette version permet de tester Étudia en ligne avec des données entièrement fictives. Elle n'est pas destinée à recevoir des informations réelles sur des élèves, des parents ou des paiements.

- Render Free, 512 Mo, région Francfort, aucune base payante ni disque payant.
- Base PocketBase éphémère dans `/tmp/etudia-demo-data`.
- Les modifications peuvent disparaître lors des redémarrages, redéploiements et mises en veille. La démo initiale est alors recréée.
- Une première ouverture après une mise en veille peut demander environ une minute.
- Configuration reproductible dans `render-demo.yaml` ; Dockerfile commun avec la version persistante.

## Accès de test

| Établissement fictif | Administration | Enseignant | Élève | Parent |
| --- | --- | --- | --- | --- |
| Collège Horizon | `DEMOADMIN` | `DEMOPROF` | `DEMOELEVE` | `DEMOPARENT` |
| Groupe scolaire Baobab | `DEMOADMIN2` | `DEMOPROF2` | `DEMOELEVE2` | `DEMOPARENT2` |
| Lycée Avenir | `DEMOADMIN3` | `DEMOPROF3` | `DEMOELEVE3` | `DEMOPARENT3` |

Déconnectez-vous pour visiter un autre établissement avec son compte. Un administrateur scolaire voit uniquement son établissement.
Le mot de passe commun est fourni séparément et conservé dans la variable secrète `ETUDIA_DEMO_PASSWORD`. Il ne figure pas dans les sources.

La démo contient 3 établissements, 12 classes, 120 élèves, 60 parents (deux enfants par parent), 18 enseignants et 9 administrateurs (direction, scolarité et comptabilité). Chaque établissement a 15 matières, 12 affectations, 12 créneaux, 3 trimestres et 40 inscriptions. Au total : 720 notes, 84 évaluations (dont 12 non publiées), 90 versements fictifs avec trois annulations, 480 échéances, 120 présences/retards/absences, 24 justifications en attente, 36 devoirs, 180 rendus, 36 séances de cahier de textes, 120 appréciations, 12 annonces et 21 messages privés. Les comptes élèves principaux ont une moyenne de démonstration de 16/20. Les élèves ont des noms complets distincts au sein de chaque établissement et les frères et sœurs partagent le nom de leur parent fictif. Tous les noms sont synthétiques, les emails utilisent le domaine invalide demo.invalid et aucun numéro de téléphone réel n’est utilisé. Les protections de connexion, les permissions et les contrôles d'origine restent actifs. Le compte technique PocketBase est aléatoire et n'est pas partagé.

## Variables du service gratuit

`ETUDIA_DEMO=1`, `ETUDIA_DATA_DIR=/tmp/etudia-demo-data`, `ETUDIA_DEMO_PASSWORD` (secret, au moins 12 caractères). `RENDER_EXTERNAL_HOSTNAME` est fourni par Render. Aucun domaine générique avec joker n'est autorisé.

Le mode démo refuse un répertoire de données qui ne commence pas par `/tmp/etudia-demo-`. Il n'efface jamais une base existante. L'initialisation s'exécute par la commande serveur `seed-demo`, après les migrations et avant l'ouverture du port HTTP. La base personnelle de l'installation Windows n'est jamais copiée.

## Coût et limites

Le service utilise exclusivement le plan Free. Aucun passage à une offre payante n'est automatique dans cette configuration. Les quotas et conditions de dépassement du compte Render s'appliquent ; avant des tests intensifs, vérifier les limites de dépenses du workspace si un moyen de paiement y est déjà enregistré. Aucune utilisation intensive n'est nécessaire pour tester cette démo.

Documentation officielle : https://render.com/docs/free
