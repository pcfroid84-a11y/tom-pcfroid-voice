function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `} from "./conversation-guidance.mjs";\n\nconst PCFROID_KNOWLEDGE_CONTEXT`,
    `} from "./conversation-guidance.mjs";\nimport {\n  classifyExpectedFieldTurn,\n  detectServiceIntent,\n  extractCustomerStatusClean,\n  extractIdentityClean,\n  finalAnswerKind,\n  isQuestionAnnouncement,\n  looksLikeLateralQuestion,\n  normalizeCleanText,\n  relationshipProvesExistingCustomer,\n} from "./clean-v1-core.mjs";\nimport {\n  classifySectorRequest,\n  extractPostalCode,\n  getSectorService,\n  sectorStatusToZone,\n} from "./sector-rules.mjs";\n\nconst PCFROID_KNOWLEDGE_CONTEXT`,
    "imports du contrôleur propre",
  ),
);

patches.push(
  patch(
    `    recoveryCounts: {},\n    recoveryPrompt: null,\n    identityKnown: false,`,
    `    recoveryCounts: {},\n    recoveryPrompt: null,\n    awaitingPostalCode: false,\n    interventionPostalCode: null,\n    pendingCityCandidate: null,\n    identityFallbackByPhone: false,\n    testClientMatched: false,\n    testClientFirstName: null,\n    lastAssistantAudioDoneAt: 0,\n    greetingSpeechStartedBeforeConversation: false,\n    discardNextGreetingTranscript: false,\n    suppressNextQualificationCount: false,\n    identityKnown: false,`,
    "état unique du contrôleur propre",
  ),
);

patches.push(
  patch(
    `function maskPhone(phone) {\n  if (!phone) return null;\n  const value = String(phone);\n  if (value.length <= 4) return "****";\n  return \`${'${value.slice(0, 3)}'}***${'${value.slice(-3)}'}\`;\n}`,
    `function maskPhone(phone) {\n  if (!phone) return null;\n  const value = String(phone);\n  if (value.length <= 4) return "****";\n  return \`${'${value.slice(0, 3)}'}***${'${value.slice(-3)}'}\`;\n}\n\nfunction normalizeCallerPhone(value = "") {\n  let digits = String(value || "").replace(/\\D/g, "");\n  if (digits.startsWith("00")) digits = digits.slice(2);\n  if (digits.startsWith("0") && digits.length === 10) digits = "33" + digits.slice(1);\n  return digits;\n}\n\nfunction getConfiguredTestClient(phone) {\n  const configured = normalizeCallerPhone(process.env.TOM_TEST_CLIENT_PHONE || "");\n  const caller = normalizeCallerPhone(phone);\n  if (!configured || !caller || configured !== caller) return null;\n\n  const name = String(process.env.TOM_TEST_CLIENT_NAME || "").trim();\n  const firstName = String(process.env.TOM_TEST_CLIENT_FIRST_NAME || name.split(/\\s+/)[0] || "").trim();\n  const address = String(process.env.TOM_TEST_CLIENT_ADDRESS || "").trim() || null;\n  if (!name) return null;\n  return { name, firstName, address };\n}\n\nfunction pendingQuestionForStage(stage, state) {\n  if (stage === "customer_status") return "Est-ce que vous êtes déjà client chez P C Froid ?";\n  if (stage === "identity") return state.customerStatus === "existing" ? "À quel nom est le dossier ?" : "Pouvez-vous me donner votre prénom et votre nom, s’il vous plaît ?";\n  if (stage === "city") return state.awaitingPostalCode ? "Quel est le code postal de l’installation ?" : "Dans quelle ville se trouve l’installation ?";\n  if (stage === "address") return state.knownCustomerAddress ? "Est-ce que l’intervention est à la même adresse que d’habitude ?" : "Quelle est l’adresse d’intervention ?";\n  if (stage === "callback") return "On peut vous rappeler sur le numéro avec lequel vous appelez ?";\n  if (stage === "callback_number") return "Quel numéro je note pour vous rappeler ?";\n  return null;\n}\n\nfunction validExpectedAnswerForStage(stage, text, state) {\n  if (stage === "customer_status") return Boolean(extractCustomerStatusClean(text));\n  if (stage === "identity") return Boolean(extractIdentityClean(text));\n  if (stage === "city") return state.awaitingPostalCode ? Boolean(extractPostalCode(text)) : Boolean(extractCityCandidate(text, true));\n  if (stage === "address") {\n    const normalized = normalizeCleanText(text);\n    if (state.knownCustomerAddress && /^(oui|non)\\b/.test(normalized)) return true;\n    return /\\d/.test(text) || /\\b(rue|avenue|av|boulevard|bd|chemin|route|impasse|allee|allée|place|lotissement|residence|résidence|zone|quartier)\\b/i.test(text);\n  }\n  if (stage === "callback") return /^(oui|non)\\b/.test(normalizeCleanText(text));\n  if (stage === "callback_number") return String(text || "").replace(/\\D/g, "").length >= 10;\n  return false;\n}`,
    "helpers du parcours propre",
  ),
);

