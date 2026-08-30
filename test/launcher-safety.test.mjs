import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const server = await readFile(new URL("../server.js", import.meta.url), "utf8");

const anchors = [
  `const N8N_WEBHOOK_URL =\n  process.env.N8N_WEBHOOK_URL ||\n  "https://pcfroid84.app.n8n.cloud/webhook/tom-appel";\n`,
  `    n8nAttempts: 0,\n    identityKnown: false,`,
  `      const businessContext = buildBusinessContext(context, state.explicitEquipment);`,
  `          state.lastCallerMessage = callerMessage;\n\n          // Un même tour client`,
  `          if (!state.identityKnown) {\n            let detectedName = null;`,
  `        instructions: SYSTEM_PROMPT,`,
  `  function setFlowStage(nextStage, reason = "") {`,
  `        case "stop":\n          app.log.info("Flux Twilio arrêté");\n          state.closed = true;`,
  `  socket.on("close", () => {\n    state.closed = true;`,
];

test("le launcher V1 est syntaxiquement valide", () => {
  const result = spawnSync(process.execPath, ["--check", "start-with-call-end.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("toutes les ancres du patch existent encore dans server.js figé", () => {
  for (const anchor of anchors) {
    assert.equal(server.includes(anchor), true, `Ancre absente : ${anchor.slice(0, 80)}`);
  }
});

test("server.js reste identifié comme V2.10 FLOW LOCK", () => {
  assert.match(server.slice(0, 200), /V2\.10 FLOW LOCK/);
});
