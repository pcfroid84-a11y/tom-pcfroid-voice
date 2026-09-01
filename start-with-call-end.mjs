import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("./server.js", import.meta.url);
const runtimePath = new URL("./.tom-server-runtime.mjs", import.meta.url);
let source = await readFile(sourcePath, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Patch fin d'appel impossible : ancre introuvable (${label})`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
`const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-appel";
`,
`import { buildCallEndPayload } from "./call-end-payload.mjs";
import { amplifyMulawBase64 } from "./audio-utils.mjs";
import { loadKnowledgeContext } from "./knowledge-loader.mjs";
import {
  TOM_CONVERSATION_GUIDANCE,
  buildInitialRecoveryInstruction,
  buildRecoveryInstruction,
  buildReassuringClosingInstructions,
} from "./conversation-guidance.mjs";

const PCFROID_KNOWLEDGE_CONTEXT = await loadKnowledgeContext();

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-appel";
const N8N_CALL_END_WEBHOOK_URL =
  process.env.N8N_CALL_END_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-fin-appel";
`,
"URL webhook fin d'appel + payload V1 + connaissances + conversation + audio"
);

replaceOnce(
`    n8nAttempts: 0,
    identityKnown: false,`,
`    n8nAttempts: 0,
    routingCategory: null,
    routingUrgency: null,
    callerMessages: [],
    callEndSent: false,
    callStartedAt: new Date().toISOString(),
    recoveryCounts: {},
    recoveryPrompt: null,
    identityKnown: false,`,
"état fin d'appel + relances naturelles"
);

replaceOnce(
`      const businessContext = buildBusinessContext(context, state.explicitEquipment);`,
`      state.routingCategory = context.routing?.category || null;
      state.routingUrgency = context.routing?.urgency ?? null;

      const businessContext = buildBusinessContext(context, state.explicitEquipment);`,
"routage n8n"
);

replaceOnce(
`          state.lastCallerMessage = callerMessage;

          // Un même tour client`,
`          state.lastCallerMessage = callerMessage;
          state.callerMessages.push(callerMessage);

          // Un même tour client`,
"historique appelant"
);

replaceOnce(
`          if (!state.identityKnown) {
            let detectedName = null;`,
`          // Sécurité V1 : si Tom est encore à l'étape identité mais a demandé la ville par erreur,
          // une réponse comme « Avignon » doit être mémorisée comme ville et jamais comme nom.
          let earlyCityCapturedWhileIdentity = false;
          if (
            !state.identityKnown &&
            flowStageAtTurnStart === "identity" &&
            state.awaitingCity &&
            !state.interventionCity
          ) {
            const earlyCity = extractCityCandidate(callerMessage);
            if (earlyCity) {
              state.interventionCity = earlyCity;
              state.cityZoneStatus = classifyServiceArea(earlyCity);
              state.awaitingCity = false;
              earlyCityCapturedWhileIdentity = true;

              addSystemContext(
                `VILLE D'INTERVENTION DÉJÀ COMPRISE : ${earlyCity}. Ne la redemandez pas. L'identité prénom et nom reste à demander maintenant.`
              );

              app.log.info(
                { city: earlyCity },
                "Ville captée pendant l'étape identité sans la confondre avec le nom"
              );
            }
          }

          if (!state.identityKnown && !earlyCityCapturedWhileIdentity) {
            let detectedName = null;`,
"protection ville prise pour identité"
);

replaceOnce(
`        instructions: SYSTEM_PROMPT,`,
`        instructions: SYSTEM_PROMPT + PCFROID_KNOWLEDGE_CONTEXT + TOM_CONVERSATION_GUIDANCE,`,
"injection base de connaissances et ton conversationnel PC Froid"
);

replaceOnce(
`          output: {
            format: { type: "audio/pcmu" },
            voice: "verse",
            speed: 1.10,
          },`,
`          output: {
            format: { type: "audio/pcmu" },
            voice: "verse",
            speed: 1.15,
          },`,
"voix légèrement plus rapide"
);

replaceOnce(
`        voice: "verse",
        speed: 1.10,
        maxOutputTokens: MAX_OUTPUT_TOKENS,`,
`        voice: "verse",
        speed: 1.15,
        maxOutputTokens: MAX_OUTPUT_TOKENS,`,
"journal vitesse voix"
);

