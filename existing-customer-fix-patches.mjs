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
    `function extractCustomerStatusAnswer(text) {\n  let normalized = normalizeText(text);\n  if (!normalized) return null;`,
    `function extractCustomerStatusAnswer(text) {\n  let normalized = normalizeText(text);\n  if (!normalized) return null;\n\n  if (/^oui(?:\\s+oui)+$/.test(normalized)) return "existing";\n  if (/^non(?:\\s+non)+$/.test(normalized)) return "new";`,
    "oui oui et non non reconnus comme statut client",
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
    `            } else if (flowStageAtTurnStart === "identity") {\n              nextRecoveryInstruction("identity");\n              app.log.info(\n                { callerMessage },\n                "Réponse reçue mais identité non validée"\n              );\n            }`,
    `            } else if (flowStageAtTurnStart === "identity") {\n              if (state.customerStatus === "existing") {\n                state.identityKnown = true;\n                state.identityName = "Client existant - nom à retrouver par téléphone";\n                clearRecovery("identity");\n                setFlowStage(\n                  "callback",\n                  "client existant : nom non compris, numéro de rappel prioritaire"\n                );\n                addSystemContext(\n                  "CLIENT EXISTANT : le nom n'a pas été compris avec assez de fiabilité. Ne redemandez pas le nom. Ne prétendez pas connaître son identité. Le dossier sera retrouvé par l'équipe grâce au numéro de rappel."\n                );\n                app.log.info(\n                  { callerMessage },\n                  "Client existant : nom non compris, Tom n'insiste pas et passe au rappel"\n                );\n              } else {\n                nextRecoveryInstruction("identity");\n                app.log.info(\n                  { callerMessage },\n                  "Réponse reçue mais identité non validée"\n                );\n              }\n            }`,
    "client existant : un seul essai sur le nom puis rappel",
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
    `   if (state.serviceIntent === "devis_installation") {\n  setFlowStage(\n    "address",\n    "devis installation/remplacement : aucune qualification dépannage nécessaire"\n  );`,
    `   if (state.serviceIntent === "devis_installation") {\n  if (state.customerStatus === "existing" && !state.knownCustomerAddress) {\n    setFlowStage(\n      "callback",\n      "client existant sans adresse dossier : rappel prioritaire"\n    );\n    return {\n      stage: "callback",\n      instructions: 'Output ONLY this exact French sentence with zero words before or after: "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Then stop and wait.'\n    };\n  }\n\n  setFlowStage(\n    "address",\n    "devis installation/remplacement : aucune qualification dépannage nécessaire"\n  );`,
    "devis client existant sans dossier : le téléphone suffit pour reprise",
  ),
);

patches.push(
  patch(
    `   if (state.serviceIntent === "entretien") {\n  setFlowStage(\n    "address",\n    "entretien : aucune qualification technique nécessaire"\n  );`,
    `   if (state.serviceIntent === "entretien") {\n  if (state.customerStatus === "existing" && !state.knownCustomerAddress) {\n    setFlowStage(\n      "callback",\n      "client existant sans adresse dossier : rappel prioritaire"\n    );\n    return {\n      stage: "callback",\n      instructions: 'Output ONLY this exact French sentence with zero words before or after: "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Then stop and wait.'\n    };\n  }\n\n  setFlowStage(\n    "address",\n    "entretien : aucune qualification technique nécessaire"\n  );`,
    "entretien client existant sans dossier : le téléphone suffit pour reprise",
  ),
);

patches.push(
  patch(
    `   if (\n  state.flowStage === "address" &&\n  !state.interventionAddress\n) {\n    \n  return {`,
    `   if (\n  state.flowStage === "address" &&\n  !state.interventionAddress\n) {\n    if (state.customerStatus === "existing" && !state.knownCustomerAddress) {\n      setFlowStage(\n        "callback",\n        "client existant sans adresse dossier : rappel prioritaire"\n      );\n      return {\n        stage: "callback",\n        instructions: 'Output ONLY this exact French sentence with zero words before or after: "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Then stop and wait.'\n      };\n    }\n    \n  return {`,
    "dépannage client existant sans dossier : pas d'interrogatoire d'adresse",
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

export const EXISTING_CUSTOMER_FIX_PATCHES = patches.join("\n\n") + "\n\n";
