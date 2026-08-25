// TOM PC FROID VOICE - V2.10 FLOW LOCK - base V2.9 figée + parcours verrouillé + raccrochage sécurisé
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import formbody from "@fastify/formbody";
import WebSocket from "ws";
 
const app = Fastify({ logger: true });
 
await app.register(formbody);
await app.register(websocket);
 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = Number(process.env.PORT || 3000);
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-appel";
 
const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";
const TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
 
// Réglages anti-bruit : ajustables dans Railway sans modifier le code.
const VAD_THRESHOLD = Number(process.env.OPENAI_VAD_THRESHOLD || 0.65);
const VAD_SILENCE_MS = Number(process.env.OPENAI_VAD_SILENCE_MS || 900);
const VAD_PREFIX_MS = Number(process.env.OPENAI_VAD_PREFIX_MS || 300);
const MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 800);
 

// NOTE V2.8 DEFINITIVE : le SMS récapitulatif doit être déclenché côté n8n après l’appel.
// Ce serveur ne doit jamais prétendre qu’un SMS est envoyé sans confirmation du workflow.
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY manquante");
}
 
const SYSTEM_PROMPT = `
Tu es Tom, l'assistant téléphonique de PC Froid.

PERSONNALITÉ
- Tom est chaleureux, simple, professionnel, naturel et efficace.
- Il ne prétend jamais être humain et n'invente ni souvenirs, ni âge, ni ancienneté précise.
- Il peut avoir une petite touche d'humour si le client plaisante, puis revient au motif de l'appel.
- Si on lui demande qui il est : « Moi c'est Tom, l'assistant virtuel de PC Froid. Je suis là pour vous aider et transmettre votre demande à l'équipe. »
- Si on lui demande depuis combien de temps il est chez PC Froid : « Je suis le petit nouveau de PC Froid. J'ai été mis en place pour aider l'équipe à mieux gérer les appels. »

LANGAGE ET PRONONCIATION
- VOUVOYEZ toujours le client, même s'il vous tutoie.
- Le nom de l'entreprise est « PC Froid ».
- Prononcez « PC Froid » naturellement comme « pé cé froid », de façon fluide.
- N'exagérez pas les lettres P et C et ne ralentissez pas la prononciation.
- Ne dites jamais « PC trois » ni « PC froide ».
- Évitez de prononcer « multi-split ». Dites plutôt « une installation avec plusieurs unités intérieures » ou indiquez le nombre d'unités.

RÈGLES DE CONVERSATION PRIORITAIRES
- Une seule question à la fois. Après une question, arrêtez-vous et attendez la réponse réelle du client.
- N'enchaînez jamais deux ou trois questions techniques dans la même réponse.
- Ne répétez pas une information déjà comprise.
- Ne transformez pas systématiquement la réponse du client en question de confirmation.
- Ne reposez jamais une question à laquelle le client a répondu clairement.
- Une seule relance est autorisée si une information est réellement ambiguë, incomplète ou mal entendue.
- N'inventez jamais une réponse du client. Si le client dit qu'il n'y a pas de code erreur, ne prétendez jamais qu'il a indiqué un code.
- N'inventez ni nom, ni nombre, ni adresse, ni ville, ni tarif, ni disponibilité, ni rendez-vous.
- Évitez les séries de « merci », « d'accord », « parfait », « très bien ». Une transition n'est pas obligatoire.
- Réponses courtes : en général une ou deux phrases, avec une seule question à la fin.

DÉBUT DE L'APPEL
- L'accueil initial est géré séparément par le serveur.
- Après l'accueil, laissez le client expliquer son motif. N'anticipez jamais l'équipement ni le problème.
- Le mot « Froid » dans « PC Froid » n'est jamais un indice sur le motif de l'appel.
- Si le client dit seulement « bonjour », « allô » ou « je suis bien chez PC Froid ? », répondez brièvement puis laissez-le expliquer son besoin.

RÉPONSES SUR LES SERVICES
- Quand le client demande si PC Froid réalise un service, répondez d'abord clairement et professionnellement par oui ou non.
- Évitez « vous pouvez faire appel à nous », « on peut s'en occuper » ou toute formulation hésitante.
- Exemple : Client : « Est-ce que vous faites les entretiens de climatisation ? » Tom : « Oui, tout à fait, nous faisons l'entretien des climatisations. Est-ce que vous êtes déjà client chez P C Froid ? »
- Même principe pour dépannage, entretien, installation ou autre service réellement couvert par les règles métier chargées.

ÉQUIPEMENT
- L'équipement explicitement cité par le client est prioritaire sur toute supposition du système.
- Conservez cet équipement comme sujet tant que le client n'en change pas.
- Si l'équipement est réellement incertain, posez une seule question courte de confirmation.

PARCOURS DE PRISE DE CONTACT
Après avoir compris brièvement la demande :
1. Demandez une seule fois : « Est-ce que vous êtes déjà client chez P C Froid ? »
2. Prenez ensuite l'identité de façon naturelle.
3. Qualifiez la demande avec le minimum de questions techniques.
4. Avant la fin, récupérez ou confirmez obligatoirement le lieu d'intervention et le numéro de rappel.
5. Posez une seule fois la question finale « Est-ce que vous avez une autre question ou quelque chose à ajouter ? »
6. Clôturez une seule fois.

CLIENT EXISTANT
- S'il est déjà client, demandez « À quel nom est le dossier ? » seulement si l'identité n'est pas déjà connue.
- Ne redemandez pas la ville au début uniquement pour contrôler le secteur.
- Un client existant peut être pris en charge même hors du secteur habituel. Ne refusez jamais automatiquement un client existant à cause de sa ville.
- Si le système fournit une adresse habituelle fiable, gardez-la pour la vérification de fin d'appel.

NOUVEAU CLIENT
- Demandez le prénom et le nom, puis seulement la ville où se trouve l'installation.
- Ne demandez pas encore l'adresse complète.
- La ville permet d'appliquer les règles de secteur si elles sont réellement fournies par le système.
- Ne déclarez jamais une ville hors secteur sans règle métier explicite et fiable.

SECTEUR D'INTERVENTION

- Cette règle concerne principalement les NOUVEAUX CLIENTS.

- Le secteur habituel de PC Froid comprend :
  1. le Vaucluse (84) ;
  2. les communes limitrophes du Vaucluse dans les Bouches-du-Rhône (13) ;
  3. les communes limitrophes du Vaucluse dans le Gard (30).

- Ne pas considérer que tout le département 13 ou tout le département 30 est automatiquement dans le secteur.

- Si un nouveau client indique une ville clairement éloignée du secteur, par exemple Bastia, Lyon, Paris ou Nice, Tom comprend que la demande est hors secteur habituel.

- Dans ce cas, Tom ne poursuit pas inutilement avec l'adresse complète et toutes les coordonnées.

- Tom répond naturellement, par exemple :
  « Nous intervenons principalement dans le Vaucluse et les secteurs limitrophes. Bastia est malheureusement trop éloigné pour une intervention habituelle. »

- Si Tom n'est pas certain qu'une commune du 13 ou du 30 soit suffisamment proche du Vaucluse, il ne refuse pas de lui-même. Il indique que Christophe vérifiera si l'intervention est possible.
- Si le serveur injecte « ZONE CONFIRMÉE », « HORS SECTEUR » ou « ZONE À VÉRIFIER », cette décision est prioritaire : Tom ne la contredit pas et ne refait pas lui-même le raisonnement géographique.

- Pour un CLIENT DÉJÀ CONNU DE PC FROID, ne jamais refuser automatiquement à cause de la distance ou de la ville. Un client existant peut être pris en charge hors du secteur habituel.

IDENTITÉ ET NOM DU CLIENT
- Si le client donne prénom et nom ensemble, considérez les deux comme acquis et ne redemandez pas le nom de famille.
- Ne déduisez jamais le prénom ou le nom de famille uniquement à partir de l'ordre des mots.
- N'appelez pas le client par son prénom seul si vous n'êtes pas certain qu'il s'agit bien du prénom.
- Si la civilité et le nom sont clairement connus, vous pouvez utiliser « Monsieur Martin » ou « Madame Martin » une ou deux fois maximum dans l'appel.
- Sinon, restez neutre plutôt que d'inventer une façon de l'appeler.

NOMBRES, VILLES ET ADRESSES
- Ne remplacez jamais un nombre entendu par un autre. Si vous avez compris « 63 », ne dites jamais ensuite que le client avait dit « 73 ».
- En cas de doute réel : « J'ai compris 63, c'est bien ça ? »
- Une information clairement comprise ne doit pas être redemandée.
- Si le client corrige une ville, un nom, un nombre ou une adresse, la nouvelle information remplace immédiatement l'ancienne. Ne conservez jamais les deux versions et ne demandez pas au client de choisir entre l'ancienne valeur erronée et sa correction.
- Exemple : si Tom avait compris « La Seyne » et que le client dit « Vous avez mal compris, je suis à Marseille », la ville devient uniquement « Marseille ».
- Exception utile : en fin d'appel, vous pouvez réutiliser naturellement la ville déjà comprise dans la demande d'adresse. Exemple : « Monsieur Martin, quelle adresse je note pour le technicien à Monteux ? » Cela permet au client de corriger la ville si elle a été mal entendue.

QUALIFICATION TECHNIQUE
- Pour une panne simple, posez au maximum deux questions techniques réellement utiles.
- Ne cherchez pas à établir un diagnostic complet au téléphone.
- Dès que vous avez assez d'informations pour décider de la suite, arrêtez les questions techniques.
- Ne posez jamais une question simplement parce qu'elle pourrait être intéressante si elle ne change plus la décision.

CLIMATISATION
- Pour une climatisation en panne, restez sur les symptômes de climatisation.
- Ne posez jamais de question sur la marchandise, les aliments ou la conservation.
- Si elle ne fait plus de froid, une ou deux précisions utiles maximum peuvent suffire : depuis quand, si elle démarre, ou un code/voyant seulement si cette information est encore inconnue et utile.
- Si le client vient de dire qu'elle démarre mais ne fait pas de froid, ne reformulez pas et ne redemandez pas si elle démarre.

MACHINE À GLAÇONS
- Si le client parle d'une machine à glaçons, conserver exactement le terme « machine à glaçons ».
- Ne jamais remplacer cette expression par « machine à glace ».
- Si la machine ne produit plus de glaçons ou ne refroidit plus, Tom ne cherche pas à établir un diagnostic complet au téléphone.
- Il demande seulement les informations qui peuvent réellement aider Christophe.
- Si le client précise que la situation est urgente, Tom arrête les questions techniques inutiles et passe à la prise en charge de la demande.

ÉQUIPEMENTS HORS COMPÉTENCE

- PC Froid ne prend pas en charge les équipements de cuisson ou de chaud en cuisine professionnelle.

Sont notamment hors compétence :
- friteuses,
- fours,
- plaques de cuisson,
- pianos de cuisson,
- grills,
- salamandres,
- hottes de cuisine,
- systèmes d'extraction de cuisine,
- et plus généralement les équipements destinés à cuire ou chauffer les aliments.

- Tom ne doit jamais confirmer un dépannage sur ces équipements.
- Tom ne doit pas proposer de transmettre la demande à Christophe si le seul motif concerne un équipement hors compétence.
- Tom répond simplement :
  « Désolé, nous ne faisons pas le dépannage de ce type d'équipement de cuisine. PC Froid intervient principalement sur le froid et la climatisation. »
- Tom peut ensuite demander une seule fois :
  « Est-ce que je peux vous aider pour autre chose ? »
- Si le client répond non, Tom clôture immédiatement l'appel.
- Ne pas demander le nom, l'adresse, la ville ou le numéro de téléphone lorsque le seul motif concerne un équipement hors compétence.

CHAMBRE FROIDE SANS FROID
- Ce cas peut nécessiter jusqu'à quatre questions car il faut qualifier l'urgence de conservation.
- Posez uniquement les éléments encore manquants, dans cet ordre :
  1. Depuis combien de temps la chambre ne fait plus de froid ?
  2. Est-elle positive ou négative ?
  3. Y a-t-il actuellement de la marchandise à conserver ?
  4. Si oui, la marchandise a-t-elle été mise ailleurs ou existe-t-il une solution frigorifique de secours ?
- Ne poursuivez pas ensuite avec humidité, givre, ventilateurs ou autres symptômes sauf si le client donne spontanément un élément qui change la priorité.
- Marchandise sensible sans solution de secours : urgence.
- Marchandise mise en sécurité ailleurs : important mais pas urgence absolue.
- Chambre vide, arrêtée depuis longtemps ou remise en service plus tard : à planifier.
- En urgence réelle : « D'accord, je fais passer ça en urgence à Christophe. Il vous rappellera au plus vite pour prendre en charge le dépannage. »

TARIFS
- Si le système fournit un tarif fixe, validé et correspondant exactement à la demande du client, annoncez ce tarif clairement.
- Un tarif fixe connu ne doit pas être renvoyé inutilement vers Christophe pour simple confirmation.
- Si plusieurs tarifs existent, si la configuration exacte n'est pas couverte ou si aucun tarif fiable n'est fourni, n'inventez rien : dites que Christophe confirmera le tarif.
- Ne dites pas « une offre adaptée » pour un simple tarif d'entretien. Préférez une formulation directe et métier.

RENDEZ-VOUS
- Tom pourra à terme proposer et prendre un rendez-vous.
- Pour l'instant, ne proposez ou ne confirmez un créneau que si le système fournit explicitement des disponibilités réelles ET confirme que le rendez-vous a été enregistré.
- Sans disponibilité système fiable, ne fabriquez jamais de créneau et indiquez que Christophe rappellera pour l'organiser.

FIN D'APPEL : ORDRE OBLIGATOIRE
Avant de poser la question finale ou d'annoncer que la demande est terminée, vérifiez les étapes encore nécessaires :
A. L'identité est connue.
B. Le lieu d'intervention est confirmé.
C. Le numéro de rappel est confirmé.
D. Ensuite seulement, la question finale est posée une seule fois.
E. Puis une seule clôture.

LIEU D'INTERVENTION EN FIN D'APPEL
- Client existant + adresse habituelle réellement fournie par le système : « Monsieur Martin, est-ce que l'intervention est à la même adresse que d'habitude ? »
- S'il répond oui, ne faites pas répéter l'adresse.
- S'il répond non, demandez la nouvelle adresse.
- Si aucune adresse habituelle fiable n'est disponible, demandez l'adresse complète.
- Nouveau client : utilisez la ville comprise. Exemple : « Quelle adresse je note pour le technicien à Monteux ? »
- Ne dites pas que vous transmettez définitivement la demande tant que le lieu d'intervention et le numéro de rappel nécessaires ne sont pas récupérés.

NUMÉRO DE RAPPEL
- Après le lieu d'intervention, dans une question séparée : « On peut vous rappeler sur le numéro avec lequel vous appelez ? »
- Si oui, ne faites pas répéter le numéro.
- Si non, demandez uniquement le numéro à utiliser.

QUESTION FINALE
- Posez UNE SEULE FOIS : « Est-ce que vous avez une autre question ou quelque chose à ajouter ? »
- Si le client pose alors une question, répondez-y mais NE REPOSEZ JAMAIS la question finale ensuite.
- Après avoir traité cette dernière question, passez directement aux éventuelles informations de fin encore manquantes, puis à la clôture.

CLÔTURE
- Une seule clôture, courte.
- Une fois la demande prête : annoncez l'action suivante puis dites au revoir.
- Pour un dépannage transmis, préférez « Christophe vous rappellera » plutôt que « il vous rappellera si nécessaire », sauf si le workflow indique réellement qu'aucun rappel n'est prévu.
- Après votre formule « au revoir / bonne journée / bonne soirée », ne repartez jamais dans la conversation.
- Si le client répond lui-même « au revoir », une deuxième longue formule n'est pas nécessaire.

SMS RÉCAPITULATIF
- Le SMS est géré par le workflow PC Froid.
- N'affirmez jamais qu'il a été envoyé sans confirmation système.
- Si le système confirme l'envoi prévu, vous pouvez préciser une seule fois que le client pourra vérifier le récapitulatif et ses coordonnées, puis répondre au SMS pour corriger une information ou ajouter un complément.

ÉCOUTE ET SÉCURITÉ
- Ignorez les voix de fond et les bruits qui ne vous sont pas adressés.
- Ne demandez jamais au client d'ouvrir un appareil, mesurer une tension ou manipuler un circuit frigorifique.
- Si une décision technique ou humaine est nécessaire, transmettez à Christophe.
- Si le client est pressé ou agacé, réduisez encore les questions.

FRANÇAIS PARLÉ
- « Elle fait plus de froid » signifie généralement « elle ne fait plus de froid ».
- « Elle fait plus de chaud » ou « j'ai plus de chauffage » signifie généralement « elle ne chauffe plus ».
- Si le sens reste réellement ambigu, posez une seule confirmation courte.

PRIORITÉS
1. Ne jamais inventer.
2. Ne jamais répéter inutilement.
3. Respecter l'équipement réellement cité.
4. Une question à la fois.
5. Respecter l'ordre de fin d'appel : lieu, rappel, question finale, clôture.
6. Utiliser les données n8n/Supabase sans réciter les règles au client.

OBJECTIF
Le client doit avoir l'impression de parler à un assistant PC Froid compétent, naturel et efficace, jamais à un questionnaire automatique.
`;
 
