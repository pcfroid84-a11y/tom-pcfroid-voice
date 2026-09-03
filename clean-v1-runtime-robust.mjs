import { CLEAN_V1_LATEST_PATCHES } from "./clean-v1-runtime-latest.mjs";

function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `const REALTIME_MODEL =\n  process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";`,
    `const REALTIME_MODEL =\n  process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";`,
    "modèle realtime complet pour meilleure robustesse",
  ),
);

patches.push(
  patch(
    `const TRANSCRIBE_MODEL =\n  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";`,
    `const TRANSCRIBE_MODEL =\n  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";`,
    "transcription haute précision",
  ),
);

patches.push(
  patch(
    `const VAD_PREFIX_MS = Number(process.env.OPENAI_VAD_PREFIX_MS || 300);`,
    `const VAD_PREFIX_MS = Number(process.env.OPENAI_VAD_PREFIX_MS || 500);`,
    "préfixe audio élargi pour ne pas couper le début des noms",
  ),
);

patches.push(
  patch(
    `} from "./sector-rules-latest.mjs";\n\nconst PCFROID_KNOWLEDGE_CONTEXT`,
    `} from "./sector-rules-latest.mjs";\nimport {\n  containsNonLatinScript,\n  isReliableIdentityTranscript,\n  isVeryLowConfidenceTranscript,\n  matchKnownSectorCity,\n  transcriptionAverageLogprob,\n} from "./transcription-guard.mjs";\n\nconst PCFROID_KNOWLEDGE_CONTEXT`,
    "imports garde transcription",
  ),
);

patches.push(
  patch(
    `        instructions: SYSTEM_PROMPT,\n        audio: {`,
    `        instructions: SYSTEM_PROMPT,\n        include: ["item.input_audio_transcription.logprobs"],\n        audio: {`,
    "logprobs de transcription activés",
  ),
);

patches.push(
  patch(
    `            transcription: {\n              model: TRANSCRIBE_MODEL,\n              language: "fr",\n            },`,
    `            transcription: {\n              model: TRANSCRIBE_MODEL,\n              language: "fr",\n              prompt: "Conversation téléphonique en français de France avec les clients de PC Froid, entreprise de climatisation, pompe à chaleur et froid commercial dans le Vaucluse. Transcrire fidèlement les prénoms, noms, nombres, codes postaux et communes. Communes fréquentes : Monteux, Carpentras, Bédarrides, Sorgues, Vedène, Avignon, L'Isle-sur-la-Sorgue, Le Thor, Sarrians, Aubignan, Pernes-les-Fontaines, Entraigues-sur-la-Sorgue, Cavaillon, Orange, Bollène et Châteaurenard. Ne jamais traduire la parole dans une autre langue. Pour un nom propre, conserver la forme phonétique française la plus plausible en alphabet latin.",\n            },`,
    "contexte français PC Froid donné au transcripteur",
  ),
);

patches.push(
  patch(
    `    suppressNextQualificationCount: false,\n    identityKnown: false,`,
    `    suppressNextQualificationCount: false,\n    identityRecognitionFailures: 0,\n    cityRecognitionFailures: 0,\n    lastTranscriptionAvgLogprob: null,\n    identityKnown: false,`,
    "compteurs de fiabilité noms et villes",
  ),
);

patches.push(
  patch(
    `        const callerMessage = event.transcript?.trim();\n \n        if (callerMessage) {`,
    `        const callerMessage = event.transcript?.trim();\n        const transcriptionAvgLogprob = transcriptionAverageLogprob(event.logprobs);\n \n        if (callerMessage) {\n          state.lastTranscriptionAvgLogprob = transcriptionAvgLogprob;`,
    "confiance de transcription disponible dans le tour",
  ),
);

