import { readFile } from "node:fs/promises";

function isEnabled(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "oui", "on"].includes(String(value).trim().toLowerCase());
}

export function formatKnowledgeContext({ site, tariffs, includeTariffs = false } = {}) {
  const lines = [
    "\n\nBASE DE CONNAISSANCES PC FROID VALIDÉE",
    "- Utilisez uniquement les informations ci-dessous pour répondre aux questions commerciales et de services.",
    "- Si une information n'est pas présente, ne l'inventez pas : transmettez ou indiquez qu'elle doit être confirmée par l'équipe.",
  ];

  const entries = Array.isArray(site?.entries) ? site.entries.filter((entry) => entry?.active) : [];
  if (entries.length) {
    lines.push("\nINFORMATIONS PC FROID :");
    for (const entry of entries) {
      if (entry?.answer) lines.push(`- ${entry.answer}`);
    }
  }

  if (includeTariffs && Array.isArray(tariffs?.tariffs)) {
    lines.push(
      "\nTARIFS AUTORISÉS :",
      "- Respectez exactement HT/TTC, ‘à partir de’, les conditions et ‘devis sur demande’.",
      "- Ne transformez jamais un prix indicatif en prix ferme.",
    );
    for (const tariff of tariffs.tariffs) {
      if (!tariff?.service || !tariff?.price) continue;
      const condition = tariff.condition ? ` — ${tariff.condition}` : "";
      lines.push(`- ${tariff.service} : ${tariff.price}${condition}`);
    }
  } else {
    lines.push(
      "\nTARIFS : la grille n'est pas activée pour la voix. N'annoncez pas de prix provenant de cette base tant que l'activation n'est pas validée.",
    );
  }

  return lines.join("\n") + "\n";
}

export async function loadKnowledgeContext({
  enableSite = isEnabled(process.env.TOM_ENABLE_SITE_KNOWLEDGE, true),
  enableTariffs = isEnabled(process.env.TOM_ENABLE_TARIFFS, false),
} = {}) {
  if (!enableSite && !enableTariffs) return "";

  let site = null;
  let tariffs = null;

  if (enableSite) {
    const siteUrl = new URL("./knowledge/site-v1.json", import.meta.url);
    site = JSON.parse(await readFile(siteUrl, "utf8"));
  }

  if (enableTariffs) {
    const tariffUrl = new URL("./knowledge/tariffs-v1.json", import.meta.url);
    tariffs = JSON.parse(await readFile(tariffUrl, "utf8"));
  }

  return formatKnowledgeContext({ site, tariffs, includeTariffs: enableTariffs });
}
