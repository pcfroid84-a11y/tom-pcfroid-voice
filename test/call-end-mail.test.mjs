import test from "node:test";
import assert from "node:assert/strict";
import { buildCallEndMailHtml, buildUsefulDetails } from "../call-end-mail.mjs";

test("retire les réponses triviales du mail", () => {
  assert.deepEqual(
    buildUsefulDetails([
      "Oui.",
      "Je voudrais l'entretien de ma climatisation.",
      "D'accord.",
      "Elle est au 3 rue Neuve.",
      "Au revoir.",
    ]),
    ["Je voudrais l'entretien de ma climatisation.", "Elle est au 3 rue Neuve."],
  );
});

test("génère un mail lisible sans données techniques internes", () => {
  const html = buildCallEndMailHtml({
    identity: "Nicolas Garcia",
    phone: "+33767651245",
    customer_status: "new",
    reason: "Entretien climatisation",
    equipment: "climatisation",
    city: "Avignon",
    address: "3 rue Neuve",
    category: "PROSPECT",
    caller_messages: ["Je voudrais prendre rendez-vous pour l'entretien de ma clim."],
  });

  assert.match(html, /Appel reçu par Tom/);
  assert.match(html, /Nicolas Garcia/);
  assert.match(html, /Entretien climatisation/);
  assert.match(html, /3 rue Neuve/);
  assert.match(html, /Recontacter le prospect/);
  assert.doesNotMatch(html, /Call SID/i);
});

test("échappe le HTML fourni par un appelant", () => {
  const html = buildCallEndMailHtml({
    identity: '<img src=x onerror="alert(1)">',
    phone: "+33123456789",
    reason: "Message",
    category: "MESSAGE",
    caller_messages: ["<script>alert('x')</script>"],
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x/);
});