replaceOnce(
`     if (
  event.type === "input_audio_buffer.speech_started" ||
  event.type === "input_audio_buffer.speech_stopped"
) {
  app.log.info(
    { eventType: event.type },
    "Détection parole client OpenAI"
  );
}`,
`     if (event.type === "input_audio_buffer.speech_started") {
  app.log.info(
    { eventType: event.type, phase: state.phase },
    "Détection début parole client OpenAI"
  );

  const canInterrupt =
    !state.closed &&
    !state.closingStarted &&
    !state.pendingHangup &&
    !state.hangupMark;

  if (canInterrupt && !state.conversationModeEnabled &&
      (state.phase === "greeting-generating" || state.phase === "greeting-playback")) {
    if (state.greetingPlaybackFallback) {
      clearTimeout(state.greetingPlaybackFallback);
      state.greetingPlaybackFallback = null;
    }
    state.greetingPlaybackMark = null;
    state.pendingConversationResponse = false;
    cancelActiveResponse();
    enableConversationMode("caller-barge-in-greeting");
    app.log.info("Le client a parlé pendant l'accueil : Tom se tait et écoute");
  } else if (
    canInterrupt &&
    state.conversationModeEnabled &&
    (state.responseActive || state.assistantSpeaking || state.playbackMark)
  ) {
    state.pendingConversationResponse = false;
    cancelActiveResponse();
    app.log.info("Interruption client : audio de Tom coupé immédiatement");
  }
}

if (event.type === "input_audio_buffer.speech_stopped") {
  app.log.info(
    { eventType: event.type, phase: state.phase },
    "Détection fin parole client OpenAI"
  );
}`,
"barge-in client : Tom se tait dès que le client parle"
);

replaceOnce(
`            media: { payload: event.delta },`,
`            media: { payload: amplifyMulawBase64(event.delta, 1.12) },`,
"léger gain de volume voix"
);

replaceOnce(
`  function setFlowStage(nextStage, reason = "") {`,
`  async function sendCallEndWebhook(trigger = "unknown") {
    if (state.callEndSent || !state.callSid) return;
    state.callEndSent = true;

    const payload = buildCallEndPayload(state, trigger);

    // Compatibilité avec le workflow n8n actuel : aucune valeur utile ne doit devenir undefined.
    payload.identity = payload.identity || "Non communiquée";
    payload.equipment = payload.equipment || "Non précisé";
    payload.city = payload.city || "Non précisée";
    payload.address = payload.address || "Non précisée";
    payload.important_information =
      payload.important_information || "Aucune transcription exploitable";
    payload.message_to_forward = payload.transcript || payload.reason;

    try {
      const response = await fetch(N8N_CALL_END_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("n8n fin d'appel HTTP " + response.status);
      }

      app.log.info(
        {
          callSid: state.callSid,
          category: payload.category,
          trigger,
          identityConfidence: payload.identity_confidence,
        },
        "Fin d'appel envoyée au workflow n8n SMS/mail - schéma V1"
      );
    } catch (error) {
      state.callEndSent = false;
      app.log.error(error, "Erreur webhook n8n de fin d'appel");
    }
  }

  function nextRecoveryInstruction(field) {
    const previous = Number(state.recoveryCounts?.[field] || 0);
    const attempt = previous + 1;
    state.recoveryCounts[field] = attempt;

    const instruction = buildRecoveryInstruction(field, {
      attempt,
      // Le transfert en direct reste volontairement désactivé tant que le numéro
      // humain et la reprise d'appel Twilio n'ont pas été validés en production.
      liveTransferAvailable: false,
    });

    state.recoveryPrompt = instruction;
    app.log.info({ field, attempt }, "Relance naturelle après réponse non comprise");
    return instruction;
  }

  function clearRecovery(field) {
    if (!field) return;
    state.recoveryCounts[field] = 0;
    if (state.recoveryPrompt) state.recoveryPrompt = null;
  }

  function setFlowStage(nextStage, reason = "") {`,
"fonction webhook fin d'appel V1 + relances naturelles"
);

replaceOnce(
`      ? 'If the client explicitly asks whether PC Froid handles climatisation maintenance or repair, output EXACTLY two sentences: first a brief yes statement "Oui, tout à fait, nous prenons en charge les climatisations." then exactly "Est-ce que vous êtes déjà client chez P C Froid ?" with one question mark only. If the client reports a climatisation symptom instead of asking a service question, output ONLY the status question "Est-ce que vous êtes déjà client chez P C Froid ?" with exactly one question mark. Never add technical diagnosis, technical questions, or reformulation. Stop after the question(s).'`,
`      ? state.serviceIntent === "entretien"
        ? 'DEMANDE D’ENTRETIEN OU DE RENDEZ-VOUS D’ENTRETIEN. Ne demandez surtout aucune date ni disponibilité. Dites exactement et uniquement : "Oui, bien sûr. Est-ce que vous êtes déjà client chez P C Froid ?" Puis arrêtez-vous et attendez la réponse.'
        : 'Si le client demande si PC Froid prend en charge la climatisation, répondez brièvement oui. Ensuite la seule question autorisée est exactement : "Est-ce que vous êtes déjà client chez P C Froid ?" Ne posez aucune question technique, ne demandez aucune date ni disponibilité et arrêtez-vous après cette question.'`,
"entretien : pas de faux rendez-vous avant statut client"
);

replaceOnce(
`          } else if (flowStageAtTurnStart === "identity") {
              app.log.info(
                { callerMessage },
                "Réponse reçue mais identité non validée"
              );
            }`,
`          } else if (flowStageAtTurnStart === "identity") {
              nextRecoveryInstruction("identity");
              app.log.info(
                { callerMessage },
                "Réponse reçue mais identité non validée"
              );
            }`,
"relance naturelle identité"
);

