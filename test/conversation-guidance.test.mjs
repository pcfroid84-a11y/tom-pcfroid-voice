import test from "node:test";
import assert from "node:assert/strict";
import {
  TOM_CONVERSATION_GUIDANCE,
  buildInitialRecoveryInstruction,
  buildRecoveryInstruction,
  buildReassuringClosingInstructions,
} from "../conversation-guidance.mjs";

test("Tom répond à allô sans enchaîner avec une question parasite", () => {
  const instruction = buildInitialRecoveryInstruction("Allô ?");
  assert.match(instruction, /je vous écoute/i);
  assert.doesNotMatch(instruction, /Que puis-je faire pour vous/i);
  assert.match(instruction, /laissez l’appelant expliquer sa demande/i);
});

test("Tom répond à bonjour puis laisse réellement parler l'appelant", () => {
  const instruction = buildInitialRecoveryInstruction("Bonjour.");
  assert.match(instruction, /Bonjour, je vous écoute/i);
  assert.match(instruction, /Ne posez aucune question/i);
  assert.doesNotMatch(instruction, /motif de votre appel/i);
});

test("une transcription initiale inexploitable déclenche une reformulation naturelle", () => {
  const instruction = buildInitialRecoveryInstruction("Viva, pour caméra non.");
  assert.match(instruction, /Excusez-moi/i);
  assert.match(instruction, /reformuler/i);
});

test("la première incompréhension du nom ne répète pas mécaniquement la question", () => {
  const instruction = buildRecoveryInstruction("identity", { attempt: 1 });
  assert.match(instruction, /interpréter correctement/i);
  assert.match(instruction, /prénom et votre nom/i);
  assert.doesNotMatch(instruction, /Pouvez-vous me donner votre prénom et votre nom, s’il vous plaît \?/i);
});

test("la deuxième incompréhension ne promet pas un transfert si le direct n'est pas disponible", () => {
  const instruction = buildRecoveryInstruction("identity", {
    attempt: 2,
    liveTransferAvailable: false,
  });
  assert.match(instruction, /équipe vous rappellera/i);
  assert.doesNotMatch(instruction, /Ne quittez pas, je vous transfère/i);
});

test("la deuxième incompréhension peut préparer le transfert lorsqu'il sera activé", () => {
  const instruction = buildRecoveryInstruction("identity", {
    attempt: 2,
    liveTransferAvailable: true,
  });
  assert.match(instruction, /Ne quittez pas, je vous transfère/i);
});

test("la conclusion entretien rassure sans inventer de rendez-vous", () => {
  const instruction = buildReassuringClosingInstructions({
    serviceIntent: "entretien",
    equipment: "climatisation",
  });
  assert.match(instruction, /demande d’entretien est bien enregistrée/i);
  assert.match(instruction, /va vous rappeler/i);
  assert.match(instruction, /selon vos disponibilités/i);
  assert.match(instruction, /Ne promettez aucun créneau/i);
});

test("le guide interdit la fausse confirmation et la fausse disponibilité", () => {
  assert.match(TOM_CONVERSATION_GUIDANCE, /merci pour cette confirmation/i);
  assert.match(TOM_CONVERSATION_GUIDANCE, /aucun agenda réel/i);
});
