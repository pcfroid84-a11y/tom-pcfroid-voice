function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `const looksLikeSideQuestion = Boolean(sideQuestionPending) && (`,
    `const naturalCustomerStatusHint = (() => {
  const value = normalizedCallerMessage;

  if (
    /\\b(premiere|première)\\s+(demande|fois)\\b/.test(value) ||
    /\\bjamais\\s+(appele|appelé|fait appel)\\b/.test(value) ||
    /\\bje n[' ]?ai jamais\\s+(appele|appelé|fait appel)\\b/.test(value) ||
    /\\bje ne suis pas(?: encore)? client(?:e)?\\b/.test(value) ||
    /\\bpas encore client(?:e)?\\b/.test(value) ||
    /\\bnouveau client\\b/.test(value) ||
    /\\bnouvelle cliente\\b/.test(value)
  ) {
    return "new";
  }

  if (
    /\\b(deja|déjà) client(?:e)?\\b/.test(value) ||
    /\\bje suis client(?:e)?\\b/.test(value) ||
    /\\bj[' ]?ai (deja|déjà) (appele|appelé|fait appel)\\b/.test(value) ||
    /\\bvous (etes|êtes) (deja|déjà) venu(?:s)?\\b/.test(value) ||
    /\\bj[' ]?ai un dossier chez vous\\b/.test(value) ||
    /\\bvous connaissez mon dossier\\b/.test(value)
  ) {
    return "existing";
  }

  return null;
})();

const isQuestionIntro =
  /^(?:bonjour\\s+)?(?:(?:j[' ]?ai|j aurais|j'aurais|je voudrais|je voulais)\\s+)?(?:juste\\s+)?(?:une\\s+)?(?:petite\\s+)?question(?:\\s+(?:a|à|sur|pour|concernant)\\b.*)?$/.test(normalizedCallerMessage) ||
  /^(?:est ce que |est-ce que )?je peux vous poser (?:une )?(?:petite )?question(?:\\s+.*)?$/.test(normalizedCallerMessage) ||
  /^j aimerais vous poser (?:une )?(?:petite )?question(?:\\s+.*)?$/.test(normalizedCallerMessage);

if (
  isQuestionIntro &&
  !state.partnerOrSupplierFlow &&
  !callerIsClosing(callerMessage)
) {
  if (
    /\\b(entretien|maintenance|nettoy\\w*|desinfect\\w*)\\b/.test(normalizedCallerMessage)
  ) {
    state.serviceIntent = "entretien";
  }

  app.log.info(
    { callerMessage, flowStage: flowStageAtTurnStart },
    "Parenthèse annoncée : Tom garde l'étape et laisse poser la question"
  );

  sendToOpenAI({
    type: "response.create",
    response: {
      output_modalities: ["audio"],
      instructions:
        'Répondez exactement et uniquement : "Bien sûr, je vous écoute." Puis taisez-vous. Ne reposez pas encore la question précédente et ne changez pas d’étape.'
    }
  });

  return;
}

const looksLikeSideQuestion = Boolean(sideQuestionPending) && (`,
    "parenthèse client sans perte d'étape + statut naturel",
  ),
);

patches.push(
  patch(
    `sideQuestionAlsoAnswersPendingField = Boolean(\n      extractCustomerStatusAnswer(callerMessage)\n    );`,
    `sideQuestionAlsoAnswersPendingField = Boolean(\n      extractCustomerStatusAnswer(callerMessage) || naturalCustomerStatusHint\n    );`,
    "question latérale peut aussi contenir le statut client naturel",
  ),
);

patches.push(
  patch(
    `  const customerStatus = extractCustomerStatusAnswer(callerMessage);`,
    `  const customerStatus =\n    extractCustomerStatusAnswer(callerMessage) || naturalCustomerStatusHint;`,
    "première demande / première fois reconnues comme nouveau client",
  ),
);

export const DETOUR_HARDENING_PATCHES = patches.join("\n\n") + "\n\n";
