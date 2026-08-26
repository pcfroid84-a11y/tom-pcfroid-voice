import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../server.js", import.meta.url);
let source = readFileSync(path, "utf8");

const marker = "const flowStageAtTurnStart = state.flowStage;";

if (!source.includes(marker)) {
  const anchor = `          state.lastCallerMessage = callerMessage;\n\n          if (isClearlyOutOfCompetenceRequest(callerMessage)) {`;
  const replacement = `          state.lastCallerMessage = callerMessage;\n\n          // Sécurité parcours : un même tour client ne doit normalement\n          // faire avancer qu'une seule étape du flow. On mémorise l'étape\n          // présente au début du traitement de cette transcription.\n          const flowStageAtTurnStart = state.flowStage;\n\n          if (isClearlyOutOfCompetenceRequest(callerMessage)) {`;

  if (!source.includes(anchor)) {
    throw new Error("Patch flow-stage: point d'insertion introuvable");
  }

  source = source.replace(anchor, replacement);

  const handlerStart = source.indexOf(
    'conversation.item.input_audio_transcription.completed'
  );
  const handlerEnd = source.indexOf(
    'if (event.type === "response.output_audio.delta")',
    handlerStart
  );

  if (handlerStart < 0 || handlerEnd < 0) {
    throw new Error("Patch flow-stage: handler transcription introuvable");
  }

  let before = source.slice(0, handlerStart);
  let handler = source.slice(handlerStart, handlerEnd);
  const after = source.slice(handlerEnd);

  const replacements = [
    ['if (state.flowStage === "customer_status") {', 'if (flowStageAtTurnStart === "customer_status") {'],
    ['if (state.flowStage === "city" || callerCorrectsCity(callerMessage)) {', 'if (flowStageAtTurnStart === "city" || callerCorrectsCity(callerMessage)) {'],
    ['  state.flowStage === "city" &&\n  state.customerStatus === "new" &&', '  flowStageAtTurnStart === "city" &&\n  state.customerStatus === "new" &&'],
    ['if (state.flowStage === "address") {', 'if (flowStageAtTurnStart === "address") {'],
    ['if (state.flowStage === "callback") {', 'if (flowStageAtTurnStart === "callback") {'],
    ['if (state.flowStage === "callback_number") {', 'if (flowStageAtTurnStart === "callback_number") {'],
    ['  state.flowStage === "final_question" &&\n  state.finalQuestionAsked', '  flowStageAtTurnStart === "final_question" &&\n  state.finalQuestionAsked'],
    ['if (state.flowStage === "identity") {\n              detectedName = extractDirectIdentityAnswer(callerMessage);', 'if (flowStageAtTurnStart === "identity") {\n              detectedName = extractDirectIdentityAnswer(callerMessage);'],
    ['state.flowStage === "identity" ? "question-identité" : "volontaire"', 'flowStageAtTurnStart === "identity" ? "question-identité" : "volontaire"'],
    ['} else if (state.flowStage === "identity") {\n              app.log.info(', '} else if (flowStageAtTurnStart === "identity") {\n              app.log.info('],
  ];

  for (const [from, to] of replacements) {
    if (!handler.includes(from)) {
      throw new Error(`Patch flow-stage: motif introuvable: ${from}`);
    }
    handler = handler.replace(from, to);
  }

  source = before + handler + after;
  writeFileSync(path, source, "utf8");
  console.log("Patch runtime appliqué: une seule étape de flow par tour client.");
} else {
  console.log("Patch runtime déjà présent.");
}
