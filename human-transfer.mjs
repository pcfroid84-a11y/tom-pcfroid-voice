function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildTransferTwiml({ targetNumber, timeoutSeconds = 20 } = {}) {
  if (!targetNumber) throw new Error("Numéro de transfert manquant");
  const timeout = Math.max(5, Math.min(60, Number(timeoutSeconds) || 20));
  const number = escapeXml(targetNumber);

  return [
    "<Response>",
    `<Dial answerOnBridge="true" timeout="${timeout}"><Number>${number}</Number></Dial>`,
    '<Say language="fr-FR">Je suis désolé, personne de l’équipe n’est disponible pour le moment. Votre appel a bien été enregistré et l’équipe vous rappellera dès que possible.</Say>',
    "</Response>",
  ].join("");
}

export async function transferTwilioCall({
  callSid,
  targetNumber,
  accountSid = process.env.TWILIO_ACCOUNT_SID,
  authToken = process.env.TWILIO_AUTH_TOKEN,
  timeoutSeconds = 20,
  fetchImpl = fetch,
} = {}) {
  if (!callSid) throw new Error("Call SID manquant pour le transfert");
  if (!targetNumber) throw new Error("Numéro humain manquant pour le transfert");
  if (!accountSid || !authToken) {
    throw new Error("Identifiants Twilio absents : transfert non disponible");
  }

  const twiml = buildTransferTwiml({ targetNumber, timeoutSeconds });
  const body = new URLSearchParams({ Twiml: twiml });
  const authorization = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls/${encodeURIComponent(callSid)}.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Échec transfert Twilio HTTP ${response.status}${detail ? ` : ${detail.slice(0, 300)}` : ""}`);
  }

  return true;
}
