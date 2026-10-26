# Étudia — démonstration gratuite

Cette version permet de tester Étudia en ligne avec des données entièrement fictives. Elle n'est pas destinée à recevoir des informations réelles sur des élèves, des parents ou des paiements.

- Render Free, 512 Mo, région Francfort, aucune base payante ni disque payant.
- Base PocketBase éphémère dans `/tmp/etudia-demo-data`.
- Les modifications peuvent disparaître lors des redémarrages, redéploiements et mises en veille. La démo initiale est alors recréée.
- Une première ouverture après une mise en veille peut demander environ une minute.
- Configuration reproductible dans `render-demo.yaml` ; Dockerfile commun avec la version persistante.

## Accès de test

Matricules : `DEMOADMIN`, `DEMOPROF`, `DEMOELEVE`, `DEMOPARENT`.
Le mot de passe commun est fourni séparément et conservé dans la variable secrète `ETUDIA_DEMO_PASSWORD`. Il ne figure pas dans les sources.

La démo contient un établissement, une classe, quinze matières, une affectation en mathématiques, un créneau du lundi, un devoir et un bulletin fictif à 16/20. Les protections de connexion, les permissions et les contrôles d'origine restent actifs. Le compte technique PocketBase est aléatoire et n'est pas partagé.

## Variables du service gratuit

`ETUDIA_DEMO=1`, `ETUDIA_DATA_DIR=/tmp/etudia-demo-data`, `ETUDIA_DEMO_PASSWORD` (secret, au moins 12 caractères). `RENDER_EXTERNAL_HOSTNAME` est fourni par Render. Aucun domaine générique avec joker n'est autorisé.

Le mode démo refuse un répertoire de données qui ne commence pas par `/tmp/etudia-demo-`. Il n'efface jamais une base existante. L'initialisation s'exécute par la commande serveur `seed-demo`, après les migrations et avant l'ouverture du port HTTP. La base personnelle de l'installation Windows n'est jamais copiée.

## Coût et limites

Le service utilise exclusivement le plan Free. Aucun passage à une offre payante n'est automatique dans cette configuration. Les quotas et conditions de dépassement du compte Render s'appliquent ; avant des tests intensifs, vérifier les limites de dépenses du workspace si un moyen de paiement y est déjà enregistré. Aucune utilisation intensive n'est nécessaire pour tester cette démo.

Documentation officielle : https://render.com/docs/free
