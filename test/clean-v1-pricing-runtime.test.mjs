import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { CLEAN_V1_PRICING_PATCHES } from "../clean-v1-runtime-pricing.mjs";

test("le runtime final applique le moteur tarifaire contrôlé", async () => {
  const baseLauncher = await readFile(new URL("../start-with-call-end.mjs", import.meta.url), "utf8");
  const anchor = 'await writeFile(runtimePath, source, "utf8");';
  assert.ok(baseLauncher.includes(anchor));

  let generatedLauncher = baseLauncher.replace(anchor, CLEAN_V1_PRICING_PATCHES + anchor);
  const strictReplaceOnce = `function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(\`Patch fin d'appel impossible : ancre introuvable (\${label})\`);
  }
  source = source.replace(search, replacement);
}`;
  const auditReplaceOnce = `function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) {
    console.error("CLEAN_MISSING_ANCHOR:" + label);
    return;
  }
  source = source.replace(search, replacement);
}`;

  generatedLauncher = generatedLauncher.replace(strictReplaceOnce, auditReplaceOnce);

  const launcherUrl = new URL(`../.clean-v1-pricing-audit-${process.pid}.mjs`, import.meta.url);
  const runtimeUrl = new URL(`../.tom-server-pricing-runtime-${process.pid}.mjs`, import.meta.url);
  generatedLauncher = generatedLauncher.replace(
    'const runtimePath = new URL("./.tom-server-runtime.mjs", import.meta.url);',
    `const runtimePath = new URL("./.tom-server-pricing-runtime-${process.pid}.mjs", import.meta.url);`,
  );
  generatedLauncher = generatedLauncher.replace(
    'await import(runtimePath.href + `?v=${Date.now()}`);',
    'console.log(runtimePath.pathname);',
  );

  await writeFile(launcherUrl, generatedLauncher, "utf8");

  try {
    const applied = spawnSync(process.execPath, [launcherUrl.pathname], {
      encoding: "utf8",
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, OPENAI_API_KEY: "test-only-not-used" },
      timeout: 10000,
    });
    assert.equal(applied.status, 0, applied.stderr || applied.stdout);

    const missing = String(applied.stderr || "")
      .split(/\r?\n/)
      .filter((line) => line.startsWith("CLEAN_MISSING_ANCHOR:"));
    assert.deepEqual(missing, []);

    const runtime = await readFile(runtimeUrl, "utf8");
    for (const marker of [
      "./tariff-engine.mjs",
      "Tarif entretien demandé : nombre d'unités intérieures requis",
      "combien d’unités intérieures avez-vous",
      "Ces unités intérieures sont-elles toutes reliées au même groupe extérieur",
      "Tarif entretien clim annoncé avec validation PC Froid",
      "Tarif incertain laissé à la validation PC Froid",
      "tarif répondu après la question finale",
      "Statut reconnu verrouillé : passage direct à l'étape suivante",
      'requestConversationResponse("customer-status-confirmed")',
    ]) {
      assert.ok(runtime.includes(marker), `marqueur tarifaire ou parcours absent : ${marker}`);
    }

    assert.match(runtime, /state\.serviceIntent === "entretien"[\s\S]{0,180}state\.explicitEquipment === "climatisation"/);
    assert.match(runtime, /flowStageAtTurnStart[\s\S]{0,6000}isClimMaintenanceTariffRequest\(callerMessage\)/);
    assert.match(runtime, /Statut reconnu verrouillé[\s\S]{0,220}requestConversationResponse\("customer-status-confirmed"\);[\s\S]{0,80}return;/);

    const syntax = spawnSync(process.execPath, ["--check", runtimeUrl.pathname], {
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  } finally {
    await unlink(launcherUrl).catch(() => {});
    await unlink(runtimeUrl).catch(() => {});
  }
});
