export function normalizeCleanText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFusedYesNoHesitation(value = "") {
  return String(value || "").replace(/^e(?=(?:non|oui)\b)/, "");
}

export function extractYesNoClean(text = "") {
  let value = normalizeCleanText(text);
  if (!value) return null;

  value = value.replace(/^(?:(?:euh|ah|ben|bah)\s+)+/, "");
  value = cleanFusedYesNoHesitation(value);

  const hasYes = /\boui\b/.test(value);
  const hasNo = /\bnon\b/.test(value);
  if (hasYes && hasNo) return null;

  if (
    hasYes &&
    /^(?:(?:bien sur|d'accord|d accord|tout a fait|certainement)\s+)*oui(?:\s+(?:oui|bien sur|d'accord|d accord|tout a fait|certainement|merci|pourquoi))*$/.test(value)
  ) {
    return "yes";
  }

  if (
    hasNo &&
    /^(?:(?:bien sur|d'accord|d accord)\s+)*non(?:\s+(?:non|merci|c'est bon|c est bon))*$/.test(value)
  ) {
    return "no";
  }

  return null;
}

export function isPlausibleFrenchLocationText(text = "") {
  const value = String(text || "").trim();
  if (!value || value.length > 80) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ.'’ -]+$/u.test(value)) return false;
  return /[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]{2}/u.test(value);
}

export function detectServiceIntent(text = "", equipment = null) {
  const value = normalizeCleanText(text);
  if (!value) return null;

  if (/\b(entretien|maintenance|nettoyage|nettoyer|desinfection|desinfecter)\b/.test(value)) {
    return "entretien";
  }

  const installationWords = /\b(installer|installation|remplacer|remplacement|changer|nouvelle|nouveau|poser|pose)\b/;
  if (/\bdevis\b/.test(value) && installationWords.test(value)) return "devis_installation";
  if (/\b(je voudrais|j aimerais|on voudrait|nous voudrions)\b/.test(value) && installationWords.test(value)) {
    return "devis_installation";
  }
  if (/\b(remplacer|remplacement)\b/.test(value) && /\b(clim|climatisation|pac|pompe a chaleur|systeme|appareil|installation)\b/.test(value)) {
    return "devis_installation";
  }

  if (equipment === "climatisation" && /\bdevis\b/.test(value) && !/\b(entretien|maintenance|depannage|panne|reparation|fuite|bruit|code|voyant)\b/.test(value)) {
    return "devis_installation";
  }

  return null;
}

export function relationshipProvesExistingCustomer(text = "") {
  const value = normalizeCleanText(text);
  if (!value) return false;

  return [
    /\bvous m'avez install/, /\bvous me l'avez install/, /\bc'est vous qui .*install/,
    /\bvous etes deja venu/, /\bvous etes deja intervenu/, /\bvous m'avez deja/,
    /\bj'ai deja fait appel a vous/, /\bc'est vous qui me l'avez pose/,
  ].some((pattern) => pattern.test(value));
}