patches.push(
  patch(
    `          if (flowStageAtTurnStart === "address" && state.identityFallbackByPhone) {`,
    `          if (flowStageAtTurnStart === "identity") {\n            const identityReliable = isReliableIdentityTranscript({\n              text: callerMessage,\n              customerStatus: state.customerStatus,\n              logprobs: event.logprobs,\n            });\n\n            if (!identityReliable) {\n              state.identityRecognitionFailures = Number(state.identityRecognitionFailures || 0) + 1;\n              state.recoveryPrompt = null;\n              cancelActiveResponse();\n              app.log.info(\n                {\n                  attempt: state.identityRecognitionFailures,\n                  avgLogprob: transcriptionAvgLogprob,\n                  nonLatin: containsNonLatinScript(callerMessage),\n                },\n                "Transcription identité incertaine : nom non enregistré",\n              );\n\n              if (state.identityRecognitionFailures >= 3) {\n                state.identityKnown = true;\n                state.identityName = "Nom à confirmer lors du rappel";\n                state.identityFallbackByPhone = true;\n                clearRecovery("identity");\n                addSystemContext("IDENTITÉ MAL ENTENDUE APRÈS PLUSIEURS ESSAIS : ne jamais inventer le nom. L'équipe le confirmera lors du rappel.");\n                setFlowStage(state.customerStatus === "new" ? "city" : "qualification", "nom illisible après trois essais, confirmation humaine prévue");\n                app.log.info("Trois échecs de transcription identité : poursuite sans inventer de nom");\n                if (state.customerStatus === "new") {\n                  sendToOpenAI({\n                    type: "response.create",\n                    response: {\n                      output_modalities: ["audio"],\n                      instructions: 'Dites exactement et uniquement : "Je capte mal votre nom, ce n’est pas grave, l’équipe le confirmera avec vous. Dans quelle ville se trouve l’installation ?" Aucun mot avant, aucun mot après.',\n                    },\n                  });\n                } else {\n                  requestConversationResponse("identity-noisy-fallback");\n                }\n                return;\n              }\n\n              const identityRetryInstruction = state.identityRecognitionFailures === 1\n                ? (state.customerStatus === "new"\n                  ? 'Dites exactement et uniquement : "Je n’ai pas bien compris votre nom. Pouvez-vous me redonner votre prénom et votre nom, s’il vous plaît ?" Aucun mot avant, aucun mot après.'\n                  : 'Dites exactement et uniquement : "Je n’ai pas bien compris le nom du dossier. Vous pouvez me le répéter, s’il vous plaît ?" Aucun mot avant, aucun mot après.')\n                : 'Dites exactement et uniquement : "Je capte mal le nom. Pouvez-vous me l’épeler lentement, s’il vous plaît ?" Aucun mot avant, aucun mot après.';\n\n              sendToOpenAI({\n                type: "response.create",\n                response: { output_modalities: ["audio"], instructions: identityRetryInstruction },\n              });\n              return;\n            }\n\n            state.identityRecognitionFailures = 0;\n          }\n\n          if (flowStageAtTurnStart === "city" && !state.awaitingPostalCode) {\n            const robustCityMatch = matchKnownSectorCity(callerMessage);\n            const cityLowConfidence = isVeryLowConfidenceTranscript(event.logprobs);\n            const cityCorrupt = containsNonLatinScript(callerMessage);\n\n            if (robustCityMatch && !cityCorrupt && (!cityLowConfidence || robustCityMatch.exact || robustCityMatch.similarity >= 0.9)) {\n              const sectorService = getSectorService({\n                serviceIntent: state.serviceIntent,\n                equipment: state.explicitEquipment,\n                text: state.callerMessages.join(" "),\n              });\n              const cityDecision = classifySectorRequest({\n                city: robustCityMatch.city,\n                service: sectorService,\n                existingCustomer: false,\n              });\n\n              if (cityDecision.status === "no" && !robustCityMatch.exact) {\n                state.pendingCityCandidate = robustCityMatch.city;\n                state.awaitingPostalCode = true;\n                app.log.info({ city: robustCityMatch.city, similarity: robustCityMatch.similarity }, "Ville rapprochée mais hors secteur : code postal exigé avant refus");\n                sendToOpenAI({\n                  type: "response.create",\n                  response: { output_modalities: ["audio"], instructions: 'Dites exactement et uniquement : "Pour être sûr de la ville, quel est le code postal de l’installation ?" Aucun mot avant, aucun mot après.' },\n                });\n                return;\n              }\n\n              state.interventionCity = cityDecision.city || robustCityMatch.city;\n              state.cityZoneStatus = sectorStatusToZone(cityDecision.status);\n              state.pendingCityCandidate = null;\n              state.awaitingPostalCode = false;\n              state.cityRecognitionFailures = 0;\n              app.log.info({ city: state.interventionCity, similarity: robustCityMatch.similarity, exact: robustCityMatch.exact }, "Ville connue reconnue par garde phonétique");\n\n              if (cityDecision.status === "no") {\n                sendOutOfSectorClosing(state.interventionCity);\n                return;\n              }\n\n              setFlowStage("qualification", "ville connue reconnue de façon robuste");\n              requestConversationResponse("robust-city-confirmed");\n              return;\n            }\n\n            if (cityCorrupt || cityLowConfidence) {\n              state.cityRecognitionFailures = Number(state.cityRecognitionFailures || 0) + 1;\n              state.pendingCityCandidate = null;\n              state.recoveryPrompt = null;\n              cancelActiveResponse();\n              app.log.info(\n                { attempt: state.cityRecognitionFailures, avgLogprob: transcriptionAvgLogprob, nonLatin: cityCorrupt },\n                "Transcription ville incertaine : aucune ville enregistrée",\n              );\n\n              if (state.cityRecognitionFailures >= 2) {\n                state.awaitingPostalCode = true;\n                sendToOpenAI({\n                  type: "response.create",\n                  response: { output_modalities: ["audio"], instructions: 'Dites exactement et uniquement : "Je capte mal le nom de la ville. Donnez-moi simplement le code postal de l’installation, s’il vous plaît." Aucun mot avant, aucun mot après.' },\n                });\n              } else {\n                sendToOpenAI({\n                  type: "response.create",\n                  response: { output_modalities: ["audio"], instructions: 'Dites exactement et uniquement : "Je n’ai pas bien entendu la ville. Vous pouvez me la répéter, s’il vous plaît ?" Aucun mot avant, aucun mot après.' },\n                });\n              }\n              return;\n            }\n\n            state.cityRecognitionFailures = 0;\n          }\n\n          if (flowStageAtTurnStart === "address" && state.identityFallbackByPhone) {`,
    "noms et villes critiques validés avant toute progression",
  ),
);

export const CLEAN_V1_ROBUST_PATCHES = CLEAN_V1_LATEST_PATCHES + patches.join("\n\n") + "\n\n";