patches.push(
  patch(
    `    if (!state.greetingText) {\n      state.greetingText = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];\n    }`,
    `    if (!state.greetingText) {\n      state.greetingText = state.testClientMatched && state.testClientFirstName\n        ? \`Bonjour \${state.testClientFirstName}, vous êtes bien chez PC Froid, et c'est Tom. Je vous écoute.\`\n        : GREETINGS[Math.floor(Math.random() * GREETINGS.length)];\n    }`,
    "accueil personnalisé si numéro reconnu",
  ),
);

patches.push(
  patch(
    `          state.calledPhone =\n            message.start.customParameters?.calledPhone || null;`,
    `          state.calledPhone =\n            message.start.customParameters?.calledPhone || null;\n\n          const configuredTestClient = getConfiguredTestClient(state.callerPhone);\n          if (configuredTestClient) {\n            state.testClientMatched = true;\n            state.testClientFirstName = configuredTestClient.firstName || null;\n            state.customerStatus = "existing";\n            state.identityKnown = true;\n            state.identityName = configuredTestClient.name;\n            state.knownCustomerAddress = configuredTestClient.address;\n            app.log.info(\n              { hasAddress: Boolean(configuredTestClient.address) },\n              "Client test reconnu directement par le numéro appelant"\n            );\n          }`,
    "reconnaissance client test avant accueil",
  ),
);

patches.push(
  patch(
    `            voice: "verse",\n            speed: 1.10,`,
    `            voice: "verse",\n            speed: 1.15,`,
    "vitesse voix validée",
  ),
);

patches.push(
  patch(
    `     if (\n  event.type === "input_audio_buffer.speech_started" ||\n  event.type === "input_audio_buffer.speech_stopped"\n) {\n  app.log.info(\n    { eventType: event.type },\n    "Détection parole client OpenAI"\n  );\n}`,
    `     if (\n  event.type === "input_audio_buffer.speech_started" ||\n  event.type === "input_audio_buffer.speech_stopped"\n) {\n  app.log.info(\n    { eventType: event.type, phase: state.phase },\n    "Détection parole client OpenAI"\n  );\n\n  if (event.type === "input_audio_buffer.speech_started") {\n    if (!state.conversationModeEnabled && (state.phase === "greeting-generating" || state.phase === "greeting-playback")) {\n      state.greetingSpeechStartedBeforeConversation = true;\n      app.log.info("Parole détectée pendant l'accueil : accueil conservé sans interruption");\n    } else if (state.conversationModeEnabled && (state.responseActive || state.assistantSpeaking || state.playbackMark)) {\n      const bufferedPlaybackOnly = Boolean(state.playbackMark) && !state.responseActive && !state.assistantSpeaking;\n      const probableSelfEcho = bufferedPlaybackOnly && state.lastAssistantAudioDoneAt > 0 && Date.now() - state.lastAssistantAudioDoneAt < 350;\n      if (probableSelfEcho) {\n        app.log.info({ sinceAudioDoneMs: Date.now() - state.lastAssistantAudioDoneAt }, "Écho probable juste après la voix de Tom : pas de coupure");\n      } else {\n        state.pendingConversationResponse = false;\n        cancelActiveResponse();\n        app.log.info("Interruption client réelle : audio de Tom coupé");\n      }\n    }\n  }\n\n  if (event.type === "input_audio_buffer.speech_stopped" && state.greetingSpeechStartedBeforeConversation) {\n    state.greetingSpeechStartedBeforeConversation = false;\n    state.discardNextGreetingTranscript = true;\n  }\n}`,
    "anti-écho propre et barge-in conversation",
  ),
);

