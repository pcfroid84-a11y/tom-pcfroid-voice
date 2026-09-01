function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `import { buildCallEndPayload } from "./call-end-payload.mjs";\nimport { amplifyMulawBase64 } from "./audio-utils.mjs";`,
    `import { buildCallEndPayload } from "./call-end-payload.mjs";\nimport { amplifyMulawBase64 } from "./audio-utils.mjs";\nimport {\n  classifySectorRequest,\n  extractPostalCode,\n  getSectorService,\n  sectorStatusToZone,\n} from "./sector-rules.mjs";`,
    "moteur secteur PC Froid",
  ),
);

patches.push(
  patch(
    `    recoveryCounts: {},\n    recoveryPrompt: null,\n    identityKnown: false,`,
    `    recoveryCounts: {},\n    recoveryPrompt: null,\n    awaitingPostalCode: false,\n    interventionPostalCode: null,\n    pendingCityCandidate: null,\n    identityKnown: false,`,
    "état code postal secteur",
  ),
);

patches.push(
  patch(
    `        const installationProjectDetected =\n  (\n    /\\bdevis\\b/.test(normalizedCallerMessage) &&\n    /\\b(install\\w*|remplac\\w*|nouve\\w*|pose\\w*)\\b/.test(normalizedCallerMessage)\n  ) ||`,
    `        const installationProjectDetected =\n  (\n    /\\bdevis\\b/.test(normalizedCallerMessage) &&\n    (\n      /\\b(install\\w*|remplac\\w*|nouve\\w*|pose\\w*)\\b/.test(normalizedCallerMessage) ||\n      (\n        state.explicitEquipment === "climatisation" &&\n        state.serviceIntent !== "entretien" &&\n        !/\\b(entretien|maintenance|depann\\w*|panne|repar\\w*|fuite|bruit|code|voyant)\\b/.test(normalizedCallerMessage)\n      )\n    )\n  ) ||`,
    "devis clim simple reconnu comme projet installation",
  ),
);

patches.push(
  patch(
    `    if (\n      state.customerStatus === "new" &&\n      state.identityKnown &&\n      !state.interventionCity\n    ) {\n     setFlowStage("city", "ville nouveau client requise");\n     \n      return {\n        stage: "new-city",\n       instructions:\n  'DITES EXACTEMENT ET UNIQUEMENT CETTE PHRASE, SANS AUCUN MOT AVANT NI APRÈS : "Dans quelle ville se trouve l’installation ?" Ne répondez à aucun autre sujet dans ce tour. Arrêtez-vous immédiatement après la question et attendez la réponse.',\n      };\n    }`,
    `    if (\n      state.customerStatus === "new" &&\n      state.identityKnown &&\n      !state.interventionCity &&\n      (state.awaitingPostalCode || state.pendingCityCandidate)\n    ) {\n      state.awaitingPostalCode = true;\n      setFlowStage("city", "code postal requis pour confirmer une ville incertaine");\n      return {\n        stage: "new-postal-code",\n        instructions:\n          'Dites exactement et uniquement : "Je préfère vérifier pour ne pas me tromper de ville. Quel est le code postal de l’installation ?" Puis arrêtez-vous et attendez la réponse.',\n      };\n    }\n\n    if (\n      state.customerStatus === "new" &&\n      state.identityKnown &&\n      !state.interventionCity\n    ) {\n     setFlowStage("city", "ville nouveau client requise");\n     \n      return {\n        stage: "new-city",\n       instructions:\n  'DITES EXACTEMENT ET UNIQUEMENT CETTE PHRASE, SANS AUCUN MOT AVANT NI APRÈS : "Dans quelle ville se trouve l’installation ?" Ne répondez à aucun autre sujet dans ce tour. Arrêtez-vous immédiatement après la question et attendez la réponse.',\n      };\n    }`,
    "code postal si ville incertaine",
  ),
);

patches.push(
  patch(
    `  const spontaneousCity = extractCityCandidate(callerMessage);`,
    `  const rawSpontaneousCity = extractCityCandidate(callerMessage);\n  const spontaneousSectorService = getSectorService({\n    serviceIntent: state.serviceIntent,\n    equipment: state.explicitEquipment,\n    text: state.callerMessages.join(" "),\n  });\n  const spontaneousSectorDecision = rawSpontaneousCity\n    ? classifySectorRequest({\n        city: rawSpontaneousCity,\n        service: spontaneousSectorService,\n        existingCustomer: false,\n      })\n    : null;\n  const spontaneousCity =\n    spontaneousSectorDecision?.status === "unknown" ? null : rawSpontaneousCity;\n\n  if (rawSpontaneousCity && !spontaneousCity) {\n    state.pendingCityCandidate = rawSpontaneousCity;\n    app.log.info(\n      { cityCandidate: rawSpontaneousCity },\n      "Ville spontanée incertaine : code postal requis avant validation"\n    );\n  }`,
    "ville spontanée inconnue non validée",
  ),
);

patches.push(
  patch(
    `    state.interventionCity = spontaneousCity;\n    state.cityZoneStatus = classifyServiceArea(spontaneousCity);`,
    `    state.interventionCity = spontaneousSectorDecision?.city || spontaneousCity;\n    state.cityZoneStatus = sectorStatusToZone(spontaneousSectorDecision?.status);`,
    "secteur activité pour ville spontanée",
  ),
);

