# Audit du processus de commande — 21 septembre 2026

Audit du code local après les corrections du paiement par tranche. Périmètre : commande ordinaire, paiement PawaPay, paiement par proche, échéancier, prix négocié, confirmation vendeur, livraison/retrait, annulation, séquestre et règlement vendeur.

13 problèmes restent présents dans le parcours élargi. Aucun correctif applicatif n'a été appliqué pendant cet audit. Aucun paiement réel, notification à un utilisateur, accès aux données de production ou déploiement n'a été effectué.

P1 : risque d'encaissement sans commande, de remboursement manquant, de règlement vendeur incohérent ou de contournement important du parcours. P2 : incohérence de montant, de livraison ou de suivi nécessitant une correction.

## Constats, par priorité

### 1. P1 — Annuler une commande ordinaire payée ne déclenche pas toujours le remboursement

Reproduction sur une commande de 10 000 FCFA payée via PawaPay : annulation client, modification de statut administrateur et modification de statut vendeur retournent toutes un succès. La commande devient `cancelled`, mais `refundStatus` reste `none`, le séquestre reste `IN_ESCROW` et aucun remboursement n'est créé. Le parcours dédié `sellerCancelOrder` appelle bien le remboursement ; les autres routes ne le font pas. Le bouton client utilise le parcours de changement de statut.