patches.push(
  patch(
    `          if (!state.conversationModeEnabled) {\n            app.log.info(\n              { callerMessage, phase: state.phase },\n              state.closingStarted\n                ? "Transcription ignorée pendant la clôture"\n                : "Transcription ignorée pendant l'accueil"\n            );\n            return;\n          }\n\n          if (state.closingStarted || state.pendingHangup || state.hangupMark) {`,
    `          if (!state.conversationModeEnabled) {\n            if (state.discardNextGreetingTranscript) state.discardNextGreetingTranscript = false;\n            app.log.info(\n              { callerMessage, phase: state.phase },\n              state.closingStarted\n                ? "Transcription ignorée pendant la clôture"\n                : "Transcription ignorée pendant l'accueil"\n            );\n            return;\n          }\n\n          if (state.discardNextGreetingTranscript) {\n            state.discardNextGreetingTranscript = false;\n            app.log.info({ callerMessage }, "Transcription d'un tour commencé pendant l'accueil ignorée sans contaminer le tour suivant");\n            return;\n          }\n\n          if (state.closingStarted || state.pendingHangup || state.hangupMark) {`,
    "aucun drapeau anti-écho ne survit au bon tour",
  ),
);

patches.push(
  patch(
    `      if (event.type === "response.output_audio.done") {\n        app.log.info(`,
    `      if (event.type === "response.output_audio.done") {\n        if (state.phase === "conversation") state.lastAssistantAudioDoneAt = Date.now();\n        app.log.info(`,
    "horodatage fin audio conversation",
  ),
);

patches.push(
  patch(
    `         const normalizedCallerMessage = normalizeText(callerMessage);\n\nif (\n  normalizedCallerMessage.includes("entretien") ||\n  normalizedCallerMessage.includes("maintenance")\n) {`,
    `         const normalizedCallerMessage = normalizeText(callerMessage);\n\nconst cleanServiceIntent = detectServiceIntent(callerMessage, state.explicitEquipment);\nif (cleanServiceIntent) {\n  state.serviceIntent = cleanServiceIntent;\n  app.log.info({ serviceIntent: cleanServiceIntent }, "Intention de service déterminée par le contrôleur propre");\n}\n\nif (\n  normalizedCallerMessage.includes("entretien") ||\n  normalizedCallerMessage.includes("maintenance") ||\n  normalizedCallerMessage.includes("nettoyage") ||\n  normalizedCallerMessage.includes("désinfection") ||\n  normalizedCallerMessage.includes("desinfection")\n) {`,
    "nettoyage et désinfection sont des entretiens",
  ),
);

patches.push(
  patch(
    `         if (callerIsClosing(callerMessage)) {`,
    `         if (state.customerStatus === null && relationshipProvesExistingCustomer(callerMessage)) {\n  state.customerStatus = "existing";\n  state.awaitingCustomerStatus = false;\n  setFlowStage(state.identityKnown ? "qualification" : "identity", "relation client déjà prouvée par la phrase");\n  addSystemContext("STATUT CLIENT DÉJÀ PROUVÉ PAR L'APPELANT : client existant. Ne demandez pas s'il est déjà client.");\n  app.log.info({ callerMessage }, "Relation client déjà prouvée : question statut évitée");\n}\n\n         if (callerIsClosing(callerMessage)) {`,
    "la phrase vous me l'avez installée suffit",
  ),
);

