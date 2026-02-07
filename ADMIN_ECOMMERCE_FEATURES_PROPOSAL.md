# Admin E‑commerce – Nouvelles fonctionnalités proposées

Ce document propose des évolutions pour l’espace admin HDMarket, orientées e‑commerce et exploitation des données.

---

## 1. Tableau de bord desktop (fait)

- **Sidebar de navigation** sur desktop (lg) avec liens vers toutes les sections admin.
- **Layout commun** : toutes les pages admin (/admin, /admin/orders, etc.) partagent la même sidebar pour une navigation rapide.
- **Sidebar repliable** pour gagner de la place à l’écran.

---

## 2. Fonctionnalités proposées

### 2.1 Gestion des stocks et alertes

- **Stock par produit** (optionnel) : champ `stock` ou `quantity` sur les annonces.
- **Alertes stock bas** : liste admin des produits sous un seuil (ex. &lt; 3) avec lien vers l’annonce et le vendeur.
- **Historique des mouvements** (ventes / mises à jour) pour les produits avec stock.

**Bénéfice** : moins de ventes “indisponibles”, meilleure confiance acheteur.

---

### 2.2 Promotions et codes promo (admin)

- **Création de codes promo** : pourcentage ou montant fixe, date de début/fin, usage max par utilisateur, usage max global.
- **Rapport d’utilisation** : qui a utilisé quel code, sur quelles commandes, montant de réduction.
- **Promos flash** : courtes (ex. 24 h) avec visibilité home + rapport admin.

**Bénéfice** : campagnes marketing pilotables depuis l’admin, mesure de l’impact.

---

### 2.3 Commission et revenus plateforme

- **Taux de commission** (global ou par catégorie) : % prélevé sur chaque vente.
- **Vue “Revenus plateforme”** : CA total, commission perçue, par période (jour / semaine / mois).
- **Export** (CSV/Excel) : ventes, commissions, par vendeur ou par catégorie.

**Bénéfice** : monétisation claire et pilotage du business.

---

### 2.4 Modération des annonces avancée

- **File d’attente de modération** : vue dédiée (en attente / approuvées / rejetées) avec filtres (catégorie, date, vendeur).
- **Raisons de rejet prédéfinies** : liste admin (prix, photo, description, autre) pour un retour structuré au vendeur.
- **Historique des actions** : qui a approuvé/rejeté quoi et quand (audit).

**Bénéfice** : modération plus rapide et traçable.

---

### 2.5 Support et litiges

- **Centre de litiges** : liste des litiges (retour, non reçu, produit non conforme) avec statuts (ouvert / en cours / résolu).
- **Conversation admin–vendeur–acheteur** : fil de messages ou notes internes par litige.
- **Décision admin** : remboursement partiel/total, clôture, escalade.

**Bénéfice** : résolution centralisée et cohérente des conflits.

---

### 2.6 Analytics et rapports

- **Rapport “Top vendeurs”** : CA, nombre de commandes, note moyenne, évolution sur N jours.
- **Rapport “Top catégories”** : ventes et CA par catégorie, tendance.
- **Rapport “Panier moyen”** : évolution dans le temps, par catégorie ou par ville.
- **Graphiques exportables** (PNG/PDF) pour rapports internes ou partenaires.

**Bénéfice** : décisions basées sur les données (catégories à pousser, vendeurs à mettre en avant).

---

### 2.7 Notifications et communication

- **Annonces admin** : message court affiché à tous (ou par segment) sur la home ou la page compte (bannière ou pop-in).
- **Envoi d’email / push ciblé** : par rôle (vendeurs / acheteurs), par ville, ou “tous” (maintenance, promo, rappel).
- **Modèles de messages** : templates réutilisables pour emails et notifications in-app.

**Bénéfice** : communication centralisée et maîtrisée.

---

### 2.8 Paramètres marchand (admin)

- **Frais de livraison par défaut** (ou par zone) : montant fixe ou règle (ex. % du panier).
- **Devise et affichage** : symbole (FCFA, etc.), format des prix (espaces, décimales).
- **Seuils** : montant minimum de commande, délai max de traitement des paiements avant relance.

**Bénéfice** : configuration du marché sans toucher au code.

---

### 2.9 Export et intégrations

- **Export commandes** : CSV/Excel (filtres par date, statut, vendeur) pour compta ou CRM.
- **Export produits** : catalogue (titre, prix, catégorie, statut, vendeur) pour référence ou migration.
- **Webhook (optionnel)** : notification HTTP sur nouvel ordre / paiement validé pour intégration ERP ou logistique.

**Bénéfice** : automatisation et reporting externe.

---

### 2.10 Rôles et permissions granulaires

- **Rôles personnalisés** : ex. “Support”, “Modérateur”, “Finances” avec droits limités (voir commandes, voir paiements, modérer annonces, etc.).
- **Permissions par écran** : accès en lecture seule vs modification pour chaque section admin.
- **Journal des actions sensibles** : qui a changé un rôle, validé un paiement, désactivé un compte.

**Bénéfice** : sécurité et conformité, délégation sans tout ouvrir.

---

## 3. Priorisation suggérée

| Priorité | Fonctionnalité              | Effort estimé | Impact |
|----------|-----------------------------|---------------|--------|
| 1        | Commission & revenus        | Moyen         | Élevé  |
| 2        | Modération avancée          | Faible        | Élevé  |
| 3        | Codes promo                | Moyen         | Élevé  |
| 4        | Export commandes / produits | Faible        | Moyen  |
| 5        | Alertes stock               | Moyen         | Moyen  |
| 6        | Centre de litiges           | Élevé         | Élevé  |
| 7        | Analytics (top vendeurs, etc.) | Moyen      | Moyen  |
| 8        | Annonces / notifications    | Moyen         | Moyen  |
| 9        | Paramètres marchand         | Faible        | Moyen  |
| 10       | Rôles granulaires           | Élevé         | Moyen  |

---

## 4. Résumé

- **Desktop** : admin déjà redesigné avec sidebar et layout commun.
- **Nouvelles idées** : commission, modération, codes promo, litiges, analytics, exports, rôles, paramètres marchand et communication.

On peut détailler l’UX/API pour une de ces idées en priorité (ex. commission ou codes promo) si besoin.