replaceOnce(
`                "Ville d'intervention enregistrée - V2.9"
              );
            }
          }`,
`                "Ville d'intervention enregistrée - V2.9"
              );
              clearRecovery("city");
            } else if (flowStageAtTurnStart === "city") {
              nextRecoveryInstruction("city");
            }
          }`,
"relance naturelle ville"
);

replaceOnce(
`  } else {
    addSystemContext(
      'La réponse reçue ne ressemble pas à une adresse d’intervention. Ne l’enregistrez pas comme adresse. Demandez simplement et uniquement : "Quelle est l’adresse d’intervention ?"'
    );
  }
}`,
`  } else {
    nextRecoveryInstruction("address");
  }
}`,
"relance naturelle adresse"
);

replaceOnce(
`  } else if (
    normalizedCallbackAnswer === "non" ||
    normalizedCallbackAnswer.startsWith("non ")
  ) {
    setFlowStage(
      "callback_number",
      "autre numéro de rappel demandé"
    );
  }
}`,
`  } else if (
    normalizedCallbackAnswer === "non" ||
    normalizedCallbackAnswer.startsWith("non ")
  ) {
    setFlowStage(
      "callback_number",
      "autre numéro de rappel demandé"
    );
  } else {
    nextRecoveryInstruction("callback");
  }
}`,
"relance naturelle confirmation numéro"
);

replaceOnce(
`  } else {
    addSystemContext(
      "Le numéro de rappel n’a pas été suffisamment clair. Demandez uniquement au client de répéter son numéro de téléphone, sans inventer ni compléter de chiffres."
    );
  }
}`,
`  } else {
    nextRecoveryInstruction("callback_number");
  }
}`,
"relance naturelle numéro dicté"
);

replaceOnce(
`  } else {
    cancelActiveResponse();

    setTimeout(() => {
      sendToOpenAI({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions:
            'Répondez exactement et uniquement : "Je n’ai pas bien compris. Est-ce que vous êtes déjà client chez P C Froid ?" Ne posez aucune autre question.'
        }
      });
    }, 80);

    return;
  }
}`,
`  } else {
    cancelActiveResponse();
    const recoveryInstruction = nextRecoveryInstruction("customer_status");
    state.recoveryPrompt = null;

    setTimeout(() => {
      sendToOpenAI({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions: recoveryInstruction,
        }
      });
    }, 80);

    return;
  }
}`,
"relance naturelle statut client"
);

replaceOnce(
`        if (
  state.lastConversationResponseAt === 0 &&
  !isUsefulCallerMessage(callerMessage) &&
  !detectedEquipment
) {
            app.log.info(
              { callerMessage },
              "Petit fragment initial ignoré - attente de la demande réelle"
            );
            return;
          }`,
`        if (
  state.lastConversationResponseAt === 0 &&
  !isUsefulCallerMessage(callerMessage) &&
  !detectedEquipment
) {
            const initialRecoveryInstruction = buildInitialRecoveryInstruction(callerMessage);
            state.lastConversationResponseAt = Date.now();
            app.log.info(
              { callerMessage },
              "Petit fragment initial reçu - Tom relance naturellement"
            );
            sendToOpenAI({
              type: "response.create",
              response: {
                output_modalities: ["audio"],
                instructions: initialRecoveryInstruction,
              },
            });
            return;
          }`,
"plus de silence après allô ou transcription initiale inexploitable"
);

replaceOnce(
`const responseInstructions = [
  flowLock?.instructions,
  identityGuard,
]
  .filter(Boolean)
  .join("\\n\\n");`,
`const recoveryOverride = state.recoveryPrompt;
state.recoveryPrompt = null;

const responseInstructions = [
  recoveryOverride || flowLock?.instructions,
  identityGuard,
  TOM_CONVERSATION_GUIDANCE,
]
  .filter(Boolean)
  .join("\\n\\n");`,
"priorité aux reformulations naturelles"
);

replaceOnce(
`   if (state.flowStage === "closing") {
  return {
    stage: "closing",
    instructions:
      'Si l’appelant vient de poser une dernière question, répondez-y brièvement et clairement. Ensuite clôturez une seule fois en indiquant que la demande va être transmise à l’équipe, puis souhaitez une bonne journée. Ne posez plus aucune question.',
  };
}`,
`   if (state.flowStage === "closing") {
  return {
    stage: "closing",
    instructions: buildReassuringClosingInstructions({
      serviceIntent: state.serviceIntent,
      equipment: state.explicitEquipment,
    }),
  };
}`,
"conclusion rassurante adaptée au motif"
);

replaceOnce(
`        case "stop":
          app.log.info("Flux Twilio arrêté");
          state.closed = true;`,
`        case "stop":
          app.log.info("Flux Twilio arrêté");
          void sendCallEndWebhook("twilio-stop");
          state.closed = true;`,
"événement stop Twilio"
);

replaceOnce(
`  socket.on("close", () => {
    state.closed = true;`,
`  socket.on("close", () => {
    void sendCallEndWebhook("socket-close");
    state.closed = true;`,
"fermeture socket Twilio"
);

await writeFile(runtimePath, source, "utf8");
await import(runtimePath.href + `?v=${Date.now()}`);