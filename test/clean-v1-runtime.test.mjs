import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { CLEAN_V1_LATEST_PATCHES } from "../clean-v1-runtime-latest.mjs";

test("toutes les ancres du runtime propre correspondent à l'ancien moteur stable", async () => {
  const baseLauncher = await readFile(new URL("../start-with-call-end.mjs", import.meta.url), "utf8");
  const anchor = 'await writeFile(runtimePath, source, "utf8");';
  assert.ok(baseLauncher.includes(anchor), "ancre finale du launcher absente");

  let generatedLauncher = baseLauncher.replace(anchor, CLEAN_V1_LATEST_PATCHES + anchor);

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

  assert.ok(generatedLauncher.includes(strictReplaceOnce), "fonction replaceOnce historique introuvable");
  generatedLauncher = generatedLauncher.replace(strictReplaceOnce, auditReplaceOnce);
  generatedLauncher = generatedLauncher.replace(
    'await import(runtimePath.href + `?v=${Date.now()}`);',
    'console.log(runtimePath.pathname);',
  );

  const launcherUrl = new URL(`../.clean-v1-runtime-audit-${process.pid}.mjs`, import.meta.url);
  const runtimeUrl = new URL("../.tom-server-runtime.mjs", import.meta.url);

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
      .filter((line) => line.startsWith("CLEAN_MISSING_ANCHOR:"))
      .map((line) => line.slice("CLEAN_MISSING_ANCHOR:".length));

    assert.deepEqual(missing, [], `ancres manquantes du contrôleur propre : ${missing.join(", ")}`);

    const runtime = await readFile(runtimeUrl, "utf8");
    for (const marker of [
      "Client test reconnu directement par le numéro appelant",
      "Relation client déjà prouvée : question statut évitée",
      "Question latérale : étape conservée sans incompréhension",
      "Nom client existant non compris : aucune deuxième interrogation",
      "Transcription d'un tour commencé pendant l'accueil ignorée sans contaminer le tour suivant",
      "Code postal utilisé pour sécuriser le secteur",
      "instructions: buildReassuringClosingInstructions({",
      "const cleanCallbackAnswer = extractYesNoClean(callerMessage);",
      "const callbackRecoveryAttempt = Number(state.recoveryCounts?.callback || 0) + 1;",
      "flowStageAtTurnStart !== \"final_question\"",
      "isPlausibleFrenchLocationText(cityCandidate)",
      "Le motif est verrouillé et ne doit jamais être remplacé par un autre service",
      "const fixedAdministrativeInstruction = (() => {",
      "Instruction administrative figée",
      "Aucun mot avant, aucun mot après",
      "flowStageAtTurnStart !== \"customer_status\"",
      "Allô simple ou transcription équivalente : étape conservée sans nouvelle question",
      "Oui, je vous écoute.",
      "Est-ce que l’eau vient de l’unité intérieure ?",
      "Ne demandez pas au client de répéter le motif",
      "Rendez-vous sans motif : demande de précision avant le statut client",
      "Bien sûr. C’est pour quel type d’intervention ?",
      "Relance statut client verrouillée",
      "Dites-moi simplement oui si vous êtes déjà client chez PC Froid, ou non si c’est votre première demande.",
      "./clean-v1-core-latest.mjs",
      "./sector-rules-latest.mjs",
      "Code postal incertain : nouvelle demande sans décision secteur",
      "Je n’ai pas bien compris le code postal. Pouvez-vous me le répéter, s’il vous plaît ?",
      "Output ONLY this exact French sentence with no introduction",
      "hangupGraceActive",
      "Client reparle pendant les 3 secondes : raccrochage suspendu",
      "Fin de parole client pendant la grâce : nouveau délai de 3 secondes",
      "attente de 3 secondes de silence avant raccrochage",
    ]) {
      assert.ok(runtime.includes(marker), `marqueur runtime absent : ${marker}`);
    }

    assert.match(runtime, /flowLock\?\.stage === "customer-status"[\s\S]{0,300}Est-ce que vous êtes déjà client chez P C Froid \?/);
    assert.match(runtime, /flowLock\?\.stage === "new-identity"[\s\S]{0,300}Pouvez-vous me donner votre prénom et votre nom/);
    assert.match(runtime, /flowLock\?\.stage === "callback"[\s\S]{0,300}On peut vous rappeler sur le numéro avec lequel vous appelez \?/);
    assert.match(runtime, /flowStageAtTurnStart !== "customer_status"/);
    assert.match(runtime, /\^\(allo\|hallo\|hello\|hola\)\$/);
    assert.match(runtime, /rendez\[- \]\?vous\|rdv/);
    assert.doesNotMatch(runtime, /max_output_tokens:\s*240/);
    assert.doesNotMatch(runtime, /max_output_tokens:\s*80/);
    assert.doesNotMatch(runtime, /ignoreNextGreetingSpeechTranscript/);

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
