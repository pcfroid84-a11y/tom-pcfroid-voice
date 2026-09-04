# Transfert humain — conception V1

Le helper `human-transfer.mjs` est préparé mais n'est pas branché sur les appels de production.

## Déclencheurs prévus

- Tom ne comprend pas clairement le motif après 1 à 2 tentatives ;
- client demande explicitement un humain ;
- cas métier marqué `transfert obligatoire` ;
- situation sensible où Tom ne dispose pas d'une réponse fiable.

## Phrase prévue

« Je suis désolé, je préfère vous passer quelqu'un de l'équipe qui pourra mieux vous répondre. Ne quittez pas, je vous transfère. »

## Technique

Le transfert utilise l'API Twilio sur le `CallSid` actif pour remplacer le flux courant par un `<Dial>` vers le numéro humain configuré.

Variables nécessaires :

- `TWILIO_ACCOUNT_SID` — déjà utilisé par l'environnement Twilio, ne jamais l'écrire dans le dépôt ;
- `TWILIO_AUTH_TOKEN` — secret, uniquement Railway ;
- `PCFROID_TRANSFER_NUMBER` — numéro humain au format international, à choisir avant activation.

Aucun numéro humain n'est codé en dur dans le dépôt.

## Si personne ne répond

Le TwiML de secours annonce :

« Je suis désolé, personne de l'équipe n'est disponible pour le moment. Votre appel a bien été enregistré et l'équipe vous rappellera dès que possible. »

Avant activation, vérifier qu'un numéro de rappel exploitable est disponible. Si l'appelant masque son numéro, Tom devra d'abord demander un numéro de rappel.

## Sécurité

- le transfert ne doit jamais être tenté sans `CallSid`, numéro cible et identifiants Twilio ;
- échec API : journaliser et revenir au plan de rappel ;
- ne jamais boucler entre Tom et le numéro humain ;
- pendant les tests, ne pas configurer comme cible le téléphone qui appelle Tom ;
- conserver une mémoire de l'appel même lorsqu'il est transféré.