const GREETINGS = [
  "Bonjour, vous êtes bien chez PC Froid, et c'est Tom. Je vous écoute.",
];
 
const FILLER_MESSAGES = new Set([
  "bonjour",
  "allo",
  "salut",
  "oui",
  "non",
  "ok",
  "d'accord",
  "daccord",
  "merci",
  "je sais pas",
  "je ne sais pas",
  "ça marche pas",
  "ca marche pas",
  "eh oui ça marche pas",
  "eh oui ca marche pas",
  "ça fait bip",
  "ca fait bip",
  "je comprends rien",
  "je comprends rien moi",
]);
 
const BUSINESS_HINTS = [
  "clim",
  "climatisation",
  "chaud",
  "chauffage",
  "froid",
  "souffle",
  "fuite",
  "eau",
  "bruit",
  "bip",
  "voyant",
  "code",
  "télécommande",
  "telecommande",
  "mitsubishi",
  "heiwa",
  "daikin",
  "panasonic",
  "airzone",
  "pompe à chaleur",
  "pac",
  "entretien",
  "dépannage",
  "panne",
  "depannage",
  "devis",
  "facture",
  "attestation",
  "commande",
  "fournisseur",
  "chambre froide",
 "machine à glaçons",
"machine a glacons",
"glaçons",
"glacons",
  "banque froide",
  "frigo",
  "réfrigérateur",
  "refrigerateur",
  "congélateur",
  "congelateur",
  "vitrine",
  "chauffe-eau",
  "chauffe eau",
  "ballon thermodynamique",
];
 
const NON_NAME_WORDS = new Set([
  "oui",
  "non",
  "ok",
  "merci",
  "bonjour",
  "allo",
  "clim",
  "climatisation",
  "froid",
  "chaud",
  "chauffage",
  "fuite",
  "eau",
  "bruit",
  "bip",
  "voyant",
  "code",
  "mitsubishi",
  "heiwa",
  "daikin",
  "panasonic",
  "airzone",
  "panne",
  "monsieur",
  "madame",
  "mme",
  "mr",
]);
 
function normalizeText(text = "") {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+/g, "")
    .replace(/\s+/g, " ");
}

function normalizeCityKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// V2.9 : contrôle de zone volontairement conservateur.
// - toutes les communes du Vaucluse sont acceptées pour un nouveau client ;
// - quelques communes proches des départements 13 et 30 sont acceptées explicitement ;
// - seules des villes clairement éloignées sont refusées automatiquement ;
// - tout cas non listé reste « à vérifier » afin d'éviter un faux refus.
const VAUCLUSE_CITIES = [
  "Althen-des-Paluds",
  "Ansouis",
  "Apt",
  "Aubignan",
  "Aurel",
  "Auribeau",
  "Avignon",
  "Le Barroux",
  "La Bastide-des-Jourdans",
  "La Bastidonne",
  "Le Beaucet",
  "Beaumes-de-Venise",
  "Beaumettes",
  "Beaumont-de-Pertuis",
  "Beaumont-du-Ventoux",
  "Blauvac",
  "Bollène",
  "Bonnieux",
  "Brantes",
  "Buisson",
  "Buoux",
  "Bédarrides",
  "Bédoin",
  "Cabrières-d'Aigues",
  "Cabrières-d'Avignon",
  "Cadenet",
  "Caderousse",
  "Cairanne",
  "Camaret-sur-Aigues",
  "Caromb",
  "Carpentras",
  "Caseneuve",
  "Castellet-en-Luberon",
  "Caumont-sur-Durance",
  "Cavaillon",
  "Cheval-Blanc",
  "Châteauneuf-de-Gadagne",
  "Châteauneuf-du-Pape",
  "Courthézon",
  "Crestet",
  "Crillon-le-Brave",
  "Cucuron",
  "Entraigues-sur-la-Sorgue",
  "Entrechaux",
  "Faucon",
  "Flassan",
  "Fontaine-de-Vaucluse",
  "Gargas",
  "Gignac",
  "Gigondas",
  "Gordes",
  "Goult",
  "Grambois",
  "Grillon",
  "L'Isle-sur-la-Sorgue",
  "Jonquerettes",
  "Jonquières",
  "Joucas",
  "Lacoste",
  "Lafare",
  "Lagarde-Paréol",
  "Lagarde-d'Apt",
  "Lagnes",
  "Lamotte-du-Rhône",
  "Lapalud",
  "Lauris",
  "Lioux",
  "Loriol-du-Comtat",
  "Lourmarin",
  "Malaucène",
  "Malemort-du-Comtat",
  "Maubec",
  "Mazan",
  "Mirabeau",
  "Modène",
  "Mondragon",
  "Monieux",
  "Monteux",
  "Morières-lès-Avignon",
  "Mormoiron",
  "Mornas",
  "La Motte-d'Aigues",
  "Murs",
  "Ménerbes",
  "Mérindol",
  "Méthamis",
  "Oppède",
  "Orange",
  "Pernes-les-Fontaines",
  "Pertuis",
  "Peypin-d'Aigues",
  "Piolenc",
  "Le Pontet",
  "Puget",
  "Puyméras",
  "Puyvert",
  "Rasteau",
  "Richerenches",
  "Roaix",
  "Robion",
  "La Roque-Alric",
  "La Roque-sur-Pernes",
  "Roussillon",
  "Rustrel",
  "Sablet",
  "Saignon",
  "Saint-Christol",
  "Saint-Didier",
  "Saint-Hippolyte-le-Graveyron",
  "Saint-Léger-du-Ventoux",
  "Saint-Marcellin-lès-Vaison",
  "Saint-Martin-de-Castillon",
  "Saint-Martin-de-la-Brasque",
  "Saint-Pantaléon",
  "Saint-Pierre-de-Vassols",
  "Saint-Romain-en-Viennois",
  "Saint-Roman-de-Malegarde",
  "Saint-Saturnin-lès-Apt",
  "Saint-Saturnin-lès-Avignon",
  "Saint-Trinit",
  "Sainte-Cécile-les-Vignes",
  "Sannes",
  "Sarrians",
  "Sault",
  "Saumane-de-Vaucluse",
  "Savoillan",
  "Sivergues",
  "Sorgues",
  "Suzette",
  "Séguret",
  "Sérignan-du-Comtat",
  "Taillades",
  "Le Thor",
  "La Tour-d'Aigues",
  "Travaillan",
  "Uchaux",
  "Vacqueyras",
  "Vaison-la-Romaine",
  "Valréas",
  "Vaugines",
  "Vedène",
  "Velleron",
  "Venasque",
  "Viens",
  "Villars",
  "Villedieu",
  "Villelaure",
  "Villes-sur-Auzon",
  "Violès",
  "Visan",
  "Vitrolles-en-Lubéron"
];

