import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  buildCategory,
  buildCallEndPayload,
  getIdentity,
} from "../call-end-payload.mjs";

test("normalise les numéros français", () => {
  assert.equal(normalizePhone("07 67 65 12 45"), "+33767651245");
  assert.equal(normalizePhone("0033767651245"), "+33767651245");
  assert.equal(normalizePhone("+33767651245"), "+33767651245");
});

test("un score numérique 2 ne classe plus automatiquement un entretien en URGENCE", () => {
  const category = buildCategory({
    customerStatus: "new",
    serviceIntent: "entretien",
    routingUrgency: 2,
  });
  assert.equal(category, "PROSPECT");
});

test("une urgence explicitement confirmée reste URGENCE", () => {
  assert.equal(
    buildCategory({ customerStatus: "existing", businessUrgencyConfirmed: true }),
    "URGENCE",
  );
  assert.equal(
    buildCategory({ customerStatus: "existing", routingUrgency: "urgent" }),
    "URGENCE",
  );
});

test("une identité identique à la ville est rejetée comme suspecte", () => {
  assert.deepEqual(
    getIdentity({ identityName: "Avignon", interventionCity: "Avignon" }),
    { value: null, confidence: "suspicious_city_match" },
  );
});

test("construit un payload exploitable pour mémoire, mail et SMS", () => {
  const payload = buildCallEndPayload(
    {
      callSid: "CA_TEST",
      callerPhone: "0767651245",
      callbackPhone: "0767651245",
      customerStatus: "new",
      identityName: "Nicolas Garcia",
      serviceIntent: "entretien",
      explicitEquipment: "climatisation",
      interventionCity: "Avignon",
      interventionAddress: "3 rue Neuve",
      routingUrgency: 2,
      callerMessages: [
        "Je voudrais prendre un rendez-vous pour l'entretien de ma clim.",
        "Nicolas Garcia.",
      ],
      finalQuestionAsked: true,
    },
    "socket-close",
    new Date("2026-08-30T15:23:47.000Z"),
  );

  assert.equal(payload.category, "PROSPECT");
  assert.equal(payload.identity, "Nicolas Garcia");
  assert.equal(payload.phone, "+33767651245");
  assert.equal(payload.reason, "Entretien climatisation");
  assert.equal(payload.city, "Avignon");
  assert.equal(payload.call_complete, true);
  assert.match(payload.sms_summary, /Entretien climatisation/);
  assert.match(payload.mail_subject, /^\[PROSPECT\]/);
});
