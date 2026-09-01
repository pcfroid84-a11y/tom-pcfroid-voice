import {
  extractPostalCode as baseExtractPostalCode,
} from "./sector-rules.mjs";

export {
  getSectorService,
  classifySectorRequest,
  sectorStatusToZone,
  getSectorData,
} from "./sector-rules.mjs";

export function extractPostalCode(text = "") {
  const raw = String(text || "").trim();
  const postal = baseExtractPostalCode(raw);
  if (!postal) return null;

  const hasWrittenDigits = /\d/.test(raw);
  const normalized = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const clearlySpokenLeadingZero = /\bzero\b/.test(normalized);
  const explicitThousands = /\bmille\b/.test(normalized);

  // Une transcription purement orale du type « quatre huit cents » peut être
  // reconstruite à tort en 04800. Sans zéro ou « mille » explicite, on la
  // considère comme ambiguë et on redemande le code postal au lieu de refuser.
  if (!hasWrittenDigits && postal.startsWith("0") && !clearlySpokenLeadingZero && !explicitThousands) {
    return null;
  }

  return /^\d{5}$/.test(postal) ? postal : null;
}
