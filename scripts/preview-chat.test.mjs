import test from "node:test";
import assert from "node:assert/strict";
import { previewAnswer } from "./preview-chat.mjs";

test("preview chat distinguishes explanations from unavailable research", () => {
  assert.match(previewAnswer("Explain the power curve"), /power curve/i);
  assert.match(previewAnswer("Find research on direct-drive turbines"), /preview/i);
  assert.match(previewAnswer("Find a wind-turbine patent"), /no research database/i);
});