patches.push(
  patch(
    `          // V2.9 : statut client explicite, indépendant du raisonnement du modèle.\nif (\n  flowStageAtTurnStart === "customer_status" &&`,
    `          const cleanAdministrativeStages = new Set(["customer_status", "identity", "city", "address", "callback", "callback_number", "qualification"]);\n          if (flowStageAtTurnStart === "need" && isQuestionAnnouncement(callerMessage)) {\n            sendToOpenAI({\n              type: "response.create",\n              response: { output_modalities: ["audio"], instructions: 'Dites exactement et uniquement : "Bien sûr, je vous écoute." Puis attendez la question du client sans changer d’étape.' },\n            });\n            return;\n          }\n\n          if (\n            cleanAdministrativeStages.has(flowStageAtTurnStart) &&\n            looksLikeLateralQuestion(callerMessage) &&\n            !validExpectedAnswerForStage(flowStageAtTurnStart, callerMessage, state)\n          ) {\n            const pendingQuestion = pendingQuestionForStage(flowStageAtTurnStart, state);\n            if (flowStageAtTurnStart === "qualification") state.suppressNextQualificationCount = true;\n            const instruction = isQuestionAnnouncement(callerMessage)\n              ? 'Dites exactement et uniquement : "Bien sûr, je vous écoute." Puis attendez la vraie question du client. Ne changez pas d’étape.'\n              : pendingQuestion\n                ? 'Répondez brièvement à la question du client avec uniquement les informations fiables disponibles, sans rien inventer. Puis terminez exactement par cette question : "' + pendingQuestion + '". Ne changez pas d’étape et ne considérez pas cette parenthèse comme une incompréhension.'\n                : 'Répondez brièvement à la question du client avec uniquement les informations fiables disponibles. Ne changez pas d’étape.';\n            app.log.info({ flowStageAtTurnStart, callerMessage }, "Question latérale : étape conservée sans incompréhension");\n            sendToOpenAI({ type: "response.create", response: { output_modalities: ["audio"], instructions: instruction } });\n            return;\n          }\n\n          // V2.9 : statut client explicite, indépendant du raisonnement du modèle.\nif (\n  flowStageAtTurnStart === "customer_status" &&`,
    "parenthèses client sans perte du parcours",
  ),
);

patches.push(
  patch(
    `  const customerStatus = extractCustomerStatusAnswer(callerMessage);`,
    `  const customerStatus = extractCustomerStatusClean(callerMessage);`,
    "statut client naturel déterministe",
  ),
);

patches.push(
  patch(
    `           if (flowStageAtTurnStart === "identity") {\n              detectedName = extractDirectIdentityAnswer(callerMessage);\n            }`,
    `           if (flowStageAtTurnStart === "identity") {\n              detectedName = extractIdentityClean(callerMessage);\n            }`,
    "identité stricte au lieu du parseur permissif",
  ),
);

patches.push(
  patch(
    `            if (!detectedName) {\n              detectedName = extractNameCandidate(callerMessage);\n            }`,
    `            if (!detectedName && flowStageAtTurnStart !== "identity") {\n              detectedName = extractNameCandidate(callerMessage);\n            }`,
    "pas de second parseur permissif sur une réponse identité",
  ),
);

patches.push(
  patch(
    `            } else if (flowStageAtTurnStart === "identity") {\n              nextRecoveryInstruction("identity");\n              app.log.info(\n                { callerMessage },\n                "Réponse reçue mais identité non validée"\n              );\n            }`,
    `            } else if (flowStageAtTurnStart === "identity") {\n              if (state.customerStatus === "existing") {\n                state.identityKnown = true;\n                state.identityName = "Client existant - à retrouver par téléphone";\n                state.identityFallbackByPhone = true;\n                clearRecovery("identity");\n                setFlowStage("qualification", "client existant : nom non compris, téléphone suffisant");\n                addSystemContext("CLIENT EXISTANT : le nom n'a pas été compris. Ne redemandez jamais le nom pendant cet appel. Le dossier sera retrouvé grâce au numéro de rappel.");\n                app.log.info({ callerMessage }, "Nom client existant non compris : aucune deuxième interrogation");\n              } else {\n                nextRecoveryInstruction("identity");\n                app.log.info({ callerMessage }, "Réponse reçue mais identité non validée");\n              }\n            }`,
    "un seul essai nom pour client existant",
  ),
);