Correction recommandée : centraliser toutes les annulations dans une opération atomique qui enregistre aussi une intention durable de remboursement et sa reprise. Sources : [annulation client](../backend/controllers/orderController.js#L3751), [administrateur](../backend/controllers/orderController.js#L2944), [statut vendeur](../backend/controllers/orderController.js#L5054), [annulation vendeur dédiée](../backend/controllers/orderController.js#L5428).

### 2. P1 — Les transitions permettent de rouvrir des commandes clôturées et de libérer un séquestre après annulation

Le vendeur de la commande peut renvoyer `cancelled`, `completed` ou `dispute_opened` vers `confirmed`. La validation vérifie surtout le statut demandé et quelques étapes, sans bloquer généralement les états terminaux.

Une chaîne complète a été reproduite : commande avec preuve soumise et minuterie de séquestre → retour vendeur à `confirmed` → annulation vendeur → passage automatique du séquestre. Résultat : la commande annulée devient `completed`, le séquestre devient `RELEASED` et un règlement vendeur est créé. Le traitement automatique ne filtre ni le statut annulé ni un remboursement en cours.

Correction recommandée : transitions autorisées explicitement selon l'état courant, protections atomiques contre les modifications concurrentes, et garde financière au moment de libérer les fonds. Sources : [transitions vendeur](../backend/services/orderStatusFlowService.js#L195), [écriture du statut](../backend/controllers/orderController.js#L5054), [libération du séquestre](../backend/services/escrowService.js#L180), [sélection automatique](../backend/services/escrowService.js#L315).

### 3. P1 — Le checkout ordinaire peut encaisser avant de valider la commande et son devis n'est pas figé

Une demande visant un produit inexistant ouvre un checkout prestataire. Après succès simulé, aucune commande n'est créée et la finalisation échoue. Une demande de 10 FCFA pour un article de 10 000 FCFA ouvre également un paiement. Autre reproduction : prix initial 10 000, modification vendeur à 11 000 pendant le paiement, puis confirmation des 10 000 ; le checkout est confirmé, la finalisation échoue, sans commande ni remboursement.

Le chemin `ORDER_CHECKOUT` contrôle le pourcentage et les bornes du montant avant l'appel, mais recalcule les articles, promotions et frais après paiement. Le bénéfice de livraison gratuite est enregistré ; le devis complet ne l'est pas.

Correction recommandée : valider et enregistrer un devis serveur complet avant l'encaissement ; finaliser ce devis de façon atomique, ou orienter un paiement impossible à exécuter vers un remboursement durable. Sources : [création du paiement](../backend/controllers/pawapayController.js#L209), [validation après paiement](../backend/controllers/orderController.js#L1159), [comparaison du montant](../backend/controllers/orderController.js#L1359).

### 4. P1 — Deux tentatives ordinaires concurrentes peuvent produire deux paiements et deux commandes

Deux requêtes identiques avec des clés d'idempotence différentes ouvrent deux checkouts distincts. Après confirmation des deux paiements simulés, deux commandes sont créées. La finalisation est protégée par checkout, mais il manque la réservation commune de la tentative d'achat, déjà présente pour les tranches et le paiement par proche.

Correction recommandée : réserver le devis/panier confirmé pour une seule tentative active, réutiliser la tentative en attente et permettre explicitement un nouvel achat après sa finalisation. Source : [création sans réservation pour le checkout ordinaire](../backend/controllers/pawapayController.js#L549).

### 5. P1 — La reprise automatique ignore des paiements ordinaires et par proche déjà confirmés

Le traitement périodique ne sélectionne pas les checkouts `CONFIRMED` dont la finalisation a échoué pour `ORDER_CHECKOUT`, `SPONSORSHIP_ACCEPT` et `SPONSORSHIP_PAY_SELF`. Les trois sondes sont restées à zéro paiement repris. Un callback rejoué, un retour client ou une intervention administrateur peut relancer la finalisation, mais fermer la page après une panne peut laisser le paiement sans commande finalisée.

Correction recommandée : reprendre toutes les actions de paiement confirmées et inachevées, avec la même protection contre les doublons ; conserver une voie de traitement des échecs permanents. Source : [filtre de rapprochement](../backend/controllers/pawapayController.js#L1017).

### 6. P1 — Un paiement tardif de prix négocié réactive une commande annulée

Reproduction : ouverture du paiement `ORDER_PAYMENT` d'une commande négociée, annulation client avant confirmation, puis callback de succès. La commande passe de `cancelled` à `paid`, sans remboursement. Ce chemin possède son propre traitement et ne bénéficie pas des gardes ajoutés aux tranches.

Correction recommandée : réservation du paiement négocié et coordination avec l'annulation ; après une annulation définitive, conserver cet état et suivre le retour des fonds. Sources : [initiation](../backend/controllers/pawapayController.js#L255), [finalisation](../backend/controllers/pawapayController.js#L1193).

### 7. P1 — Une livraison offerte après paiement intégral peut être refacturée

Le checkout PawaPay enregistre `deliveryFeeLocked = true`, mais pas `deliveryFeeWaiverReason = FULL_PAYMENT`. Le garde d'édition exige les deux champs. La sonde a ajouté 1 500 FCFA à une commande payée 10 000 FCFA avec livraison offerte : succès, total 11 500, solde 1 500.

Correction recommandée : rendre la règle de verrouillage cohérente à la création et à l'édition, y compris pour les commandes existantes présentant cette combinaison. Sources : [champs créés](../backend/controllers/orderController.js#L1398), [garde de verrouillage](../backend/services/orderDeliveryFeeService.js#L10).

### 8. P1 — La preuve de livraison contourne les étapes vendeur et le délai d'annulation

Une commande ordinaire venant d'être payée, encore dans les 30 minutes d'annulation, accepte directement une preuve vendeur. La sonde a obtenu `delivery_proof_submitted`, un séquestre `WAITING_BUYER_CONFIRMATION` et sa date de libération automatique. L'annulation client est ensuite refusée. Le changement de statut vendeur normal contrôle le délai, mais la soumission de preuve ne le contrôle pas et accepte déjà le statut `paid`.

Correction recommandée : appliquer les mêmes étapes et le même délai à tous les chemins de livraison, avec une transition atomique et une exception explicite lorsque le client a levé le délai. Sources : [statuts acceptés pour la preuve](../backend/services/orderStatusFlowService.js#L317), [soumission](../backend/controllers/orderController.js#L4218), [délai vendeur normal](../backend/controllers/orderController.js#L5023).

### 9. P2 — L'arrondi des promotions peut laisser un solde après paiement à 100 %

Trois articles à 10 000 FCFA, remise totale de 1 FCFA : le paiement de 29 999 est accepté, mais chaque ligne est arrondie séparément à 10 000. La commande totalise alors 30 000, conserve 1 FCFA restant et devient `PARTIAL` malgré le choix du paiement intégral. La conservation du montant entre boutiques fonctionne ; la répartition de remise entre lignes reste incorrecte.

Correction recommandée : répartir la remise en FCFA entiers avec conservation exacte du total et conserver le détail de la promotion. Sources : [arrondi des lignes](../backend/controllers/orderController.js#L1310), [total enregistré](../backend/controllers/orderController.js#L1372).

### 10. P2 — Les modes de livraison/retrait interdits sont acceptés au checkout ordinaire

Le paiement confirmé crée une commande en retrait pour un produit avec `pickupAvailable = false`. Une commande en livraison est également créée pour un produit avec `deliveryAvailable = false` dans le cas de livraison offerte à 100 %. La disponibilité du mode n'est pas un garde commun indépendant du calcul des frais.

Correction recommandée : vérifier le mode autorisé de chaque article avant paiement, même lorsque les frais sont nuls. Sources : [construction des lignes](../backend/controllers/orderController.js#L1247), [calcul des frais conditionnel](../backend/controllers/orderController.js#L1329).

### 11. P2 — L'adresse de livraison peut appartenir à un autre pays

Une ville et une commune actives d'un autre pays, liées correctement entre elles, ont été acceptées pour un produit congolais. La commande conserve le pays du produit et une destination étrangère. La validation contrôle l'existence et la relation commune/ville, mais pas leur pays commun avec le produit et le paiement.

Correction recommandée : appliquer la cohérence pays/devise/destination au devis ordinaire, comme pour les tranches. Source : [résolution d'adresse](../backend/controllers/orderController.js#L817).

### 12. P2 — Modifier l'adresse conserve l'ancienne destination dans les données utilisées pour la livraison

Après changement client de « Old address, Brazzaville » vers « New address, Pointe-Noire », `deliveryAddress` change mais `shippingAddressSnapshot` conserve l'ancienne adresse et l'ancienne ville. La demande de livraison privilégie ce snapshot ; elle peut donc reprendre l'ancienne destination. Les frais ne sont pas recalculés et la modification ne fournit pas de nouveaux identifiants ville/commune.

Correction recommandée : mettre à jour une destination structurée unique, valider son pays, traiter le nouveau devis de livraison et synchroniser une éventuelle demande de livraison existante. Sources : [modification client](../backend/controllers/orderController.js#L3881), [destination prioritaire du livreur](../backend/controllers/deliveryRequestController.js#L597).

### 13. P2 — Le solde payé à la livraison n'a pas de clôture comptable explicite

Une commande de 10 000 FCFA dont 5 000 ont été payés en ligne peut être confirmée reçue et devenir `completed`, tout en conservant 5 000 FCFA restants et `PARTIAL`. Le règlement vendeur porte correctement sur les 5 000 réellement encaissés par PawaPay. L'interface vendeur demande de collecter le reste, mais aucun chemin de confirmation de cet encaissement en espèces n'a été trouvé dans les routes et contrôleurs examinés. La dette affichée ne peut donc pas être distinguée d'un solde déjà reçu hors ligne.

Correction recommandée : enregistrer explicitement montant, auteur, date et mode du règlement du solde, séparément des fonds détenus par PawaPay. La remise du colis seule ne doit pas inventer ce paiement. Sources : [confirmation client](../backend/controllers/orderController.js#L4421), [montant du règlement vendeur](../backend/services/sellerSettlementService.js#L195), [instruction de collecte](../frontend/src/pages/SellerOrderDetail.jsx#L737).

## Vérification et limites

- 22 sondes d'audit ont confirmé les comportements décrits, avec les vrais contrôleurs, modèles, hooks et transactions sur un replica set MongoDB local jetable. Une sonde réussie signifie ici que le défaut a été reproduit, pas corrigé.
- 93 tests de régression existants ont réussi : 33 commandes/paiement par proche, 36 tranches, 24 remboursements.
- 16 tests navigateur existants ont réussi sur les vrais écrans React : panier/checkout, paiement par proche et tranches, avec API simulée et appels externes bloqués.
- Prestataire, notifications, SMS et uploads externes simulés. Les sondes de remise et de confirmation utilisent des métadonnées de preuve synthétiques ; aucune preuve réelle n'a été envoyée.
- Les tests d'audit sont archivés dans `/tmp/hdmarket-order-process-audit.pZ0Ch0/orderProcess.audit.test.js`, hors de la suite normale puisqu'ils affirment les défauts observés. Les bases de test ont été supprimées par les suites et le serveur temporaire arrêté.

Ces résultats ne prouvent pas que des clients de production ont subi ces défauts. Ils ne valident pas la configuration du prestataire, la livraison de ses signatures/callbacks ni l'infrastructure déployée. Les corrections déjà apportées aux tranches et à la réservation du paiement par proche ont passé leurs régressions ; elles ne couvrent pas tous les chemins ordinaires et de livraison ci-dessus.

Traiter en premier les annulations/libérations de fonds (1, 2, 6, 8), puis la création et reprise des paiements (3, 4, 5), le verrouillage de livraison offerte (7), et les incohérences restantes (9–13). Ajouter les reproductions correspondantes en tests de comportement attendu lors des corrections.