const NEIGHBOR_SECTOR_CITIES = [
  "Barbentane",
  "Rognonas",
  "Châteaurenard",
  "Noves",
  "Cabannes",
  "Saint-Andiol",
  "Plan-d'Orgon",
  "Orgon",
  "Sénas",
  "Mallemort",
  "Charleval",
  "La Roque-d'Anthéron",
  "Saint-Estève-Janson",
  "Jouques",
  "Saint-Paul-lès-Durance",
  "Villeneuve-lès-Avignon",
  "Les Angles",
  "Rochefort-du-Gard",
  "Saze",
  "Pujaut",
  "Sauveterre",
  "Roquemaure",
  "Montfaucon",
  "Saint-Laurent-des-Arbres",
  "Lirac",
  "Tavel",
  "Laudun-l'Ardoise",
  "Codolet",
  "Chusclan",
  "Orsan",
  "Saint-Étienne-des-Sorts",
  "Pont-Saint-Esprit"
];

const CLEAR_OUT_OF_SECTOR_CITIES = [
  "Marseille",
  "Aix-en-Provence",
  "Aubagne",
  "La Ciotat",
  "Cassis",
  "Martigues",
  "Istres",
  "Arles",
  "Salon-de-Provence",
  "Toulon",
  "Nice",
  "Cannes",
  "Antibes",
  "Fréjus",
  "Draguignan",
  "Bastia",
  "Ajaccio",
  "Lyon",
  "Paris",
  "Montpellier",
  "Nîmes",
  "Alès",
  "Grenoble",
  "Valence",
  "Gap",
  "Digne-les-Bains",
  "Manosque",
  "Sisteron"
];

const IN_SECTOR_CITY_MAP = new Map(
  [...VAUCLUSE_CITIES, ...NEIGHBOR_SECTOR_CITIES].map((city) => [
    normalizeCityKey(city),
    city,
  ])
);

const OUT_OF_SECTOR_CITY_MAP = new Map(
  CLEAR_OUT_OF_SECTOR_CITIES.map((city) => [normalizeCityKey(city), city])
);

const ALL_KNOWN_CITY_MAP = new Map([
  ...IN_SECTOR_CITY_MAP,
  ...OUT_OF_SECTOR_CITY_MAP,
]);

function classifyServiceArea(city) {
  const key = normalizeCityKey(city);
  if (!key) return "unknown";
  if (IN_SECTOR_CITY_MAP.has(key)) return "in";
  if (OUT_OF_SECTOR_CITY_MAP.has(key)) return "out";
  return "unknown";
}

function assistantAskedForCustomerStatus(text) {
  const normalized = normalizeText(text);
  return [
    "déjà client chez pc froid",
    "deja client chez pc froid",
    "êtes-vous déjà client",
    "etes-vous deja client",
    "êtes vous déjà client",
    "etes vous deja client",
  ].some((phrase) => normalized.includes(phrase));
}

function extractCustomerStatusAnswer(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  if (
    normalized === "non" ||
    normalized.startsWith("non ") ||
    normalized.includes("pas du tout") ||
    normalized.includes("pas encore client") ||
    normalized.includes("nouveau client")
  ) {
    return "new";
  }

  if (
    normalized === "oui" ||
    normalized.startsWith("oui ") ||
    normalized.includes("déjà client") ||
    normalized.includes("deja client") ||
    normalized.includes("je suis client")
  ) {
    return "existing";
  }

  return null;
}

function assistantAskedForCity(text) {
  const normalized = normalizeText(text);
  if (!normalized || normalized.includes("adresse")) return false;

  if (
    normalized.includes("ville") &&
    (
      normalized.includes("quelle") ||
      normalized.includes("dans laquelle") ||
      normalized.includes("se trouve") ||
      normalized.includes("installation")
    )
  ) {
    return true;
  }

  return [
    "dans quelle ville",
    "quelle ville",
    "ville où se trouve",
    "ville ou se trouve",
    "où se trouve l'installation",
    "ou se trouve l'installation",
    "où se trouve l intervention",
    "ou se trouve l intervention",
    "quel endroit se trouve l'installation",
    "quel endroit se trouve l installation",
    "dans quelle commune",
    "quelle commune",
    "localité",
    "localite",
  ].some((phrase) => normalized.includes(phrase));
}

function callerCorrectsCity(text) {
  const normalized = normalizeText(text);
  return [
    "vous avez mal compris",
    "vous m'avez mal compris",
    "vous m avez mal compris",
    "non je suis à",
    "non je suis a",
    "non c'est à",
    "non c est à",
    "non c'est a",
    "non c est a",
    "la ville c'est",
    "la ville c est",
  ].some((phrase) => normalized.includes(phrase));
}

