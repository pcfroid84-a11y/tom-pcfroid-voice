import test from "node:test";
import assert from "node:assert/strict";
import { formatKnowledgeContext } from "../knowledge-loader.mjs";

const site = {
  entries: [
    { active: true, answer: "PC Froid intervient en climatisation." },
    { active: false, answer: "Information inactive." },
  ],
};

const tariffs = {
  tariffs: [
    { service: "Entretien", price: "105 €", condition: "Tarif dégressif" },
    { service: "Installation", price: "À partir de 1 250 € TTC", condition: null },
  ],
};

test("n'inclut que les connaissances actives", () => {
  const text = formatKnowledgeContext({ site, tariffs, includeTariffs: false });
  assert.match(text, /PC Froid intervient en climatisation/);
  assert.doesNotMatch(text, /Information inactive/);
});

test("n'expose pas les tarifs tant qu'ils ne sont pas activés", () => {
  const text = formatKnowledgeContext({ site, tariffs, includeTariffs: false });
  assert.doesNotMatch(text, /105 €/);
  assert.match(text, /grille n'est pas activée/);
});

test("préserve les mentions à partir de et TTC quand les tarifs sont activés", () => {
  const text = formatKnowledgeContext({ site, tariffs, includeTariffs: true });
  assert.match(text, /Entretien : 105 € — Tarif dégressif/);
  assert.match(text, /Installation : À partir de 1 250 € TTC/);
});
