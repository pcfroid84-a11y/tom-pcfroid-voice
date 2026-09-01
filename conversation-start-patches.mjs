function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `         const normalizedCallerMessage = normalizeText(callerMessage);`,
    `         const normalizedCallerMessage = normalizeText(callerMessage);\n\nif (\n  (\n    state.explicitEquipment === "climatisation" ||\n    detectedEquipment === "climatisation" ||\n    /\\bclim\\w*\\b/.test(normalizedCallerMessage)\n  ) &&\n  /\\b(entretien|maintenance|nettoy\\w*|desinfect\\w*)\\b/.test(normalizedCallerMessage)\n) {\n  state.serviceIntent = "entretien";\n  app.log.info(\n    { callerMessage, serviceIntent: state.serviceIntent },\n    "Nettoyage climatisation classé comme entretien"\n  );\n}\n\nif (\n  flowStageAtTurnStart === "need" &&\n  /^(oui|non|ok|d accord|d'accord)$/.test(normalizedCallerMessage) &&\n  !detectedEquipment\n) {\n  app.log.info(\n    { callerMessage },\n    "Réponse courte isolée au démarrage : Tom reste en écoute"\n  );\n\n  sendToOpenAI({\n    type: "response.create",\n    response: {\n      output_modalities: ["audio"],\n      instructions:\n        'Répondez exactement et uniquement : "Je vous écoute." Puis taisez-vous et laissez l’appelant expliquer sa demande. Ne posez aucune question.'\n    }\n  });\n\n  return;\n}`,
    "nettoyage clim = entretien + oui/non isolé sans avancement",
  ),
);

patches.push(
  patch(
    `'Respectez impérativement le parcours PC Froid. Si le client demande explicitement si PC Froid réalise ce service, répondez clairement en une phrase courte, sans inventer. Sinon, ne reformulez pas le symptôme. Ne posez aucune question technique. La seule question autorisée ensuite est exactement : "Est-ce que vous êtes déjà client chez P C Froid ?" Puis arrêtez-vous et attendez la réponse.'`,
    `'Dites exactement et uniquement : "Est-ce que vous êtes déjà client chez P C Froid ?" Puis arrêtez-vous et attendez la réponse. Ne prononcez aucune consigne interne et n’ajoutez aucune phrase avant.'`,
    "question statut client sans lecture des consignes internes",
  ),
);

patches.push(
  patch(
    `const responseInstructions = [\n  recoveryOverride || flowLock?.instructions,\n  identityGuard,\n  TOM_CONVERSATION_GUIDANCE,\n]\n  .filter(Boolean)\n  .join("\\n\\n");`,
    `const qualificationBrevityGuard =\n  state.flowStage === "qualification"\n    ? "QUALIFICATION : réponse très courte. Maximum 25 mots au total. Une seule information utile puis une seule question. Aucun long commentaire, aucune explication développée, aucune reformulation du dossier."\n    : null;\n\nconst responseInstructions = [\n  recoveryOverride || flowLock?.instructions,\n  identityGuard,\n  qualificationBrevityGuard,\n  TOM_CONVERSATION_GUIDANCE,\n]\n  .filter(Boolean)\n  .join("\\n\\n");`,
    "qualification limitée à une réponse courte",
  ),
);

export const CONVERSATION_START_PATCHES = patches.join("\n\n") + "\n\n";
