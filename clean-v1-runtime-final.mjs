import { CLEAN_V1_PATCHES } from "./clean-v1-runtime-patches.mjs";

function finalPatch(search, replacement, label) {
  return `replaceOnce(${JSON.stringify(search)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const looseAnchor = `  if (state.flowStage === "qualification" &&\n  assistantText.includes("?")\n) {\n  state.qualificationQuestionCount += 1;`;

const stableServerAnchor = `       if (\n  state.flowStage === "qualification" &&\n  assistantText.includes("?")\n) {\n  state.qualificationQuestionCount += 1;`;

const encodedLooseAnchor = JSON.stringify(looseAnchor);
const encodedStableServerAnchor = JSON.stringify(stableServerAnchor);

if (!CLEAN_V1_PATCHES.includes(encodedLooseAnchor)) {
  throw new Error("Tom V1 propre : ancre qualification à corriger introuvable");
}

const qualificationFixedPatches = CLEAN_V1_PATCHES.replace(
  encodedLooseAnchor,
  encodedStableServerAnchor,
);

const strictInstructionAnchor = `const responseInstructions = strictFlowStages.has(flowLock?.stage)\n  ? [recoveryOverride || flowLock?.instructions, identityGuard].filter(Boolean).join("\\n\\n")\n  : [recoveryOverride || flowLock?.instructions, identityGuard, qualificationBrevity, TOM_CONVERSATION_GUIDANCE].filter(Boolean).join("\\n\\n");`;

const strictInstructionReplacement = `const fixedAdministrativeInstruction = (() => {\n  if (recoveryOverride) return recoveryOverride;\n  if (flowLock?.stage === "customer-status") return 'Dites exactement et uniquement : "Est-ce que vous êtes déjà client chez P C Froid ?" Aucun mot avant, aucun mot après.';\n  if (flowLock?.stage === "existing-identity") return 'Dites exactement et uniquement : "À quel nom est le dossier ?" Aucun mot avant, aucun mot après.';\n  if (flowLock?.stage === "new-identity") return 'Dites exactement et uniquement : "Pouvez-vous me donner votre prénom et votre nom, s’il vous plaît ?" Aucun mot avant, aucun mot après.';\n  if (flowLock?.stage === "new-city") return state.awaitingPostalCode\n    ? 'Dites exactement et uniquement : "Quel est le code postal de l’installation ?" Aucun mot avant, aucun mot après.'\n    : 'Dites exactement et uniquement : "Dans quelle ville se trouve l’installation ?" Aucun mot avant, aucun mot après.';\n  if (flowLock?.stage === "address") return state.knownCustomerAddress && !state.interventionAddress\n    ? 'Dites exactement et uniquement : "Est-ce que l’intervention est à la même adresse que d’habitude ?" Aucun mot avant, aucun mot après.'\n    : 'Dites exactement et uniquement : "Quelle est l’adresse d’intervention ?" Aucun mot avant, aucun mot après.';\n  if (flowLock?.stage === "callback") return 'Dites exactement et uniquement : "On peut vous rappeler sur le numéro avec lequel vous appelez ?" Aucun mot avant, aucun mot après.';\n  if (flowLock?.stage === "callback-number") return 'Dites exactement et uniquement : "Quel numéro je note pour vous rappeler ?" Aucun mot avant, aucun mot après.';\n  if (flowLock?.stage === "final-question") return 'Dites exactement et uniquement : "Est-ce que vous avez une autre question ou quelque chose à ajouter avant que je transmette votre demande ?" Aucun mot avant, aucun mot après.';\n  if (flowLock?.stage === "qualification-climatisation" && state.qualificationQuestionCount === 0) {\n    const qualificationHistory = normalizeCleanText(state.callerMessages.join(" "));\n    if (/\\b(eau|coule|couler|fuite)\\b/.test(qualificationHistory)) {\n      return 'Dites exactement et uniquement : "Est-ce que l’eau vient de l’unité intérieure ?" Aucun mot avant, aucun mot après. Ne demandez pas au client de répéter le motif.';\n    }\n  }\n  if (flowLock?.stage === "closing") return buildReassuringClosingInstructions({ serviceIntent: state.serviceIntent, equipment: state.explicitEquipment });\n  return null;\n})();\n\nif (fixedAdministrativeInstruction) {\n  app.log.info({ flowLockStage: flowLock?.stage }, "Instruction administrative figée");\n}\n\nconst responseInstructions = fixedAdministrativeInstruction || (strictFlowStages.has(flowLock?.stage)\n  ? [flowLock?.instructions, identityGuard].filter(Boolean).join("\\n\\n")\n  : [flowLock?.instructions, identityGuard, qualificationBrevity, TOM_CONVERSATION_GUIDANCE].filter(Boolean).join("\\n\\n"));`;

const responseCreateAnchor = `return sendToOpenAI({\n  type: "response.create",\n  response: {\n    output_modalities: ["audio"],\n    instructions: responseInstructions,\n  },\n});`;

const responseCreateReplacement = `return sendToOpenAI({\n  type: "response.create",\n  response: {\n    output_modalities: ["audio"],\n    instructions: responseInstructions,\n    ...(fixedAdministrativeInstruction ? { max_output_tokens: 240 } : {}),\n  },\n});`;

const identityTurnAnchor = `          if (!state.identityKnown && !earlyCityCapturedWhileIdentity) {\n            let detectedName = null;`;

const identityTurnReplacement = `          if (!state.identityKnown && !earlyCityCapturedWhileIdentity && flowStageAtTurnStart !== "customer_status") {\n            let detectedName = null;`;

const administrativeStageAnchor = `          const cleanAdministrativeStages = new Set(["customer_status", "identity", "city", "address", "callback", "callback_number", "qualification"]);`;

const administrativeStageReplacement = `          const cleanAdministrativeStages = new Set(["customer_status", "identity", "city", "address", "callback", "callback_number", "qualification"]);\n          const cleanTurnText = normalizeCleanText(callerMessage);\n          if (/^(allo|allo allo)$/.test(cleanTurnText)) {\n            app.log.info({ flowStageAtTurnStart }, "Allô simple : étape conservée sans nouvelle question");\n            sendToOpenAI({\n              type: "response.create",\n              response: {\n                output_modalities: ["audio"],\n                instructions: 'Dites exactement et uniquement : "Oui, je vous écoute." Aucun mot avant, aucun mot après. Ne changez pas d’étape.',\n                max_output_tokens: 80,\n              },\n            });\n            return;\n          }`;

export const CLEAN_V1_FINAL_PATCHES = qualificationFixedPatches +
  finalPatch(
    strictInstructionAnchor,
    strictInstructionReplacement,
    "phrases administratives figées sans improvisation",
  ) + "\n\n" +
  finalPatch(
    responseCreateAnchor,
    responseCreateReplacement,
    "sorties administratives courtes plafonnées",
  ) + "\n\n" +
  finalPatch(
    identityTurnAnchor,
    identityTurnReplacement,
    "un tour statut client ne peut jamais devenir identité",
  ) + "\n\n" +
  finalPatch(
    administrativeStageAnchor,
    administrativeStageReplacement,
    "allô simple conserve strictement l'étape courante",
  ) + "\n\n";
