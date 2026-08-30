const UNKNOWN = "Non précisé";

export function normalizePhone(phone) {
  const raw = String(phone || "").trim().replace(/[^\d+]/g, "");
  if (!raw) return null;
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("0033")) return "+33" + raw.slice(4);
  if (raw.startsWith("0") && raw.length === 10) return "+33" + raw.slice(1);
  return raw;
}

export function isExplicitBusinessUrgency(state = {}) {
  if (state.businessUrgencyConfirmed === true) return true;
  const value = String(state.routingUrgency ?? "").trim().toLowerCase();
  return value.includes("urgent") || value.includes("urgence");
}

export function buildCategory(state = {}) {
  if (isExplicitBusinessUrgency(state)) return "URGENCE";
  if (state.partnerOrSupplierFlow) return "PARTENAIRE";
  if (state.customerStatus === "existing") return "CLIENT";
  if (state.customerStatus === "new") return "PROSPECT";
  return "MESSAGE";
}

export function buildReason(state = {}) {
  const equipment = state.explicitEquipment || null;
  if (state.serviceIntent === "entretien") {
    return equipment ? `Entretien ${equipment}` : "Entretien";
  }
  if (state.serviceIntent === "devis_installation") {
    return equipment
      ? `Devis installation/remplacement ${equipment}`
      : "Devis installation/remplacement";
  }
  if (state.partnerOrSupplierFlow) return "Message partenaire / fournisseur";
  if (state.outOfCompetenceFlow) return "Demande hors compétence PC Froid";
  if (equipment) return `Demande concernant ${equipment}`;
  return state.routingCategory || "Appel téléphonique";
}

export function getIdentity(state = {}) {
  const identity = String(state.identityName || "").trim();
  if (!identity) return { value: null, confidence: "missing" };

  const city = String(state.interventionCity || "").trim();
  if (city && identity.localeCompare(city, "fr", { sensitivity: "base" }) === 0) {
    return { value: null, confidence: "suspicious_city_match" };
  }

  return { value: identity, confidence: "confirmed_state" };
}

export function buildSmsSummary({ category, reason, city } = {}) {
  if (category === "PARTENAIRE") {
    return "PC Froid : merci pour votre appel. Votre message a bien été transmis à l'équipe.";
  }

  const location = city && city !== UNKNOWN ? ` à ${city}` : "";
  const request = reason && reason !== "Appel téléphonique" ? ` (${reason}${location})` : location;
  return `PC Froid : votre demande${request} a bien été enregistrée. Vous pouvez répondre à ce SMS pour corriger ou compléter une information.`;
}

export function buildMailSummary(payload = {}) {
  const status =
    payload.customer_status === "existing"
      ? "Client existant"
      : payload.customer_status === "new"
        ? "Nouveau client / prospect"
        : "Statut non précisé";

  return [
    `Identité : ${payload.identity || "Non communiquée"}`,
    `Téléphone : ${payload.phone || "Non communiqué"}`,
    `Statut : ${status}`,
    `Demande : ${payload.reason || UNKNOWN}`,
    `Équipement : ${payload.equipment || UNKNOWN}`,
    `Lieu : ${[payload.address, payload.city].filter(Boolean).join(" - ") || UNKNOWN}`,
    `Catégorie : ${payload.category || "MESSAGE"}`,
    `Informations : ${payload.important_information || "Aucune information complémentaire"}`,
  ].join("\n");
}

export function buildCallEndPayload(state = {}, trigger = "unknown", now = new Date()) {
  const endedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const phone = normalizePhone(state.callbackPhone || state.callerPhone);
  const callerPhone = normalizePhone(state.callerPhone);
  const category = buildCategory(state);
  const reason = buildReason(state);
  const identity = getIdentity(state);
  const callerMessages = Array.isArray(state.callerMessages)
    ? state.callerMessages.filter(Boolean).map(String).slice(-40)
    : [];
  const transcript = callerMessages.join(" | ").slice(0, 8000);
  const city = state.interventionCity || null;
  const address = state.interventionAddress || state.knownCustomerAddress || null;
  const customerStatus = ["existing", "new"].includes(state.customerStatus)
    ? state.customerStatus
    : "unknown";

  const payload = {
    schema_version: "1.0",
    event_id: `${state.callSid || "unknown"}:${endedAt}`,
    call_sid: state.callSid || null,
    started_at: state.callStartedAt || null,
    ended_at: endedAt,
    trigger,

    caller_phone: callerPhone,
    phone,
    identity: identity.value,
    identity_confidence: identity.confidence,
    customer_status: customerStatus,
    contact_type: state.contactType || (state.partnerOrSupplierFlow ? "partenaire" : "unknown"),

    reason,
    service_intent: state.serviceIntent || null,
    equipment: state.explicitEquipment || null,
    city,
    address,
    important_information: transcript || null,
    caller_messages: callerMessages,
    transcript: transcript || null,

    category,
    urgency: state.routingUrgency ?? null,
    business_urgency_confirmed: isExplicitBusinessUrgency(state),
    routing_category: state.routingCategory || null,

    call_complete: Boolean(state.callComplete || state.finalQuestionAsked || state.endCallRequested),
  };

  payload.sms_summary = buildSmsSummary({ category, reason, city });
  payload.mail_subject = `[${category}] ${reason} - ${payload.identity || payload.phone || "Appel"}`;
  payload.mail_summary = buildMailSummary(payload);

  return payload;
}
