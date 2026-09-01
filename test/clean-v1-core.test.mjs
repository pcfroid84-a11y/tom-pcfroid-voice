import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyExpectedFieldTurn,
  detectServiceIntent,
  extractCustomerStatusClean,
  extractIdentityClean,
  finalAnswerKind,
  nextAdministrativeStage,
  relationshipProvesExistingCustomer,
  shouldAskIdentityAgain,
} from "../clean-v1-core.mjs";

test("nettoyage clim est un entretien", () => {
  assert.equal(detectServiceIntent("Je voudrais programmer le nettoyage de ma clim", "climatisation"), "entretien");
  assert.equal(detectServiceIntent("désinfection de la clim", "climatisation"), "entretien");
});

test("les formulations naturelles du statut client sont comprises", () => {
  for (const text of ["Oui", "Oui oui", "Eh oui", "Et oui", "Ben oui", "Bah oui", "Je suis client", "Vous êtes déjà venus", "J'ai déjà fait appel à vous"]) {
    assert.equal(extractCustomerStatusClean(text), "existing", text);
  }
  for (const text of ["Non", "Non non", "Première demande", "Première fois", "Je ne suis pas client", "Jamais appelé"]) {
    assert.equal(extractCustomerStatusClean(text), "new", text);
  }
});

test("une phrase qui prouve la relation client évite la question statut", () => {
  assert.equal(relationshipProvesExistingCustomer("Je voudrais l'entretien de la clim que vous m'avez installée"), true);
  assert.equal(extractCustomerStatusClean("C'est vous qui me l'avez installée"), "existing");
});

test("une question latérale ne devient pas une mauvaise réponse", () => {
  assert.deepEqual(classifyExpectedFieldTurn("customer_status", "J'ai une petite question"), {
    kind: "question_announcement",
    value: null,
  });
  assert.deepEqual(classifyExpectedFieldTurn("customer_status", "Est-ce que vous faites les entretiens ?"), {
    kind: "lateral_question",
    value: null,
  });
  assert.deepEqual(classifyExpectedFieldTurn("customer_status", "Oui, pourquoi ?"), {
    kind: "answer",
    value: "existing",
  });
});

test("les identités parasites sont refusées", () => {
  assert.equal(extractIdentityClean("И вы гочи"), null);
  assert.equal(extractIdentityClean("ça"), null);
  assert.equal(extractIdentityClean("Oye, figur"), null);
  assert.equal(extractIdentityClean("Carole Pérez"), "Carole Pérez");
});

test("un client existant rappelable n'est plus harcelé pour son nom", () => {
  assert.equal(shouldAskIdentityAgain({ customerStatus: "existing", identityKnown: false, callbackConfirmed: true, identityFallbackByPhone: true }), false);
  assert.equal(nextAdministrativeStage({ customerStatus: "existing", identityKnown: false, identityFallbackByPhone: true, knownCustomerAddress: null, callbackConfirmed: false }), "callback");
});

test("la fin naturelle est stable", () => {
  assert.equal(finalAnswerKind("Non, c'est bon."), "nothing_else");
  assert.equal(finalAnswerKind("Non, c'est bon, juste qu'on me rappelle rapidement."), "followup_then_close");
});
