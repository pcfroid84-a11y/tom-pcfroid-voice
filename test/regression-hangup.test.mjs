import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../start-with-regression-fix.mjs", import.meta.url), "utf8");

test("le dernier complément arme toujours le raccrochage", () => {
  assert.match(source, /state\.flowStage === "final_followup"/);
  assert.match(source, /state\.pendingHangup = true/);
  assert.match(source, /state\.conversationModeEnabled = false/);
  assert.match(source, /response\?\.status === "completed"/);
});