function cleanCityCandidate(value) {
  let city = String(value || "").trim();
  if (!city) return null;

  city = city
    .replace(/[.!?;:].*$/u, "")
    .replace(/,.*$/u, "")
    .replace(/\s+(?:vous avez|vous m'avez|vous m avez|mais|par contre|s'il vous plaît|s il vous plait).*$/iu, "")
    .trim();

  if (!city || city.length < 2 || city.length > 70) return null;
  if (!/^[\p{L}'’\- ]+$/u.test(city)) return null;

  const normalized = normalizeText(city);
  if (["oui", "non", "merci", "d'accord", "daccord"].includes(normalized)) return null;

  return city;
}

function extractCityCandidate(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const normalizedRaw = ` ${normalizeCityKey(raw)} `;

  // D'abord les villes connues : on privilégie les noms les plus longs.
  const knownCities = [...ALL_KNOWN_CITY_MAP.entries()].sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [key, canonical] of knownCities) {
    if (normalizedRaw.includes(` ${key} `)) return canonical;
  }

  const patterns = [
    /(?:je suis|c['’]est|ça se trouve|ca se trouve|l'installation est|l intervention est)\s+(?:à|a|sur)\s+([\p{L}'’\- ]{2,70})/iu,
    /(?:ville|commune)\s+(?:c['’]est|est)?\s*(?:à|a|sur)?\s*([\p{L}'’\- ]{2,70})/iu,
    /^(?:à|a|sur)\s+([\p{L}'’\- ]{2,70})$/iu,
    /^([\p{L}'’\- ]{2,70})$/u,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      const city = cleanCityCandidate(match[1]);
      if (city) return city;
    }
  }

  return null;
}
 
function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
 
function maskPhone(phone) {
  if (!phone) return null;
  const value = String(phone);
  if (value.length <= 4) return "****";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
 
function isUsefulCallerMessage(text) {
  const normalized = normalizeText(text);
  if (!normalized || FILLER_MESSAGES.has(normalized)) return false;

  const words = normalized.split(/\s+/).filter(Boolean);
  const hasBusinessHint = BUSINESS_HINTS.some((hint) =>
    normalized.includes(hint)
  );

  const hasPersonalQuestion = [
    "qui êtes-vous",
    "qui etes-vous",
    "qui etes vous",
    "qui êtes vous",
    "vous êtes un robot",
    "vous etes un robot",
    "vous êtes qui",
    "vous etes qui",
    "depuis combien de temps",
  ].some((phrase) => normalized.includes(phrase));

  // Une demande métier courte doit pouvoir déclencher le contexte n8n.
  if (hasBusinessHint && words.length >= 2) return true;
  if (hasPersonalQuestion) return true;

  // Hors métier explicite, on attend une phrase un peu plus construite.
  return words.length >= 6;
}

function isInitialFragmentMessage(text) {
  const normalized = normalizeText(text);
  if (!normalized || FILLER_MESSAGES.has(normalized)) return true;

  const words = normalized.split(/\s+/).filter(Boolean);

  // Fragments typiques captés lorsque l'appelant commence juste à parler.
  if (normalized === "oui bonjour" || normalized === "bonjour oui") return true;
  if (normalized === "je vous appelle" || normalized === "oui je vous appelle") return true;
  if (normalized === "bonjour je vous appelle" || normalized === "oui bonjour je vous appelle") return true;
  if (normalized.startsWith("oui bonjour je vous appelle") && words.length <= 5) return true;
  if (normalized.startsWith("bonjour je vous appelle") && words.length <= 4) return true;

  return false;
}

function isPersonalQuestionMessage(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  return [
    "qui êtes-vous",
    "qui etes-vous",
    "qui etes vous",
    "qui êtes vous",
    "vous êtes un robot",
    "vous etes un robot",
    "vous êtes qui",
    "vous etes qui",
    "depuis combien de temps",
  ].some((phrase) => normalized.includes(phrase));
}

function isClearlyOutOfCompetenceRequest(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  return [
    "friteuse",
    "four",
    "plaque de cuisson",
    "plaques de cuisson",
    "piano de cuisson",
    "grill",
    "salamandre",
    "hotte de cuisine",
    "extraction de cuisine",
  ].some((term) => normalized.includes(term));
}
 
function cleanIdentityName(value) {
  let candidate = String(value || "")
    .trim()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");

  if (!candidate) return null;

  // Retire les civilités et un éventuel contexte de ville :
  // « Monsieur Garnier à Sarrians » -> « Garnier ».
  candidate = candidate
    .replace(/^(?:monsieur|madame|mme|mr|m)\.?\s+/i, "")
    .replace(/\s+à\s+.+$/iu, "")
    .trim();

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) return null;
  if (candidate.length < 2 || candidate.length > 60) return null;
 if (!words.every((word) => /^[\p{L}'’ -]+$/u.test(word))) return null;
 
  const normalizedWords = words.map((word) => normalizeText(word));
  if (normalizedWords.some((word) => NON_NAME_WORDS.has(word))) return null;

  const normalizedCandidate = normalizeText(candidate);
  if (FILLER_MESSAGES.has(normalizedCandidate)) return null;
  if (BUSINESS_HINTS.some((hint) => normalizedCandidate.includes(hint))) return null;

  return candidate;
}

function extractNameCandidate(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const strongPatterns = [
   /^(?:oui[\s,]+)?(?:bonjour[\s,]+)?(?:je m['’]appelle|moi c['’]est|mon nom c['’]est|je suis|c['’]est)\s+([^.!?;:,]+)(?:[.!?;:,]|$)/iu,
    /^(?:bonjour[\s,]+)?(?:monsieur|madame|mme|mr|m)\.?\s+([^.!?;:,]+)(?:[.!?;:,]|$)/iu,
  ];

  for (const pattern of strongPatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanIdentityName(match[1]);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

function extractDirectIdentityAnswer(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  // Accepte « Alex Rangoni » mais aussi « C’est Alex Rangoni » après une question d’identité.
  const prefixed = extractNameCandidate(raw);
  if (prefixed) return prefixed;

  const cleaned = cleanIdentityName(raw);
  if (!cleaned) return null;

  const normalized = normalizeText(cleaned);
  const forbidden = [
    "oui", "non", "allo", "bonjour", "merci", "daccord", "d'accord",
    "je", "vous", "il", "elle", "on", "ca", "ça", "probleme", "problème", "panne"
  ];
  if (cleaned.split(/\s+/).some((w) => forbidden.includes(normalizeText(w)))) return null;
  if (FILLER_MESSAGES.has(normalized)) return null;
  if (BUSINESS_HINTS.some((hint) => normalized.includes(hint))) return null;

  return cleaned;
}

function assistantAskedForIdentity(text) {
  const normalized = normalizeText(text);
  return [
    "votre nom",
    "votre prénom",
    "votre prenom",
    "nom et prénom",
    "nom et prenom",
    "prénom et nom",
    "prenom et nom",
    "comment vous appelez",
    "vous appelez comment",
    "pouvez-vous me donner votre nom",
    "pouvez vous me donner votre nom",
    "pouvez-vous me donner votre prénom",
    "pouvez vous me donner votre prenom",
    "à quel nom",
    "a quel nom",
    "nom du dossier",
  ].some((phrase) => normalized.includes(phrase));
}

function assistantAskedFinalQuestion(text) {
  const normalized = normalizeText(text);
  return [
    "autre question",
    "quelque chose à ajouter",
    "autre chose à ajouter",
    "un détail à ajouter",
    "un detail à ajouter",
  ].some((phrase) => normalized.includes(phrase));
}

function assistantIsClosing(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  return /(?:au revoir|bonne journée|bonne soirée|bonne continuation|à bientôt)(?:\s+à vous)?(?:\s+et\s+(?:bonne journée|bonne soirée|bonne continuation))?$/.test(
    normalized
  );
}

function callerIsClosing(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  // Formules explicites de départ
  if (
    /(?:au revoir|bonne journée|bonne soirée|à bientôt)$/.test(normalized)
  ) {
    return true;
  }

  // Le client indique clairement qu'il souhaite terminer
  return [
    "je vous laisse",
    "c'est tout merci",
    "c est tout merci",
    "tant pis merci",
    "tant pis c'est pas grave",
    "tant pis c est pas grave",
    "non ça ira merci",
    "non ca ira merci",
    "ça ira merci",
    "ca ira merci",
   "non ça va merci",
"non ca va merci",
"non c'est bon merci",
"non c est bon merci",
"merci quand même",
"merci quand meme",
    "je vais voir ailleurs",
    "je vais regarder ailleurs",
    "je vais appeler quelqu'un d'autre",
    "je vais appeler quelqu un d autre"
  ].some(
    (phrase) =>
      normalized === phrase ||
      normalized.endsWith(` ${phrase}`)
  );
}
 
function detectExplicitEquipment(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
 
  const equipmentPatterns = [
    { name: "chambre froide", terms: ["chambre froide", "banque froide"] },
    { name: "réfrigérateur", terms: ["réfrigérateur", "refrigerateur", "frigo"] },
    { name: "congélateur", terms: ["congélateur", "congelateur"] },
   { name: "machine à glaçons", terms: ["machine à glaçons", "machine a glacons", "machine à glaçon", "machine a glacon"] },
    { name: "vitrine réfrigérée", terms: ["vitrine réfrigérée", "vitrine refrigeree", "vitrine froide", "vitrine"] },
    { name: "pompe à chaleur", terms: ["pompe à chaleur", "pompe a chaleur", "pac"] },
    { name: "chauffe-eau", terms: ["chauffe-eau", "chauffe eau", "ballon thermodynamique", "chauffe-eau thermodynamique"] },
    {
terms: [
  "climatisation",
  "clim",
  "climatiseur",
  "gainable",
  "gainables",
  "génable",
  "génables",
  "genable",
  "genables",
  "clim gainable",
  "climatisation gainable"
]
},
  ];
 
  for (const equipment of equipmentPatterns) {
    if (equipment.terms.some((term) => normalized.includes(term))) {
      return equipment.name;
    }
  }
 
  return null;
}
 
function extractCustomerContext(context = {}) {
  const candidates = [
    context.identity,
    context.customer,
    context.client,
    context.contact,
  ].filter(Boolean);

  const source = candidates.find((item) => item?.known === true || item?.is_known === true) || candidates[0] || {};
  const firstName = source.first_name || source.firstname || source.prenom || "";
  const lastName = source.last_name || source.lastname || source.nom || "";
  const composedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    known:
      source.known === true ||
      source.is_known === true ||
      context.identity?.known === true,
    name: source.name || source.full_name || composedName || context.identity?.name || "",
    address: source.address || source.adresse || source.street_address || "",
    city: source.city || source.ville || source.commune || "",
    phone: source.phone || source.telephone || source.mobile || "",
  };
}

function buildBusinessContext(context, explicitEquipment = null) {
  const rules = (context.essential_rules || [])
    .map((rule) => `- ${rule.instruction}`)
    .filter(Boolean)
    .join("\n");

  const scenarios = (context.selected_scenarios || [])
    .map(
      (scenario) => `
Scénario : ${scenario.scenario || ""}
Compréhension : ${scenario.expected_understanding || ""}
Questions maximum : ${scenario.max_questions || ""}
Action : ${scenario.expected_action || ""}
Urgence : ${scenario.urgency_level || ""}`
    )
    .join("\n");

  const procedures = (context.selected_procedures || [])
    .map(
      (procedure) => `
Procédure : ${procedure.name || ""}
Étapes autorisées : ${procedure.allowed_steps || ""}
Limites de sécurité : ${procedure.safety_limits || ""}`
    )
    .join("\n");

  const customer = extractCustomerContext(context);
  const pricingContext =
    context.pricing || context.tariff || context.tarifs || context.price || context.prices || context.selected_tariff || null;
  const appointmentContext =
    context.appointment || context.booking || context.availability || context.slots || context.rendez_vous || context.rdv || null;
  const pricingText = pricingContext ? JSON.stringify(pricingContext).slice(0, 2500) : "non fourni";
  const appointmentText = appointmentContext ? JSON.stringify(appointmentContext).slice(0, 2500) : "non fourni";

  return `
CONTEXTE MÉTIER PC FROID POUR CET APPEL
Équipement explicitement cité par le client : ${explicitEquipment || context.routing?.equipment || "non déterminé"}
Catégorie proposée par le routage : ${context.routing?.category || ""}
Intention : ${context.routing?.intent || ""}
Équipement routeur : ${context.routing?.equipment || ""}
Urgence : ${context.routing?.urgency || 0}
Confiance routeur : ${context.routing?.confidence ?? ""}
Analyse : ${context.routing?.reason || ""}

DOSSIER CLIENT RETOURNÉ PAR LE SYSTÈME
Client connu confirmé : ${customer.known ? "oui" : "non ou non confirmé"}
Nom : ${customer.name || "non fourni"}
Adresse habituelle : ${customer.address || "non fournie"}
Ville : ${customer.city || "non fournie"}
Numéro : ${customer.phone ? "présent dans le dossier" : "non fourni"}

TARIFS FOURNIS PAR LE SYSTÈME
${pricingText}

DISPONIBILITÉS / RENDEZ-VOUS FOURNIS PAR LE SYSTÈME
${appointmentText}

RÈGLES UTILES
${rules}

SCÉNARIO RETENU
${scenarios}

PROCÉDURE ÉVENTUELLE
${procedures}

Consignes impératives :
- Utilisez ce contexte sans le réciter.
- VOUVOYEZ toujours le client.
- L\'équipement explicitement cité par le client est prioritaire sur toute supposition du routage.
- Si un scénario ou une procédure contredit l\'équipement explicitement cité, ignorez cet élément contradictoire.
- Les règles anti-répétition, non-invention, sécurité et prise de contact progressive du SYSTEM_PROMPT restent prioritaires.
- Restez concis et respectez le nombre maximal de questions, sauf l\'exception explicite de qualification d\'une chambre froide sans froid.
- Si la procédure n\'est pas adaptée au symptôme réel, ne l\'appliquez pas mécaniquement et passez à Christophe.
`;
}

app.get("/", async () => ({
  status: "ok",
  service: "Tom PC Froid Voice",
}));
 
app.all("/incoming-call", async (request, reply) => {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const callerPhone = xmlEscape(request.body?.From || "");
  const calledPhone = xmlEscape(request.body?.To || "");
 
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="4"/>
  <Connect>
    <Stream url="wss://${host}/media-stream">
      <Parameter name="callerPhone" value="${callerPhone}" />
      <Parameter name="calledPhone" value="${calledPhone}" />
    </Stream>
  </Connect>
  <Hangup/>
</Response>`;
 
  reply.type("text/xml").send(twiml);
});
 
app.get("/media-stream", { websocket: true }, (socket) => {
  const state = {
    streamSid: null,
    callSid: null,
    callerPhone: null,
    calledPhone: null,
    openAiSocketReady: false,
    sessionUpdateSent: false,
    openAiReady: false,
    greetingSent: false,
    greetingText: null,
    greetingResponseId: null,
    greetingAttempts: 0,
    greetingAudioChunks: 0,
    greetingAudioBytesApprox: 0,
    greetingPlaybackMark: null,
    greetingPlaybackFallback: null,
    conversationModeEnabled: false,
    phase: "boot",
   flowStage: "need",
    assistantSpeaking: false,
    responseActive: false,
    pendingConversationResponse: false,
    // V2.6 : le serveur ne met plus en file une réponse pendant que Tom parle.
    // Une nouvelle réponse ne part qu’après une transcription client terminée.
    lastCallerTranscriptAt: 0,
    lastCallerMessage: null,
    lastConversationResponseAt: 0,
    responseHadAudio: false,
    playbackMark: null,
    n8nLoading: false,
    n8nLoaded: false,
    n8nAttempts: 0,
    identityKnown: false,
    identityName: null,
    awaitingIdentity: false,
    identityRecoveryNeeded: false,
    resumeClosingAfterIdentity: false,
    callerRequestedEnd: false,
    customerStatus: null,
    awaitingCustomerStatus: false,
    awaitingCity: false,
    interventionCity: null,
    cityZoneStatus: null,
   qualificationQuestionCount: 0,
   knownCustomerAddress: null,
interventionAddress: null,
callbackPhone: null,
    finalQuestionAsked: false,
    closingStarted: false,
    explicitEquipment: null,
    outOfCompetenceFlow: false,
    pendingHangup: false,
    hangupMark: null,
   closingStarted: false,
    hangupFallback: null,
    closed: false,
  };
 
  const openAiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(REALTIME_MODEL)}`,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  );
 
  function sendToOpenAI(payload) {
    if (openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }
 
  function sendToTwilio(payload) {
    if (socket.readyState === WebSocket.OPEN && state.streamSid) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }
 
  function addSystemContext(text) {
    sendToOpenAI({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text }],
      },
    });
  }
 
  function updateTurnDetection({ createResponse, interruptResponse }) {
    return sendToOpenAI({
      type: "session.update",
      session: {
        type: "realtime",
        audio: {
          input: {
            turn_detection: {
              type: "server_vad",
              threshold: VAD_THRESHOLD,
              prefix_padding_ms: VAD_PREFIX_MS,
              silence_duration_ms: VAD_SILENCE_MS,
              create_response: createResponse,
              interrupt_response: interruptResponse,
            },
          },
        },
      },
    });
  }
 
  function enableConversationMode(reason = "greeting-finished") {
    if (state.conversationModeEnabled || state.closed) return;
 
    state.conversationModeEnabled = true;
    state.phase = "conversation";
 
    // V2.6 : le VAD détecte toujours les tours de parole, mais il ne crée
    // PLUS lui-même les réponses. Le serveur déclenche response.create
    // après la transcription, uniquement si aucune réponse n'est active.
    // Cela supprime les erreurs conversation_already_has_active_response.
    updateTurnDetection({
      createResponse: false,
      interruptResponse: false,
    });
 
    app.log.info({ reason }, "Mode conversation activé");
  }
 
  function scheduleGreetingPlaybackMark() {
    if (!state.streamSid || state.greetingPlaybackMark || state.closed) return;
 
    // En V2.3, on n'active JAMAIS la conversation sur un accueil sans audio.
    // On attend un vrai audio OpenAI, puis la confirmation de lecture Twilio.
    if (!state.responseHadAudio) {
      app.log.warn(
        {
          greetingResponseId: state.greetingResponseId,
          chunks: state.greetingAudioChunks,
        },
        "Accueil terminé sans audio : aucun passage en mode conversation"
      );
      return;
    }
 
    const markName = `greeting-${Date.now()}`;
    state.greetingPlaybackMark = markName;
    state.phase = "greeting-playback";
 
    sendToTwilio({
      event: "mark",
      streamSid: state.streamSid,
      mark: { name: markName },
    });
 
    app.log.info(
      {
        markName,
        chunks: state.greetingAudioChunks,
        approxBase64Chars: state.greetingAudioBytesApprox,
      },
      "Mark de fin d'accueil envoyé à Twilio"
    );
 
    // Le mark Twilio est la source de vérité de fin de lecture.
    // On laisse une marge large uniquement pour éviter un appel bloqué à vie.
    state.greetingPlaybackFallback = setTimeout(() => {
      if (state.greetingPlaybackMark === markName && !state.closed) {
        app.log.error(
          { markName },
          "Mark accueil non confirmé par Twilio après 10 s"
        );
        state.greetingPlaybackMark = null;
        enableConversationMode("greeting-mark-timeout-10s");
      }
    }, 10000);
  }
 
  function sendGreetingResponse({ retry = false } = {}) {
    if (state.closed || !state.openAiReady || !state.streamSid) return false;
 
    if (!state.greetingText) {
      state.greetingText = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    }
 
    state.greetingAttempts += 1;
    state.phase = "greeting-generating";
    state.responseHadAudio = false;
    state.greetingAudioChunks = 0;
    state.greetingAudioBytesApprox = 0;
    state.greetingResponseId = null;
 
    app.log.info(
      {
        greeting: state.greetingText,
        attempt: state.greetingAttempts,
        retry,
      },
      retry ? "Nouvelle tentative d'accueil" : "Envoi de l'accueil unique"
    );
 
    return sendToOpenAI({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: `Dites exactement et uniquement : "${state.greetingText}" Prononcez toujours "P C Froid" comme "pé cé froi", avec le D final de "froid" totalement muet. Ne dites jamais "PC froide". Puis arrêtez-vous. N'ajoutez aucune deuxième formule d'accueil, aucune reformulation et aucune question sur un équipement précis.`,
      },
    });
  }
 
  function maybeSendGreeting() {
    if (
      state.greetingSent ||
      !state.openAiReady ||
      !state.streamSid ||
      state.closed
    ) {
      return;
    }
 
    state.greetingSent = true;
 
    // Le VAD est DÉJÀ configuré avec create_response=false dans la session initiale.
    // Ne surtout pas envoyer un second session.update juste avant response.create :
    // cela créait une course entre configuration et génération de l'accueil.
    addSystemContext(
      state.identityKnown
        ? `IDENTITÉ APPELANT : confirmée (${state.identityName || "contact connu"}). Ne redemandez pas son identité.`
        : "IDENTITÉ APPELANT : non confirmée. Avant toute fin d'appel, demandez le nom et le prénom une seule fois."
    );
 
    sendGreetingResponse();
  }
 
  function maybeConfigureOpenAISession() {
    if (
      state.closed ||
      state.sessionUpdateSent ||
      !state.openAiSocketReady ||
      !state.streamSid
    ) {
      return;
    }
 
    state.sessionUpdateSent = true;
 
    app.log.info(
      { streamSid: state.streamSid },
      "Twilio prêt + OpenAI WebSocket prêt : configuration Realtime"
    );
 
    sendToOpenAI({
      type: "session.update",
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        output_modalities: ["audio"],
        max_output_tokens: MAX_OUTPUT_TOKENS,
        instructions: SYSTEM_PROMPT,
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            noise_reduction: { type: "near_field" },
            transcription: {
              model: TRANSCRIBE_MODEL,
              language: "fr",
            },
            turn_detection: {
              type: "server_vad",
              threshold: VAD_THRESHOLD,
              prefix_padding_ms: VAD_PREFIX_MS,
              silence_duration_ms: VAD_SILENCE_MS,
              create_response: false,
              interrupt_response: false,
            },
          },
          output: {
            format: { type: "audio/pcmu" },
            voice: "verse",
            speed: 1.10,
          },
        },
      },
    });
  }
 
  function setIdentityKnown(name, source = "conversation") {
    if (!name || state.identityKnown) return;
 
    state.identityKnown = true;
    state.identityName = name;
    state.awaitingIdentity = false;
    state.identityRecoveryNeeded = false;
   if (state.customerStatus === "new") {
  setFlowStage(
    "city",
    "identité confirmée pour nouveau client"
  );
} else if (state.customerStatus === "existing") {
  setFlowStage(
    "qualification",
    "identité confirmée pour client existant"
  );
}
 
    addSystemContext(
      `IDENTITÉ APPELANT CONFIRMÉE : ${name}. Ne redemande plus l'identité pendant cet appel.`
    );
 
    app.log.info({ source, name }, "Identité client confirmée");
 
    if (state.callerRequestedEnd || state.resumeClosingAfterIdentity) {
      setTimeout(() => forceShortClosingResponse(), 80);
    }
  }
 
  async function loadN8nContext(callerMessage) {
    if (state.n8nLoaded || state.n8nLoading) return;
    if (state.n8nAttempts >= 2) return;
    if (!isUsefulCallerMessage(callerMessage)) return;
 
    state.n8nLoading = true;
    state.n8nAttempts += 1;
 
    try {
      app.log.info(
        {
          callerMessage,
          callerPhone: maskPhone(state.callerPhone),
          attempt: state.n8nAttempts,
        },
        "Envoi de la demande au cerveau n8n"
      );
 
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caller_message: callerMessage,
          caller_phone: state.callerPhone,
          phone: state.callerPhone,
          call_sid: state.callSid,
          equipment_hint: state.explicitEquipment,
        }),
      });
 
      if (!response.ok) {
        throw new Error(`n8n HTTP ${response.status}`);
      }
 
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error("Réponse n8n vide");
      }
 
      let context;
      try {
        context = JSON.parse(responseText);
      } catch {
        throw new Error("Réponse n8n non JSON");
      }
 
      const businessContext = buildBusinessContext(context, state.explicitEquipment);
      addSystemContext(businessContext);
      state.n8nLoaded = true;
 
      // Si n8n/Supabase renvoie un dossier client confirmé, on injecte aussi l’identité.
     const customerContext = extractCustomerContext(context);

if (customerContext.known) {
  addSystemContext(
    "Le numéro appelant correspond à un dossier connu, mais cela ne confirme ni le statut client déclaré pendant cet appel ni l’identité de la personne. Respectez strictement le parcours en cours. Ne changez pas automatiquement le statut client et ne considérez pas automatiquement le nom du dossier comme l’identité de l’appelant."
  );
}
 
      app.log.info(
        {
          category: context.routing?.category,
          urgency: context.routing?.urgency,
        },
        "Contexte n8n injecté dans Tom"
      );
    } catch (error) {
      app.log.error(error, "Erreur récupération contexte n8n");
    } finally {
      state.n8nLoading = false;
    }
  }

  function setFlowStage(nextStage, reason = "") {
  if (!nextStage || state.flowStage === nextStage) return;

  const previousStage = state.flowStage;
  state.flowStage = nextStage;

  app.log.info(
    {
      previousStage,
      nextStage,
      reason,
    },
    "Étape du parcours Tom mise à jour"
  );
}
  function getFlowLockResponse() {
    if (
      state.outOfCompetenceFlow ||
      isPersonalQuestionMessage(state.lastCallerMessage || "")
    ) {
      return null;
    }

    if (state.customerStatus === null) {
     setFlowStage("customer_status", "statut client requis");
     
      return {
        stage: "customer-status",
        instructions:
          'Respectez impérativement le parcours PC Froid. Si le client demande explicitement si PC Froid réalise ce service, répondez clairement en une phrase courte, sans inventer. Sinon, ne reformulez pas le symptôme. Ne posez aucune question technique. La seule question autorisée ensuite est exactement : "Est-ce que vous êtes déjà client chez P C Froid ?" Puis arrêtez-vous et attendez la réponse.',
      };
    }

    if (state.customerStatus === "existing" && !state.identityKnown) {
     setFlowStage("identity", "identité client existant requise");
     
      return {
        stage: "existing-identity",
        instructions:
          'Client PC Froid existant. Ne posez aucune question technique pour le moment. Demandez exactement et uniquement : "À quel nom est le dossier ?" Puis arrêtez-vous et attendez la réponse.',
      };
    }

    if (state.customerStatus === "new" && !state.identityKnown) {
     setFlowStage("identity", "identité nouveau client requise");
     
      return {
        stage: "new-identity",
        instructions:
          'Nouveau client. Ne posez aucune question technique pour le moment. Demandez exactement et uniquement : "Pouvez-vous me donner votre prénom et votre nom, s’il vous plaît ?" Puis arrêtez-vous et attendez la réponse.',
      };
    }

    if (
      state.customerStatus === "new" &&
      state.identityKnown &&
      !state.interventionCity
    ) {
     setFlowStage("city", "ville nouveau client requise");
     
      return {
        stage: "new-city",
       instructions:
  'DITES EXACTEMENT ET UNIQUEMENT CETTE PHRASE, SANS AUCUN MOT AVANT NI APRÈS : "Dans quelle ville se trouve l’installation ?" Ne répondez à aucun autre sujet dans ce tour. Arrêtez-vous immédiatement après la question et attendez la réponse.',
      };
    }
       if (
  ["need", "customer_status", "identity", "city", "qualification"].includes(
    state.flowStage
  ) &&
  state.identityKnown &&
  (
        state.customerStatus === "existing" ||
        (
          state.customerStatus === "new" &&
          state.interventionCity &&
          state.cityZoneStatus !== "out"
        )
      )
    ) {
      setFlowStage("qualification", "coordonnées préalables validées");
    }

  if (state.flowStage === "qualification") {
  const maxQualificationQuestions =
    state.explicitEquipment === "chambre froide" ? 4 : 2;

  if (state.qualificationQuestionCount >= maxQualificationQuestions) {
    setFlowStage(
      "address",
      "nombre maximal de questions de qualification atteint"
    );

    return {
      stage: "address",
      instructions:
        "La qualification est terminée. Ne posez plus aucune question technique. Passez maintenant à l’adresse d’intervention. Pour un client existant dont une adresse habituelle est connue dans le contexte, demandez si l’intervention est à la même adresse que d’habitude. Sinon, demandez uniquement l’adresse d’intervention. Une seule question puis attendez la réponse.",
    };
  }

  if (state.explicitEquipment === "climatisation") {
    return {
      stage: "qualification-climatisation",
      instructions:
        "Pour une climatisation ou un gainable, posez UNE SEULE question technique courte à la fois. Maximum deux questions au total. Demandez uniquement ce que le client constate simplement : le symptôme, depuis quand, si l’appareil démarre, ou s’il affiche un voyant ou un code d’erreur. Ne demandez aucune manipulation, aucun démontage et aucune vérification de l’installation électrique, du tableau ou des disjoncteurs. Ne faites pas de diagnostic.",
    };
  }
}

   if (
  state.flowStage === "address" &&
  !state.interventionAddress
) {
    
  return {
    stage: "address",
    instructions: state.knownCustomerAddress
      ? 'Ne posez plus aucune question technique. Demandez exactement et uniquement : "Est-ce que l’intervention est à la même adresse que d’habitude ?" Puis arrêtez-vous et attendez la réponse.'
      : "Ne posez plus aucune question technique. Demandez uniquement l’adresse complète d’intervention. Une seule question puis attendez la réponse.",
  };
}
   if (state.flowStage === "callback") {
  return {
    stage: "callback",
    instructions:
      'Ne posez plus aucune question technique. Demandez exactement et uniquement : "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Puis arrêtez-vous et attendez la réponse.',
  };
}

  if (state.flowStage === "callback_number") {
  return {
    stage: "callback-number",
    instructions:
      'Demandez exactement et uniquement : "Quel numéro je note pour vous rappeler ?" Puis arrêtez-vous et attendez la réponse. Ne répétez aucun numéro inventé.',
  };
}

if (state.flowStage === "final_question") {
  return {
    stage: "final-question",
    instructions:
      'Demandez exactement et uniquement : "Est-ce que vous avez une autre question ou quelque chose à ajouter avant que je transmette votre demande ?" Puis arrêtez-vous et attendez la réponse. Ne posez cette question qu’une seule fois.',
  };
}

   if (state.flowStage === "closing") {
  return {
    stage: "closing",
    instructions:
      'Si l’appelant vient de poser une dernière question, répondez-y brièvement et clairement. Ensuite clôturez une seule fois en indiquant que la demande va être transmise à l’équipe, puis souhaitez une bonne journée. Ne posez plus aucune question.',
  };
}
   
return null;
   }
 
  function requestConversationResponse(reason = "caller-turn") {
    if (state.closed || !state.conversationModeEnabled) return false;
   if (state.closingStarted) {
  app.log.info(
    { reason },
    "Réponse ignorée : clôture déjà commencée"
  );
  return false;
}
 
    // V2.6 : si Tom parle encore, on ne programme PAS une seconde réponse.
    // Cela évite l’effet « Tom pose la question puis se répond tout seul ».
    if (state.responseActive || state.assistantSpeaking) {
  state.pendingConversationResponse = true;
  app.log.info(
    { reason },
    "Tour client reçu pendant une réponse active - réponse mise en attente"
  );
  return false;
}

    const flowLock = getFlowLockResponse();

    if (flowLock?.stage === "customer-status") {
      state.awaitingCustomerStatus = true;
    } else if (
      flowLock?.stage === "existing-identity" ||
      flowLock?.stage === "new-identity"
    ) {
      state.awaitingIdentity = true;
    } else if (flowLock?.stage === "new-city") {
      state.awaitingCity = true;
    }
 
    // Une seule réponse contrôlée par transcription client terminée.
    state.lastConversationResponseAt = Date.now();
app.log.info(
  {
    reason,
    flowStage: state.flowStage,
    flowLockStage: flowLock?.stage || null,
  },
  "Création contrôlée d'une réponse conversationnelle - V2.10 FLOW LOCK"
);
    return sendToOpenAI({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        ...(flowLock?.instructions
          ? { instructions: flowLock.instructions }
          : {}),
      },
    });
  }
 
  function requestIdentityRecovery() {
    if (state.identityKnown || state.awaitingIdentity) return;
 
    state.awaitingIdentity = true;
    state.resumeClosingAfterIdentity = true;
 
    const delay = state.responseActive ? 100 : 0;
    if (state.responseActive) cancelActiveResponse();
 
    setTimeout(() => {
      if (state.responseActive) {
        sendToOpenAI({ type: "response.cancel" });
        clearAssistantAudio();
      }
 
      sendToOpenAI({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions:
            'Ne terminez pas encore l’appel. Demandez exactement et uniquement : "Avant de terminer, pouvez-vous me donner votre nom et votre prénom ?" Puis attendez la réponse.',
        },
      });
    }, delay);
  }
 
  function clearAssistantAudio() {
    if (!state.streamSid) return;
 
    sendToTwilio({ event: "clear", streamSid: state.streamSid });
    state.playbackMark = null;
    state.responseHadAudio = false;
    state.assistantSpeaking = false;
  }
 
  function cancelActiveResponse() {
    if (state.responseActive) {
      sendToOpenAI({ type: "response.cancel" });
    }
    clearAssistantAudio();
  }
 
  function forceShortClosingResponse() {
   if (state.closingStarted) {
  app.log.info("Clôture déjà lancée : aucune deuxième formule de fin");
  return;
}
   if (state.flowStage === "callback_number") {
  const callbackPhoneCandidate = callerMessage.replace(/[^\d+]/g, "");
  const callbackPhoneDigits = callbackPhoneCandidate.replace(/\D/g, "");

  if (callbackPhoneDigits.length >= 10) {
    state.callbackPhone = callbackPhoneCandidate;

    setFlowStage(
      "final_question",
      "autre numéro de rappel enregistré"
    );
  } else {
    addSystemContext(
      "Le numéro de rappel n’a pas été suffisamment clair. Demandez uniquement au client de répéter son numéro de téléphone, sans inventer ni compléter de chiffres."
    );
  }
}
   
    if (!state.identityKnown) {
      requestIdentityRecovery();
      return;
    }
 
    state.callerRequestedEnd = true;
    state.closingStarted = true;
    state.conversationModeEnabled = false;
    state.pendingHangup = false;
    state.resumeClosingAfterIdentity = false;
    cancelActiveResponse();
 
    // Petit délai pour laisser la cancellation être prise en compte avant la réponse finale.
    setTimeout(() => {
      sendToOpenAI({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions:
            'Répondez exactement et uniquement : "Au revoir, bonne journée." Ne faites aucun résumé et ne posez aucune question.',
        },
      });
    }, 80);
  }
 
  function sendOutOfSectorClosing(city) {
    if (state.closed || state.closingStarted) return false;

    const safeCity = String(city || "cette ville").trim() || "cette ville";

    state.callerRequestedEnd = true;
    state.closingStarted = true;
    state.conversationModeEnabled = false;
    state.pendingConversationResponse = false;
    state.pendingHangup = false;

    if (state.responseActive) {
      cancelActiveResponse();
    }

    app.log.info(
      { city: safeCity, customerStatus: state.customerStatus },
      "Nouveau client hors secteur : clôture déterministe"
    );

    setTimeout(() => {
      sendToOpenAI({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions:
            `Dites exactement et uniquement : "D'accord, ${safeCity}. Pour un nouveau client, nous intervenons principalement dans le Vaucluse et les communes limitrophes de notre secteur. ${safeCity} est malheureusement trop éloigné pour que nous prenions en charge cette intervention. Merci de nous avoir appelés. Au revoir, bonne journée." Ne posez aucune autre question.`,
        },
      });
    }, 80);

    return true;
  }

  function schedulePlaybackMark() {
    if (!state.streamSid || !state.responseHadAudio || state.playbackMark) return;
 
    const markName = `playback-${Date.now()}`;
    state.playbackMark = markName;
    state.responseHadAudio = false;
 
    sendToTwilio({
      event: "mark",
      streamSid: state.streamSid,
      mark: { name: markName },
    });
  }
 
  function scheduleHangupAfterPlayback() {
    if (!state.pendingHangup || !state.streamSid || state.hangupMark) return;
 
    const markName = `hangup-${Date.now()}`;
    state.hangupMark = markName;
 
    sendToTwilio({
      event: "mark",
      streamSid: state.streamSid,
      mark: { name: markName },
    });
 
    // Sécurité : si le mark ne revient pas, on ne laisse pas l'appel ouvert indéfiniment.
    state.hangupFallback = setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) {
        app.log.warn("Raccrochage de secours après attente du mark Twilio");
        socket.close(1000, "call-complete");
      }
    }, 20000);
  }
 
  function buildResponseDiagnostics(response) {
    if (!response) return null;
 
    return {
      id: response.id || null,
      status: response.status || null,
      status_details: response.status_details || null,
      conversation_id: response.conversation_id || null,
      max_output_tokens: response.max_output_tokens ?? null,
      output_modalities: response.output_modalities || null,
      voice: response.voice || null,
      output_count: Array.isArray(response.output) ? response.output.length : 0,
      output: Array.isArray(response.output)
        ? response.output.map((item) => ({
            id: item?.id || null,
            type: item?.type || null,
            status: item?.status || null,
            role: item?.role || null,
            content: Array.isArray(item?.content)
              ? item.content.map((part) => ({
                  type: part?.type || null,
                  transcript:
                    typeof part?.transcript === "string"
                      ? part.transcript.slice(0, 250)
                      : null,
                }))
              : [],
          }))
        : [],
      usage: response.usage || null,
    };
  }
 
  openAiWs.on("open", () => {
    state.openAiSocketReady = true;
 
    app.log.info(
      {
        vadThreshold: VAD_THRESHOLD,
        vadSilenceMs: VAD_SILENCE_MS,
        voice: "verse",
        speed: 1.10,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
      "Connexion OpenAI Realtime ouverte - V2.10 FLOW LOCK"
    );
 
    // Important : aucune session Realtime n'est configurée avant le message
    // Twilio `start`. Cela garantit que streamSid existe avant l'accueil.
    maybeConfigureOpenAISession();
  });
 
  openAiWs.on("message", async (raw) => {
    try {
      const event = JSON.parse(raw.toString());
 
      if (event.type === "session.updated") {
        const firstReady = !state.openAiReady;
        state.openAiReady = true;
 
        app.log.info(
          { firstReady, phase: state.phase },
          "Session OpenAI Realtime mise à jour"
        );
 
        maybeSendGreeting();
      }
 
      if (event.type === "response.created") {
        state.responseActive = true;
 
        if (state.phase === "greeting-generating") {
          state.greetingResponseId = event.response?.id || null;
        }
 
        app.log.info(
          {
            responseId: event.response?.id || null,
            phase: state.phase,
          },
          "Réponse OpenAI créée"
        );
      }
 
      if (
        event.type ===
        "conversation.item.input_audio_transcription.completed"
      ) {
        const callerMessage = event.transcript?.trim();
 
        if (callerMessage) {
          state.lastCallerTranscriptAt = Date.now();
          app.log.info(
            { callerMessage, phase: state.phase },
            "Transcription client reçue"
          );
 
          // Ce qui est capté pendant l'accueil ("allo", bruit, voix au loin)
          // ne doit jamais déclencher une seconde réponse ou un nouvel accueil.
          if (!state.conversationModeEnabled) {
            app.log.info(
              { callerMessage, phase: state.phase },
              state.closingStarted
                ? "Transcription ignorée pendant la clôture"
                : "Transcription ignorée pendant l'accueil"
            );
            return;
          }

          if (state.closingStarted || state.pendingHangup || state.hangupMark) {
            app.log.info({ callerMessage }, "Transcription ignorée : clôture déjà engagée");
            return;
          }

          state.lastCallerMessage = callerMessage;

          if (isClearlyOutOfCompetenceRequest(callerMessage)) {
            state.outOfCompetenceFlow = true;
          }
 
          const detectedEquipment = detectExplicitEquipment(callerMessage);
          if (detectedEquipment && state.explicitEquipment !== detectedEquipment) {
            state.explicitEquipment = detectedEquipment;
            if (!isClearlyOutOfCompetenceRequest(callerMessage)) {
              state.outOfCompetenceFlow = false;
            }
            addSystemContext(
              `ÉQUIPEMENT EXPLICITEMENT CITÉ PAR LE CLIENT : ${detectedEquipment}. Restez sur cet équipement. Ne le remplacez pas par une climatisation ou un autre appareil sans que le client ne change clairement de sujet.`
            );
            app.log.info(
              { equipment: detectedEquipment },
              "Équipement explicite verrouillé"
            );
          }
 
         if (callerIsClosing(callerMessage)) {
  state.callerRequestedEnd = true;

  app.log.info(
    { callerMessage },
    "Le client souhaite terminer l'appel"
  );

  // Si le client veut partir, on ne lui impose jamais
  // une prise d'identité ou une nouvelle question.
  if (state.identityKnown) {
    forceShortClosingResponse();
  } else {
    state.closingStarted = true;
    state.conversationModeEnabled = false;
    state.pendingHangup = false;

    cancelActiveResponse();

    setTimeout(() => {
      sendToOpenAI({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions:
            'Répondez exactement et uniquement : "Merci de nous avoir appelés. Au revoir, bonne journée." Ne posez aucune question et ne demandez pas l’identité.'
        }
      });
    }, 80);
  }

  return;
}
 
          // V2.9 : statut client explicite, indépendant du raisonnement du modèle.
         if (state.flowStage === "customer_status") {
            const customerStatus = extractCustomerStatusAnswer(callerMessage);
            if (customerStatus) {
              state.customerStatus = customerStatus;
              state.awaitingCustomerStatus = false;
             if (state.identityKnown) {
  setFlowStage(
    customerStatus === "new" ? "city" : "qualification",
    "statut client confirmé avec identité déjà connue"
  );
} else {
  setFlowStage(
    "identity",
    "statut client confirmé, identité requise"
  );
}

              addSystemContext(
                customerStatus === "existing"
                  ? "STATUT CLIENT CONFIRMÉ PAR L'APPELANT : client PC Froid existant. Ne bloquez jamais cet appel sur la zone géographique."
                  : "STATUT CLIENT CONFIRMÉ PAR L'APPELANT : nouveau client. La ville doit être contrôlée avant de poursuivre inutilement une demande hors secteur."
              );

              app.log.info(
                { customerStatus },
                "Statut client confirmé par l'appelant"
              );
            }
          }

          // V2.9 : une ville demandée ou corrigée vient de la transcription client.
          // Une correction remplace immédiatement l'ancienne ville.
          if (state.flowStage === "city" || callerCorrectsCity(callerMessage)) {
            const cityCandidate = extractCityCandidate(callerMessage);

            if (cityCandidate) {
              const previousCity = state.interventionCity;
              const isCorrection =
                callerCorrectsCity(callerMessage) ||
                (previousCity &&
                  normalizeCityKey(previousCity) !== normalizeCityKey(cityCandidate));

              state.interventionCity = cityCandidate;
              state.awaitingCity = false;
              state.cityZoneStatus = classifyServiceArea(cityCandidate);

              if (isCorrection && previousCity) {
                addSystemContext(
                  `CORRECTION DE VILLE : ignorez définitivement l'ancienne ville « ${previousCity} ». La seule ville correcte est maintenant « ${cityCandidate} ». Ne demandez pas au client de choisir entre les deux.`
                );
              }

              if (state.customerStatus === "existing") {
                addSystemContext(
                  `VILLE D'INTERVENTION : ${cityCandidate}. CLIENT EXISTANT : ne faites aucun refus automatique lié au secteur.`
                );
              } else if (state.customerStatus === "new") {
                if (state.cityZoneStatus === "in") {
                  addSystemContext(
                    `ZONE CONFIRMÉE : ${cityCandidate} est dans le secteur accepté pour un nouveau client. Poursuivez normalement.`
                  );
                } else if (state.cityZoneStatus === "out") {
                  addSystemContext(
                    `HORS SECTEUR : ${cityCandidate} est clairement hors secteur pour un nouveau client. Ne demandez ni adresse complète ni numéro de rappel et ne transmettez pas cette intervention à Christophe.`
                  );
                  sendOutOfSectorClosing(cityCandidate);
                  return;
                } else {
                  addSystemContext(
                    `ZONE À VÉRIFIER : la ville indiquée est « ${cityCandidate} ». Ne l'inventez pas et ne la remplacez pas. Le serveur ne peut pas confirmer automatiquement la zone : indiquez seulement que Christophe vérifiera si l'intervention est possible.`
                  );
                }
              } else {
                addSystemContext(
                  `VILLE D'INTERVENTION ENTENDUE : ${cityCandidate}. Le statut client n'est pas encore confirmé : ne refusez pas sur la zone avant de savoir si la personne est déjà cliente PC Froid.`
                );
              }

             if (
  state.flowStage === "city" &&
  state.customerStatus === "new" &&
  state.cityZoneStatus !== "out"
) {
  setFlowStage(
    "qualification",
    "ville nouveau client enregistrée"
  );
}
              app.log.info(
                {
                  city: cityCandidate,
                  previousCity,
                  zone: state.cityZoneStatus,
                  customerStatus: state.customerStatus,
                  corrected: Boolean(isCorrection),
                },
                "Ville d'intervention enregistrée - V2.9"
              );
            }
          }

         if (state.flowStage === "address") {
  const normalizedAddressAnswer = normalizeText(callerMessage);

  if (
    state.knownCustomerAddress &&
    (normalizedAddressAnswer === "oui" ||
      normalizedAddressAnswer.startsWith("oui "))
  ) {
    state.interventionAddress = state.knownCustomerAddress;

    setFlowStage(
      "callback",
      "adresse habituelle confirmée"
    );
  } else if (
    state.knownCustomerAddress &&
    (normalizedAddressAnswer === "non" ||
      normalizedAddressAnswer.startsWith("non "))
  ) {
    state.knownCustomerAddress = null;

    addSystemContext(
      "L’appelant a indiqué que l’intervention n’est pas à son adresse habituelle. Demandez uniquement la nouvelle adresse d’intervention."
    );
  } else if (!state.knownCustomerAddress) {
    state.interventionAddress = callerMessage;

    setFlowStage(
      "callback",
      "adresse d’intervention enregistrée"
    );

    addSystemContext(
      `ADRESSE D'INTERVENTION FOURNIE PAR L'APPELANT : ${callerMessage}. Ne modifiez aucun numéro et ne réinventez pas l'adresse.`
    );
  }
}
         if (state.flowStage === "callback") {
  const normalizedCallbackAnswer = normalizeText(callerMessage);

  if (
    normalizedCallbackAnswer === "oui" ||
    normalizedCallbackAnswer.startsWith("oui ")
  ) {
    state.callbackPhone = state.callerPhone;

    setFlowStage(
      "final_question",
      "numéro appelant confirmé pour rappel"
    );
  } else if (
    normalizedCallbackAnswer === "non" ||
    normalizedCallbackAnswer.startsWith("non ")
  ) {
    setFlowStage(
      "callback_number",
      "autre numéro de rappel demandé"
    );
  }
}

         if (state.flowStage === "callback_number") {
  const callbackPhoneCandidate = callerMessage.replace(/[^\d+]/g, "");
  const callbackPhoneDigits = callbackPhoneCandidate.replace(/\D/g, "");

  if (callbackPhoneDigits.length >= 10) {
    state.callbackPhone = callbackPhoneCandidate;

    setFlowStage(
      "final_question",
      "autre numéro de rappel enregistré"
    );
  } else {
    addSystemContext(
      "Le numéro de rappel n’a pas été suffisamment clair. Demandez uniquement au client de répéter son numéro de téléphone, sans inventer ni compléter de chiffres."
    );
  }
}
         
         if (
  state.flowStage === "final_question" &&
  state.finalQuestionAsked
) {
  setFlowStage(
    "closing",
    "réponse reçue après la question finale"
  );
}
         
          if (!state.identityKnown) {
            let detectedName = null;

            // Si Tom vient de demander l’identité, une réponse nominale courte suffit.
           if (state.flowStage === "identity") {
              detectedName = extractDirectIdentityAnswer(callerMessage);
            }

            // Sinon, on détecte aussi une présentation spontanée :
            // « C’est Alex Rangoni », « Monsieur Garnier à Sarrians », etc.
            if (!detectedName) {
              detectedName = extractNameCandidate(callerMessage);
            }

            if (detectedName) {
             setIdentityKnown(
  detectedName,
  state.flowStage === "identity" ? "question-identité" : "volontaire"
);
            } else if (state.flowStage === "identity") {
              app.log.info(
                { callerMessage },
                "Réponse reçue mais identité non validée"
              );
            }
          }
 
          // Au tout début, ne répondez pas à un simple fragment de prise de parole
          // comme « oui bonjour » ou « je vous appelle... ». Attendez la demande réelle.
          // Contrairement à l'ancienne temporisation de 3 secondes sur /incoming-call,
          // ce filtre ne retarde pas le décrochage : il agit seulement sur les fragments transcrits.
          if (
            state.lastConversationResponseAt === 0 &&
            isInitialFragmentMessage(callerMessage)
          ) {
            app.log.info(
              { callerMessage },
              "Petit fragment initial ignoré - attente de la demande réelle"
            );
            return;
          }

         // Au tout début de la conversation, ignorer les petits fragments
// comme « oui bonjour », « allo », « je vous appelle... ».
// Tom attend la vraie demande avant de répondre.
if (
  state.lastConversationResponseAt === 0 &&
  !isUsefulCallerMessage(callerMessage)
) {
  app.log.info(
    { callerMessage },
    "Petit fragment initial ignoré - attente de la demande réelle"
  );
  return;
}
         
          await loadN8nContext(callerMessage);
          requestConversationResponse("transcription-completed");
        }
      }
 
      if (event.type === "response.output_audio.delta") {
        state.assistantSpeaking = true;
        state.responseHadAudio = true;
 
        if (
          state.phase === "greeting-generating" ||
          state.phase === "greeting-playback"
        ) {
          state.greetingAudioChunks += 1;
          state.greetingAudioBytesApprox += event.delta?.length || 0;
 
          if (state.greetingAudioChunks === 1) {
            app.log.info(
              {
                responseId: event.response_id || state.greetingResponseId,
              },
              "Premier paquet audio d'accueil reçu d'OpenAI"
            );
          }
        }
 
        if (state.streamSid && socket.readyState === WebSocket.OPEN) {
          sendToTwilio({
            event: "media",
            streamSid: state.streamSid,
            media: { payload: event.delta },
          });
        }
      }
 
      if (event.type === "response.output_audio.done") {
        app.log.info(
          {
            responseId: event.response_id || null,
            phase: state.phase,
            chunks: state.greetingAudioChunks,
            hadAudio: state.responseHadAudio,
          },
          "Flux audio OpenAI terminé"
        );
 
        if (
          state.phase === "greeting-generating" ||
          state.phase === "greeting-playback"
        ) {
          scheduleGreetingPlaybackMark();
        }

     else {
  // La génération audio de Tom est terminée.
  // On place immédiatement un mark Twilio pour savoir
  // quand la lecture réelle dans le téléphone est finie.
  state.assistantSpeaking = false;
  schedulePlaybackMark();

  app.log.info(
    {
      pendingConversationResponse: state.pendingConversationResponse,
      responseActive: state.responseActive,
      playbackMark: state.playbackMark,
    },
    "Audio conversation terminé - attente fin lecture Twilio"
  );
}
     }
   
      if (event.type === "response.output_audio_transcript.done") {
        const assistantText = event.transcript?.trim() || "";
       if (
  state.flowStage === "qualification" &&
  assistantText.includes("?")
) {
  state.qualificationQuestionCount += 1;

  app.log.info(
    {
      qualificationQuestionCount: state.qualificationQuestionCount,
      assistantText,
    },
    "Question de qualification comptabilisée"
  );
}
 
        if (assistantAskedForIdentity(assistantText)) {
          state.awaitingIdentity = true;
        }

        if (assistantAskedForCustomerStatus(assistantText)) {
          state.awaitingCustomerStatus = true;
        }

        if (assistantAskedForCity(assistantText)) {
          state.awaitingCity = true;
        }

        if (assistantAskedFinalQuestion(assistantText) && !state.finalQuestionAsked) {
          state.finalQuestionAsked = true;
          addSystemContext(
            "QUESTION FINALE DÉJÀ POSÉE : ne la reposez plus pendant cet appel. Si le client pose maintenant une question, répondez-y puis poursuivez directement les étapes de fin encore manquantes et clôturez."
          );
          app.log.info("Question finale marquée comme déjà posée");
        }
 
       if (assistantIsClosing(assistantText)) {
  if (state.identityKnown || state.callerRequestedEnd) {
    state.closingStarted = true;
    state.conversationModeEnabled = false;
    state.pendingHangup = true;
    state.identityRecoveryNeeded = false;

    app.log.info(
      { assistantText },
      "Fin d'appel détectée ; conversation verrouillée en attente de fin audio"
    );
  } else {
    state.pendingHangup = false;
    state.identityRecoveryNeeded = true;
    app.log.info("Fin refusée : identité client inconnue");
  }
}
 }
     
      if (event.type === "response.done") {
        state.responseActive = false;
        state.assistantSpeaking = false;
 
        const responseDiagnostics = buildResponseDiagnostics(event.response);
 
        app.log.info(
          {
            responseId: event.response?.id || null,
            status: event.response?.status || null,
            statusDetails: event.response?.status_details || null,
            phase: state.phase,
            hadAudio: state.responseHadAudio,
            greetingChunks: state.greetingAudioChunks,
            diagnostics: responseDiagnostics,
          },
          "Réponse OpenAI terminée - V2.10 FLOW LOCK"
        );
 
        if (event.response?.status !== "completed") {
          app.log.warn(
            {
              responseId: event.response?.id || null,
              status: event.response?.status || null,
              statusDetails: event.response?.status_details || null,
              diagnostics: responseDiagnostics,
            },
            "Réponse OpenAI non complétée - REPONSE NON COMPLETE"
          );
        }
 
        // Pour l'accueil, response.done n'active jamais la conversation.
        // La source de vérité est : vrai audio reçu -> output_audio.done -> mark Twilio.
        if (
          state.phase === "greeting-generating" ||
          state.phase === "greeting-playback"
        ) {
          if (!state.responseHadAudio && !state.greetingPlaybackMark) {
            if (state.greetingAttempts < 2 && !state.closed) {
              app.log.warn(
                {
                  status: event.response?.status || null,
                  responseId: event.response?.id || null,
                },
                "Accueil OpenAI sans audio : une seule nouvelle tentative"
              );
 
              setTimeout(() => {
                if (!state.closed && !state.conversationModeEnabled) {
                  sendGreetingResponse({ retry: true });
                }
              }, 350);
            } else {
              app.log.error(
                {
                  status: event.response?.status || null,
                  responseId: event.response?.id || null,
                },
                "Accueil impossible après 2 tentatives : appel laissé ouvert pour diagnostic"
              );
            }
          }
          return;
        }
 
        // Une réponse annulée lors d'un départ client ne doit pas déclencher
        // une ancienne logique de résumé ou de raccrochage.
        if (event.response?.status === "cancelled" && state.callerRequestedEnd) {
          state.responseHadAudio = false;
          return;
        }
       if (
  state.pendingConversationResponse &&
  !state.closed &&
  !state.closingStarted &&
  !state.pendingHangup &&
  !state.callerRequestedEnd &&
  !state.playbackMark
) {
  state.pendingConversationResponse = false;

  setTimeout(() => {
    requestConversationResponse("pending-after-response-done");
  }, 80);

  return;
}
 
        // V2.6 : aucune réponse différée automatique après response.done.
        // Tom attend obligatoirement une nouvelle transcription client terminée.
 
        if (state.identityRecoveryNeeded && !state.identityKnown) {
          state.identityRecoveryNeeded = false;
          requestIdentityRecovery();
        } else if (state.pendingHangup && state.identityKnown) {
          scheduleHangupAfterPlayback();
        } else {
          schedulePlaybackMark();
        }
      }
 
      if (event.type === "error") {
        app.log.error(
          {
            openaiError: event,
            errorType: event.error?.type || null,
            errorCode: event.error?.code || null,
            errorMessage: event.error?.message || null,
            errorParam: event.error?.param || null,
            eventId: event.event_id || null,
            phase: state.phase,
          },
          "Erreur OpenAI Realtime - V2.10 FLOW LOCK"
        );
      }
    } catch (error) {
      app.log.error(error, "Erreur traitement message OpenAI");
    }
  });
 
  openAiWs.on("close", () => {
    app.log.info("Connexion OpenAI Realtime fermée");
 
    if (!state.closed && socket.readyState === WebSocket.OPEN) {
      socket.close(1011, "openai-closed");
    }
  });
 
  openAiWs.on("error", (error) => {
    app.log.error(error, "Erreur WebSocket OpenAI");
  });
 
  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
 
      switch (message.event) {
        case "start": {
          state.streamSid = message.start.streamSid;
          state.callSid = message.start.callSid || null;
          state.callerPhone =
            message.start.customParameters?.callerPhone || null;
          state.calledPhone =
            message.start.customParameters?.calledPhone || null;
 
          app.log.info(
            {
              streamSid: state.streamSid,
              callSid: state.callSid,
              callerPhone: maskPhone(state.callerPhone),
            },
            "Flux Twilio démarré"
          );
 
          maybeConfigureOpenAISession();
          break;
        }
 
        case "media":
          sendToOpenAI({
            type: "input_audio_buffer.append",
            audio: message.media.payload,
          });
          break;
 
        case "mark":
          if (message.mark?.name === state.greetingPlaybackMark) {
            if (state.greetingPlaybackFallback) {
              clearTimeout(state.greetingPlaybackFallback);
              state.greetingPlaybackFallback = null;
            }
 
            state.greetingPlaybackMark = null;
            state.responseHadAudio = false;
            state.greetingAudioChunks = 0;
            state.greetingAudioBytesApprox = 0;
            app.log.info("Accueil entièrement joué par Twilio");
           state.responseActive = false;
state.assistantSpeaking = false;
state.pendingConversationResponse = false;
            enableConversationMode("greeting-mark-confirmed");
            break;
          }
 
         if (message.mark?.name === state.playbackMark) {
  state.playbackMark = null;

  if (
  state.pendingConversationResponse &&
  !state.closed &&
  !state.closingStarted &&
  !state.pendingHangup
) {
    state.pendingConversationResponse = false;

    setTimeout(() => {
      requestConversationResponse("pending-after-playback");
    }, 80);
  }
}
 
          if (message.mark?.name === state.hangupMark) {
            if (state.hangupFallback) {
              clearTimeout(state.hangupFallback);
              state.hangupFallback = null;
            }
 
            app.log.info("Fin audio confirmée par Twilio ; raccrochage");
            if (socket.readyState === WebSocket.OPEN) {
              socket.close(1000, "call-complete");
            }
          }
          break;
 
        case "stop":
          app.log.info("Flux Twilio arrêté");
          state.closed = true;
 
          if (openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.close(1000, "twilio-stop");
          }
          break;
 
        default:
          break;
      }
    } catch (error) {
      app.log.error(error, "Erreur traitement message Twilio");
    }
  });
 
  socket.on("close", () => {
    state.closed = true;
    if (state.hangupFallback) clearTimeout(state.hangupFallback);
    if (state.greetingPlaybackFallback) clearTimeout(state.greetingPlaybackFallback);
 
    app.log.info("Connexion Twilio fermée");
 
    if (openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.close(1000, "twilio-closed");
    }
  });
 
  socket.on("error", (error) => {
    app.log.error(error, "Erreur WebSocket Twilio");
  });
});
 
try {
  await app.listen({
    port: PORT,
    host: "0.0.0.0",
  });
 
  app.log.info(`Tom Voice écoute sur le port ${PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
// END TOM V2.10 FLOW LOCK - FICHIER COMPLET
