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

const MONO_PRICES = new Map([[1,105],[2,155],[3,195],[4,235],[5,275]]);
const MULTI_PRICES = new Map([[2,150],[3,180],[4,210],[5,240]]);
const COUNT_WORDS = new Map([
  ["un",1],["une",1],["deux",2],["trois",3],["quatre",4],["cinq",5],
  ["bi",2],["tri",3],["quadri",4],["penta",5],
]);

export function isClimMaintenanceTariffRequest(text = "") {
  const value = normalize(text);
  if (!value) return false;
  return /\b(tarif|prix|cout|coute|couter)\b/.test(value) ||
    /\bcombien (?:ca|cela|c est|est ce que ca) (?:coute|couter)\b/.test(value);
}

export function extractIndoorUnitCount(text = "") {
  const value = normalize(text);
  if (!value) return null;

  const direct = value.match(/\b([1-5])\b/);
  if (direct) return Number(direct[1]);

  for (const [word, count] of COUNT_WORDS.entries()) {
    if (new RegExp(`\\b${word}\\b`).test(value)) return count;
  }

  if (/\bbi split\b/.test(value)) return 2;
  if (/\btri split\b/.test(value)) return 3;
  if (/\bquadri split\b/.test(value)) return 4;
  if (/\bpenta split\b/.test(value)) return 5;
  return null;
}

export function inferClimMaintenanceConfig(text = "") {
  const value = normalize(text);
  if (!value) return null;

  const count = extractIndoorUnitCount(value);
  const hasEquipmentCountContext = /\b(split|splits|unite|unites|clim|clims|climatisation|climatisations)\b/.test(value);
  const explicitMulti = /\b(multi split|multisplit|bi split|tri split|quadri split|penta split)\b/.test(value) ||
    /\b(un seul|meme|le meme) groupe exterieur\b/.test(value);
  const explicitMono = /\b(mono split|monosplit|monosplits|plusieurs mono|groupes exterieurs|un groupe par unite|climatisations? independantes?|clims? independantes?)\b/.test(value);

  if (explicitMulti && count && count >= 2 && count <= 5) {
    return { type: "multi", count };
  }
  if (explicitMono && count && count >= 1 && count <= 5) {
    return { type: "mono", count };
  }
  if (count === 1 && hasEquipmentCountContext) return { type: "mono", count: 1 };
  return null;
}

export function getClimMaintenanceQuote(config) {
  if (!config || !config.type || !config.count) return null;
  if (config.type === "mono") {
    const price = MONO_PRICES.get(Number(config.count));
    if (!price) return null;
    return {
      type: "mono",
      count: Number(config.count),
      priceTtc: price,
      label: Number(config.count) === 1 ? "un monosplit" : `${config.count} monosplits sur le même site`,
    };
  }
  if (config.type === "multi") {
    const price = MULTI_PRICES.get(Number(config.count));
    if (!price) return null;
    const labels = {2:"un bi-split",3:"un tri-split",4:"un quadri-split",5:"un penta-split"};
    return {
      type: "multi",
      count: Number(config.count),
      priceTtc: price,
      label: labels[Number(config.count)] || `un multisplit de ${config.count} unités intérieures`,
    };
  }
  return null;
}

export function buildControlledTariffSentence(quote) {
  if (!quote) {
    return "Je préfère que l’équipe PC Froid vous confirme directement le tarif pour éviter de vous annoncer un mauvais montant.";
  }
  return `Pour ${quote.label}, le tarif prévu est de ${quote.priceTtc} euros TTC. Ce montant sera confirmé par l’équipe PC Froid lors du rappel.`;
}

export function buildUncertainTariffSentence() {
  return "Je préfère que l’équipe PC Froid vous confirme directement le tarif pour éviter de vous annoncer un mauvais montant.";
}
