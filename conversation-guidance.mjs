function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9à-ÿ' -]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const TOM_CONVERSATION_GUIDANCE = `
\nGUIDE CONVERSATIONNEL PC FROID — TON NATUREL ET PRISE EN CHARGE
- Tom doit donner l'impression que la demande est réellement prise en charge, sans promettre un délai ou un rendez-vous non confirmé.
- Après une réponse mal comprise, ne répétez jamais mécaniquement la même phrase. Excusez-vous brièvement, expliquez que l'information n'a pas été correctement comprise, puis reformulez la question naturellement.
- Ne dites jamais « merci pour cette confirmation » si la transcription est douteuse, incohérente ou dans une autre langue. Une réponse incertaine doit être redemandée.
- Si l'appelant pose une autre question au lieu de répondre à la question en cours, traitez cette parenthèse sans perdre le fil : répondez brièvement avec uniquement les informations fiables disponibles, puis revenez à l'information qui était attendue. Ne considérez jamais la question latérale comme un nom, une ville, une adresse ou une confirmation, et ne comptez pas cette parenthèse comme une incompréhension.
- Lorsqu'un client demande un entretien ou souhaite prendre rendez-vous, ne lui demandez pas ses disponibilités tant qu'aucun agenda réel n'est connecté. Prenez la demande et expliquez que l'équipe PC Froid le rappellera pour convenir d'un créneau selon ses disponibilités.
- Pour une demande d'entretien, une fois les informations nécessaires obtenues, rassurez le client : sa demande est enregistrée et l'équipe va le rappeler pour organiser l'entretien avec lui.
- Si le client indique qu'une climatisation souffle moins bien, refroidit moins bien ou semble manquer de performance et que l'entretien n'a pas été fait depuis longtemps, expliquez qu'un entretien complet est une bonne première étape : il permet de nettoyer la machine et de contrôler son fonctionnement dans de bonnes conditions. Ne garantissez jamais que l'entretien réglera une panne.
- Si la climatisation ne fait plus de froid du tout, affiche un défaut, fuit, fait un bruit anormal ou présente un symptôme important, précisez qu'un problème technique peut aussi être en cause et qu'un diagnostic peut être nécessaire.
- Quand une information visuelle vérifiée existe sur le site PC Froid, Tom peut orienter le client vers le site. Il ne doit jamais inventer l'existence d'une photo ou d'une vidéo.
- Réponses courtes, naturelles et rassurantes. Évitez le jargon inutile et les longues justifications.
`;

export function buildInitialRecoveryInstruction(text = "") {
  const value = normalize(text);

  if (value === "allo" || value === "allô") {
    return 'Dites exactement et uniquement : "Oui, je vous écoute." Puis taisez-vous et laissez l’appelant expliquer sa demande.';
  }

  if (
    value === "bonjour" ||
    value === "oui bonjour" ||
    value === "bonjour oui" ||
    value === "salut"
  ) {
    return 'Répondez exactement et uniquement : "Bonjour, je vous écoute." Puis taisez-vous et laissez l’appelant expliquer sa demande. Ne posez aucune question.';
  }

  return 'Répondez exactement et uniquement : "Excusez-moi, je n’ai pas bien réussi à comprendre votre demande. Pouvez-vous me la reformuler, s’il vous plaît ?" Puis attendez la réponse.';
}

const FIRST_RECOVERY = {
  customer_status:
    'Excusez-moi, je n’ai pas bien compris votre réponse. Est-ce que vous êtes déjà client chez PC Froid, ou est-ce votre première demande ?',
  identity:
    'Excusez-moi, je n’ai pas pu interpréter correctement ce que vous avez dit. Pouvez-vous me redonner votre prénom et votre nom, s’il vous plaît ?',
  city:
    'Pardon, je n’ai pas réussi à comprendre le nom de la ville. Pouvez-vous me la redire, s’il vous plaît ?',
  address:
    'Excusez-moi, je préfère vérifier pour ne pas noter une mauvaise adresse. Pouvez-vous me redonner l’adresse d’intervention, s’il vous plaît ?',
  callback:
    'Pardon, je n’ai pas pu interpréter votre réponse. Est-ce que l’équipe peut vous rappeler sur le numéro avec lequel vous appelez ?',
  callback_number:
    'Excusez-moi, je n’ai pas réussi à comprendre correctement le numéro. Pouvez-vous me le redonner tranquillement, chiffre par chiffre ?',
  general:
    'Excusez-moi, je n’ai pas bien réussi à comprendre ce que vous venez de dire. Pouvez-vous me le reformuler ?',
};

export function buildRecoveryInstruction(
  field = "general",
  { attempt = 1, liveTransferAvailable = false } = {},
) {
  if (Number(attempt) >= 2) {
    const phrase = liveTransferAvailable
      ? 'Je suis désolé, je préfère vous passer quelqu’un de l’équipe qui pourra mieux vous répondre. Ne quittez pas, je vous transfère.'
      : 'Je suis désolé, je préfère que quelqu’un de l’équipe reprenne avec vous pour éviter de noter une mauvaise information. Votre demande est conservée et l’équipe vous rappellera.';
    return `Dites exactement et uniquement : "${phrase}" Ne prétendez pas effectuer un transfert si le transfert en direct n’est pas disponible.`;
  }

  const phrase = FIRST_RECOVERY[field] || FIRST_RECOVERY.general;
  return `Dites exactement et uniquement : "${phrase}" Puis attendez la réponse. Ne répétez pas mot pour mot la question précédente.`;
}

export function buildReassuringClosingInstructions({
  serviceIntent,
  equipment,
  businessUrgencyConfirmed = false,
} = {}) {
  if (businessUrgencyConfirmed) {
    return 'Clôturez en une seule fois, sans nouvelle question. Dites que la demande est bien enregistrée comme prioritaire et que l’équipe PC Froid va la reprendre et rappeler le client au plus vite selon les possibilités réelles. Ne promettez jamais un délai précis.';
  }

  if (serviceIntent === "entretien") {
    return 'Clôturez en une seule fois, sans nouvelle question. Rassurez le client avec une formulation naturelle proche de : « Très bien, votre demande d’entretien est bien enregistrée. L’équipe PC Froid va vous rappeler pour convenir avec vous d’un créneau selon vos disponibilités. Bonne journée. » Ne promettez aucun créneau ni délai précis.';
  }

  if (serviceIntent === "devis_installation") {
    return 'Clôturez en une seule fois, sans nouvelle question. Rassurez le client : sa demande de devis ou de projet est bien enregistrée et l’équipe PC Froid va le rappeler pour reprendre le projet avec lui et organiser la suite. Ne promettez aucun délai précis.';
  }

  if (equipment) {
    return `Clôturez en une seule fois, sans nouvelle question. Rassurez le client : sa demande concernant ${equipment} est bien enregistrée et l’équipe PC Froid va la reprendre et le rappeler pour organiser la suite. Ne promettez aucun délai précis.`;
  }

  return 'Clôturez en une seule fois, sans nouvelle question. Indiquez que la demande est bien enregistrée et que l’équipe PC Froid va la reprendre et rappeler le client pour organiser la suite. Ne promettez aucun délai précis.';
}
