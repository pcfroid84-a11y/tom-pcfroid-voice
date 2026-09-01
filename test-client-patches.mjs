function patch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const patches = [];

patches.push(
  patch(
    `} from "./sector-rules.mjs";`,
    `} from "./sector-rules.mjs";\nimport { getTestClientByPhone } from "./test-client.mjs";`,
    "client test privé par numéro",
  ),
);

patches.push(
  patch(
    `    waitingExistingCustomerContext: false,`,
    `    waitingExistingCustomerContext: false,\n    testClientMatched: false,\n    testClientFirstName: null,`,
    "état client test reconnu",
  ),
);

patches.push(
  patch(
    `          state.calledPhone =\n            message.start.customParameters?.calledPhone || null;`,
    `          state.calledPhone =\n            message.start.customParameters?.calledPhone || null;\n\n          const testClient = getTestClientByPhone(state.callerPhone);\n          if (testClient?.known) {\n            state.testClientMatched = true;\n            state.testClientFirstName = testClient.firstName || null;\n            state.customerStatus = "existing";\n            state.identityKnown = Boolean(testClient.name);\n            state.identityName = testClient.name || null;\n            state.knownCustomerAddress = testClient.address || null;\n            app.log.info(\n              {\n                hasName: Boolean(testClient.name),\n                hasAddress: Boolean(testClient.address),\n              },\n              "Client test reconnu directement par le numéro appelant"\n            );\n          }`,
    "reconnaissance immédiate du client test",
  ),
);

patches.push(
  patch(
    `    if (!state.greetingText) {\n      state.greetingText = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];\n    }`,
    `    if (!state.greetingText) {\n      state.greetingText = state.testClientMatched && state.testClientFirstName\n        ? \`Bonjour \${state.testClientFirstName}, vous êtes bien chez PC Froid, et c'est Tom. Je vous écoute.\`\n        : GREETINGS[Math.floor(Math.random() * GREETINGS.length)];\n    }`,
    "accueil personnalisé client reconnu",
  ),
);

patches.push(
  patch(
    `  if (/^oui(?:\\s+oui)+$/.test(normalized)) return "existing";\n  if (/^non(?:\\s+non)+$/.test(normalized)) return "new";`,
    `  if (/^oui(?:\\s+oui)+$/.test(normalized)) return "existing";\n  if (/^(?:eh|et|ben|bah)\\s+oui$/.test(normalized)) return "existing";\n  if (/^non(?:\\s+non)+$/.test(normalized)) return "new";`,
    "eh oui et variantes reconnus comme client existant",
  ),
);

patches.push(
  patch(
    `    if (state.customerStatus === null) {`,
    `    if (state.customerStatus === null) {\n      const relationshipText = normalizeText(state.lastCallerMessage || "");\n      const existingRelationshipIsExplicit =\n        /\\b(vous m avez install|vous me l avez install|c est vous qui.*install|vous etes deja venu|vous etes deja intervenu|j ai deja fait appel a vous|vous m avez deja)\\w*/.test(relationshipText);\n\n      if (existingRelationshipIsExplicit) {\n        state.customerStatus = "existing";\n        state.awaitingCustomerStatus = false;\n        app.log.info(\n          { callerMessage: state.lastCallerMessage },\n          "Relation client déjà prouvée par la phrase : question statut évitée"\n        );\n      }\n    }\n\n    if (state.customerStatus === null) {`,
    "phrase qui prouve déjà la relation client",
  ),
);

patches.push(
  patch(
    `   const identityGuard =\n  state.identityKnown && state.identityName\n    ? \`IDENTITÉ VERROUILLÉE : l'identité enregistrée de l'appelant est "\${state.identityName}". N'utilisez jamais un autre prénom ou nom. Ne devinez jamais un prénom à partir de la conversation. Il est préférable de rester neutre plutôt que d'appeler le client par son prénom.\`\n    : "IDENTITÉ NON CONFIRMÉE : n'appelez jamais l'appelant par un prénom ou un nom tant que son identité n'a pas été explicitement enregistrée.";`,
    `   const identityGuard =\n  state.customerStatus === "existing" &&\n  state.identityName === "Client existant - nom à retrouver par téléphone"\n    ? "CLIENT EXISTANT NON IDENTIFIÉ PAR LE NOM : le numéro de rappel suffit pour retrouver le dossier. Ne demandez plus jamais le nom ni le prénom pendant cet appel. Restez neutre dans la façon de vous adresser au client."\n    : state.identityKnown && state.identityName\n      ? \`IDENTITÉ VERROUILLÉE : l'identité enregistrée de l'appelant est "\${state.identityName}". N'utilisez jamais un autre prénom ou nom. Ne devinez jamais un prénom à partir de la conversation. Il est préférable de rester neutre plutôt que d'appeler le client par son prénom.\`\n      : "IDENTITÉ NON CONFIRMÉE : n'appelez jamais l'appelant par un prénom ou un nom tant que son identité n'a pas été explicitement enregistrée.";`,
    "nom facultatif jusqu'à la fin pour client existant rappelable",
  ),
);

patches.push(
  patch(
    `      "Le client vient de poser une question ou d'ajouter une information après la question finale. Traitez uniquement ce qu'il vient de dire. S'il pose une question, répondez-y brièvement avec uniquement les informations fiables disponibles. Si vous ne connaissez pas la réponse, dites-le simplement sans inventer. S'il ajoute une information, prenez-la en compte sans la reformuler longuement. Ne reposez jamais la question finale. Ensuite, clôturez une seule fois avec une formule courte."`,
    `      "Le client vient de poser une question ou d'ajouter une information après la question finale. Traitez uniquement ce qu'il vient de dire. S'il pose une question, répondez-y brièvement avec uniquement les informations fiables disponibles. Si vous ne connaissez pas la réponse, dites-le simplement sans inventer. S'il ajoute une information, prenez-la en compte sans la reformuler longuement. Ne reposez jamais la question finale. Pour un client existant dont le nom n'a pas été compris mais dont le numéro de rappel est confirmé, ne redemandez JAMAIS le nom ni le prénom. Une demande de rappel rapide est une information à transmettre, pas une promesse de délai. Ensuite, clôturez une seule fois avec une formule courte."`,
    "fin d'appel sans redemander le nom",
  ),
);

export const TEST_CLIENT_PATCHES = patches.join("\n\n") + "\n\n";
