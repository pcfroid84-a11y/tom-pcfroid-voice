import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launcher = await readFile(new URL("../start-with-call-end.mjs", import.meta.url), "utf8");

test("le launcher active l'interruption client et les réglages voix test", () => {
  assert.match(launcher, /caller-barge-in-greeting/);
  assert.match(launcher, /Interruption client : audio de Tom coupé immédiatement/);
  assert.match(launcher, /amplifyMulawBase64\(event\.delta, 1\.12\)/);
  assert.match(launcher, /speed: 1\.15/);
});
