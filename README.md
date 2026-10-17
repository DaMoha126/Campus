# Étudia

Plateforme scolaire en construction. Cette étape fournit une administration connectée avec données SQLite persistantes : installation initiale, connexion, années scolaires, classes, matières et création des comptes.

## Démarrer

Prérequis : Node.js 24 ou supérieur. Aucune dépendance externe.

```sh
npm start
```

Ouvrez http://localhost:3030 puis créez l’établissement et son premier administrateur. Le formulaire d’installation est désactivé après cette création. Les mots de passe doivent contenir au moins 12 caractères.

```sh
npm test
```

## Configuration

- `PORT` : 3030 par défaut.
- `HOST` : 127.0.0.1 par défaut. Utilisez 0.0.0.0 derrière un reverse proxy si nécessaire.
- `ETUDIA_DATA_DIR` : dossier persistant de la base (par défaut `server/data`). Sauvegardez ce dossier avec une procédure SQLite adaptée avant toute mise à jour.
- `ETUDIA_HTTPS=1` : cookies Secure lorsque le service est exposé en HTTPS. Le proxy doit préserver le Host public.

Installez le premier administrateur avant d’exposer le service au public. Utilisez HTTPS pour tout accès distant. Les sessions expirent après huit heures, survivent au redémarrage et sont révoquées à la déconnexion. Les mots de passe utilisent scrypt et un sel individuel. Les accès d’administration sont vérifiés côté serveur et limités à l’établissement du compte. Les tentatives de connexion sont limitées en mémoire par adresse IP (configurer une protection adaptée au proxy en production).

## Périmètre actuel et limites

Les administrateurs peuvent créer des années, des classes, des matières et des comptes. Les autres comptes peuvent se connecter, mais leurs espaces pédagogiques ne sont pas encore implémentés. La création des comptes ne fournit pas encore l’envoi d’invitations, le changement de mot de passe ou la récupération de compte. Les liens parent–enfant, inscriptions dans les classes et affectations des enseignants restent à connecter.

Les notes, bulletins, appels, devoirs, emplois du temps et messages ne sont pas encore disponibles dans l’application connectée. L’ancienne interface conservée sous `outputs/campus` est une démo indépendante utilisant le stockage du navigateur ; ses données ne sont pas migrées. Cette version ne prétend pas à une parité avec PRONOTE.

Avant une exploitation scolaire : compléter les parcours pédagogiques, les modifications et archivages, les audits, les sauvegardes/restaurations, la gestion des mots de passe et les tests dans les navigateurs.
