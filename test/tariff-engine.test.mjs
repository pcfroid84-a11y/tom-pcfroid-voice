import test from "node:test";
import assert from "node:assert/strict";

import {
  buildControlledTariffSentence,
  buildUncertainTariffSentence,
  extractIndoorUnitCount,
  getClimMaintenanceQuote,
  inferClimMaintenanceConfig,
  isClimMaintenanceTariffRequest,
} from "../tariff-engine.mjs";

test("reconnaît les demandes de tarif même formulées brièvement", () => {
  assert.equal(isClimMaintenanceTariffRequest("Est-ce que vous pouvez me donner le tarif ?"), true);
  assert.equal(isClimMaintenanceTariffRequest("Quel est le prix ?"), true);
  assert.equal(isClimMaintenanceTariffRequest("Combien d'unités intérieures avez-vous ?"), false);
});

test("grille monosplits validée", () => {
  assert.equal(getClimMaintenanceQuote({ type: "mono", count: 1 }).priceTtc, 105);
  assert.equal(getClimMaintenanceQuote({ type: "mono", count: 2 }).priceTtc, 155);
  assert.equal(getClimMaintenanceQuote({ type: "mono", count: 3 }).priceTtc, 195);
  assert.equal(getClimMaintenanceQuote({ type: "mono", count: 4 }).priceTtc, 235);
  assert.equal(getClimMaintenanceQuote({ type: "mono", count: 5 }).priceTtc, 275);
});

test("grille multisplits validée", () => {
  assert.equal(getClimMaintenanceQuote({ type: "multi", count: 2 }).priceTtc, 150);
  assert.equal(getClimMaintenanceQuote({ type: "multi", count: 3 }).priceTtc, 180);
  assert.equal(getClimMaintenanceQuote({ type: "multi", count: 4 }).priceTtc, 210);
  assert.equal(getClimMaintenanceQuote({ type: "multi", count: 5 }).priceTtc, 240);
});

test("une configuration explicite peut être tarifée sans question supplémentaire", () => {
  assert.deepEqual(inferClimMaintenanceConfig("J'ai un tri-split"), { type: "multi", count: 3 });
  assert.deepEqual(inferClimMaintenanceConfig("J'ai trois monosplits"), { type: "mono", count: 3 });
  assert.deepEqual(inferClimMaintenanceConfig("J'ai une climatisation"), { type: "mono", count: 1 });
});

test("un simple nombre ou une adresse ne devient jamais une configuration", () => {
  assert.equal(inferClimMaintenanceConfig("Trois rue Neuve"), null);
  assert.equal(inferClimMaintenanceConfig("J'en ai trois"), null);
  assert.equal(extractIndoorUnitCount("J'en ai trois"), 3);
});

test("le prix annoncé reste toujours soumis à validation PC Froid", () => {
  const speech = buildControlledTariffSentence(getClimMaintenanceQuote({ type: "multi", count: 3 }));
  assert.match(speech, /180 euros TTC/);
  assert.match(speech, /confirmé par l’équipe PC Froid/);
  assert.match(buildUncertainTariffSentence(), /PC Froid vous confirme directement le tarif/);
});
