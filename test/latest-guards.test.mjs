import test from "node:test";
import assert from "node:assert/strict";

import {
  extractCustomerStatusClean,
  extractIdentityClean,
} from "../clean-v1-core-latest.mjs";
import { extractPostalCode } from "../sector-rules-latest.mjs";

test("pas du tout signifie nouveau client", () => {
  assert.equal(extractCustomerStatusClean("Pas du tout."), "new");
  assert.equal(extractCustomerStatusClean("Euh, pas du tout merci."), "new");
});

test("les hésitations initiales ne font pas partie du nom", () => {
  assert.equal(extractIdentityClean("euh Sabrina Pérez."), "Sabrina Pérez");
  assert.equal(extractIdentityClean("heu Nicolas Gauthier"), "Nicolas Gauthier");
});

test("un code postal oral ambigu ne peut pas déclencher un secteur", () => {
  assert.equal(extractPostalCode("Quatre huit cents."), null);
  assert.equal(extractPostalCode("quatre-vingt-quatre mille huit cents"), "84800");
  assert.equal(extractPostalCode("84800"), "84800");
});
