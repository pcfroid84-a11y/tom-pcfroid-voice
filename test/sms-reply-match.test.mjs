import test from "node:test";
import assert from "node:assert/strict";
import {
  findMatchingCalls,
  chooseLatestCallForSms,
  buildInboundSmsRecord,
} from "../sms-reply-match.mjs";

const calls = [
  {
    appel_id: "CALL_OLD",
    telephone_rappel: "0767651245",
    identite: "Nicolas Garcia",
    motif: "Dépannage climatisation",
    date_heure_fin: "2026-08-28T10:00:00+02:00",
  },
  {
    appel_id: "CALL_NEW",
    telephone_rappel: "+33767651245",
    identite: "Nicolas Garcia",
    motif: "Entretien climatisation",
    date_heure_fin: "2026-08-30T15:23:47+02:00",
  },
  {
    appel_id: "OTHER",
    telephone_rappel: "+33600000000",
    identite: "Autre client",
    motif: "Devis",
    date_heure_fin: "2026-08-30T16:00:00+02:00",
  },
];

test("retrouve les appels du même numéro malgré les formats 07 et +33", () => {
  const result = findMatchingCalls(calls, "07 67 65 12 45");
  assert.deepEqual(result.map((item) => item.appel_id), ["CALL_NEW", "CALL_OLD"]);
});

test("rattache une réponse au dernier appel correspondant et non au dernier appel global", () => {
  const match = chooseLatestCallForSms(calls, "+33767651245");
  assert.equal(match.status, "RATTACHÉ");
  assert.equal(match.call.appel_id, "CALL_NEW");
  assert.equal(match.candidate_count, 2);
});

test("ne rattache pas un numéro inconnu", () => {
  const match = chooseLatestCallForSms(calls, "+33711111111");
  assert.equal(match.status, "NON RATTACHÉ");
  assert.equal(match.call, null);
});

test("prépare l'enregistrement du SMS entrant avec l'appel d'origine", () => {
  const record = buildInboundSmsRecord(
    {
      messageSid: "SM_TEST",
      from: "0767651245",
      body: "Petite correction : c'est le 5 rue Neuve.",
      receivedAt: "2026-08-31T09:00:00+02:00",
    },
    calls,
  );

  assert.equal(record.appel_id_rattache, "CALL_NEW");
  assert.equal(record.identite, "Nicolas Garcia");
  assert.equal(record.motif, "Entretien climatisation");
  assert.equal(record.statut_rattachement, "RATTACHÉ");
  assert.equal(record.nombre_appels_correspondants, 2);
});
