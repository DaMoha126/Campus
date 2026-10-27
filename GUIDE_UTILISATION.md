# Utiliser Étudia

## Première organisation de l’école

Après la création du superutilisateur technique, de l’établissement et du premier compte scolaire administrateur (voir le guide Windows), connectez-vous à l’application.

## Rôles administratifs

La **Direction** conserve tous les droits et peut créer les comptes des autres responsables depuis **Classes & comptes**. Le compte **Scolarité** gère les profils d’élèves et de parents, les liens familiaux, les affectations en classe, les classes, les absences et les appréciations ; ses inscriptions commencent avec des frais à zéro. Il ne peut ni consulter ni modifier les montants ou les versements. Le compte **Comptabilité** ouvre directement le registre financier, peut définir les frais, enregistrer les versements, échéances et corrections ; il ne peut pas changer les classes, les inscriptions ni les notes. Ces restrictions sont vérifiées par le serveur.

1. Dans **Classes & comptes**, créez l’année, les classes, les matières et les comptes. Une adresse email est facultative ; chaque compte obtient un matricule de connexion. L’annuaire affiche ce matricule. Transmettez les identifiants en privé.
2. Dans **Inscriptions & paiements**, inscrivez les élèves dans leur classe et définissez les frais. Une seule inscription par élève et année est autorisée. Un changement de classe reste possible dans le dossier ; les classes précédentes sont conservées pour l’historique.
3. Dans **Pédagogie & communications → Organisation pédagogique**, affectez chaque enseignant à une classe et une matière. Définissez le coefficient de la matière. Une classe/matière a une seule affectation dans cette version.
4. Reliez chaque compte parent à ses enfants. Un parent sans lien ne voit aucun dossier d’enfant.
5. Créez les périodes scolaires, à l’intérieur des dates de l’année (par exemple les trimestres).
6. Ajoutez les créneaux de l’emploi du temps. Le serveur refuse les chevauchements de classe, d’enseignant et de salle pour la même année.

## Importer des élèves

Dans Organisation pédagogique, la Direction peut sélectionner une classe, une date d’inscription et des frais communs. Collez un CSV séparé par des points-virgules avec cet en-tête exact :

```csv
first_name;last_name;email;phone
Awa;Ouédraogo;;
Issa;Kaboré;issa@example.com;70000000
```

L’email et le téléphone peuvent être vides. Un lot contient de 1 à 100 élèves. Des comptes, matricules et inscriptions sont créés ensemble. Si une ligne est invalide, si un email existe déjà ou si la classe est pleine, l’ensemble du lot est annulé.

Le navigateur télécharge un CSV confidentiel contenant les matricules et les mots de passe initiaux individuels. Conservez-le dans un emplacement privé, transmettez chaque identifiant uniquement à la personne concernée puis gérez sa conservation avec précaution. Il ne s’agit pas d’un email automatique. Si le téléchargement échoue, les comptes restent visibles dans l’annuaire et l’administrateur peut réinitialiser leurs mots de passe.

## Enseignant

- **Notes & évaluations** : créez une évaluation dans une affectation et une période, puis saisissez les notes. Une nouvelle saisie pour le même élève et la même évaluation corrige la note existante. Une note doit être comprise entre zéro et le barème.
- Les évaluations commencent en brouillon. Cliquez sur **Publier** pour rendre les résultats visibles aux familles ; **Dépublier** masque à nouveau ces résultats dans leur espace.
- **Devoirs & rendus** : donnez les consignes et une date ; consultez les réponses textuelles et ajoutez un retour.
- **Cahier de textes** : enregistrez le contenu des séances.
- **Appel & absences** : renseignez présence, absence ou retard. La saisie d’une affectation/élève/date déjà existante corrige l’entrée au lieu de créer un doublon.
- **Messagerie** : communiquez avec les contacts autorisés. Les messages restent privés entre l’expéditeur et le destinataire, y compris vis-à-vis des autres comptes administrateurs.

Les données sont limitées aux affectations de l’enseignant. Les informations financières des élèves ne sont pas communiquées aux enseignants.

## Élève et parent

L’élève voit ses classes, cours, devoirs, résultats publiés, absences, bulletins et frais. Il peut rendre ou remplacer une réponse textuelle, envoyer un motif d’absence et contacter les enseignants concernés ou l’administration.

Le parent voit uniquement les enfants qui lui sont rattachés. Il peut consulter leurs résultats, devoirs, absences, versements et échéances, ainsi qu’envoyer un motif d’absence. L’administration accepte ou refuse ces motifs.

Les annonces sont filtrées selon leur public. Le tableau de bord signale les messages non lus. Les données se rechargent à l’ouverture d’un module ; il n’y a pas encore de notifications push.

## Emploi du temps

La direction peut définir des créneaux chaque semaine ou en alternance sur les semaines ISO paires et impaires. Une date de début et de fin peut limiter un créneau à une période de l’année scolaire. Les conflits de classe, d’enseignant ou de salle sont refusés uniquement lorsque les semaines et les périodes de validité se chevauchent. Les vacances et jours fériés doivent encore être gérés séparément.

## Bulletins et calculs

Choisissez un élève et une période. Seules les évaluations **publiées** sont utilisées.