patches.push(
  patch(
    `          // V2.9 : une ville demandée ou corrigée vient de la transcription client.`,
    `          if (flowStageAtTurnStart === "city" && state.awaitingPostalCode) {\n            const postalCode = extractPostalCode(callerMessage);\n\n            if (!postalCode) {\n              cancelActiveResponse();\n              setTimeout(() => {\n                sendToOpenAI({\n                  type: "response.create",\n                  response: {\n                    output_modalities: ["audio"],\n                    instructions:\n                      'Dites exactement et uniquement : "Je n’ai pas réussi à comprendre le code postal. Pouvez-vous me le redonner, s’il vous plaît ?" Puis attendez la réponse.',\n                  },\n                });\n              }, 80);\n              return;\n            }\n\n            const sectorService = getSectorService({\n              serviceIntent: state.serviceIntent,\n              equipment: state.explicitEquipment,\n              text: state.callerMessages.join(" "),\n            });\n            const postalDecision = classifySectorRequest({\n              postalCode,\n              service: sectorService,\n              existingCustomer: false,\n            });\n\n            state.interventionPostalCode = postalCode;\n            state.cityZoneStatus = sectorStatusToZone(postalDecision.status);\n            state.awaitingPostalCode = false;\n\n            if (postalDecision.status === "out") {\n              const label = state.pendingCityCandidate || ("le secteur du " + postalCode);\n              app.log.info(\n                { postalCode, service: sectorService, decision: postalDecision.status },\n                "Code postal confirmé hors secteur standard"\n              );\n              sendOutOfSectorClosing(label);\n              return;\n            }\n\n            state.interventionCity =\n              postalDecision.city || ("Code postal " + postalCode);\n            state.pendingCityCandidate = null;\n\n            if (postalDecision.status === "in") {\n              addSystemContext(\n                "ZONE CONFIRMÉE PAR CODE POSTAL : " + postalCode +\n                  " est accepté pour cette activité. Poursuivez normalement."\n              );\n            } else {\n              addSystemContext(\n                "ZONE À VÉRIFIER PAR CODE POSTAL : " + postalCode +\n                  ". Prenez la demande mais ne promettez pas l'intervention ; l'équipe PC Froid vérifiera."\n              );\n            }\n\n            setFlowStage("qualification", "zone confirmée ou à vérifier par code postal");\n            app.log.info(\n              {\n                postalCode,\n                city: state.interventionCity,\n                service: sectorService,\n                decision: postalDecision.status,\n                candidates: postalDecision.candidates,\n              },\n              "Code postal utilisé pour sécuriser la zone d'intervention"\n            );\n\n            requestConversationResponse("postal-code-confirmed");\n            return;\n          }\n\n          // V2.9 : une ville demandée ou corrigée vient de la transcription client.`,
    "traitement déterministe du code postal",
  ),
);

patches.push(
  patch(
    `            const cityCandidate = extractCityCandidate(callerMessage, true);`,
    `            const cityCandidate = extractCityCandidate(callerMessage, true);\n            const sectorService = getSectorService({\n              serviceIntent: state.serviceIntent,\n              equipment: state.explicitEquipment,\n              text: state.callerMessages.join(" "),\n            });\n            const sectorDecision = cityCandidate\n              ? classifySectorRequest({\n                  city: cityCandidate,\n                  service: sectorService,\n                  existingCustomer: state.customerStatus === "existing",\n                })\n              : null;\n\n            if (\n              cityCandidate &&\n              state.customerStatus === "new" &&\n              sectorDecision?.status === "unknown"\n            ) {\n              state.pendingCityCandidate = cityCandidate;\n              state.awaitingPostalCode = true;\n              state.interventionCity = null;\n              state.cityZoneStatus = "unknown";\n\n              app.log.info(\n                { cityCandidate, service: sectorService },\n                "Ville non reconnue : Tom demande le code postal au lieu de la valider"\n              );\n\n              cancelActiveResponse();\n              setTimeout(() => {\n                sendToOpenAI({\n                  type: "response.create",\n                  response: {\n                    output_modalities: ["audio"],\n                    instructions:\n                      'Dites exactement et uniquement : "Je préfère vérifier pour ne pas me tromper de ville. Quel est le code postal de l’installation ?" Puis attendez la réponse.',\n                  },\n                });\n              }, 80);\n              return;\n            }`,
    "ville inconnue vers demande code postal",
  ),
);

patches.push(
  patch(
    `              state.interventionCity = cityCandidate;\n              state.awaitingCity = false;\n              state.cityZoneStatus = classifyServiceArea(cityCandidate);`,
    `              state.interventionCity = sectorDecision?.city || cityCandidate;\n              state.awaitingCity = false;\n              state.awaitingPostalCode = false;\n              state.pendingCityCandidate = null;\n              state.cityZoneStatus =\n                state.customerStatus === "new"\n                  ? sectorStatusToZone(sectorDecision?.status)\n                  : classifyServiceArea(state.interventionCity);`,
    "décision secteur selon activité",
  ),
);

patches.push(
  patch(
    `        const responseDiagnostics = buildResponseDiagnostics(event.response);`,
    `        const responseDiagnostics = buildResponseDiagnostics(event.response);\n\n        // NON-RÉGRESSION : après la dernière question/dernier complément,\n        // la réponse de Tom doit toujours entraîner le raccrochage, même si\n        // l'événement response.output_audio_transcript.done n'arrive pas.\n        if (\n          state.flowStage === "final_followup" &&\n          event.response?.status === "completed" &&\n          state.identityKnown &&\n          !state.closingStarted\n        ) {\n          state.closingStarted = true;\n          state.conversationModeEnabled = false;\n          state.pendingHangup = true;\n          state.identityRecoveryNeeded = false;\n          app.log.info(\n            "Raccrochage de non-régression armé après la dernière réponse"\n          );\n        }`,
    "raccrochage fiable après final_followup",
  ),
);

export const RUNTIME_PATCHES = patches.join("\n\n") + "\n\n";
