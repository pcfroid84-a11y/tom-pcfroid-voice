import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../server.js", import.meta.url), "utf8");

const anchors = [
  `      ? 'If the client explicitly asks whether PC Froid handles climatisation maintenance or repair, output EXACTLY two sentences: first a brief yes statement "Oui, tout à fait, nous prenons en charge les climatisations." then exactly "Est-ce que vous êtes déjà client chez P C Froid ?" with one question mark only. If the client reports a climatisation symptom instead of asking a service question, output ONLY the status question "Est-ce que vous êtes déjà client chez P C Froid ?" with exactly one question mark. Never add technical diagnosis, technical questions, or reformulation. Stop after the question(s).'`,
  `          } else if (flowStageAtTurnStart === "identity") {\n              app.log.info(\n                { callerMessage },\n                "Réponse reçue mais identité non validée"\n              );\n            }`,
  `                "Ville d'intervention enregistrée - V2.9"\n              );\n            }\n          }`,
  `      'La réponse reçue ne ressemble pas à une adresse d’intervention. Ne l’enregistrez pas comme adresse. Demandez simplement et uniquement : "Quelle est l’adresse d’intervention ?"'`,
  `      "Le numéro de rappel n’a pas été suffisamment clair. Demandez uniquement au client de répéter son numéro de téléphone, sans inventer ni compléter de chiffres."`,
  `            'Répondez exactement et uniquement : "Je n’ai pas bien compris. Est-ce que vous êtes déjà client chez P C Froid ?" Ne posez aucune autre question.'`,
  `              "Petit fragment initial ignoré - attente de la demande réelle"`,
  `const responseInstructions = [\n  flowLock?.instructions,\n  identityGuard,\n]\n  .filter(Boolean)\n  .join("\\n\\n");`,
  `      'Si l’appelant vient de poser une dernière question, répondez-y brièvement et clairement. Ensuite clôturez une seule fois en indiquant que la demande va être transmise à l’équipe, puis souhaitez une bonne journée. Ne posez plus aucune question.',`,
];

test("les ancres des corrections conversationnelles existent dans le serveur figé", () => {
  for (const anchor of anchors) {
    assert.equal(server.includes(anchor), true, `Ancre conversationnelle absente : ${anchor.slice(0, 100)}`);
  }
});
