function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `    n8nLoading: false,\n    n8nLoaded: false,`,
    `    n8nLoading: false,\n    n8nLoaded: false,\n    waitingExistingCustomerContext: false,`,
    "état attente contexte client existant",
  ),
);

patches.push(
  patch(
    `function extractDirectIdentityAnswer(text) {\n  const raw = String(text || "").trim();\n  if (!raw) return null;`,
    `function extractDirectIdentityAnswer(text) {\n  const raw = String(text || "").trim();\n  if (!raw) return null;\n\n  const cleanedIdentity = raw.replace(/[.,!?;:]+$/u, "").trim();\n  const normalizedIdentity = normalizeText(cleanedIdentity);\n  const identityLooksLatin = /^[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ.'’ -]{2,80}$/u.test(cleanedIdentity);\n  const identityIsFiller = [\n    "oui", "non", "bonjour", "bon", "merci", "allo", "allô",\n    "ca", "ça", "c est ca", "c'est ca", "c est ça", "c'est ça",\n    "c est moi", "c'est moi", "moi", "d accord", "d'accord"\n  ].includes(normalizedIdentity);\n\n  if (!identityLooksLatin || identityIsFiller) {\n    return null;\n  }`,
    "identité non latine ou parasite refusée",
  ),
);

patches.push(
  patch(
    `            if (!detectedName) {\n              detectedName = extractNameCandidate(callerMessage);\n            }`,
    `            if (!detectedName && flowStageAtTurnStart !== "identity") {\n              detectedName = extractNameCandidate(callerMessage);\n            }`,
    "une réponse identité invalide ne repasse pas par le détecteur permissif",
  ),
);

patches.push(
  patch(
    `    } finally {\n      state.n8nLoading = false;\n    }`,
    `    } finally {\n      state.n8nLoading = false;\n\n      if (\n        state.waitingExistingCustomerContext &&\n        !state.closed &&\n        state.customerStatus === "existing" &&\n        state.identityKnown\n      ) {\n        state.waitingExistingCustomerContext = false;\n        app.log.info(\n          { knownCustomerAddress: Boolean(state.knownCustomerAddress) },\n          "Contexte client existant terminé : reprise du parcours"\n        );\n        requestConversationResponse("existing-customer-context-ready");\n      }\n    }`,
    "reprise parcours après retour dossier client",
  ),
);

patches.push(
  patch(
    `          void loadN8nContext(callerMessage);\n          requestConversationResponse("transcription-completed");`,
    `          if (\n            flowStageAtTurnStart === "identity" &&\n            state.customerStatus === "existing" &&\n            state.identityKnown &&\n            !state.n8nLoaded\n          ) {\n            state.waitingExistingCustomerContext = true;\n            app.log.info(\n              { identity: state.identityName, n8nLoading: state.n8nLoading },\n              "Client existant : Tom attend le retour du dossier avant de demander l'adresse"\n            );\n            void loadN8nContext(callerMessage);\n            return;\n          }\n\n          void loadN8nContext(callerMessage);\n          requestConversationResponse("transcription-completed");`,
    "attend dossier client existant avant adresse",
  ),
);

patches.push(
  patch(
    `const responseInstructions = [\n  recoveryOverride || flowLock?.instructions,\n  identityGuard,\n  qualificationBrevityGuard,\n  TOM_CONVERSATION_GUIDANCE,\n]\n  .filter(Boolean)\n  .join("\\n\\n");`,
    `const strictFlowLockStages = new Set([\n  "customer-status",\n  "existing-identity",\n  "new-identity",\n  "new-city",\n  "new-postal-code",\n  "address",\n  "callback",\n  "callback-number",\n  "final-question",\n  "closing",\n]);\n\nconst responseInstructions = strictFlowLockStages.has(flowLock?.stage)\n  ? [recoveryOverride || flowLock?.instructions, identityGuard]\n      .filter(Boolean)\n      .join("\\n\\n")\n  : [\n      recoveryOverride || flowLock?.instructions,\n      identityGuard,\n      qualificationBrevityGuard,\n      TOM_CONVERSATION_GUIDANCE,\n    ]\n      .filter(Boolean)\n      .join("\\n\\n");`,
    "étapes administratives sans phrases parasites",
  ),
);

patches.push(
  patch(
    `'Ne posez plus aucune question technique. Demandez exactement et uniquement : "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Puis arrêtez-vous et attendez la réponse.'`,
    `'Output ONLY this exact French sentence with zero words before or after: "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Then stop and wait.'`,
    "question rappel sans phrase parasite",
  ),
);

patches.push(
  patch(
    `  const nothingElseToAdd =\n    normalizedFinalAnswer === "non" ||`,
    `  const naturalNothingElseToAdd =\n    /^non(?: non)?(?: c est bon)?(?: merci(?: beaucoup)?)?$/.test(normalizedFinalAnswer) ||\n    /^c est bon(?: merci(?: beaucoup)?)?$/.test(normalizedFinalAnswer) ||\n    /^non merci(?: beaucoup)?$/.test(normalizedFinalAnswer);\n\n  const nothingElseToAdd =\n    naturalNothingElseToAdd ||\n    normalizedFinalAnswer === "non" ||`,
    "non non c'est bon merci reconnu comme fin",
  ),
);

patches.push(
  patch(
    `'Si l’appelant vient de poser une dernière question, répondez-y brièvement et clairement. Ensuite clôturez une seule fois en indiquant que la demande va être transmise à l’équipe, puis souhaitez une bonne journée. Ne posez plus aucune question.'`,
    `state.serviceIntent === "entretien"\n        ? 'Dites exactement et uniquement : "Très bien, votre demande d’entretien est bien enregistrée. L’équipe PC Froid vous rappellera pour convenir d’un créneau avec vous. Bonne journée." Ne posez aucune question.'\n        : 'Dites exactement et uniquement : "Très bien, votre demande est bien enregistrée. L’équipe PC Froid vous rappellera. Bonne journée." Ne posez aucune question.'`,
    "clôture entretien naturelle et déterministe",
  ),
);

export const EXISTING_CUSTOMER_FIX_PATCHES = patches.join("\n\n") + "\n\n";
