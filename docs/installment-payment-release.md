# Paiement par tranche — corrections du 21 septembre 2026

Les 13 constats de [l'audit](installment-payment-audit.md) sont corrigés dans le code local. Aucun paiement réel, accès à la base de production ou déploiement n'a été effectué.

## Comportement corrigé

| Point | Résultat |
| --- | --- |
| 1 | Propriétaire, état, tranche, montant et pays sont contrôlés avant l'appel PawaPay. Les requêtes concurrentes pour une même tranche partagent une réservation, même avec des clés d'idempotence différentes. |
| 2 | Le premier paiement crée une seule commande dans une transaction. Rejouer un callback retrouve cette commande. Le traitement périodique reprend aussi les finalisations de tranches confirmées mais inachevées. |
| 3 | Les nouvelles échéances sont en FCFA entiers et conservent exactement le total : 7 000 sur trois échéances devient 2 333 + 2 333 + 2 334. Pas de nouvelle échéance inférieure à 10 FCFA ; aucun arrondi supplémentaire dans le bouton de paiement. |
| 4 | Chaque dépôt est conservé dans les reçus de la commande. Le séquestre suit tous les encaissements. Un remboursement global est réparti entre les dépôts et n'est confirmé qu'après tous ses remboursements individuels. |
| 5 | Le refus vendeur et les autres annulations enregistrent une demande durable de remboursement, reprise après une interruption. Un échec d'une portion ne fait pas rembourser à nouveau les portions déjà terminées. |
| 6 | Une commande annulée reste annulée. Un paiement confirmé tardivement, ou un paiement supplémentaire pour une tranche déjà réglée, est enregistré puis orienté vers un remboursement. Le bouton disparaît pour les commandes clôturées. |
| 7 | Le devis applique le prix de la variante sélectionnée, puis les règles de quantité. |
| 8 | Le mode livraison/retrait doit être autorisé. Les frais sont inclus dans le total et le solde affichés ; une estimation inconnue bloque le paiement. Le devis enregistré ne change pas pendant le paiement. |
| 9 | Principal, pénalités, encaissements et dette restante sont suivis séparément. Le total est égal aux sommes affectées au plan plus son solde. Une pénalité reste à payer jusqu'à son règlement effectif. |
| 10 | Un premier paiement couvrant tout le total devient intégralement payé et permet la préparation dès confirmation vendeur. |
| 11 | Une preuve manuelle en attente reste dans la file de validation. Les anciennes preuves marquées en retard sont restaurées par le rappel. La date de soumission détermine le retard, avec une fin de journée à Brazzaville, pas la date de validation vendeur. |
| 12 | Ville, commune, produit, devise et prestataire doivent correspondre au pays de la commande. |
| 13 | Désactiver `enable_installments` masque les nouvelles offres et bloque leur création/achat côté serveur. Les échéanciers déjà ouverts restent payables. |

Les remboursements utilisent aussi le verrou commun du dépôt : deux anciennes commandes faisant référence au même paiement ne peuvent pas rembourser plus que le dépôt. Après le remboursement d'un versement accidentel supplémentaire, l'échéancier initial reste payable.

Les pénalités sont arrondies au FCFA entier, ne produisent pas de pénalités composées et ne sont pas facturées lorsqu'elles seraient inférieures au minimum de paiement de 10 FCFA. Les frais de livraison d'un devis échelonné accepté ne sont plus modifiables après paiement.

## Vérifications locales

- Backend : 534 tests réussis, dont 36 scénarios d'échelonnement et 57 régressions commandes ordinaires, paiement par proche et remboursements. Les 45 tests d'intégration Acheter Pour Moi/rapports de publication nécessitant d'autres bases dédiées restent désactivés dans cette exécution.
- Frontend : 265 tests unitaires réussis.
- Navigateur : six scénarios échelonnement et dix régressions checkout/paiement par proche, avec les vrais écrans React et des réponses API simulées.
- Lint des deux projets, vérification syntaxique des 605 fichiers JavaScript backend et build frontend vers un dossier temporaire.
- `npm audit --audit-level=critical` tenté dans les deux projets : indisponible, le registre npm a interrompu les connexions (`ECONNRESET`). Aucun résultat d'audit de dépendances n'est donc affirmé pour cette exécution.

Les tests d'intégration utilisent les vrais contrôleurs, hooks et transactions MongoDB sur un replica set local jetable. Les appels PawaPay et notifications sont simulés. Les suites suppriment uniquement leurs bases de test dédiées à la fin. Les tests navigateur bloquent les appels externes et s'arrêtent avant tout paiement.

## Exploitation et historique

Le backend nécessite les transactions MongoDB (replica set ou cluster compatible), les index déclarés par les modèles, et ses traitements périodiques de rapprochement PawaPay/remboursements. Aucun nouveau secret n'est nécessaire. La validation réelle du prestataire reste à effectuer dans son environnement de test avant la mise en production.

À la lecture d'une commande, les échéances anciennes non réglées, sans preuve ni paiement en cours, sont normalisées en entiers sans déplacer leurs indices. Les reçus historiques sont retrouvés à partir des références PawaPay confirmées. Les preuves et paiements en cours ne sont pas réécrits.

Cette correction ne constitue pas un rapprochement des commandes de production. Les doublons historiques de commandes, anciens prix ou frais erronés, reçus manquants, anciennes pénalités sans détail et éventuels soldes résiduels isolés inférieurs à 10 FCFA nécessitent une revue avant toute correction comptable. Ils ne sont ni repricés ni effacés automatiquement.
