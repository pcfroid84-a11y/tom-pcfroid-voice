import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { RUNTIME_PATCHES } from "../runtime-patches.mjs";
import { CONVERSATION_START_PATCHES } from "../conversation-start-patches.mjs";
import { ECHO_GUARD_PATCHES } from "../echo-guard-patches.mjs";

test("les correctifs runtime conservent raccrochage, secteur et protection anti-écho", async () => {
  const launcher = await readFile(new URL("../start-with-call-end.mjs", import.meta.url), "utf8");
  const anchor = 'await writeFile(runtimePath, source, "utf8");';
  assert.ok(launcher.includes(anchor));

  const generated = launcher.replace(
    anchor,
    RUNTIME_PATCHES + CONVERSATION_START_PATCHES + ECHO_GUARD_PATCHES + anchor,
  );
  assert.match(generated, /raccrochage fiable après final_followup/);
  assert.match(generated, /ville inconnue vers demande code postal/);
  assert.match(generated, /décision secteur selon activité/);
  assert.match(generated, /devis clim simple reconnu comme projet installation/);
  assert.match(generated, /protection anti-écho pendant accueil/);
  assert.match(generated, /ignore écho bonjour initial/);

  const file = join(tmpdir(), `tom-generated-launcher-${process.pid}-${Date.now()}.mjs`);
  await writeFile(file, generated, "utf8");
  try {
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    await unlink(file).catch(() => {});
  }
});
