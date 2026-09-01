import { readFile } from "node:fs/promises";

const sectorUrl = new URL("./knowledge/sector-v1.json", import.meta.url);
const sector = JSON.parse(await readFile(sectorUrl, "utf8"));

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const communeEntries = Array.isArray(sector?.communes) ? sector.communes : [];
const cityMap = new Map();
const postalMap = new Map();

for (const entry of communeEntries) {
  for (const name of [entry.city, ...(entry.aliases || [])]) {
    const key = normalize(name);
    if (key) cityMap.set(key, entry);
  }

  for (const postalCode of entry.postal_codes || []) {
    const key = String(postalCode).trim();
    if (!postalMap.has(key)) postalMap.set(key, []);
    postalMap.get(key).push(entry);
  }
}

export function getSectorService({ serviceIntent, equipment, text = "" } = {}) {
  const normalizedEquipment = normalize(equipment);
  const normalizedText = normalize(text);

  if (
    normalizedEquipment.includes("pompe a chaleur") ||
    normalizedEquipment === "pac" ||
    /\bpac\b/.test(normalizedText) ||
    normalizedText.includes("pompe a chaleur")
  ) {
    return "pac";
  }

  if (serviceIntent === "entretien") return "entretien";
  if (serviceIntent === "devis_installation") return "installation";

  if (
    normalizedText.includes("devis") &&
    (normalizedEquipment.includes("clim") || normalizedText.includes("clim")) &&
    !/(entretien|maintenance|depann|panne|repar|fuite|bruit|code|voyant)/.test(normalizedText)
  ) {
    return "installation";
  }

  return "depannage";
}

const DIGIT_WORDS = new Map([
  ["zero", "0"],
  ["un", "1"],
  ["une", "1"],
  ["deux", "2"],
  ["trois", "3"],
  ["quatre", "4"],
  ["cinq", "5"],
  ["six", "6"],
  ["sept", "7"],
  ["huit", "8"],
  ["neuf", "9"],
]);