- Chaque note est ramenée sur 20 : `note / barème × 20`.
- Moyenne de matière : somme des notes ramenées sur 20 multipliées par le coefficient d’évaluation, divisée par la somme de ces coefficients.
- Moyenne générale : moyenne pondérée des matières ayant des notes, selon leurs coefficients.
- Rang dans la classe : classement par moyenne générale parmi les élèves avec au moins une note publiée ; les ex æquo partagent le même rang.
- Mention indicative : Excellent (16/20), Très bien (14), Bien (12), Assez bien (10), Insuffisant (8), puis Très insuffisant. Ces seuils sont des repères configurés par l’établissement.
- Absences et dispenses sont exclues du calcul, sans être transformées en zéros.
- Les notes des classes précédentes enregistrées dans l’historique de l’année restent prises en compte. Le coefficient de l’affectation de la classe actuelle est retenu s’il existe pour cette matière.

L’administration peut ajouter une appréciation générale. Le bouton d’impression permet de sortir le bulletin sur papier ou en PDF via le navigateur. Il s’agit d’un document interne, sans signature électronique ni modèle réglementaire national certifié.

La direction peut clôturer une période scolaire après sa date de fin depuis Organisation pédagogique. Une période clôturée bloque la création d’évaluations, la saisie et la correction des notes ainsi que leur publication. La direction peut la rouvrir pour effectuer une correction ; elle doit être rouverte avant suppression. Les appréciations générales restent modifiables après clôture.

## Scolarité et versements

Les montants sont des entiers en FCFA. Dans le dossier d’un élève, saisissez les frais d’inscription et la scolarité annuelle, puis les versements reçus. Le logiciel calcule le solde net et refuse un versement supérieur au reste à payer.

Une erreur de saisie se corrige par **Annuler ce versement**, avec un motif obligatoire. L’écriture d’origine reste conservée et le solde est recalculé. Une annulation n’effectue aucun remboursement bancaire. Un reçu annulé porte cette mention lorsqu’il est réimprimé.

Vous pouvez définir des échéances dont le total ne dépasse pas les frais. Dans l’espace Scolarité & versements, les échéances passées non couvertes sont calculées en imputant les versements nets aux premières échéances. Aucun rappel externe n’est envoyé automatiquement.

CSV : export du registre de l’année sélectionnée. JSON : export des données visibles par l’administrateur, hors mots de passe et fichiers ; ce JSON ne remplace pas une sauvegarde PocketBase complète.

## Compte, sauvegarde et maintenance

Dans **Compte & sécurité**, changez votre mot de passe avec preuve de l’ancien. L’administration peut réinitialiser celui d’une autre personne, désactiver un compte, corriger les noms/téléphones, renommer une classe ou une matière et activer une année.

Après un changement de votre propre mot de passe, reconnectez-vous. Les mots de passe scolaires demandent huit caractères minimum. Le mot de passe du superutilisateur technique reste géré séparément dans PocketBase.

Pour sauvegarder, arrêtez PocketBase avec Ctrl+C, puis double-cliquez sur **Sauvegarder-Etudia.cmd**. Une archive complète de `pb_data` est créée dans **sauvegardes**. Copiez-la aussi sur un autre support privé. Le script refuse de travailler si un processus PocketBase est actif.

Pour restaurer : arrêtez PocketBase, sauvegardez d’abord l’état actuel, extrayez l’archive dans un dossier séparé puis remplacez le dossier `pocketbase\pb_data` par celui de l’archive. Conservez une version du code et du binaire cohérente avec cette sauvegarde. Testez d’abord cette procédure sur une copie.

## Matières générales par défaut

Quinze matières sont préenregistrées par établissement : français, mathématiques, anglais, histoire-géographie, SVT, physique-chimie, philosophie, EPS, éducation civique et morale, informatique, technologie, allemand, espagnol, arts plastiques et éducation musicale.

Dans **Pédagogie & communications → Organisation → Affecter un enseignant**, choisissez le professeur, la classe et la matière dans les listes, puis indiquez le coefficient. La liste des matières est triée par ordre alphabétique. Les matières ne sont pas affectées automatiquement à toutes les classes.

Les matières déjà présentes et leurs affectations sont conservées ; les noms usuels (Maths, SVT, EPS, etc.) sont reconnus pour éviter de recréer leur équivalent. Vous pouvez toujours ajouter une matière spécifique dans la rubrique Matières.

## Classes et rangement des notes

L’administration dispose d’un accès direct **Classes** et **Notes** depuis les onglets supérieurs. Dans l’espace pédagogique, **Classes** permet de filtrer par année, d’ouvrir une classe et de consulter ses élèves, parents liés, matières et enseignants. La création et la modification des classes sont réservées à l’administration. Les enseignants disposent d’une consultation de leurs classes uniquement.

Dans **Notes & évaluations**, choisissez la classe, la matière et la période. Les notes sont regroupées par classe puis par matière, avec une ligne par élève et une colonne par évaluation. Les appréciations restent visibles sous chaque note. Les évaluations à publier et la saisie des notes suivent ces mêmes filtres. **Toutes les classes**, **Toutes les matières** et **Toutes les périodes** permettent d’élargir la vue. Chaque classe indique son année scolaire pour distinguer les années archivées.

Depuis une fiche classe, **Consulter les notes de cette classe** ouvre directement les notes correspondantes. Les familles conservent uniquement leurs données autorisées et les évaluations publiées.
