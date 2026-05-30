# App Settings & Admin Features – Proposals

## App Settings (Section « App Settings » – `/admin/settings`)

The **App Settings** section lives under **Admin** at `/admin/settings`. It centralises global app branding and promotional assets.

### Currently implemented

- **App logo**
  - Logo **desktop** (navbar, horizontal)
  - Logo **mobile** (navbar, square)
- **Hero banner (Accueil)**
  - Image de fond du HERO sur la page d’accueil (recommandé 1600×600px).
- **Bannière publicitaire**
  - Bannière desktop + mobile
  - Lien optionnel et dates de début/fin pour affichage conditionnel.

### Proposals for App Settings

1. **Favicon**
   - Upload favicon (`.ico` ou PNG) pour onglets/navigateur.
   - Versions 16×16, 32×32, 180×180 (Apple touch).

2. **Open Graph & meta**
   - Image OG par défaut (partages Facebook, etc.).
   - Titre et description par défaut pour les pages sans meta dédiés.

3. **Thème / couleurs**
   - Couleur primaire (ex. indigo) et secondaire.
   - Couleur d’accent pour boutons, liens, badges.
   - Export des variables CSS (ou preset) pour cohérence front.

4. **Maintenance mode**
   - Interrupteur « Mode maintenance ».
   - Message personnalisable et page dédiée (optionnel).
   - Exemption par IP pour les admins.

5. **Messages globaux**
   - Bandeau d’annonce (notification globale) avec dates de début/fin.
   - Lien optionnel, style (info / warning / success).
   - Affichage sur toutes les pages ou uniquement accueil.

6. **Splash / onboarding**
   - Image splash (ex. mobile) configurable depuis App Settings.
   - Texte court et lien optionnel (ex. campagne).

7. **Réseaux sociaux**
   - URLs Facebook, Instagram, Twitter/X, WhatsApp.
   - Affichage dans le footer et éventuellement sur la page d’accueil.

8. **Cache & performance**
   - Invalidation manuelle du cache (ex. après changement logo/bannières).
   - TTL par type de ressource (logos, bannières, settings).

9. **Sauvegarde / rollback**
   - Historique des dernières configurations (logo, hero, promo).
   - Restauration d’une version précédente en un clic.

10. **A/B tests (avancé)**
    - Variantes de bannière HERO ou promo.
    - Répartition du trafic (ex. 50/50) et suivi des clics.

---

## Admin Features – Proposals

Suggestions pour enrichir le back-office admin, en complément de l’existant (voir aussi `ADMIN_FEATURES_PROPOSAL.md`).

### Analytics & reporting

- **Dashboard temps réel**  
  Graphiques (Chart.js / Recharts), tendances 7/30/90 jours, heatmap des commandes, conversion visiteurs → commandes.
- **Rapports**  
  Export PDF/Excel, rapports par email (quotidien/hebdo/mensuel), filtres période/catégorie/ville, comparaison vs période précédente.
- **Insights IA (optionnel)**  
  Prédictions de ventes, détection d’anomalies, recommandations de mise en avant.

### Utilisateurs & rôles

- **Badges & récompenses**  
  Badges vendeurs (Top Seller, Fast Shipper), points, niveaux, programme de fidélité.
- **Communication**  
  Notifications en masse, templates de messages, historique par utilisateur, tickets support.
- **Rôles avancés**  
  Permissions granulaires, audit log des actions admin, approbations en cascade, délégation temporaire.

### Finances & paiements

- **Tableau de bord financier**  
  Revenus par période, prévisions de trésorerie, commissions, export comptable.
- **Paiements**  
  Validation en masse, règles auto (ex. montants < X), historique des transactions, intégrations externes.

### Commandes & logistique

- **Logistique**  
  Tournées de livraison, optimisation des routes, suivi GPS, alertes retards.
- **Stocks**  
  Alertes stock faible, prévisions de réappro, mouvements de stock.

### Sécurité & modération

- **Modération**  
  Détection de contenu suspect (IA), mots interdits, scoring de confiance, blacklist automatique.
- **Audit & conformité**  
  Logs détaillés, export pour audits, RGPD (export données utilisateur), rapports sécurité.

### Interface admin

- **Dashboard**  
  Widgets déplaçables, vues par rôle, thème clair/sombre, raccourcis clavier.
- **Notifications**  
  Centre de notifications unifié, priorisation des alertes, push, résumé quotidien.

### Mobile & accessibilité

- **Admin mobile**  
  Dashboard adapté, actions rapides, notifications push, signature électronique pour validations.
- **Accessibilité**  
  Lecteurs d’écran, navigation clavier, contraste, textes alternatifs.

### Automatisation & intégrations

- **Workflows**  
  Règles « si-alors », relances commandes, archivage/nettoyage automatique.
- **Intégrations**  
  Webhooks, CRM (HubSpot, Salesforce), marketing (Mailchimp, SendGrid), marketplaces.

---

## Priorités recommandées

### Court terme (1–2 mois)

1. Favicon + meta OG dans App Settings.
2. Mode maintenance (interrupteur + message).
3. Bandeau d’annonce global (messages globaux).
4. Export PDF/Excel des rapports admin.
5. Notifications admin unifiées.

### Moyen terme (3–4 mois)

6. Thème / couleurs dans App Settings.
7. Historique et rollback des configs (logo, hero, promo).
8. Tableau de bord financier.
9. Rôles et permissions avancés.
10. Modération assistée (mots interdits, scoring).

### Long terme (5–6 mois)

11. Prédictions / insights IA.
12. Admin mobile dédié.
13. Workflows automatisés.
14. Intégrations externes (CRM, webhooks).

---

## Liens utiles

- **App Settings** : `/admin/settings` (admin uniquement).
- **Propositions admin détaillées** : `ADMIN_FEATURES_PROPOSAL.md`.
- **Rapports** : `ADMIN_REPORTS_PROPOSAL.md`, `REPORTING_SYSTEM_SUMMARY.md`.
