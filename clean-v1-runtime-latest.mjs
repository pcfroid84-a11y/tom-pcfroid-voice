import { CLEAN_V1_FINAL_PATCHES } from "./clean-v1-runtime-final.mjs";

function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    'from "./clean-v1-core.mjs";',
    'from "./clean-v1-core-latest.mjs";',
    "statut pas du tout et identité sans hésitation",
  ),
);

patches.push(
  patch(
    'from "./sector-rules.mjs";',
    'from "./sector-rules-latest.mjs";',
    "code postal oral ambigu sécurisé",
  ),
);

patches.push(
  patch(
    `              const recoveryInstruction = nextRecoveryInstruction("city");\n              state.recoveryPrompt = null;\n              sendToOpenAI({ type: "response.create", response: { output_modalities: ["audio"], instructions: recoveryInstruction.replace(/nom de la ville/gi, "code postal") } });\n              return;`,
    `              state.recoveryPrompt = null;\n              app.log.info({ callerMessage }, "Code postal incertain : nouvelle demande sans décision secteur");\n              sendToOpenAI({\n                type: "response.create",\n                response: {\n                  output_modalities: ["audio"],\n                  instructions: 'Dites exactement et uniquement : "Je n’ai pas bien compris le code postal. Pouvez-vous me le répéter, s’il vous plaît ?" Aucun mot avant, aucun mot après. Ne prenez aucune décision de secteur tant que le code postal n’est pas certain.',\n                },\n              });\n              return;`,
    "code postal incertain redemandé sans refus",
  ),
);

patches.push(
  patch(
    `         if (callerIsClosing(callerMessage) && flowStageAtTurnStart !== "final_question") {`,
    `         if (flowStageAtTurnStart === "city" && callerIsClosing(callerMessage)) {\n  state.recoveryPrompt = null;\n  state.pendingCityCandidate = null;\n  app.log.info({ callerMessage }, "Formule de départ détectée pendant la ville : pas de raccrochage, ville redemandée");\n  sendToOpenAI({\n    type: "response.create",\n    response: {\n      output_modalities: ["audio"],\n      instructions: 'Dites exactement et uniquement : "Je n’ai pas bien compris la ville. Vous pouvez me la répéter, s’il vous plaît ?" Aucun mot avant, aucun mot après. Restez à l’étape ville et ne raccrochez pas.',\n    },\n  });\n  return;\n}\n\n         if (callerIsClosing(callerMessage) && flowStageAtTurnStart !== "final_question") {`,
    "une formule de départ mal transcrite ne ferme jamais l'appel pendant la ville",
  ),
);

patches.push(
  patch(
    `          instructions:\n            \`Dites exactement et uniquement : "D'accord, \${safeCity}. Pour un nouveau client, nous intervenons principalement dans le Vaucluse et les communes limitrophes de notre secteur. \${safeCity} est malheureusement trop éloigné pour que nous prenions en charge cette intervention. Merci de nous avoir appelés. Au revoir, bonne journée." Ne posez aucune autre question.\`,`,
    `          instructions:\n            \`Output ONLY this exact French sentence with no introduction, no commentary and no extra words. Your first spoken words MUST be "D'accord". Exact sentence: "D'accord, \${safeCity}. Pour un nouveau client, nous intervenons principalement dans le Vaucluse et les communes limitrophes de notre secteur. \${safeCity} est malheureusement trop éloigné pour que nous prenions en charge cette intervention. Merci de nous avoir appelés. Au revoir, bonne journée." Stop immediately after "bonne journée".\`,`,
    "clôture hors secteur sans phrase parasite",
  ),
);

patches.push(
  patch(
    `    hangupFallback: null,\n    closed: false,`,
    `    hangupFallback: null,\n    hangupGraceTimer: null,\n    hangupGraceActive: false,\n    closed: false,`,
    "état délai silence avant raccrochage",
  ),
);

patches.push(
  patch(
    `  if (event.type === "input_audio_buffer.speech_started") {\n    if (!state.conversationModeEnabled`,
    `  if (event.type === "input_audio_buffer.speech_started") {\n    if (state.hangupGraceActive && state.hangupGraceTimer) {\n      clearTimeout(state.hangupGraceTimer);\n      state.hangupGraceTimer = null;\n      app.log.info("Client reparle pendant les 3 secondes : raccrochage suspendu");\n    }\n    if (!state.conversationModeEnabled`,
    "parole client suspend le délai de raccrochage",
  ),
);

patches.push(
  patch(
    `  if (event.type === "input_audio_buffer.speech_stopped" && state.greetingSpeechStartedBeforeConversation) {`,
    `  if (event.type === "input_audio_buffer.speech_stopped" && state.hangupGraceActive && !state.hangupGraceTimer) {\n    app.log.info("Fin de parole client pendant la grâce : nouveau délai de 3 secondes");\n    state.hangupGraceTimer = setTimeout(() => {\n      state.hangupGraceTimer = null;\n      state.hangupGraceActive = false;\n      if (socket.readyState === WebSocket.OPEN) socket.close(1000, "call-complete");\n    }, 3000);\n  }\n\n  if (event.type === "input_audio_buffer.speech_stopped" && state.greetingSpeechStartedBeforeConversation) {`,
    "trois secondes de silence après la dernière parole client",
  ),
);

patches.push(
  patch(
    `            app.log.info("Fin audio confirmée par Twilio ; pause de 3 secondes avant raccrochage");\n            setTimeout(() => {\n              if (socket.readyState === WebSocket.OPEN) {\n                socket.close(1000, "call-complete");\n              }\n            }, 3000);`,
    `            app.log.info("Fin audio confirmée par Twilio ; attente de 3 secondes de silence avant raccrochage");\n            state.hangupMark = null;\n            state.hangupGraceActive = true;\n            if (state.hangupGraceTimer) clearTimeout(state.hangupGraceTimer);\n            state.hangupGraceTimer = setTimeout(() => {\n              state.hangupGraceTimer = null;\n              state.hangupGraceActive = false;\n              if (socket.readyState === WebSocket.OPEN) {\n                socket.close(1000, "call-complete");\n              }\n            }, 3000);`,
    "raccrochage après trois secondes de silence réel",
  ),
);

patches.push(
  patch(
    `    if (state.hangupFallback) clearTimeout(state.hangupFallback);\n    if (state.greetingPlaybackFallback) clearTimeout(state.greetingPlaybackFallback);`,
    `    if (state.hangupFallback) clearTimeout(state.hangupFallback);\n    if (state.hangupGraceTimer) clearTimeout(state.hangupGraceTimer);\n    state.hangupGraceTimer = null;\n    state.hangupGraceActive = false;\n    if (state.greetingPlaybackFallback) clearTimeout(state.greetingPlaybackFallback);`,
    "nettoyage délai de raccrochage à la fermeture",
  ),
);

export const CLEAN_V1_LATEST_PATCHES = CLEAN_V1_FINAL_PATCHES + patches.join("\n\n") + "\n\n";
