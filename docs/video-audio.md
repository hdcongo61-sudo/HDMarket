# Modifier le son avant l’envoi

Dans le formulaire produit ou dans chaque vidéo sélectionnée de **Mes HDMarket Videos**, ouvrez **Modifier le son**.

1. Choisissez **Couper**, **Remplacer** ou **Mélanger**.
2. Pour remplacer ou mélanger, sélectionnez une piste audio locale (20 Mo maximum). Réglez le volume ajouté et, pour un mélange, celui de la vidéo originale.
3. Cliquez **Préparer l’aperçu**, écoutez le résultat puis **Appliquer ce son à la vidéo**. Sans application, le fichier sélectionné reste inchangé.
4. Envoyez la vidéo normalement. Chaque fichier conserve son propre résultat et les reprises utilisent le même fichier préparé.

Après avoir appliqué une piste, elle est conservée localement dans les **4 sons les plus utilisés** de ce compte. Elle est proposée dans les deux éditeurs, avec son compteur d’utilisation et un bouton **Retirer**. Les fichiers restent dans le stockage du navigateur et ne sont pas envoyés à HDMarket avant d’être utilisés dans une vidéo.

La piste commence au début de la vidéo, boucle si elle est plus courte et s’arrête avec la vidéo. La préparation locale utilise les codecs disponibles dans le navigateur, jusqu’à 1920 pixels sur le côté le plus long et 30 images/seconde. Elle réencode donc la vidéo et peut modifier sa taille ou sa qualité. Gardez l’onglet visible. Un navigateur incompatible ou un fichier audio illisible affiche une erreur sans remplacer le fichier initial.

Les vidéos dont un transfert a déjà démarré ne peuvent plus être modifiées dans la file : retirez-les et sélectionnez-les à nouveau pour changer leur son. La bibliothèque publiée n’est pas modifiée par cet éditeur.

Vérification navigateur : `npx playwright test e2e/video-audio.spec.js`. Le test crée des médias locaux, vérifie la lecture, l’absence de piste en mode muet, les fréquences audio du remplacement/mélange et l’annulation, sans publier de vidéo.
