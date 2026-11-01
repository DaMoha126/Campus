# Livraison Goal — Étudia — 1 novembre 2026

## Objectif de cette livraison
Fiabiliser les parcours existants d’édition des emplois du temps et d’impression des bulletins, sans changer l’hébergement de démonstration.

## Contributions
- Coordinateur : intégration, contrôle des modifications, CI et déploiement.
- Conception : revue des parcours ; défaut d’impression simultanée de documents identifié.
- Réalisation : mode modification explicite, annulation, conservation de la saisie après erreur, préremplissage de l’appréciation générale.
- Tests : régressions navigateur pour édition, annulation, impression collective et isolation des documents imprimés.
- Sécurité : revue des contrôles serveur et tests négatifs de modification des créneaux.

## Résultat
L’édition d’un cours peut être annulée sans modifier les données. Une erreur conserve la saisie pour correction. L’appréciation du bulletin déjà enregistrée est reprise. Reçus et documents scolaires ne partagent plus la zone d’impression active.

## Validation
Les résultats détaillés de la suite PocketBase et Chromium sont conservés dans GitHub Actions pour le commit de livraison. Les contrôles de syntaxe locaux passent. Les tests d’intégration locaux ne sont pas comptés comme exécutés si les binaires sont absents ; la CI est le contrôle complet requis avant déploiement.

## Sécurité et données
Aucune faille de permission confirmée dans le chemin d’édition examiné. Les tests couvrent les refus interétablissements, les cinq rôles non autorisés, les conflits et l’absence de mutation lors d’un refus. Ces contrôles ciblés ne constituent pas un audit exhaustif de sécurité.
Aucune migration ni changement de stockage dans cette livraison. Les données fictives de la démo restent temporaires.

## Limites restantes
Vacances, jours fériés, remplacements ponctuels, appréciations par matière et personnalisation partagée en base restent à développer. L’impression collective déduit la classe de l’élève et de la période sélectionnés ; le choix explicite d’une classe est une amélioration suivante. Le logo distant dépend de la disponibilité de son hébergeur. Les tests automatisés ne remplacent pas une validation visuelle de chaque modèle d’impression.
