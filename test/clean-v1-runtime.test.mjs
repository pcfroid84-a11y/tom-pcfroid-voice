import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { CLEAN_V1_PATCHES } from "../clean-v1-runtime-patches.mjs";

test("le runtime propre s'injecte entièrement dans l'ancien moteur stable", async () => {
  const baseLauncher = await readFile(new URL("../start-with-call-end.mjs", import.meta.url), "utf8");
  const anchor = 'await writeFile(runtimePath, source, "utf8");';
  assert.ok(baseLauncher.includes(anchor), "ancre finale du launcher absente");

  let generatedLauncher = baseLauncher.replace(anchor, CLEAN_V1_PATCHES + anchor);

  // Pour ce test, on applique tous les replaceOnce et on écrit le runtime,
  // mais on n'importe pas le serveur HTTP final.
  generatedLauncher = generatedLauncher.replace(
    'await import(runtimePath.href + `?v=${Date.now()}`);',
    'console.log(runtimePath.pathname);',
  );

  const launcherUrl = new URL(`../.clean-v1-runtime-test-${process.pid}.mjs`, import.meta.url);
  const runtimeUrl = new URL("../.tom-server-runtime.mjs", import.meta.url);

  await writeFile(launcherUrl, generatedLauncher, "utf8");
  try {
    const applied = spawnSync(process.execPath, [launcherUrl.pathname], {
      encoding: "utf8",
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, OPENAI_API_KEY: "test-only-not-used" },
      timeout: 10000,
    });

    assert.equal(
      applied.status,
      0,
      `échec d'injection du runtime propre:\n${applied.stderr || applied.stdout}`,
    );

    const runtime = await readFile(runtimeUrl, "utf8");

    for (const marker of [
      "Client test reconnu directement par le numéro appelant",
      "Relation client déjà prouvée : question statut évitée",
      "Question latérale : étape conservée sans incompréhension",
      "Nom client existant non compris : aucune deuxième interrogation",
      "Transcription d'un tour commencé pendant l'accueil ignorée sans contaminer le tour suivant",
      "Code postal utilisé pour sécuriser le secteur",
      "Très bien, votre demande d’entretien est bien enregistrée.",
    ]) {
      assert.match(runtime, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    // Le bug qui jetait la première vraie phrase après l'accueil ne doit pas exister.
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
