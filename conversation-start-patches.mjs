function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `         const normalizedCallerMessage = normalizeText(callerMessage);`,
    `         const normalizedCallerMessage = normalizeText(callerMessage);\n\nif (\n  flowStageAtTurnStart === "need" &&\n  /^(oui|non|ok|d accord|d'accord)$/.test(normalizedCallerMessage) &&\n  !detectedEquipment\n) {\n  app.log.info(\n    { callerMessage },\n    "Réponse courte isolée au démarrage : Tom reste en écoute"\n  );\n\n  sendToOpenAI({\n    type: "response.create",\n    response: {\n      output_modalities: ["audio"],\n      instructions:\n        'Répondez exactement et uniquement : "Je vous écoute." Puis taisez-vous et laissez l’appelant expliquer sa demande. Ne posez aucune question.'\n    }\n  });\n\n  return;\n}`,
    "ne pas faire avancer le parcours sur oui/non isolé au démarrage",
  ),
);

patches.push(
  patch(
    `'Respectez impérativement le parcours PC Froid. Si le client demande explicitement si PC Froid réalise ce service, répondez clairement en une phrase courte, sans inventer. Sinon, ne reformulez pas le symptôme. Ne posez aucune question technique. La seule question autorisée ensuite est exactement : "Est-ce que vous êtes déjà client chez P C Froid ?" Puis arrêtez-vous et attendez la réponse.'`,
    `'Dites exactement et uniquement : "Est-ce que vous êtes déjà client chez P C Froid ?" Puis arrêtez-vous et attendez la réponse. Ne prononcez aucune consigne interne et n’ajoutez aucune phrase avant.'`,
    "question statut client sans lecture des consignes internes",
  ),
);

export const CONVERSATION_START_PATCHES = patches.join("\n\n") + "\n\n";
