import { readFile, writeFile } from "node:fs/promises";
import { RUNTIME_PATCHES } from "./runtime-patches.mjs";
import { CONVERSATION_START_PATCHES } from "./conversation-start-patches.mjs";
import { DETOUR_HARDENING_PATCHES } from "./detour-hardening-patches.mjs";
import { EXISTING_CUSTOMER_FIX_PATCHES } from "./existing-customer-fix-patches.mjs";
import { ECHO_GUARD_PATCHES } from "./echo-guard-patches.mjs";

const baseLauncherPath = new URL("./start-with-call-end.mjs", import.meta.url);
const runtimeLauncherPath = new URL("./.tom-launcher-regression-runtime.mjs", import.meta.url);
let launcher = await readFile(baseLauncherPath, "utf8");

const anchor = 'await writeFile(runtimePath, source, "utf8");';
if (!launcher.includes(anchor)) {
  throw new Error("Correctif non-régression impossible : ancre launcher introuvable");
}

launcher = launcher.replace(
  anchor,
  RUNTIME_PATCHES +
    CONVERSATION_START_PATCHES +
    DETOUR_HARDENING_PATCHES +
    EXISTING_CUSTOMER_FIX_PATCHES +
    ECHO_GUARD_PATCHES +
    anchor,
);
await writeFile(runtimeLauncherPath, launcher, "utf8");
await import(runtimeLauncherPath.href + `?v=${Date.now()}`);
