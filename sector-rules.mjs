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

export function extractPostalCode(text = "") {
  const compact = String(text || "").replace(/(?<=\d)\s+(?=\d)/g, "");
  const match = compact.match(/\b\d{5}\b/);
  return match?.[0] || null;
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
