# Retouches photo IA payantes

## Activation

1. Configurez `OPENAI_API_KEY` sur le backend (jamais dans une variable VITE). Le modèle image est choisi avec `PRODUCT_IMAGE_AI_MODEL`, par défaut `gpt-image-2.5-sunburst`. Votre projet OpenAI doit pouvoir utiliser le modèle et disposer de crédits/API billing.
2. Configurez Cloudinary pour stocker les originaux et résultats et PawaPay pour les paiements confirmés. Le service prend actuellement en charge XAF uniquement, dans un pays autorisant PawaPay et cette devise.
3. Administration → Retouches IA payantes → Configurer les prix → Configuration : recherchez `image_edit`. Fixez `image_edit_price_background`, `image_edit_price_cleanup`, `image_edit_price_lighting`, `image_edit_price_custom` (entiers, 10–1 000 000 FCFA), puis activez `image_edit_ai_enabled`. Les valeurs initiales sont 500 FCFA et le service est désactivé par défaut. Vérifiez vos coûts OpenAI, stockage et paiement avant activation.
4. Redémarrez/redéployez après modification des variables. Les paramètres admin sont mis en cache pendant environ 2 minutes. Les tarifs peuvent être définis globalement par le fondateur ou par pays dans les paramètres existants ; les demandes existantes gardent leur prix enregistré.

## Parcours vendeur

Studio complet → Retouche IA, ou `/seller/image-edits`. Une demande enregistre une photo (PNG/JPEG/WebP, 10 Mo maximum), une opération, des instructions et un prix. Les originaux sont stockés sur Cloudinary avant paiement. Le prix n’est pas calculé par le navigateur. La demande est ensuite immuable : changer la photo ou les instructions nécessite une nouvelle demande et un nouveau paiement.

Après confirmation PawaPay, cliquez « Lancer la retouche ». Le traitement est asynchrone ; revenir à la page permet de retrouver le paiement et le résultat. Le studio conserve le formulaire lors du retour de la fenêtre PawaPay. Les résultats s’ouvrent aussi dans la galerie pour téléchargement puis import dans le formulaire. L’image produite est un PNG 1024 × 1024 ; elle ne conserve pas la résolution originale. Vérifiez visuellement la fidélité au produit avant publication. L’IA peut se tromper.

Les champs texte et la photo sont envoyés à OpenAI. Le modèle ne doit pas inventer des caractéristiques du produit. Les photos sont hébergées via les URL Cloudinary du projet : elles ne sont pas un stockage privé de documents confidentiels.

## Paiement, reprise et exploitation

- Une tentative de paiement active par demande, avec réservation atomique. Le serveur contrôle propriétaire, pays, devise, montant, objet et confirmation. Une réponse du navigateur seule ne déverrouille jamais OpenAI.
- Une retouche terminée renvoie le même résultat sans relancer OpenAI. Au plus trois tentatives de traitement par paiement ; les échecs gardent leur paiement, sans refacturer le vendeur.
- `/admin/image-edits` affiche les 100 dernières demandes (pays de l’admin, tous pays pour le fondateur). Il permet de réautoriser des tentatives après échec ou interruption de plus de 10 minutes. Cette reprise est datée et attribuée à l’admin dans la demande. Elle ne déclenche pas elle-même OpenAI. Les coûts de nouvelles tentatives sont supportés par la plateforme.
- Les traitements tournent dans le processus Node avec un état et un verrou durables dans MongoDB. Après un redémarrage pendant un traitement, utilisez la reprise admin ; aucune relance automatique n’est faite. Une reprise reçoit un nouvel identifiant de traitement qui empêche un ancien traitement d’écraser son résultat.
- Les remboursements d’une retouche non livrée demandent une vérification du support et une opération du prestataire de paiement. Aucun remboursement automatique n’est implémenté. Ne demandez pas au vendeur de repayer une demande échouée.
- Les limites de débit utilisent la mémoire du processus. Elles ne constituent pas un plafond global de dépenses. Une facture OpenAI peut être due même pour une requête interrompue.
- Les originaux non payés restent dans Cloudinary et MongoDB ; prévoir une politique de conservation/nettoyage avant un déploiement à grande échelle.

Les outils manuels du studio et le détourage local restent gratuits. `/avantages` présente le studio, le détourage, la rédaction IA et les nouvelles retouches payantes avec leurs étapes.

Référence API : https://developers.openai.com/api/docs/guides/image-generation . Aucun paiement réel ni appel OpenAI facturable n’a été effectué pendant les tests automatisés.
