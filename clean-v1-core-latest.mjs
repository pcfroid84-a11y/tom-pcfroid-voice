import {
  extractCustomerStatusClean as baseExtractCustomerStatusClean,
  extractIdentityClean as baseExtractIdentityClean,
} from "./clean-v1-core.mjs";

export {
  normalizeCleanText,
  extractYesNoClean,
  isPlausibleFrenchLocationText,
  detectServiceIntent,
  relationshipProvesExistingCustomer,
  isQuestionAnnouncement,
  looksLikeLateralQuestion,
  classifyExpectedFieldTurn,
  finalAnswerKind,
  shouldAskIdentityAgain,
  nextAdministrativeStage,
} from "./clean-v1-core.mjs";

export function extractCustomerStatusClean(text = "") {
  const value = String(text || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(?:euh |ah |ben |bah )?pas du tout(?: merci)?$/.test(value)) return "new";
  return baseExtractCustomerStatusClean(text);
}

export function extractIdentityClean(text = "") {
  const cleaned = String(text || "")
    .trim()
    .replace(/^(?:(?:euh|heu|hum|hmm|ah|ben|bah)\s+)+/iu, "");
  return baseExtractIdentityClean(cleaned);
}