patches.push(
  patch(
    `   if (state.serviceIntent === "devis_installation") {\n  setFlowStage(`,
    `   if (state.serviceIntent === "devis_installation") {\n  if (state.customerStatus === "existing" && !state.knownCustomerAddress) {\n    setFlowStage("callback", "client existant sans adresse dossier : téléphone prioritaire");\n    return { stage: "callback", instructions: 'Dites exactement et uniquement : "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Puis attendez la réponse.' };\n  }\n  setFlowStage(`,
    "devis existant sans dossier : pas d'interrogatoire adresse",
  ),
);

patches.push(
  patch(
    `   if (state.serviceIntent === "entretien") {\n  setFlowStage(`,
    `   if (state.serviceIntent === "entretien") {\n  if (state.customerStatus === "existing" && !state.knownCustomerAddress) {\n    setFlowStage("callback", "client existant sans adresse dossier : téléphone prioritaire");\n    return { stage: "callback", instructions: 'Dites exactement et uniquement : "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Puis attendez la réponse.' };\n  }\n  setFlowStage(`,
    "entretien existant sans dossier : pas d'interrogatoire adresse",
  ),
);

patches.push(
  patch(
    `   if (\n  state.flowStage === "address" &&\n  !state.interventionAddress\n) {\n    \n  return {`,
    `   if (\n  state.flowStage === "address" &&\n  !state.interventionAddress\n) {\n    if (state.customerStatus === "existing" && !state.knownCustomerAddress) {\n      setFlowStage("callback", "client existant sans adresse dossier : téléphone prioritaire");\n      return { stage: "callback", instructions: 'Dites exactement et uniquement : "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Puis attendez la réponse.' };\n    }\n    \n  return {`,
    "dépannage existant sans dossier : pas d'interrogatoire adresse",
  ),
);

patches.push(
  patch(
    `   const identityGuard =\n  state.identityKnown && state.identityName\n    ? \`IDENTITÉ VERROUILLÉE : l'identité enregistrée de l'appelant est "\${state.identityName}". N'utilisez jamais un autre prénom ou nom. Ne devinez jamais un prénom à partir de la conversation. Il est préférable de rester neutre plutôt que d'appeler le client par son prénom.\`\n    : "IDENTITÉ NON CONFIRMÉE : n'appelez jamais l'appelant par un prénom ou un nom tant que son identité n'a pas été explicitement enregistrée.";\n\nconst recoveryOverride = state.recoveryPrompt;\nstate.recoveryPrompt = null;\n\nconst responseInstructions = [\n  recoveryOverride || flowLock?.instructions,\n  identityGuard,\n  TOM_CONVERSATION_GUIDANCE,\n]\n  .filter(Boolean)\n  .join("\\n\\n");`,
    `   const identityGuard =\n  state.identityFallbackByPhone\n    ? "CLIENT EXISTANT À RETROUVER PAR TÉLÉPHONE : ne demandez plus jamais le nom ni le prénom et restez neutre dans la façon de vous adresser au client."\n    : state.identityKnown && state.identityName\n      ? \`IDENTITÉ VERROUILLÉE : l'identité enregistrée de l'appelant est "\${state.identityName}". N'utilisez jamais un autre prénom ou nom.\`\n      : "IDENTITÉ NON CONFIRMÉE : n'appelez jamais l'appelant par un prénom ou un nom tant que son identité n'a pas été explicitement enregistrée.";\n\nconst recoveryOverride = state.recoveryPrompt;\nstate.recoveryPrompt = null;\nconst strictFlowStages = new Set(["customer-status", "existing-identity", "new-identity", "new-city", "address", "callback", "callback-number", "final-question", "closing"]);\nconst qualificationBrevity = flowLock?.stage?.startsWith("qualification")\n  ? "Réponse très courte : maximum 25 mots et une seule question utile. Ne faites jamais un résumé avant la question."\n  : null;\n\nconst responseInstructions = strictFlowStages.has(flowLock?.stage)\n  ? [recoveryOverride || flowLock?.instructions, identityGuard].filter(Boolean).join("\\n\\n")\n  : [recoveryOverride || flowLock?.instructions, identityGuard, qualificationBrevity, TOM_CONVERSATION_GUIDANCE].filter(Boolean).join("\\n\\n");`,
    "étapes administratives strictes sans phrases parasites",
  ),
);

