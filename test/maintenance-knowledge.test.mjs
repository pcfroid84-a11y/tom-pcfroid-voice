import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const knowledge = JSON.parse(
  await readFile(new URL("../knowledge/site-v1.json", import.meta.url), "utf8"),
);

function entry(key) {
  return knowledge.entries.find((item) => item.key === key);
}

test("la méthode d'entretien détaillée est présente et active", () => {
  const item = entry("climatisation_maintenance_internal_method");
  assert.equal(item?.active, true);
  assert.match(item.answer, /bâche/i);
  assert.match(item.answer, /turbine/i);
  assert.match(item.answer, /groupe extérieur/i);
  assert.match(item.answer, /températures/i);
});

test("Tom peut orienter vers la photo du site mais ne doit pas inventer de vidéo", () => {
  const item = entry("climatisation_maintenance_visual");
  assert.equal(item?.active, true);
  assert.match(item.answer, /une photo/i);
  assert.match(item.answer, /ne doit pas annoncer qu’une vidéo existe/i);
});

test("la base distingue entretien et diagnostic de panne", () => {
  const performance = entry("maintenance_when_airflow_or_performance_drops");
  const breakdown = entry("maintenance_vs_breakdown");
  assert.match(performance.answer, /bonne première étape/i);
  assert.match(performance.answer, /ne doit jamais garantir/i);
  assert.match(breakdown.answer, /diagnostic/i);
});
