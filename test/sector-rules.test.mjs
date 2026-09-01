import test from "node:test";
import assert from "node:assert/strict";

import {
  classifySectorRequest,
  extractPostalCode,
  getSectorService,
  sectorStatusToZone,
} from "../sector-rules.mjs";

test("Monteux est accepté pour toutes les activités", () => {
  for (const service of ["entretien", "depannage", "installation", "pac"]) {
    assert.equal(classifySectorRequest({ city: "Monteux", service }).status, "yes");
  }
});

test("Valréas est refusé en entretien mais installation à vérifier", () => {
  assert.equal(
    classifySectorRequest({ city: "Valréas", service: "entretien" }).status,
    "no",
  );
  assert.equal(
    classifySectorRequest({ city: "Valréas", service: "installation" }).status,
    "review",
  );
});

test("les exceptions PAC validées sont respectées", () => {
  assert.equal(classifySectorRequest({ city: "Rognonas", service: "pac" }).status, "no");
  assert.equal(classifySectorRequest({ city: "Barbentane", service: "pac" }).status, "no");
  assert.equal(classifySectorRequest({ city: "Cabannes", service: "pac" }).status, "yes");
  assert.equal(classifySectorRequest({ city: "Vacqueyras", service: "pac" }).status, "yes");
  assert.equal(classifySectorRequest({ city: "Jonquières", service: "pac" }).status, "yes");
});

test("une ville inconnue ne doit jamais être validée sans code postal", () => {
  const decision = classifySectorRequest({ city: "Alice", service: "entretien" });
  assert.equal(decision.status, "unknown");
  assert.equal(decision.known, false);
});

test("Nice et le code postal 06000 sont hors secteur", () => {
  assert.equal(classifySectorRequest({ city: "Nice", service: "installation" }).status, "no");
  assert.equal(classifySectorRequest({ postalCode: "06000", service: "installation" }).status, "no");
});

test("le code postal peut confirmer une commune connue", () => {
  const decision = classifySectorRequest({ postalCode: "84170", service: "pac" });
  assert.equal(decision.status, "yes");
  assert.equal(decision.city, "Monteux");
  assert.equal(decision.source, "postal");
});

test("un code postal partagé reste exploitable si le statut est identique", () => {
  const decision = classifySectorRequest({ postalCode: "84210", service: "pac" });
  assert.equal(decision.status, "yes");
  assert.equal(decision.city, null);
  assert.ok(decision.candidates.includes("Althen-des-Paluds"));
  assert.ok(decision.candidates.includes("Pernes-les-Fontaines"));
});

test("un client connu n'est jamais refusé automatiquement", () => {
  const decision = classifySectorRequest({
    city: "Valréas",
    service: "entretien",
    existingCustomer: true,
  });
  assert.equal(decision.status, "review");
  assert.equal(decision.source, "existing-customer-override");
});

test("un devis clim simple est classé installation", () => {
  assert.equal(
    getSectorService({ equipment: "climatisation", text: "Je voudrais un devis pour une climatisation" }),
    "installation",
  );
});

test("extraction code postal tolère un espace", () => {
  assert.equal(extractPostalCode("C'est 84 170"), "84170");
});

test("comprend un code postal dicté chiffre par chiffre", () => {
  assert.equal(extractPostalCode("huit quatre deux six zéro"), "84260");
  assert.equal(extractPostalCode("huit, quatre, deux, six, zéro"), "84260");
});

test("comprend un code postal dicté comme un nombre français", () => {
  assert.equal(
    extractPostalCode("quatre-vingt-quatre mille deux cent soixante"),
    "84260",
  );
});

test("comprend un code postal dicté en deux groupes", () => {
  assert.equal(
    extractPostalCode("C'est quatre-vingt-quatre, deux cent soixante."),
    "84260",
  );
  assert.equal(
    extractPostalCode("quatre-vingt-quatre deux cent soixante"),
    "84260",
  );
});

test("conserve le zéro initial d'un code postal dicté", () => {
  assert.equal(extractPostalCode("zéro six zéro zéro zéro"), "06000");
  assert.equal(extractPostalCode("six mille"), "06000");
});

test("conversion statut vers zone", () => {
  assert.equal(sectorStatusToZone("yes"), "in");
  assert.equal(sectorStatusToZone("no"), "out");
  assert.equal(sectorStatusToZone("review"), "review");
});
