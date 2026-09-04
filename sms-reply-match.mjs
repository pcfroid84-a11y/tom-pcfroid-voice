import { normalizePhone } from "./call-end-payload.mjs";

function parseDate(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

export function findMatchingCalls(calls = [], phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  return (Array.isArray(calls) ? calls : [])
    .filter((call) => {
      const callback = normalizePhone(call?.telephone_rappel || call?.phone || call?.callback_phone);
      const caller = normalizePhone(call?.telephone_appelant || call?.caller_phone);
      return callback === normalized || caller === normalized;
    })
    .slice()
    .sort((a, b) => {
      const aDate = parseDate(a?.date_heure_fin || a?.ended_at);
      const bDate = parseDate(b?.date_heure_fin || b?.ended_at);
      return bDate - aDate;
    });
}

export function chooseLatestCallForSms(calls = [], phone) {
  const matches = findMatchingCalls(calls, phone);
  if (!matches.length) {
    return {
      status: "NON RATTACHÉ",
      call: null,
      candidate_count: 0,
    };
  }

  return {
    status: "RATTACHÉ",
    call: matches[0],
    candidate_count: matches.length,
  };
}

export function buildInboundSmsRecord({ messageSid, from, body, receivedAt } = {}, calls = []) {
  const phone = normalizePhone(from);
  const match = chooseLatestCallForSms(calls, phone);
  const call = match.call || {};

  return {
    sms_id: messageSid || null,
    date_heure: receivedAt || new Date().toISOString(),
    telephone: phone,
    direction: "ENTRANT",
    contenu: String(body || "").trim(),
    appel_id_rattache: call.appel_id || call.call_sid || null,
    identite: call.identite || call.identity || null,
    motif: call.motif || call.reason || null,
    appel_date: call.date_heure_fin || call.ended_at || null,
    statut_rattachement: match.status,
    nombre_appels_correspondants: match.candidate_count,
    action: "Transmettre à l'équipe",
    mail_transmis: "NON",
  };
}