patches.push(
  patch(
    `  const nothingElseToAdd =\n    normalizedFinalAnswer === "non" ||\n    normalizedFinalAnswer === "non merci" ||\n    normalizedFinalAnswer === "c est tout" ||\n    normalizedFinalAnswer === "c'est tout" ||\n    normalizedFinalAnswer === "rien d autre" ||\n    normalizedFinalAnswer === "rien d'autre" ||\n    normalizedFinalAnswer === "ça ira" ||\n    normalizedFinalAnswer === "ca ira" ||\n    normalizedFinalAnswer === "c est bon" ||\n    normalizedFinalAnswer === "c'est bon";\n\n  if (nothingElseToAdd || callerIsClosing(callerMessage)) {`,
    `  const cleanFinalKind = finalAnswerKind(callerMessage);\n  const nothingElseToAdd = cleanFinalKind === "nothing_else" || cleanFinalKind === "followup_then_close";\n\n  if (cleanFinalKind === "followup_then_close") {\n    addSystemContext(\`INFORMATION AJOUTÉE EN FIN D'APPEL : \${callerMessage}. Conservez cette information dans la demande, sans promettre de délai.\`);\n  }\n\n  if (nothingElseToAdd || callerIsClosing(callerMessage)) {`,
    "fin naturelle non c'est bon et rappel demandé",
  ),
);

patches.push(
  patch(
    `      "Le client vient de poser une question ou d'ajouter une information après la question finale. Traitez uniquement ce qu'il vient de dire. S'il pose une question, répondez-y brièvement avec uniquement les informations fiables disponibles. Si vous ne connaissez pas la réponse, dites-le simplement sans inventer. S'il ajoute une information, prenez-la en compte sans la reformuler longuement. Ne reposez jamais la question finale. Ensuite, clôturez une seule fois avec une formule courte."`,
    `      "Le client vient de poser une vraie question ou d'ajouter une information après la question finale. Répondez brièvement avec uniquement les informations fiables, sans inventer. Ne reposez jamais la question finale et ne demandez jamais l'identité à nouveau. Terminez obligatoirement votre réponse par une formule de clôture courte se terminant par : Bonne journée."`,
    "final followup clôture vraiment l'appel",
  ),
);

patches.push(
  patch(
    `  if (state.flowStage === "qualification" &&\n  assistantText.includes("?")\n) {\n  state.qualificationQuestionCount += 1;`,
    `  if (state.flowStage === "qualification" &&\n  assistantText.includes("?") &&\n  !state.suppressNextQualificationCount\n) {\n  state.qualificationQuestionCount += 1;`,
    "une parenthèse ne consomme pas une question technique",
  ),
);

patches.push(
  patch(
    `        if (assistantAskedForIdentity(assistantText)) {`,
    `        if (state.suppressNextQualificationCount) state.suppressNextQualificationCount = false;\n\n        if (assistantAskedForIdentity(assistantText)) {`,
    "réinitialise la protection qualification",
  ),
);

patches.push(
  patch(
    `  const spontaneousCity = extractCityCandidate(callerMessage);\n\n  if (spontaneousCity) {\n    state.interventionCity = spontaneousCity;\n    state.cityZoneStatus = classifyServiceArea(spontaneousCity);`,
    `  const rawSpontaneousCity = extractCityCandidate(callerMessage);\n  const sectorService = getSectorService({ serviceIntent: state.serviceIntent, equipment: state.explicitEquipment, text: state.callerMessages.join(" ") });\n  const sectorDecision = rawSpontaneousCity ? classifySectorRequest({ city: rawSpontaneousCity, service: sectorService, existingCustomer: state.customerStatus === "existing" }) : null;\n  const spontaneousCity = state.customerStatus === "new" && sectorDecision?.status === "unknown" ? null : rawSpontaneousCity;\n\n  if (rawSpontaneousCity && !spontaneousCity) {\n    state.pendingCityCandidate = rawSpontaneousCity;\n    state.awaitingPostalCode = true;\n    app.log.info({ cityCandidate: rawSpontaneousCity }, "Ville incertaine : code postal requis");\n  }\n\n  if (spontaneousCity) {\n    state.interventionCity = sectorDecision?.city || spontaneousCity;\n    state.cityZoneStatus = state.customerStatus === "new" ? sectorStatusToZone(sectorDecision?.status) : classifyServiceArea(spontaneousCity);`,
    "ville spontanée contrôlée par le secteur validé",
  ),
);

