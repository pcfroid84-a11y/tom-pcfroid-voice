# Contrat de fin d'appel Tom → n8n

Ce contrat sert de référence unique pour la mémoire, le mail, le SMS et le futur rattachement des réponses SMS.

## Identifiants et temps

- `event_id` : identifiant unique de l'événement de fin d'appel.
- `call_sid` : identifiant Twilio de l'appel.
- `started_at` : date/heure ISO du début d'appel si disponible.
- `ended_at` : date/heure ISO de fin.
- `trigger` : `twilio-stop`, `socket-close` ou autre source contrôlée.

## Contact

- `caller_phone` : numéro qui a appelé, normalisé en E.164 si possible.
- `phone` : numéro de rappel confirmé ; sinon numéro appelant.
- `identity` : prénom + nom tels que confirmés ; jamais déduits d'une ville ou d'une autre réponse.
- `identity_confidence` : indique si l'identité est exploitable ou suspecte.
- `customer_status` : `existing`, `new` ou `unknown`.
- `contact_type` : `particulier`, `professionnel`, `partenaire` ou `unknown` quand cette information sera disponible.

## Demande

- `reason` : motif court et lisible.
- `service_intent` : intention métier structurée quand connue.
- `equipment` : équipement concerné.
- `city` : ville d'intervention.
- `address` : adresse d'intervention.
- `important_information` : informations utiles à l'équipe, sans données techniques internes inutiles.
- `caller_messages` : liste des transcriptions client retenues.
- `transcript` : transcription client concaténée pour audit, avec taille plafonnée.

## Routage

- `category` : `CLIENT`, `PROSPECT`, `PARTENAIRE`, `MESSAGE` ou `URGENCE` uniquement si l'urgence est explicitement confirmée par une règle PC Froid validée.
- `urgency` : valeur brute du routage existant, conservée pour diagnostic mais non suffisante à elle seule pour produire `URGENCE`.
- `business_urgency_confirmed` : booléen métier contrôlé.
- `routing_category` : catégorie brute de l'ancien workflow n8n.

## Sorties

- `sms_summary` : texte court destiné au client.
- `mail_subject` : objet lisible prêt pour Gmail.
- `mail_summary` : résumé texte simple pour journalisation ou secours.
- `mail_html` : corps HTML déjà préparé et échappé par Tom, afin que n8n n'ait pas à reconstruire le mail avec de nombreuses expressions.
- `call_complete` : booléen indiquant si le parcours a atteint une fin normale.

## Règles de sécurité

1. L'envoi de fin d'appel doit être dédupliqué par `call_sid` / `event_id`.
2. Un échec n8n doit être journalisé et permettre une nouvelle tentative ; il ne doit pas casser l'appel.
3. Les champs absents restent `null` ou `Non précisé` selon la sortie, jamais inventés.
4. Le score numérique `routingUrgency` actuel ne doit pas être interprété comme une urgence métier tant que son échelle n'est pas validée.
5. La mémoire doit conserver les appels incomplets.
6. Les données provenant de l'appelant sont échappées avant insertion dans le HTML du mail.

## n8n — point important

Dans un nœud Webhook n8n, le JSON POST est généralement disponible sous `$json.body`. Le workflow doit idéalement aplatir une seule fois les champs utiles dans `Edit Fields` puis faire partir Gmail, Twilio et la mémoire depuis cette sortie commune. Cela évite les expressions différentes entre tests manuels et vraies exécutions.

Pour Gmail, la cible V1 est simplement :

- Subject : `{{$json.mail_subject}}`
- Message HTML : `{{$json.mail_html}}`

après aplatissement dans `Edit Fields`.
