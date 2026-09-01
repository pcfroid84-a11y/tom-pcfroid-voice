import { readFile, writeFile } from "node:fs/promises";

const baseLauncherPath = new URL("./start-with-call-end.mjs", import.meta.url);
const runtimeLauncherPath = new URL("./.tom-launcher-regression-runtime.mjs", import.meta.url);
let launcher = await readFile(baseLauncherPath, "utf8");

const anchor = 'await writeFile(runtimePath, source, "utf8");';
if (!launcher.includes(anchor)) {
  throw new Error("Correctif non-régression impossible : ancre launcher introuvable");
}

const regressionPatch = `
replaceOnce(
\`        const responseDiagnostics = buildResponseDiagnostics(event.response);\`,
\`        const responseDiagnostics = buildResponseDiagnostics(event.response);

        // NON-RÉGRESSION : après la dernière question/dernier complément,
        // la réponse de Tom doit toujours entraîner le raccrochage, même si
        // l'événement response.output_audio_transcript.done n'arrive pas.
        if (
          state.flowStage === "final_followup" &&
          event.response?.status === "completed" &&
          state.identityKnown &&
          !state.closingStarted
        ) {
          state.closingStarted = true;
          state.conversationModeEnabled = false;
          state.pendingHangup = true;
          state.identityRecoveryNeeded = false;
          app.log.info(
            "Raccrochage de non-régression armé après la dernière réponse"
          );
        }\`,
"raccrochage fiable après final_followup"
);

`;

launcher = launcher.replace(anchor, regressionPatch + anchor);
await writeFile(runtimeLauncherPath, launcher, "utf8");
await import(runtimeLauncherPath.href + `?v=${Date.now()}`);
