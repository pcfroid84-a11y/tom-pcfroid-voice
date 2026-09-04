import {
  extractCustomerStatusClean as baseExtractCustomerStatusClean,
  extractIdentityClean as baseExtractIdentityClean,
  extractYesNoClean as baseExtractYesNoClean,
  finalAnswerKind as baseFinalAnswerKind,
  normalizeCleanText,
} from "./clean-v1-core.mjs";

export {
  normalizeCleanText,
  isPlausibleFrenchLocationText,
  detectServiceIntent,
  relationshipProvesExistingCustomer,
  isQuestionAnnouncement,
  looksLikeLateralQuestion,
  classifyExpectedFieldTurn,
  shouldAskIdentityAgain,
  nextAdministrativeStage,
} from "./clean-v1-core.mjs";

export function extractCustomerStatusClean(text = "") {
  const value = normalizeCleanText(text);

  if (/^(?:euh |ah |ben |bah )?pas du tout(?: merci)?$/.test(value)) return "new";
  if (/^(?:nao|não)$/.test(String(text || "").trim().toLowerCase()) || value === "nao") return "new";
  return baseExtractCustomerStatusClean(text);
}

export function extractYesNoClean(text = "") {
  const value = normalizeCleanText(text);
  if (/^(?:tout a fait|bien sur|certainement|d accord|d'accord)$/.test(value)) return "yes";
  if (/^(?:pas du tout|nao)$/.test(value)) return "no";
  return baseExtractYesNoClean(text);
}

export function extractIdentityClean(text = "") {
  const cleaned = String(text || "")
    .trim()
    .replace(/^(?:(?:euh|heu|hum|hmm|ah|ben|bah)\s+)+/iu, "");
  return baseExtractIdentityClean(cleaned);
}

export function finalAnswerKind(text = "") {
  const value = normalizeCleanText(text);
  if (/^(?:nao|nao obrigado|nao obrigada)$/.test(value)) return "nothing_else";
  return baseFinalAnswerKind(text);
}
