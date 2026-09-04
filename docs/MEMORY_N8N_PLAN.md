# Mémoire d'appels et réponses SMS — plan n8n

Un Google Sheet a été préparé dans Drive sous le nom **Tom - Mémoire des appels PC Froid** avec quatre onglets : `Appels`, `SMS`, `Tarifs`, `Référentiel`.

## Workflow de fin d'appel

Structure cible :

`Webhook tom-fin-appel → Edit Fields (aplati) → Google Sheets Append Row`

Depuis la même sortie `Edit Fields`, conserver les branches Gmail et Twilio déjà existantes.

### Mapping onglet Appels

| Colonne | Source proposée |
|---|---|
| appel_id | `call_sid` au départ ; pourra évoluer vers `event_id` |
| date_heure_debut | `started_at` |
| date_heure_fin | `ended_at` |
| duree_secondes | calcul ultérieur |
| call_sid | `call_sid` |
| telephone_appelant | `caller_phone` |
| telephone_rappel | `phone` |
| identite | `identity` |
| statut_client | `customer_status` |
| type_contact | `contact_type` |
| entreprise | vide tant que non collecté |
| motif | `reason` |
| equipement | `equipment` |
| ville | `city` |
| adresse | `address` |
| urgence | `business_urgency_confirmed` ou valeur métier future |
| categorie | `category` |
| informations_importantes | `important_information` |
| disponibilites | vide tant que non collecté |
| action_a_faire | règle n8n selon catégorie |
| resume_client | `sms_summary` |
| transcription | `transcript` |
| appel_complet | `call_complete` |
| declencheur_fin | `trigger` |
| sms_envoye | `À vérifier` au premier niveau |
| sms_repondu | `NON` |
| mail_envoye | `À vérifier` au premier niveau |
| routing_category | `routing_category` |
| erreur | vide par défaut |
| derniere_mise_a_jour | `ended_at` |

## Déduplication

Le serveur protège déjà l'envoi de fin d'appel dans l'état courant. Côté mémoire, utiliser `call_sid` comme clé de base et éviter d'ajouter une deuxième ligne si le même `call_sid` existe déjà.

À terme, `event_id` permettra une déduplication encore plus explicite.

## Workflow SMS entrant

Structure cible :

`Webhook Twilio SMS entrant → Normaliser → Chercher appels du numéro → Choisir le bon appel → Enregistrer SMS → Gmail équipe`

Twilio envoie généralement les réponses SMS en `application/x-www-form-urlencoded` avec notamment `From`, `To`, `Body` et `MessageSid`.

### Règle de rattachement

1. Normaliser `From` au format E.164.
2. Chercher dans `Appels` les lignes où `telephone_rappel` ou `telephone_appelant` correspond.
3. Trier par `date_heure_fin` décroissante.
4. Prendre le dernier appel compatible.
5. Si aucun appel n'est trouvé : `statut_rattachement = NON RATTACHÉ`.
6. Si le numéro correspond à plusieurs appels très proches et que le contexte rend le choix incertain : `À CONFIRMER` plutôt que forcer l'association.

### Normalisation téléphone — Code n8n

```js
function normalizePhone(value) {
  const raw = String(value || '').trim().replace(/[^\d+]/g, '');
  if (!raw) return null;
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('0033')) return '+33' + raw.slice(4);
  if (raw.startsWith('0') && raw.length === 10) return '+33' + raw.slice(1);
  return raw;
}

const inbound = $('Webhook SMS').item.json.body || $('Webhook SMS').item.json;
return [{
  json: {
    sms_sid: inbound.MessageSid || null,
    phone: normalizePhone(inbound.From),
    to: normalizePhone(inbound.To),
    body: inbound.Body || '',
    num_media: Number(inbound.NumMedia || 0),
    received_at: new Date().toISOString(),
  }
}];
```

### Onglet SMS

- `sms_id` : MessageSid
- `date_heure` : date de réception
- `telephone` : From normalisé
- `direction` : `ENTRANT`
- `contenu` : Body
- `appel_id_rattache` : call_sid du dernier appel compatible
- `identite` : identité de l'appel rattaché
- `statut_rattachement` : `RATTACHÉ`, `À CONFIRMER` ou `NON RATTACHÉ`
- `action` : `Transmettre à l'équipe`
- `mail_transmis` : `OUI/NON`

## Mail d'une réponse SMS

Objet :

`[RÉPONSE SMS] Identité - Motif`

Corps :

- identité ;
- téléphone ;
- appel d'origine et date ;
- demande initiale ;
- texte exact du nouveau SMS ;
- mention visible si le rattachement n'est pas certain.

## Photos / MMS — prévu mais non activé en V1 immédiate

Conserver `NumMedia` et les URLs média Twilio quand cette compétence sera ajoutée. Les médias devront être rattachés au même appel et transmis à l'équipe sans être exposés publiquement.
