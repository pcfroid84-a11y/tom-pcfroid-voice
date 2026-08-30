export async function sendEndCallWebhook({ state, webhookUrl, reason = "call-ended", logger }) {
  const targetWebhookUrl =
    webhookUrl ||
    process.env.N8N_END_CALL_WEBHOOK_URL ||
    "https://pcfroid84.app.n8n.cloud/webhook/tom-fin-appel";

  if (!targetWebhookUrl || !state || state.endSummarySent) return false;

  state.endSummarySent = true;

  const payload = {
    event: "tom_call_ended",
    ended_at: new Date().toISOString(),
    started_at: state.callStartedAt || null,
    end_reason: reason,

    call_sid: state.callSid || null,
    caller_phone: state.callerPhone || null,
    callback_phone: state.callbackPhone || state.callerPhone || null,
    called_phone: state.calledPhone || null,

    customer_status: state.customerStatus || null,
    identity_name: state.identityName || null,
    intervention_city: state.interventionCity || null,
    city_zone_status: state.cityZoneStatus || null,
    intervention_address: state.interventionAddress || null,
    known_customer_address: state.knownCustomerAddress || null,

    equipment: state.explicitEquipment || null,
    service_intent: state.serviceIntent || null,
    partner_or_supplier: Boolean(state.partnerOrSupplierFlow),
    out_of_competence: Boolean(state.outOfCompetenceFlow),

    routing_category: state.routingCategory || null,
    routing_urgency: Number(state.routingUrgency || 0),
    routing_reason: state.routingReason || null,

    final_question_asked: Boolean(state.finalQuestionAsked),
    caller_messages: Array.isArray(state.callerMessages)
      ? state.callerMessages.slice(-40)
      : [],
  };

  try {
    const response = await fetch(targetWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`n8n fin d'appel HTTP ${response.status}`);
    }

    logger?.info?.(
      {
        callSid: state.callSid || null,
        reason,
        callbackPhonePresent: Boolean(payload.callback_phone),
        customerStatus: payload.customer_status,
        urgency: payload.routing_urgency,
      },
      "Récapitulatif de fin d'appel envoyé à n8n"
    );

    return true;
  } catch (error) {
    state.endSummarySent = false;
    logger?.error?.(error, "Erreur envoi récapitulatif de fin d'appel à n8n");
    return false;
  }
}
