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

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-appel";
const N8N_CALL_END_WEBHOOK_URL =
  process.env.N8N_CALL_END_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-fin-appel";
`,
"URL webhook fin d'appel + payload V1"
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
    identityKnown: false,`,
"état fin d'appel"
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
                \`VILLE D'INTERVENTION DÉJÀ COMPRISE : \${earlyCity}. Ne la redemandez pas. L'identité prénom et nom reste à demander maintenant.\`
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

  function setFlowStage(nextStage, reason = "") {`,
"fonction webhook fin d'appel V1"
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