export function extractCustomerStatusClean(text = "") {
  let value = normalizeCleanText(text);
  if (!value) return null;

  value = value.replace(/^(euh|ah)\s+/, "");
  value = cleanFusedYesNoHesitation(value);

  if (relationshipProvesExistingCustomer(value)) return "existing";

  if (/\b(deja client|je suis client|je suis deja client|vous etes deja venus?|vous etes deja intervenus?|j'ai deja fait appel a vous)\b/.test(value)) {
    return "existing";
  }

  if (/^(oui|oui oui|eh oui|et oui|ben oui|bah oui|tout a fait|bien sur|oui bien sur)$/.test(value)) {
    return "existing";
  }

  if (/^oui\s+(pourquoi|comment|bien sur|d'accord|d accord)\b/.test(value)) {
    return "existing";
  }

  if (/\b(premiere demande|premiere fois|nouveau client|pas encore client|je ne suis pas client|je suis pas client|jamais appele|jamais fait appel|jamais ete client)\b/.test(value)) {
    return "new";
  }

  if (/^(non|non non|non merci)$/.test(value)) {
    return "new";
  }

  return null;
}

export function isQuestionAnnouncement(text = "") {
  const value = normalizeCleanText(text);
  if (!value) return false;

  return /^(?:j'ai|j'aurais|j aurais)?\s*(?:une )?(?:petite )?question$/.test(value) ||
    /^(?:je voulais|je voudrais|je peux)\s+vous\s+(?:poser une question|demander quelque chose)$/.test(value);
}

export function looksLikeLateralQuestion(text = "") {
  const raw = String(text || "").trim();
  const value = normalizeCleanText(raw);
  if (!value) return false;
  if (isQuestionAnnouncement(raw)) return true;
  if (raw.includes("?")) return true;
  return /^(est ce que|pourquoi|comment|combien|quand|ou |quel |quelle |quels |quelles |vous faites|vous pouvez|est ce possible|c'est possible|c est possible)\b/.test(value);
}

const IDENTITY_FILLERS = new Set([
  "oui", "non", "bonjour", "bon", "merci", "allo", "ca", "c'est ca", "c est ca",
  "c'est moi", "c est moi", "moi", "d'accord", "d accord", "bien sur",
  "premiere demande", "ma premiere demande", "c'est ma premiere demande", "c est ma premiere demande",
  "premiere fois", "ma premiere fois", "c'est ma premiere fois", "c est ma premiere fois",
]);

export function extractIdentityClean(text = "") {
  const raw = String(text || "").trim().replace(/[.,!?;:]+$/u, "").trim();
  if (!raw) return null;

  let candidate = raw
    .replace(/^(?:oui[\s,]+)?(?:bonjour[\s,]+)?(?:je m['’]appelle|moi c['’]est|mon nom c['’]est|je suis|c['’]est)\s+/iu, "")
    .replace(/^(?:monsieur|madame|mme|mr|m)\.?\s+/iu, "")
    .trim();

  if (!candidate || candidate.length < 2 || candidate.length > 70) return null;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ.'’ -]+$/u.test(candidate)) return null;

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) return null;

  const normalized = normalizeCleanText(candidate);
  if (IDENTITY_FILLERS.has(normalized)) return null;
  if (/\b(clim|climatisation|entretien|maintenance|depannage|panne|adresse|rue|avenue|bonjour|merci)\b/.test(normalized)) return null;
  if (/\b(premiere demande|premiere fois|nouveau client|pas encore client|jamais appele|jamais fait appel)\b/.test(normalized)) return null;

  return candidate;
}

export function classifyExpectedFieldTurn(stage, text = "") {
  if (stage === "customer_status") {
    const status = extractCustomerStatusClean(text);
    if (status) return { kind: "answer", value: status };
  }

  if (stage === "identity") {
    const identity = extractIdentityClean(text);
    if (identity) return { kind: "answer", value: identity };
  }

  if (looksLikeLateralQuestion(text)) {
    return { kind: isQuestionAnnouncement(text) ? "question_announcement" : "lateral_question", value: null };
  }

  return { kind: "unrecognized", value: null };
}

export function finalAnswerKind(text = "") {
  let value = normalizeCleanText(text);
  if (!value) return "unknown";

  value = value.replace(/^(?:(?:euh|ah|ben|bah)\s+)+/, "");

  if (
    /^(non|non merci|non c'est bon|non c est bon|c'est bon|c est bon|ca ira|rien d'autre|rien d autre|c'est tout|c est tout)$/.test(value)
  ) {
    return "nothing_else";
  }

  if (/^(non )?c'est bon .*rappel/.test(value) || /^(non )?c est bon .*rappel/.test(value) || /\brappelle? rapidement\b/.test(value)) {
    return "followup_then_close";
  }

  return "followup";
}

export function shouldAskIdentityAgain({ customerStatus, identityKnown, callbackConfirmed, identityFallbackByPhone } = {}) {
  if (identityKnown) return false;
  if (customerStatus === "existing" && callbackConfirmed && identityFallbackByPhone) return false;
  return true;
}

export function nextAdministrativeStage(state = {}) {
  if (state.customerStatus == null) return "customer_status";
  if (!state.identityKnown && !(state.customerStatus === "existing" && state.identityFallbackByPhone)) return "identity";
  if (state.customerStatus === "new" && !state.interventionCity) return "city";
  if (state.needsQualification) return "qualification";
  if (state.customerStatus === "existing" && !state.knownCustomerAddress && state.identityFallbackByPhone) return "callback";
  if (!state.interventionAddress && state.knownCustomerAddress) return "address_confirm";
  if (!state.interventionAddress && state.customerStatus === "new") return "address";
  if (!state.callbackConfirmed) return "callback";
  if (!state.finalQuestionAsked) return "final_question";
  return "closing";
}
