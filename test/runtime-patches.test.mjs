import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { RUNTIME_PATCHES } from "../runtime-patches.mjs";

test("les correctifs runtime conservent raccrochage et ajoutent secteur/code postal", async () => {
  const launcher = await readFile(new URL("../start-with-call-end.mjs", import.meta.url), "utf8");
  const anchor = 'await writeFile(runtimePath, source, "utf8");';
  assert.ok(launcher.includes(anchor));

  const generated = launcher.replace(anchor, RUNTIME_PATCHES + anchor);
  assert.match(generated, /raccrochage fiable après final_followup/);
  assert.match(generated, /ville inconnue vers demande code postal/);
  assert.match(generated, /décision secteur selon activité/);
  assert.match(generated, /devis clim simple reconnu comme projet installation/);

  const file = join(tmpdir(), `tom-generated-launcher-${process.pid}-${Date.now()}.mjs`);
  await writeFile(file, generated, "utf8");
  try {
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    await unlink(file).catch(() => {});
  }
});
