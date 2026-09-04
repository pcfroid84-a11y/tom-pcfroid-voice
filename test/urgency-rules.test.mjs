import test from "node:test";
import assert from "node:assert/strict";
import { classifyBusinessUrgency } from "../urgency-rules.mjs";

test("chambre froide avec marchandise sans secours = urgence confirmée", () => {
  const result = classifyBusinessUrgency({
    equipment: "chambre froide",
    noCooling: true,
    hasGoods: true,
    goodsSecured: false,
    backupCooling: false,
  });
  assert.equal(result.level, "URGENCE");
  assert.equal(result.confirmedUrgency, true);
});

test("marchandise mise en sécurité = important mais pas urgence absolue", () => {
  const result = classifyBusinessUrgency({
    equipment: "chambre froide",
    noCooling: true,
    hasGoods: true,
    goodsSecured: true,
    backupCooling: false,
  });
  assert.equal(result.level, "IMPORTANT");
  assert.equal(result.confirmedUrgency, false);
});

test("chambre froide vide = à planifier", () => {
  const result = classifyBusinessUrgency({
    equipment: "chambre froide",
    noCooling: true,
    hasGoods: false,
  });
  assert.equal(result.level, "PLANIFIER");
  assert.equal(result.confirmedUrgency, false);
});

test("un client qui dit urgent pour une clim ne crée pas automatiquement URGENCE", () => {
  const result = classifyBusinessUrgency({
    equipment: "climatisation",
    noCooling: true,
    callerSaysUrgent: true,
  });
  assert.equal(result.level, "À_VÉRIFIER_HUMAIN");
  assert.equal(result.confirmedUrgency, false);
});
