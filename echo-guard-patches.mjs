function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `  if (canInterrupt && !state.conversationModeEnabled &&\n      (state.phase === "greeting-generating" || state.phase === "greeting-playback")) {\n    if (state.greetingPlaybackFallback) {\n      clearTimeout(state.greetingPlaybackFallback);\n      state.greetingPlaybackFallback = null;\n    }\n    state.greetingPlaybackMark = null;\n    state.pendingConversationResponse = false;\n    cancelActiveResponse();\n    enableConversationMode("caller-barge-in-greeting");\n    app.log.info("Le client a parlé pendant l'accueil : Tom se tait et écoute");\n  } else if (`,
    `  if (canInterrupt && !state.conversationModeEnabled &&\n      (state.phase === "greeting-generating" || state.phase === "greeting-playback")) {\n    // Protection anti-écho : pendant l'accueil, le téléphone peut renvoyer la voix\n    // de Tom vers l'entrée et déclencher le VAD comme si le client parlait.\n    // On laisse donc l'accueil se terminer. L'interruption reste active ensuite\n    // pendant toute la conversation.\n    app.log.info("Parole détectée pendant l'accueil : protection anti-écho, accueil conservé");\n  } else if (`,
    "protection anti-écho pendant accueil",
  ),
);

patches.push(
  patch(
    `        if (\n  state.lastConversationResponseAt === 0 &&\n  !isUsefulCallerMessage(callerMessage) &&\n  !detectedEquipment\n) {\n            const initialRecoveryInstruction = buildInitialRecoveryInstruction(callerMessage);`,
    `        if (\n  state.lastConversationResponseAt === 0 &&\n  normalizeText(callerMessage) === "bonjour"\n) {\n            app.log.info(\n              { callerMessage },\n              "Écho probable du bonjour d'accueil ignoré"\n            );\n            return;\n          }\n\n        if (\n  state.lastConversationResponseAt === 0 &&\n  !isUsefulCallerMessage(callerMessage) &&\n  !detectedEquipment\n) {\n            const initialRecoveryInstruction = buildInitialRecoveryInstruction(callerMessage);`,
    "ignore écho bonjour initial",
  ),
);

export const ECHO_GUARD_PATCHES = patches.join("\n\n") + "\n\n";
