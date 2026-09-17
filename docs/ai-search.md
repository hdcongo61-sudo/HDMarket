# Recherche image et vocale avec OpenAI

## Configuration backend

```dotenv
OPENAI_API_KEY=
SEARCH_AI_ENABLED=true
SEARCH_AI_MODEL=gpt-4.1-mini
SEARCH_TRANSCRIPTION_MODEL=gpt-transcribe
SEARCH_AI_DAILY_LIMIT=500
```

La clé OpenAI est commune aux assistants de rédaction et photo et reste uniquement sur le backend. Configurez-la dans `.env` et dans les variables de l’hébergement, puis redémarrez le backend. Les options admin `enable_image_search` et `enable_voice_search` doivent aussi être activées pour le marché concerné. Sans clé ou avec `SEARCH_AI_ENABLED=false`, les interfaces classiques restent disponibles. L’accès aux modèles et la facturation du projet OpenAI doivent être configurés. Aucun paiement par recherche n’est demandé à l’utilisateur ; HDMarket supporte les coûts API.

## Image

Choisissez une photo, cadrez l’objet et cliquez « Identifier cet article avec l’IA ». Le navigateur envoie uniquement un aperçu JPEG de 320 × 320 pixels, sans les métadonnées du fichier original. L’IA propose un mot-clé modifiable. Cliquez pour l’utiliser, puis appliquez le cadrage et les filtres. Les résultats viennent du catalogue vérifié du pays, filtré par texte et classé selon la couleur, le prix ou la date. Les pages suivantes ne rappellent pas l’IA. Une reconnaissance identique est réutilisée tant que la fenêtre et le cadrage restent inchangés.

Ce n’est pas une recherche par embeddings sur toutes les images du catalogue : la comparaison existante considère jusqu’à 200 candidats récents et peut être partielle si les couleurs ne sont pas encore en cache. Le modèle peut mal identifier un objet ; corrigez le mot-clé ou utilisez la comparaison par couleur. Aucun prix, état ou marque n’est déduit automatiquement de la photo.

## Voix

La dictée classique du navigateur reste disponible. La dictée IA est une option distincte : enregistrez jusqu’à 20 secondes, puis cliquez « Envoyer et transcrire ». Le fichier audio (3 Mo maximum) est envoyé à OpenAI, et la transcription revient dans le champ modifiable. L’enregistrement nécessite HTTPS (ou localhost), l’autorisation microphone et MediaRecorder. Le plafond de 20 secondes est appliqué par le navigateur ; le serveur borne la taille et le temps de la requête.

« Comprendre ma demande avec l’IA » envoie le texte pour proposer un mot-clé, un prix minimum/maximum et l’état explicitement demandé. Les montants ne sont pas convertis : ils utilisent la devise courante du catalogue. L’utilisateur doit approuver la proposition. Modifier ensuite les mots-clés supprime les critères AI pour éviter des filtres invisibles. La recherche finale n’est pas lancée automatiquement après dictée. Le modèle n’invente pas de fiches produit.

## Fiabilité et données

- Endpoints `/api/search/ai/capabilities`, `/image`, `/voice`, `/transcribe`.
- Photos et textes : Responses API, sortie JSON structurée, `store: false` ; audio : API de transcription. Ces réglages ne garantissent pas une rétention nulle chez le prestataire.
- Requêtes IA annulables et bornées à 25 secondes côté serveur ; le navigateur garde la recherche classique en cas d’erreur.
- 20 appels IA/heure/IP et 500/jour/processus par défaut (paramétrable avec `SEARCH_AI_DAILY_LIMIT`). Une transcription puis une interprétation comptent pour deux appels. Les quotas en mémoire sont réinitialisés au redémarrage et indépendants entre instances : ce ne sont pas des plafonds monétaires globaux.
- Aucun média utilisateur n’est stocké durablement par ces endpoints. N’envoyez pas de documents confidentiels ni de conversations privées ; l’interface annonce chaque transfert à OpenAI.
- Tests automatiques avec fournisseur simulé ; aucune recherche OpenAI facturable n’est envoyée par les tests.

Documentation officielle : https://developers.openai.com/api/docs/guides/images-vision et https://developers.openai.com/api/docs/guides/speech-to-text .
