# Proposition de refonte – Messagerie & OrderChat

## 1. Objectifs

- **Professionnaliser** l’interface de la page Messages et de la boîte de dialogue OrderChat.
- **Compléter** l’expérience : informations visibles, actions claires, états vides et erreurs gérés.
- **Clarifier** la hiérarchie visuelle et le parcours (liste → conversation → actions).

---

## 2. Page Messages (`/orders/messages`)

### 2.1 Structure proposée

- **En-tête**
  - Fil d’Ariane : Accueil > Commandes > Messages.
  - Titre : « Messagerie » avec sous-titre (nombre de conversations, nombre de non lus).
  - Badge « Messages sécurisés » discret à droite (desktop).

- **Barre d’outils**
  - Champ de recherche unique, pleine largeur sur mobile, dans la barre sur desktop.
  - Filtres sous forme d’onglets : **Tous** | **Non lus** | **Archivées** (avec compteur sur Non lus).
  - Pagination en bas de liste si nécessaire.

- **Zone principale**
  - **Desktop** : mise en page deux colonnes.
    - **Colonne gauche (≈ 400px)** : liste des conversations (cartes cliquables).
    - **Colonne droite** : soit conversation ouverte (OrderChat intégré ou en panel), soit **état vide** avec illustration et CTA « Choisir une conversation » / « Voir mes commandes ».
  - **Mobile** : liste pleine largeur ; au clic sur une conversation → ouverture de OrderChat en plein écran (comportement actuel type modal).

- **Carte conversation**
  - Image produit (thumbnail), infos produit (titre, partenaire, référence commande).
  - Dernier message (extrait) + horaire relative.
  - Badge de statut (Demande / En attente / Livrée, etc.) et indicateur « non lu » si besoin.
  - Au survol/clic : fond légèrement mis en avant + bordure; conversation sélectionnée clairement distinguée.

- **États vides**
  - Aucune conversation : illustration + texte explicatif + lien « Voir mes commandes ».
  - Aucun résultat de recherche : message dédié + bouton « Effacer la recherche ».
  - Filtre « Non lus » vide : « Vous n’avez plus de messages non lus ».

- **Erreurs**
  - Bandeau d’erreur avec icône, message et bouton « Fermer », au-dessus de la liste.

### 2.2 Comportements

- Clic sur une ligne = ouverture de la conversation (OrderChat avec `defaultOpen`).
- Une seule conversation ouverte à la fois (état `selectedOrder`).
- Après archive / suppression, fermeture du chat et rafraîchissement liste + compteur non lus.

---

## 3. OrderChat (boîte de dialogue conversation)

### 3.1 Structure proposée

- **Barre de tête (header)**
  - Bouton retour (mobile) / fermer (desktop).
  - Photo ou avatar produit/partenaire + nom du partenaire (vendeur ou client).
  - Référence commande (ex. #ABC123) et petit indicateur « Sécurisé ».
  - Actions : Recherche dans la conversation, Infos commande/produit, Menu (Archiver, Supprimer, Lien produit).

- **Zone messages**
  - Fond neutre (gris très clair / thème sombre).
  - Séparateurs de date (Aujourd’hui, Hier, date complète).
  - Bulles :
    - **Envoyées** : alignées à droite, couleur primaire (ex. indigo/violet), texte lisible, heure + statut lu/non lu.
    - **Reçues** : alignées à gauche, fond blanc/carte, nom de l’expéditeur si pertinent (ex. boutique), heure.
  - Pièces jointes (images cliquables, fichiers avec icône + lien de téléchargement).
  - Réactions sous la bulle si présentes.
  - Action « Supprimer le message » au survol (icône poubelle) avec confirmation.

- **Recherche dans la conversation**
  - Panneau repliable sous la barre de tête : champ + résultats (extraits avec surlignage).

- **Panneau Infos**
  - Repliable : produit (image, titre, lien), numéro de commande, badges « Transaction protégée » / « Données sécurisées ».

- **Zone de saisie (footer)**
  - Ligne unique : pièce jointe | zone de texte (multiligne, max hauteur fixe) | émoji | envoi.
  - Indication « Messages sécurisés » + compteur de caractères (ex. 0/1000).
  - Réponses rapides (suggestions) au-dessus du champ si conversation vide ou optionnel.

- **États**
  - Chargement initial : squelette ou spinner centré.
  - Aucun message : illustration + « Démarrez la conversation » + réponses rapides.
  - Aucun résultat de recherche : message dédié dans la zone messages.

- **Modale image**
  - Clic sur image → lightbox plein écran avec fermeture claire.

### 3.2 Détails visuels

- Typographie : titres en gras, corps de message lisible (taille confortable), horaires en plus petit et discret.
- Espacement : marges et espacements cohérents entre liste, header, messages et input.
- Bordures et ombres légères pour séparer header, zone messages et input.
- Couleurs : primaire (indigo/violet) pour actions et messages envoyés ; neutres pour fond et messages reçus.

---

## 4. Synthèse des améliorations

| Zone            | Amélioration |
|-----------------|--------------|
| Page Messages   | Mise en page deux colonnes (desktop), fil d’Ariane, cartes conversation claires, états vides et erreurs explicites. |
| OrderChat       | Header unifié (avatar, nom, ref, actions), bulles et séparateurs de date, zone de saisie compacte, panneaux recherche/infos repliables. |
| Cohérence       | Même langage visuel (couleurs, espacements, bordures), comportement prévisible (un chat ouvert, fermeture après archive/suppression). |

---

## 5. Fichiers impactés

- `frontend/src/pages/OrderMessages.jsx` – structure, layout, cartes, états vides, erreurs.
- `frontend/src/components/OrderChat.jsx` – header, zone messages, zone de saisie, panneaux optionnels.

---

## 6. Implémentation

La refonte est appliquée dans le code existant en conservant :

- Les appels API et la logique métier (liste, filtres, archive, suppression, envoi, chargement des messages).
- La compatibilité mobile (liste puis OrderChat en plein écran / modal).
- L’accessibilité de base (labels, boutons, fermeture d’erreurs).

Seuls le rendu (JSX), les classes CSS (Tailwind) et la structure des blocs sont modifiés pour atteindre un rendu plus professionnel et complet.
