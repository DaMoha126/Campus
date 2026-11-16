# Moniteur externe Étudia

Ce petit bot effectue un GET sur `/api/health` toutes les cinq minutes. Il fonctionne avec Node.js 24, sans dépendance ni mot de passe. Il n’accède pas aux données scolaires.

Depuis un ordinateur extérieur au serveur, lancer `Lancer-Moniteur-Demo.cmd` sous Windows, ou :

```sh
node scripts/keep-demo-awake.cjs
```

L’ordinateur et sa connexion doivent rester actifs. Fermer la fenêtre, mettre l’ordinateur en veille ou appuyer sur Ctrl+C arrête la surveillance. Aucun démarrage automatique n’est installé. Le bot n’est pas hébergé ni exécuté en permanence par ChatGPT.

Pour un contrôle unique : `node scripts/keep-demo-awake.cjs --once`. Une réponse non saine produit un code de sortie 1. Une page de chargement HTML n’est pas considérée comme une API disponible. Les contrôles sont séquentiels, avec un délai maximal de 60 secondes et sans rafale de tentatives.

Variables facultatives : `ETUDIA_MONITOR_URL` (URL HTTPS exacte se terminant par `/api/health`, sans identifiants ni paramètres), `ETUDIA_MONITOR_MINUTES` (1 à 10, valeur par défaut 5).

Render Free se met en veille après 15 minutes sans trafic entrant. Ces requêtes peuvent éviter cette veille tant que le bot fonctionne, mais ne garantissent pas une disponibilité permanente : Render peut redémarrer une instance et applique un quota partagé de 750 heures gratuites par workspace et par mois. Un service allumé en permanence consomme 720 heures sur 30 jours ou 744 heures sur 31 jours ; d’autres services partagent ce quota.

Ce moniteur ne rend pas PocketBase persistant. Un redémarrage ou redéploiement peut toujours effacer le stockage local éphémère de la démo.

Référence vérifiée le 16 novembre 2026 : https://render.com/docs/free
