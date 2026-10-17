# Étudia avec PocketBase — Windows x64

## Récupérer cette version

Téléchargez la branche `codex/pocketbase-local` du dépôt Campus (Code → Download ZIP), puis faites **Extraire tout** dans un dossier de travail, par exemple `Documents\Etudia`. N’exécutez pas le lanceur depuis le ZIP.

## Démarrer

Double-cliquez sur `Demarrer-Etudia.cmd`. Le lanceur appelle PowerShell avec une autorisation limitée à ce processus, télécharge PocketBase **0.40.5** depuis son dépôt officiel, vérifie le SHA256 publié puis démarre le serveur sur **127.0.0.1:8090**. Une connexion Internet est nécessaire au premier lancement ; les suivants peuvent fonctionner hors ligne.

Windows peut demander de confirmer l’exécution d’un fichier téléchargé. Vérifiez la provenance et le contenu du script avant d’autoriser son exécution. Si votre organisation bloque les scripts PowerShell, ne modifiez pas sa politique : demandez à son administrateur.

Gardez la fenêtre ouverte. Pour arrêter proprement : **Ctrl+C**. Pour relancer : double-cliquez à nouveau. Si le port 8090 est déjà occupé, fermez l’autre instance.

## Première configuration (une seule fois)

1. Dans la fenêtre PocketBase, ouvrez **le lien d’installation affiché**, contenant `/_/#/pbinstal/…`, pour créer votre compte **superutilisateur PocketBase**. Conservez ces identifiants de maintenance en privé. Si aucun lien n’apparaît, consultez `http://127.0.0.1:8090/_/`.
2. Dans le tableau de bord PocketBase, ouvrez la collection **establishments**, puis **New record**. Saisissez `name` (nom de votre école), `country` et éventuellement `city`. Enregistrez.
3. Ouvrez **school_users**, puis **New record**. Saisissez votre email, un mot de passe d’au moins 12 caractères, `first_name`, `last_name`, sélectionnez `role = administrator` et votre établissement dans `establishment_id`. Activez `emailVisibility` pour que l’adresse figure dans l’annuaire administratif. Enregistrez.
4. Ouvrez **http://127.0.0.1:8090/** et connectez-vous avec ce compte scolaire. Le compte superutilisateur sert uniquement au tableau de bord technique.
5. Ajoutez votre année scolaire, vos classes, matières et comptes depuis Étudia. Les identifiants initiaux sont à transmettre personnellement ; aucun email n’est envoyé automatiquement.

Aucun mot de passe par défaut n’est livré. Il n’y a pas d’inscription publique. Le superutilisateur crée le premier établissement et son administrateur ; les administrateurs scolaires ne voient que leur propre établissement.

## Ce qui fonctionne

Connexion PocketBase, annuaire, création des comptes, années, classes et matières ; sauvegarde locale et permissions côté serveur. Une seule année peut être active par établissement. Pour en changer, désactivez l’ancienne depuis le tableau de bord PocketBase avant d’activer la nouvelle.

Les sessions de l’interface sont conservées uniquement en mémoire : actualiser la page demande une nouvelle connexion. Une déconnexion efface le jeton du navigateur ; PocketBase utilise des jetons sans session serveur, donc elle ne révoque pas une copie éventuelle de ce jeton (expiration à huit heures).

Les espaces élève/parent/enseignant, notes, bulletins, devoirs, absences, affectations et rattachements parent–enfant restent à construire. Les données de l’ancienne version Node/SQLite et de la démo navigateur ne sont pas importées automatiquement. Elles restent séparées.

## Conserver les données

Toutes les données et les fichiers sont dans **pocketbase\pb_data**. Ne supprimez jamais ce dossier et ne l’envoyez pas sur GitHub. Le lanceur n’efface pas ce dossier.

Pour une sauvegarde, utilisez **Settings → Backups** dans PocketBase et téléchargez l’archive dans un autre emplacement sûr. Une autre méthode consiste à arrêter PocketBase puis copier intégralement `pb_data`. Testez la restauration sur une copie avant de vous appuyer sur ces sauvegardes.

Cette installation n’est pas publiée sur Internet et ne permet pas l’accès depuis les autres ordinateurs. Avant toute ouverture réseau : prévoir HTTPS, sauvegardes externes, courrier SMTP, surveillance et tests supplémentaires. Ne mettez pas le tableau de bord technique à disposition des élèves.

## Validation et versions

Migration et tests API exécutés avec le binaire officiel PocketBase 0.40.5 sous Linux. Le lanceur PowerShell n’a pas été exécuté sur un véritable PC Windows dans cet environnement. La vérification visuelle dans un navigateur reste à effectuer.

Pour exécuter le test d’intégration si Node.js 24 est installé : définissez `POCKETBASE_BIN` vers le binaire PocketBase puis lancez `node --test test/pocketbase.cjs` depuis le dépôt. Sans cette variable, le test PocketBase est explicitement ignoré.

Sources : https://pocketbase.io/docs/going-to-production/ et https://pocketbase.io/docs/js-migrations/

## Mise à jour : inscriptions et paiements

1. Arrêtez PocketBase avec **Ctrl+C** dans sa fenêtre et faites une copie de sécurité du dossier `pocketbase\pb_data` vers un autre emplacement.
2. Téléchargez la dernière version de la branche `codex/pocketbase-local` et extrayez le ZIP dans un **autre dossier**.
3. Depuis ce nouveau dossier, copiez uniquement les trois sous-dossiers **`pocketbase\pb_public`**, **`pocketbase\pb_hooks`** et **`pocketbase\pb_migrations`** vers le dossier `pocketbase` de votre installation actuelle. Fusionnez les dossiers et remplacez les fichiers demandés. **Ne supprimez et ne remplacez pas `pb_data`.**
4. Relancez `Demarrer-Etudia.cmd` dans votre installation actuelle. La nouvelle migration ajoute les collections d’inscriptions et de versements, sans effacer les comptes, classes ou matières existants. Actualisez le navigateur avec **Ctrl+F5**, puis reconnectez-vous.

### Utiliser le registre

- **Classes & comptes** : créez l’année scolaire, les classes et les comptes de rôle **Élève** si nécessaire.
- **Inscriptions & paiements** : choisissez l’année, l’élève, la classe et la date d’inscription. Indiquez séparément les frais d’inscription et la scolarité annuelle, en FCFA entiers. Cliquez sur **Inscrire et affecter à la classe**.
- Dans le registre, cliquez sur **Ouvrir** pour consulter le dossier. Vous pouvez changer de classe dans la même année et ajuster les frais ; le total ne peut pas devenir inférieur aux versements déjà enregistrés.
- Enregistrez chaque versement reçu (montant, date, mode et référence facultative). Il s’agit d’une saisie manuelle, sans opération bancaire. L’état passe de **Non réglé** à **Partiel**, puis **Soldé**. Un dossier avec zéro frais est **Sans frais**.
- Consultez l’historique, imprimez un reçu, ou utilisez **Exporter CSV** pour le registre de l’année sélectionnée. Les informations sont réservées à l’administration dans cette étape.

Les doubles inscriptions élève/année, les affectations à une classe pleine et les versements supérieurs au solde sont refusés côté serveur. Les versements sont conservés sans modification/suppression depuis l’application ; l’annulation comptable, les remboursements, les échéanciers et les relances ne sont pas encore disponibles. Vérifiez chaque saisie avant confirmation. La référence du reçu correspond à l’identifiant unique du versement.
