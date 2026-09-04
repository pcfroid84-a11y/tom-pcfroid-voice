# Mail et SMS — présentation V1

## Principe n8n

Le nœud `Webhook` reçoit le POST sous `$json.body`. Le nœud `Edit Fields` doit aplatir les champs une seule fois :

- `category` = `{{$json.body.category}}`
- `identity` = `{{$json.body.identity}}`
- `phone` = `{{$json.body.phone}}`
- `customer_status` = `{{$json.body.customer_status}}`
- `reason` = `{{$json.body.reason}}`
- `equipment` = `{{$json.body.equipment}}`
- `city` = `{{$json.body.city}}`
- `address` = `{{$json.body.address}}`
- `important_information` = `{{$json.body.important_information}}`
- `sms_summary` = `{{$json.body.sms_summary}}`
- `mail_subject` = `{{$json.body.mail_subject || ('[' + $json.body.category + '] ' + $json.body.reason + ' - ' + ($json.body.identity || $json.body.phone))}}`

Ensuite Gmail, Twilio et la mémoire utilisent uniquement les champs aplatis de `Edit Fields`.

## Objet mail

`[CATÉGORIE] Motif - Identité`

Exemples :

- `[PROSPECT] Entretien climatisation - Nicolas Garcia`
- `[CLIENT] Dépannage climatisation - Jean Martin`
- `[URGENCE] Chambre froide sans froid - Restaurant X`
- `[PARTENAIRE] Message fournisseur - Société X`

## Corps mail recommandé

Le mail doit être lisible sur téléphone et ne pas afficher de données techniques internes inutiles.

```html
<h2>Appel reçu par Tom</h2>
<p><strong>{{identity}}</strong><br>
📞 {{phone}}<br>
{{customer_status_label}}</p>

<h3>Demande</h3>
<p>{{reason}}</p>

<h3>Équipement</h3>
<p>{{equipment}}</p>

<h3>Lieu</h3>
<p>{{address}}<br>{{city}}</p>

<h3>Informations utiles</h3>
<p>{{important_information}}</p>

<h3>À faire</h3>
<p>{{action_to_take}}</p>
```

### Règles

- Si une information manque, afficher `Non précisé`, pas `undefined`.
- Ne pas afficher le Call SID dans le mail courant.
- Conserver Call SID, transcript et détails techniques uniquement dans la mémoire.
- Si l'identité est douteuse, afficher `Identité à confirmer`.
- L'urgence doit être une urgence métier confirmée, pas simplement un score numérique brut.

## SMS client

Le SMS doit confirmer ce qui a été compris sans promettre un délai non validé.

### Standard

`PC Froid : votre demande ({{reason}} à {{city}}) a bien été enregistrée. Vous pouvez répondre à ce SMS pour corriger ou compléter une information.`

### Partenaire

`PC Froid : merci pour votre appel. Votre message a bien été transmis à l'équipe.`

### À éviter

- « Un technicien vous rappelle dans X minutes » sans garantie.
- un diagnostic dans le SMS ;
- un prix non validé ;
- un résumé très long ;
- demander au client de rappeler un autre numéro alors qu'il peut répondre directement au SMS.

## Réponses SMS entrantes

À réception :

1. normaliser le numéro `From` ;
2. rechercher le dernier appel compatible avec ce numéro ;
3. rattacher le SMS à cet `appel_id` ;
4. enregistrer le SMS dans l'onglet `SMS` ;
5. envoyer un mail `[RÉPONSE SMS] Identité - Motif` ;
6. si aucun appel n'est trouvé, envoyer quand même le message en le marquant `NON RATTACHÉ` plutôt que de créer une association risquée.
