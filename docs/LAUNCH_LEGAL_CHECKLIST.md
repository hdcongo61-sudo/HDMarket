# HDMarket — checklist juridique avant lancement

Ce document complète les pages publiques de l’application. Il ne remplace pas un avis juridique local.

## Bloquants avant ouverture commerciale

- [ ] Faire valider CGU, CGV marketplace, confidentialité et politique de retours par un juriste en République du Congo.
- [ ] Renseigner `VITE_LEGAL_ADDRESS`, `VITE_LEGAL_RCCM`, `VITE_LEGAL_NIU`, `VITE_LEGAL_DIRECTOR` et `VITE_LEGAL_HOST` dans l’environnement de production.
- [ ] Confirmer le statut exact de HDMarket dans chaque flux : simple intermédiaire, vendeur, encaisseur ou mandataire.
- [ ] Vérifier les formalités de traitement et de transfert de données auprès de la Commission nationale pour la protection des données à caractère personnel.
- [ ] Signer les contrats nécessaires avec les fournisseurs d’hébergement, Firebase, messagerie, Mobile Money, livraison et traitement d’images.
- [ ] Vérifier les autorisations applicables au portefeuille, à l’encaissement pour compte de tiers et aux remboursements.
- [ ] Publier les frais, commissions, délais de paiement vendeur, délais de remboursement et responsabilités de livraison.
- [ ] Valider la procédure de rétractation et de retour au regard de la loi n°36-2024 du 11 octobre 2024 portant protection du consommateur.
- [ ] Mettre en place une procédure de retrait des produits illicites, contrefaits, dangereux ou rappelés.
- [ ] Définir les durées de conservation effectives pour comptes, commandes, paiements, preuves, messages, localisation et journaux techniques.

## Exploitation et sécurité

- [ ] Nommer les personnes autorisées à accéder aux données, preuves de paiement, conversations et réclamations.
- [ ] Documenter la réponse aux incidents, les sauvegardes, la restauration et la notification des violations de données.
- [ ] Tester la suppression de compte, l’accès/rectification des données et le retrait du consentement analytics.
- [ ] Conserver la version et la date d’acceptation des documents légaux pour chaque nouveau compte.
- [ ] Vérifier les coordonnées du support et le délai interne de réponse aux réclamations.
- [ ] Effectuer des tests d’accessibilité, de sécurité, de paiement, de remboursement, de livraison et de fonctionnement hors ligne.

## Références principales

- Loi n°29-2019 du 10 octobre 2019 portant protection des données à caractère personnel.
- Loi n°5-2025 du 29 mars 2025 portant création de la Commission nationale pour la protection des données à caractère personnel.
- Loi n°36-2024 du 11 octobre 2024 portant protection du consommateur.
- Actes uniformes OHADA applicables, notamment le droit commercial général.
