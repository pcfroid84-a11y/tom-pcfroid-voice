function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `    playbackMark: null,\n    n8nLoading: false,`,
    `    playbackMark: null,\n    lastAssistantAudioDoneAt: 0,\n    ignoreNextGreetingSpeechTranscript: false,\n    n8nLoading: false,`,
    "état anti-écho conversation et accueil",
  ),
);

patches.push(
  patch(
    `  if (canInterrupt && !state.conversationModeEnabled &&\n      (state.phase === "greeting-generating" || state.phase === "greeting-playback")) {\n    if (state.greetingPlaybackFallback) {\n      clearTimeout(state.greetingPlaybackFallback);\n      state.greetingPlaybackFallback = null;\n    }\n    state.greetingPlaybackMark = null;\n    state.pendingConversationResponse = false;\n    cancelActiveResponse();\n    enableConversationMode("caller-barge-in-greeting");\n    app.log.info("Le client a parlé pendant l'accueil : Tom se tait et écoute");\n  } else if (`,
    `  if (canInterrupt && !state.conversationModeEnabled &&\n      (state.phase === "greeting-generating" || state.phase === "greeting-playback")) {\n    // Protection anti-écho : pendant l'accueil, le téléphone peut renvoyer la voix\n    // de Tom vers l'entrée et déclencher le VAD comme si le client parlait.\n    // Toute transcription issue de ce tour sera ignorée, même si elle arrive\n    // juste après le passage en mode conversation.\n    state.ignoreNextGreetingSpeechTranscript = true;\n    app.log.info("Parole détectée pendant l'accueil : protection anti-écho, accueil conservé");\n  } else if (`,
    "protection anti-écho pendant accueil",
  ),
);

patches.push(
  patch(
    `  } else if (\n    canInterrupt &&\n    state.conversationModeEnabled &&\n    (state.responseActive || state.assistantSpeaking || state.playbackMark)\n  ) {\n    state.pendingConversationResponse = false;\n    cancelActiveResponse();\n    app.log.info("Interruption client : audio de Tom coupé immédiatement");\n  }`,
    `  } else if (\n    canInterrupt &&\n    state.conversationModeEnabled &&\n    (state.responseActive || state.assistantSpeaking || state.playbackMark)\n  ) {\n    const bufferedPlaybackOnly =\n      Boolean(state.playbackMark) &&\n      !state.responseActive &&\n      !state.assistantSpeaking;\n    const probableSelfEcho =\n      bufferedPlaybackOnly &&\n      state.lastAssistantAudioDoneAt > 0 &&\n      Date.now() - state.lastAssistantAudioDoneAt < 600;\n\n    if (probableSelfEcho) {\n      app.log.info(\n        { sinceAudioDoneMs: Date.now() - state.lastAssistantAudioDoneAt },\n        "Signal VAD juste après la fin audio : écho probable, Tom n'est pas coupé"\n      );\n    } else {\n      state.pendingConversationResponse = false;\n      cancelActiveResponse();\n      app.log.info("Interruption client : audio de Tom coupé immédiatement");\n    }\n  }`,
    "anti-écho juste après fin audio sans supprimer vraie interruption",
  ),
);

patches.push(
  patch(
    `      if (event.type === "response.output_audio.done") {\n        app.log.info(`,
    `      if (event.type === "response.output_audio.done") {\n        if (state.phase === "conversation") {\n          state.lastAssistantAudioDoneAt = Date.now();\n        }\n        app.log.info(`,
    "horodatage fin audio pour fenêtre anti-écho",
  ),
);

patches.push(
  patch(
    `          if (!state.conversationModeEnabled) {\n            app.log.info(\n              { callerMessage, phase: state.phase },\n              state.closingStarted\n                ? "Transcription ignorée pendant la clôture"\n                : "Transcription ignorée pendant l'accueil"\n            );\n            return;\n          }\n\n          if (state.closingStarted || state.pendingHangup || state.hangupMark) {`,
    `          if (!state.conversationModeEnabled) {\n            app.log.info(\n              { callerMessage, phase: state.phase },\n              state.closingStarted\n                ? "Transcription ignorée pendant la clôture"\n                : "Transcription ignorée pendant l'accueil"\n            );\n            return;\n          }\n\n          if (state.ignoreNextGreetingSpeechTranscript) {\n            state.ignoreNextGreetingSpeechTranscript = false;\n            app.log.info(\n              { callerMessage },\n              "Transcription issue d'un signal commencé pendant l'accueil ignorée comme écho"\n            );\n            return;\n          }\n\n          if (state.closingStarted || state.pendingHangup || state.hangupMark) {`,
    "ignore transcription provenant de l'écho d'accueil",
  ),
);

patches.push(
  patch(
    `  const normalizedCandidate = normalizeText(candidate);\n  if (FILLER_MESSAGES.has(normalizedCandidate)) return null;`,
    `  const normalizedCandidate = normalizeText(candidate);\n  if (["ca", "ça", "c est ca", "c'est ça", "c est ça", "c'est ca"].includes(normalizedCandidate)) return null;\n  if (FILLER_MESSAGES.has(normalizedCandidate)) return null;`,
    "ça ne peut jamais devenir une identité",
  ),
);

export const ECHO_GUARD_PATCHES = patches.join("\n\n") + "\n\n";
