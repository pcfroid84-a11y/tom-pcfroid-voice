import { readFile, writeFile } from "node:fs/promises";
import { CLEAN_V1_PATCHES } from "./clean-v1-runtime-patches.mjs";

const baseLauncherPath = new URL("./start-with-call-end.mjs", import.meta.url);
const runtimeLauncherPath = new URL("./.tom-clean-v1-launcher.mjs", import.meta.url);
let launcher = await readFile(baseLauncherPath, "utf8");

const anchor = 'await writeFile(runtimePath, source, "utf8");';
if (!launcher.includes(anchor)) {
  throw new Error("Tom V1 propre : ancre launcher introuvable");
}

launcher = launcher.replace(anchor, CLEAN_V1_PATCHES + anchor);
await writeFile(runtimeLauncherPath, launcher, "utf8");
await import(runtimeLauncherPath.href + `?v=${Date.now()}`);
