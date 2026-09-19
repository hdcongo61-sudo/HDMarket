# Couper le son avant l’envoi

La seule modification audio proposée est la suppression du son. L’ajout de musique, le mélange audio et la bibliothèque de sons enregistrés ont été retirés.

## Formulaire produit

Après avoir sélectionné une vidéo, utilisez le bouton **Couper le son** de son aperçu. Un message confirme que la vidéo sera publiée sans audio. Le bouton **Activer le son** permet de revenir au son original avant l’envoi. Le serveur supprime la piste audio lors de l’envoi du nouveau fichier ; aucun réencodage local supplémentaire n’est nécessaire.

Le bouton de volume sur une vidéo déjà publiée ne modifie que sa lecture dans l’aperçu. Pour publier une version sans son, sélectionnez à nouveau le fichier et activez **Couper le son** avant d’enregistrer.

## Mes HDMarket Videos

1. Dans chaque vidéo sélectionnée, ouvrez **Couper le son**.
2. Cliquez sur **Préparer la vidéo sans son**, puis vérifiez l’aperçu.
3. Cliquez sur **Appliquer la vidéo sans son** avant de l’envoyer. Sans application, le fichier sélectionné reste inchangé.

La préparation locale réencode la vidéo sans piste audio, jusqu’à 1920 pixels sur le côté le plus long et 30 images/seconde. Elle peut modifier la taille ou la qualité du fichier. Gardez l’onglet visible. Une erreur ou une annulation conserve le fichier sélectionné.

Les vidéos dont un transfert a déjà démarré ne peuvent plus être modifiées dans la file : retirez-les et sélectionnez-les à nouveau pour couper leur son.

Vérification navigateur : `npx playwright test e2e/video-audio.spec.js`. Les tests vérifient la lecture sans piste audio, l’annulation et le choix muet dans le formulaire produit, sans publier de vidéo réelle.