const SMALL_FRENCH = [
  "zero",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

function frenchUnder100(number) {
  if (number < 17) return SMALL_FRENCH[number];
  if (number < 20) return `dix ${SMALL_FRENCH[number - 10]}`;

  if (number < 70) {
    const tensNames = {
      20: "vingt",
      30: "trente",
      40: "quarante",
      50: "cinquante",
      60: "soixante",
    };
    const tens = Math.floor(number / 10) * 10;
    const unit = number % 10;
    if (unit === 0) return tensNames[tens];
    if (unit === 1) return `${tensNames[tens]} et un`;
    return `${tensNames[tens]} ${SMALL_FRENCH[unit]}`;
  }

  if (number < 80) {
    const rest = number - 60;
    if (rest === 11) return "soixante et onze";
    return `soixante ${frenchUnder100(rest)}`;
  }

  const rest = number - 80;
  if (rest === 0) return "quatre vingt";
  return `quatre vingt ${frenchUnder100(rest)}`;
}

const UNDER_100 = new Map();
for (let number = 0; number < 100; number += 1) {
  UNDER_100.set(frenchUnder100(number), number);
}

function cleanNumberTokens(tokens) {
  return tokens
    .map((token) => token === "vingts" ? "vingt" : token === "cents" ? "cent" : token)
    .filter(Boolean);
}

function parseUnder100(tokens) {
  const key = cleanNumberTokens(tokens).join(" ");
  return UNDER_100.has(key) ? UNDER_100.get(key) : null;
}

function parseUnder1000(tokens) {
  const cleaned = cleanNumberTokens(tokens).filter((token) => token !== "et" || tokens.length > 1);
  const centIndex = cleaned.indexOf("cent");
  if (centIndex === -1) return parseUnder100(cleaned);

  const before = cleaned.slice(0, centIndex);
  const after = cleaned.slice(centIndex + 1);
  let hundreds = 1;

  if (before.length) {
    const parsedHundreds = parseUnder100(before);
    if (parsedHundreds == null || parsedHundreds < 1 || parsedHundreds > 9) return null;
    hundreds = parsedHundreds;
  }

  const remainder = after.length ? parseUnder100(after) : 0;
  if (remainder == null) return null;
  return hundreds * 100 + remainder;
}

function parseFrenchCardinal(tokens) {
  const cleaned = cleanNumberTokens(tokens);
  const milleIndex = cleaned.indexOf("mille");

  if (milleIndex !== -1) {
    const before = cleaned.slice(0, milleIndex);
    const after = cleaned.slice(milleIndex + 1);
    const thousands = before.length ? parseUnder100(before) : 1;
    const remainder = after.length ? parseUnder1000(after) : 0;
    if (thousands == null || remainder == null || thousands < 1 || thousands > 99) return null;
    return thousands * 1000 + remainder;
  }

  return parseUnder1000(cleaned);
}

const NUMBER_VOCABULARY = new Set([
  ...SMALL_FRENCH,
  "vingt",
  "vingts",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
  "cent",
  "cents",
  "mille",
  "et",
]);

function numericWordRuns(text) {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const runs = [];
  let current = [];

  for (const token of tokens) {
    if (NUMBER_VOCABULARY.has(token)) {
      current.push(token);
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

function postalFromSpokenRun(run) {
  const cleaned = cleanNumberTokens(run);

  if (cleaned.length === 5 && cleaned.every((token) => DIGIT_WORDS.has(token))) {
    return cleaned.map((token) => DIGIT_WORDS.get(token)).join("");
  }

  // Forme « quatre-vingt-quatre mille deux cent soixante ».
  // On ne transforme pas un simple « quatre-vingt-quatre » en 00084.
  if (cleaned.includes("mille")) {
    const cardinal = parseFrenchCardinal(cleaned);
    if (cardinal != null && cardinal >= 0 && cardinal <= 99999) {
      return String(cardinal).padStart(5, "0");
    }
  }

  // Forme la plus naturelle : « quatre-vingt-quatre deux cent soixante ».
  for (let split = 1; split < cleaned.length; split += 1) {
    const department = parseUnder100(cleaned.slice(0, split));
    const suffix = parseUnder1000(cleaned.slice(split));
    if (department == null || suffix == null || department < 0 || department > 99 || suffix < 0 || suffix > 999) {
      continue;
    }

    return `${String(department).padStart(2, "0")}${String(suffix).padStart(3, "0")}`;
  }

  return null;
}

function parseSpokenGroup(text, max) {
  const tokens = normalize(text).split(" ").filter(Boolean);
  if (!tokens.length || !tokens.every((token) => NUMBER_VOCABULARY.has(token))) return null;
  const value = max <= 99 ? parseUnder100(tokens) : parseUnder1000(tokens);
  if (value == null || value < 0 || value > max) return null;
  return value;
}

export function extractPostalCode(text = "") {
  const raw = String(text || "");

  // 84260 ou 84 260.
  const compact = raw.replace(/(?<=\d)\s+(?=\d)/g, "");
  const direct = compact.match(/\b\d{5}\b/);
  if (direct?.[0]) return direct[0];

  // 84, 260 / 84-260 / 84.260.
  const numericGroups = raw.match(/\b(\d{1,2})\D+(\d{1,3})\b/);
  if (numericGroups) {
    const department = Number(numericGroups[1]);
    const suffix = Number(numericGroups[2]);
    if (department >= 0 && department <= 99 && suffix >= 0 && suffix <= 999) {
      return `${String(department).padStart(2, "0")}${String(suffix).padStart(3, "0")}`;
    }
  }

  const normalizedRaw = normalize(raw);

  // Formes mixtes : « 84 deux cent soixante ».
  const leadingDigits = normalizedRaw.match(/\b(\d{1,2})\b\s+(.+)$/);
  if (leadingDigits) {
    const department = Number(leadingDigits[1]);
    const suffix = parseSpokenGroup(leadingDigits[2], 999);
    if (department >= 0 && department <= 99 && suffix != null) {
      return `${String(department).padStart(2, "0")}${String(suffix).padStart(3, "0")}`;
    }
  }

  // Forme mixte inverse : « quatre-vingt-quatre 260 ».
  const trailingDigits = normalizedRaw.match(/^(.+?)\s+\b(\d{1,3})\b$/);
  if (trailingDigits) {
    const department = parseSpokenGroup(trailingDigits[1], 99);
    const suffix = Number(trailingDigits[2]);
    if (department != null && suffix >= 0 && suffix <= 999) {
      return `${String(department).padStart(2, "0")}${String(suffix).padStart(3, "0")}`;
    }
  }

  for (const run of numericWordRuns(raw)) {
    const postal = postalFromSpokenRun(run);
    if (postal) return postal;
  }

  return null;
}

function decisionFromEntry(entry, service) {
  const status = entry?.[service] || "review";
  return {
    status,
    known: true,
    city: entry.city,
    postalCodes: [...(entry.postal_codes || [])],
    candidates: [entry.city],
    source: "city",
  };
}

export function classifySectorRequest({
  city,
  postalCode,
  service = "depannage",
  existingCustomer = false,
} = {}) {
  if (existingCustomer) {
    return {
      status: "review",
      known: true,
      city: city || null,
      postalCodes: postalCode ? [String(postalCode)] : [],
      candidates: city ? [city] : [],
      source: "existing-customer-override",
    };
  }

  const cityEntry = cityMap.get(normalize(city));
  if (cityEntry) return decisionFromEntry(cityEntry, service);

  const postal = String(postalCode || "").replace(/\D/g, "").slice(0, 5);
  if (postal.length === 5) {
    const matches = postalMap.get(postal) || [];
    if (matches.length === 1) {
      const decision = decisionFromEntry(matches[0], service);
      return { ...decision, source: "postal" };
    }

    if (matches.length > 1) {
      const statuses = [...new Set(matches.map((entry) => entry?.[service] || "review"))];
      return {
        status: statuses.length === 1 ? statuses[0] : "review",
        known: true,
        city: null,
        postalCodes: [postal],
        candidates: matches.map((entry) => entry.city),
        source: "postal-multiple",
      };
    }

    const departmentPrefix = postal.slice(0, 2);
    const nearDepartments = new Set(["84", "13", "30"]);
    return {
      status: nearDepartments.has(departmentPrefix) ? "review" : "no",
      known: false,
      city: null,
      postalCodes: [postal],
      candidates: [],
      source: nearDepartments.has(departmentPrefix)
        ? "postal-near-department-unknown"
        : "postal-outside-department",
    };
  }

  return {
    status: "unknown",
    known: false,
    city: null,
    postalCodes: [],
    candidates: [],
    source: "unknown-city",
  };
}

export function sectorStatusToZone(status) {
  if (status === "yes") return "in";
  if (status === "no") return "out";
  if (status === "review") return "review";
  return "unknown";
}

export function getSectorData() {
  return sector;
}