patches.push(
  patch(
    `          // V2.9 : une ville demandée ou corrigée vient de la transcription client.`,
    `          if (flowStageAtTurnStart === "city" && state.awaitingPostalCode) {\n            const postalCode = extractPostalCode(callerMessage);\n            if (!postalCode) {\n              const recoveryInstruction = nextRecoveryInstruction("city");\n              state.recoveryPrompt = null;\n              sendToOpenAI({ type: "response.create", response: { output_modalities: ["audio"], instructions: recoveryInstruction.replace(/nom de la ville/gi, "code postal") } });\n              return;\n            }\n\n            const sectorService = getSectorService({ serviceIntent: state.serviceIntent, equipment: state.explicitEquipment, text: state.callerMessages.join(" ") });\n            const postalDecision = classifySectorRequest({ postalCode, service: sectorService, existingCustomer: false });\n            state.interventionPostalCode = postalCode;\n            state.awaitingPostalCode = false;\n            state.cityZoneStatus = sectorStatusToZone(postalDecision.status);\n\n            if (postalDecision.status === "no") {\n              sendOutOfSectorClosing(state.pendingCityCandidate || "le secteur du " + postalCode);\n              return;\n            }\n\n            state.interventionCity = postalDecision.city || state.pendingCityCandidate || "Code postal " + postalCode;\n            state.pendingCityCandidate = null;\n            setFlowStage("qualification", "zone confirmée ou à vérifier par code postal");\n            app.log.info({ postalCode, city: state.interventionCity, decision: postalDecision.status }, "Code postal utilisé pour sécuriser le secteur");\n            requestConversationResponse("postal-code-confirmed");\n            return;\n          }\n\n          // V2.9 : une ville demandée ou corrigée vient de la transcription client.`,
    "code postal parlé intégré au parcours propre",
  ),
);

patches.push(
  patch(
    `            const cityCandidate = extractCityCandidate(callerMessage, true);`,
    `            const cityCandidate = extractCityCandidate(callerMessage, true);\n            const sectorService = getSectorService({ serviceIntent: state.serviceIntent, equipment: state.explicitEquipment, text: state.callerMessages.join(" ") });\n            const cleanSectorDecision = cityCandidate ? classifySectorRequest({ city: cityCandidate, service: sectorService, existingCustomer: state.customerStatus === "existing" }) : null;\n            if (cityCandidate && state.customerStatus === "new" && cleanSectorDecision?.status === "unknown") {\n              state.pendingCityCandidate = cityCandidate;\n              state.awaitingPostalCode = true;\n              state.interventionCity = null;\n              setFlowStage("city", "code postal requis pour ville inconnue");\n              sendToOpenAI({ type: "response.create", response: { output_modalities: ["audio"], instructions: 'Dites exactement et uniquement : "Je préfère vérifier pour ne pas me tromper de ville. Quel est le code postal de l’installation ?" Puis attendez la réponse.' } });\n              return;\n            }`,
    "ville demandée inconnue bascule vers code postal",
  ),
);

patches.push(
  patch(
    `              state.interventionCity = cityCandidate;\n              state.awaitingCity = false;\n              state.cityZoneStatus = classifyServiceArea(cityCandidate);`,
    `              state.interventionCity = cleanSectorDecision?.city || cityCandidate;\n              state.awaitingCity = false;\n              state.awaitingPostalCode = false;\n              state.pendingCityCandidate = null;\n              state.cityZoneStatus = state.customerStatus === "new" ? sectorStatusToZone(cleanSectorDecision?.status) : classifyServiceArea(state.interventionCity);`,
    "décision secteur selon activité et commune validée",
  ),
);

export const CLEAN_V1_PATCHES = patches.join("\n\n") + "\n\n";
