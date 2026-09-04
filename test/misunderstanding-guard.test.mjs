import test from "node:test";
import assert from "node:assert/strict";
import {
  createMisunderstandingState,
  updateMisunderstandingGuard,
  transferPhrase,
} from "../misunderstanding-guard.mjs";

test("autorise une reformulation après la première incompréhension", () => {
  const state = updateMisunderstandingGuard(createMisunderstandingState(), "unclear");
  assert.equal(state.consecutiveUnclearTurns, 1);
  assert.equal(state.transferRequested, false);
  assert.equal(state.reason, "reformulation_autorisee");
});

test("demande un transfert après la deuxième incompréhension consécutive", () => {
  const once = updateMisunderstandingGuard(createMisunderstandingState(), "unclear");
  const twice = updateMisunderstandingGuard(once, "unclear");
  assert.equal(twice.consecutiveUnclearTurns, 2);
  assert.equal(twice.transferRequested, true);
  assert.equal(twice.reason, "incomprehension_repetee");
});

test("une réponse comprise remet le compteur à zéro", () => {
  const once = updateMisunderstandingGuard(createMisunderstandingState(), "unclear");
  const understood = updateMisunderstandingGuard(once, "understood");
  assert.equal(understood.consecutiveUnclearTurns, 0);
  assert.equal(understood.transferRequested, false);
});

test("une demande explicite d'humain déclenche immédiatement le transfert", () => {
  const state = updateMisunderstandingGuard(createMisunderstandingState(), "explicit_human_request");
  assert.equal(state.transferRequested, true);
  assert.equal(state.reason, "client_demande_humain");
  assert.match(transferPhrase(), /Ne quittez pas, je vous transfère/);
});
