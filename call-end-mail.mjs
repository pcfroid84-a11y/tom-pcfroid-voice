function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusLabel(status) {
  if (status === "existing") return "Client existant";
  if (status === "new") return "Nouveau client / prospect";
  return "Statut non précisé";
}

function actionLabel(category) {
  if (category === "URGENCE") return "À traiter en priorité par l’équipe.";
  if (category === "PARTENAIRE") return "Prendre connaissance du message et rappeler si nécessaire.";
  if (category === "PROSPECT") return "Recontacter le prospect pour donner suite à sa demande.";
  if (category === "CLIENT") return "Recontacter le client pour donner suite à sa demande.";
  return "Prendre connaissance de la demande et rappeler si nécessaire.";
}

const TRIVIAL_MESSAGES = new Set([
  "oui",
  "non",
  "d'accord",
  "daccord",
  "ok",
  "okay",
  "merci",
  "au revoir",
  "bonne journée",
]);

export function buildUsefulDetails(callerMessages = []) {
  const details = [];

  for (const item of Array.isArray(callerMessages) ? callerMessages : []) {
    const text = String(item || "").trim();
    if (!text) continue;
    const normalized = text
      .toLowerCase()
      .replace(/[.!?,;:]+$/g, "")
      .trim();
    if (TRIVIAL_MESSAGES.has(normalized)) continue;
    if (text.length < 5) continue;

    const clipped = text.length > 240 ? text.slice(0, 237) + "…" : text;
    if (!details.includes(clipped)) details.push(clipped);
  }

  return details.slice(0, 5);
}

export function buildCallEndMailHtml(payload = {}) {
  const identity = payload.identity || "Identité à confirmer";
  const phone = payload.phone || "Non communiqué";
  const reason = payload.reason || "Non précisé";
  const equipment = payload.equipment || "Non précisé";
  const address = payload.address || null;
  const city = payload.city || null;
  const location = [address, city]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" — ") || "Non précisé";
  const details = buildUsefulDetails(payload.caller_messages);
  const category = payload.category || "MESSAGE";

  const detailsHtml = details.length
    ? `<ul style="margin:6px 0 0 18px;padding:0">${details
        .map((detail) => `<li style="margin:4px 0">${escapeHtml(detail)}</li>`)
        .join("")}</ul>`
    : '<p style="margin:6px 0 0">Aucune précision supplémentaire exploitable.</p>';

  return `<!doctype html>
<html lang="fr">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#202124;line-height:1.45;margin:0;padding:18px">
    <div style="max-width:680px;margin:0 auto">
      <h2 style="margin:0 0 14px">Appel reçu par Tom</h2>

      <div style="padding:12px 14px;border:1px solid #dadce0;border-radius:8px;margin-bottom:12px">
        <strong style="font-size:17px">${escapeHtml(identity)}</strong><br>
        📞 ${escapeHtml(phone)}<br>
        ${escapeHtml(statusLabel(payload.customer_status))}
      </div>

      <p><strong>Demande</strong><br>${escapeHtml(reason)}</p>
      <p><strong>Équipement</strong><br>${escapeHtml(equipment)}</p>
      <p><strong>Lieu</strong><br>${escapeHtml(location)}</p>

      <div style="margin-top:14px">
        <strong>Informations utiles</strong>
        ${detailsHtml}
      </div>

      <div style="margin-top:16px;padding:10px 12px;border-left:4px solid #5f6368;background:#f8f9fa">
        <strong>À faire</strong><br>${escapeHtml(actionLabel(category))}
      </div>

      <p style="margin-top:18px;font-size:12px;color:#5f6368">Catégorie : ${escapeHtml(category)}</p>
    </div>
  </body>
</html>`;
}
