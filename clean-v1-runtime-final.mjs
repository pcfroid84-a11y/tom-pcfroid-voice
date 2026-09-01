import { CLEAN_V1_PATCHES } from "./clean-v1-runtime-patches.mjs";

const looseAnchor = `  if (state.flowStage === "qualification" &&\n  assistantText.includes("?")\n) {\n  state.qualificationQuestionCount += 1;`;

const stableServerAnchor = `       if (\n  state.flowStage === "qualification" &&\n  assistantText.includes("?")\n) {\n  state.qualificationQuestionCount += 1;`;

const encodedLooseAnchor = JSON.stringify(looseAnchor);
const encodedStableServerAnchor = JSON.stringify(stableServerAnchor);

if (!CLEAN_V1_PATCHES.includes(encodedLooseAnchor)) {
  throw new Error("Tom V1 propre : ancre qualification à corriger introuvable");
}

export const CLEAN_V1_FINAL_PATCHES = CLEAN_V1_PATCHES.replace(
  encodedLooseAnchor,
  encodedStableServerAnchor,
);
