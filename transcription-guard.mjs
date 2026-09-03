import { extractIdentityClean } from "./clean-v1-core-latest.mjs";
import { getSectorData } from "./sector-rules-latest.mjs";

function normalizeKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactKey(value = "") {
  return normalizeKey(value).replace(/\s+/g, "");
}

export function transcriptionAverageLogprob(logprobs = []) {
  if (!Array.isArray(logprobs)) return null;
  const values = logprobs
    .map((entry) => Number(entry?.logprob))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function containsNonLatinScript(text = "") {
  const letters = String(text || "").match(/\p{L}/gu) || [];
  return letters.some((letter) => !/\p{Script=Latin}/u.test(letter));
}

export function isVeryLowConfidenceTranscript(logprobs = [], threshold = -1.8) {
  const average = transcriptionAverageLogprob(logprobs);
  return average != null && average < threshold;
}

export function isReliableIdentityTranscript({ text = "", customerStatus = null, logprobs = [] } = {}) {
  const raw = String(text || "").trim();
  if (!raw || containsNonLatinScript(raw)) return false;
  if (/\?\s*$/.test(raw)) return false;
  if (isVeryLowConfidenceTranscript(logprobs)) return false;

  const identity = extractIdentityClean(raw);
  if (!identity) return false;

  const words = identity.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;

  // Pour un nouveau client Tom demande explicitement prénom + nom.
  // Un seul mot ne doit donc jamais être verrouillé comme identité complète.
  if (customerStatus === "new" && words.length < 2) return false;

  return true;
}

function levenshtein(a = "", b = "") {
  const left = String(a);
  const right = String(b);
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function similarity(a = "", b = "") {
  const left = compactKey(a);
  const right = compactKey(b);
  if (!left || !right) return 0;
  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function stripCityIntroduction(text = "") {
  return normalizeKey(text)
    .replace(/^(?:oui\s+)?(?:je suis|j habite|c est|ca se trouve|l installation est|la ville c est)\s+(?:a|sur)?\s*/i, "")
    .replace(/^(?:a|sur)\s+/i, "")
    .trim();
}

export function matchKnownSectorCity(text = "") {
  const raw = String(text || "").trim();
  if (!raw || containsNonLatinScript(raw)) return null;

  const candidate = stripCityIntroduction(raw);
  if (!candidate || candidate.length < 3) return null;

  const sector = getSectorData();
  const communes = Array.isArray(sector?.communes) ? sector.communes : [];
  const aliases = [];

  for (const entry of communes) {
    for (const name of [entry.city, ...(entry.aliases || [])]) {
      const key = normalizeKey(name);
      if (!key) continue;
      aliases.push({ city: entry.city, name, key });
    }
  }

  const candidateKey = normalizeKey(candidate);
  for (const item of aliases) {
    if (candidateKey === item.key) {
      return { city: item.city, matched: item.name, exact: true, similarity: 1 };
    }
    if (` ${candidateKey} `.includes(` ${item.key} `)) {
      return { city: item.city, matched: item.name, exact: true, similarity: 1 };
    }
  }

  let best = null;
  let secondBest = null;
  for (const item of aliases) {
    const score = similarity(candidateKey, item.key);
    if (!best || score > best.similarity) {
      secondBest = best;
      best = { city: item.city, matched: item.name, exact: false, similarity: score };
    } else if (!secondBest || score > secondBest.similarity) {
      secondBest = { city: item.city, matched: item.name, exact: false, similarity: score };
    }
  }

  if (!best) return null;
  const length = compactKey(candidateKey).length;
  const threshold = length <= 5 ? 0.84 : length <= 8 ? 0.78 : 0.72;
  const separation = secondBest ? best.similarity - secondBest.similarity : 1;

  if (best.similarity < threshold || separation < 0.06) return null;
  return best;
}
