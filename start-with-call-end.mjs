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
`const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-appel";
const N8N_CALL_END_WEBHOOK_URL =
  process.env.N8N_CALL_END_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-fin-appel";
`,
"URL webhook fin d'appel"
);

replaceOnce(
`    n8nAttempts: 0,
    identityKnown: false,`,
`    n8nAttempts: 0,
    routingCategory: null,
    routingUrgency: null,
    callerMessages: [],
    callEndSent: false,
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
`  function setFlowStage(nextStage, reason = "") {`,
`  function normalizeCallEndPhone(phone) {
    const raw = String(phone || "").trim().replace(/[^\\d+]/g, "");
    if (!raw) return null;
    if (raw.startsWith("+")) return raw;
    if (raw.startsWith("0033")) return "+33" + raw.slice(4);
    if (raw.startsWith("0") && raw.length === 10) return "+33" + raw.slice(1);
    return raw;
  }

  function buildCallEndCategory() {
    const urgencyText = String(state.routingUrgency ?? "").toLowerCase();
    const urgencyNumber = Number(state.routingUrgency);
    const isUrgent =
      urgencyText.includes("urgent") ||
      (Number.isFinite(urgencyNumber) && urgencyNumber >= 2);

    if (isUrgent) return "URGENCE";
    if (state.partnerOrSupplierFlow) return "PARTENAIRE";
    if (state.customerStatus === "existing") return "CLIENT";
    if (state.customerStatus === "new") return "PROSPECT";
    return "MESSAGE";
  }

  function buildCallEndReason() {
    const equipment = state.explicitEquipment || "équipement non précisé";
    if (state.serviceIntent === "entretien") return "Entretien " + equipment;
    if (state.serviceIntent === "devis_installation") return "Devis installation/remplacement " + equipment;
    if (state.partnerOrSupplierFlow) return "Message partenaire / fournisseur";
    if (state.outOfCompetenceFlow) return "Demande hors compétence PC Froid";
    if (state.explicitEquipment) return "Demande concernant " + equipment;
    return state.routingCategory || "Appel téléphonique";
  }

  async function sendCallEndWebhook(trigger = "unknown") {
    if (state.callEndSent || !state.callSid) return;
    state.callEndSent = true;

    const phone = normalizeCallEndPhone(state.callbackPhone || state.callerPhone);
    const category = buildCallEndCategory();
    const reason = buildCallEndReason();
    const transcript = state.callerMessages.filter(Boolean).join(" | ").slice(0, 8000);
    const customerStatus =
      state.customerStatus === "existing"
        ? "existing"
        : state.customerStatus === "new"
          ? "new"
          : "unknown";

    const smsSummary =
      category === "PARTENAIRE"
        ? "PC Froid : merci pour votre appel. Votre message a bien été transmis à l'équipe."
        : "PC Froid : votre demande a bien été enregistrée. L'équipe vous recontactera si nécessaire. Vous pouvez répondre à ce SMS pour corriger ou compléter une information.";

    const payload = {
      call_sid: state.callSid,
      category,
      urgency: state.routingUrgency ?? "normal",
      identity: state.identityName || "Non communiquée",
      phone,
      customer_status: customerStatus,
      reason,
      equipment: state.explicitEquipment || "Non précisé",
      city: state.interventionCity || "Non précisée",
      address: state.interventionAddress || state.knownCustomerAddress || "Non précisée",
      important_information: transcript || "Aucune transcription exploitable",
      message_to_forward: transcript || reason,
      sms_summary: smsSummary,
      routing_category: state.routingCategory,
      trigger,
    };

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
        { callSid: state.callSid, category, trigger },
        "Fin d'appel envoyée au workflow n8n SMS/mail"
      );
    } catch (error) {
      state.callEndSent = false;
      app.log.error(error, "Erreur webhook n8n de fin d'appel");
    }
  }

  function setFlowStage(nextStage, reason = "") {`,
"fonction webhook fin d'appel"
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
