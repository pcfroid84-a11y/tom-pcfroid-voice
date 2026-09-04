import test from "node:test";
import assert from "node:assert/strict";
import { buildTransferTwiml, transferTwilioCall } from "../human-transfer.mjs";

test("construit un TwiML de transfert avec secours si personne ne répond", () => {
  const xml = buildTransferTwiml({ targetNumber: "+33767651245", timeoutSeconds: 20 });
  assert.match(xml, /^<Response>/);
  assert.match(xml, /<Dial answerOnBridge="true" timeout="20">/);
  assert.match(xml, /\+33767651245/);
  assert.match(xml, /personne de l’équipe n’est disponible/);
});

test("refuse un transfert sans numéro humain", () => {
  assert.throws(() => buildTransferTwiml({}), /Numéro de transfert manquant/);
});

test("refuse proprement si les identifiants Twilio ne sont pas disponibles", async () => {
  await assert.rejects(
    transferTwilioCall({ callSid: "CA_TEST", targetNumber: "+33767651245", accountSid: null, authToken: null }),
    /Identifiants Twilio absents/,
  );
});

test("prépare une requête Twilio correcte sans effectuer d'appel réel", async () => {
  let captured;
  const fakeFetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, text: async () => "" };
  };

  const result = await transferTwilioCall({
    callSid: "CA_TEST",
    targetNumber: "+33767651245",
    accountSid: "AC_TEST",
    authToken: "secret-test-only",
    fetchImpl: fakeFetch,
  });

  assert.equal(result, true);
  assert.match(captured.url, /Calls\/CA_TEST\.json$/);
  assert.equal(captured.options.method, "POST");
  assert.match(String(captured.options.body), /Twiml=/);
});
