# Campus — administration locale

Lancer OUVRIR_CAMPUS.cmd puis ouvrir http://127.0.0.1:3030. Node.js avec node:sqlite est nécessaire ; aucune dépendance npm n’est requise.

Dans le sélecteur de profil, choisir Administration. Créer un établissement, puis une année scolaire dans Structure scolaire. Ajouter ensuite les classes, élèves, parents, enseignants et matières. Les compteurs et listes de ces écrans lisent SQLite. Les personnes sont des fiches, pas encore des comptes de connexion ; les affectations aux classes restent à développer.

La base persistante est server/data/etudia.db. Ne pas supprimer ce dossier. Le choix de l’établissement est conservé dans le navigateur, mais les données administratives sont enregistrées sur disque côté serveur.

Les autres espaces et fonctions (notes, messagerie, paiements, etc.) restent des démonstrations utilisant le navigateur. Le choix de profil n’est pas une authentification. Le service écoute uniquement sur 127.0.0.1 et refuse les origines externes. Ne pas publier cette version ni la connecter à un tunnel avant l’ajout des comptes et permissions serveur.

Validation : node server/test-admin.cjs. Les tests utilisent une base temporaire séparée et vérifient créations, validations, séparation des établissements, compteurs et persistance après arrêt/redémarrage. La syntaxe de app.js et admin.js a été vérifiée. Vérification visuelle non réalisée : connexion Browser indisponible.

Sauvegarde avant modification : backup-admin-20261113-191000. Modifications présentes sur ce PC ; pas encore publiées sur GitHub.

Tests des formulaires : npm.cmd test (après npm.cmd ci). jsdom est une dépendance de développement. Création de l'établissement, année, classe, élève et enseignant, compteurs et rechargement vérifiés automatiquement. Cela ne remplace pas une vérification visuelle dans Chrome.
