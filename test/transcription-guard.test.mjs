import test from "node:test";
import assert from "node:assert/strict";

import {
  extractCustomerStatusClean,
  extractYesNoClean,
  finalAnswerKind,
} from "../clean-v1-core-latest.mjs";
import {
  containsNonLatinScript,
  isReliableIdentityTranscript,
  isVeryLowConfidenceTranscript,
  matchKnownSectorCity,
  transcriptionAverageLogprob,
} from "../transcription-guard.mjs";

test("les réponses courtes restent comprises même si la transcription dérive", () => {
  assert.equal(extractYesNoClean("Tout à fait."), "yes");
  assert.equal(extractYesNoClean("Bien sûr."), "yes");
  assert.equal(extractYesNoClean("Pas du tout."), "no");
  assert.equal(extractYesNoClean("Não."), "no");
  assert.equal(extractCustomerStatusClean("Não."), "new");
  assert.equal(finalAnswerKind("Não."), "nothing_else");
});

test("un nom corrompu ou incomplet n'est jamais verrouillé", () => {
  assert.equal(containsNonLatinScript("Оче"), true);
  assert.equal(containsNonLatinScript("Pierre Martin"), false);

  assert.equal(isReliableIdentityTranscript({ text: "Оче.", customerStatus: "existing" }), false);
  assert.equal(isReliableIdentityTranscript({ text: "Goći?", customerStatus: "existing" }), false);
  assert.equal(isReliableIdentityTranscript({ text: "Abolenos", customerStatus: "new" }), false);
  assert.equal(isReliableIdentityTranscript({ text: "Pierre Martin", customerStatus: "new" }), true);
  assert.equal(isReliableIdentityTranscript({ text: "Martin", customerStatus: "existing" }), true);
});

test("une transcription à très faible confiance est rejetée pour un champ critique", () => {
  const bad = [{ logprob: -2.4 }, { logprob: -2.1 }];
  const good = [{ logprob: -0.1 }, { logprob: -0.3 }];
  assert.ok(transcriptionAverageLogprob(bad) < -2);
  assert.equal(isVeryLowConfidenceTranscript(bad), true);
  assert.equal(isVeryLowConfidenceTranscript(good), false);
  assert.equal(isReliableIdentityTranscript({ text: "Pierre Martin", customerStatus: "new", logprobs: bad }), false);
});

test("les communes connues tolèrent une petite erreur phonétique sans inventer", () => {
  assert.equal(matchKnownSectorCity("Bédarrides")?.city, "Bédarrides");
  assert.equal(matchKnownSectorCity("Bedarides")?.city, "Bédarrides");
  assert.equal(matchKnownSectorCity("Je suis à Monteux")?.city, "Monteux");
  assert.equal(matchKnownSectorCity("À bientôt"), null);
  assert.equal(matchKnownSectorCity("Apolen"), null);
});
